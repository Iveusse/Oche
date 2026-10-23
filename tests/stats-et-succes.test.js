import { describe, it, expect } from 'vitest';
import { playerStats, headToHead } from '../src/engine/stats.js';
import { computeAchievements, EXPLOIT_LIST } from '../src/engine/achievements.js';
import { computeWeekly, weekStartOf } from '../src/lib/weekly.js';
import { D, miss } from './helpers.js';

describe('stats', () => {
  it('moyenne et checkout', () => {
    const g = {
      id: 'g', mode: 'x01', settings: { start: 101, out: 'double' }, player_ids: ['a', 'b'], created_at: new Date().toISOString(),
      data: { legs: [{ order: ['a', 'b'], darts: [D(20, 3), D(1, 1), D(20, 1), miss, miss, miss, D(10, 1), D(5, 2)], validated: 3, done: true, ranking: ['a', 'b'] }] },
    };
    const s = playerStats([g], 'a');
    expect(s.avg).toBeCloseTo((101 / 5) * 3);
    expect(s.coHits).toBe(1);
    expect(s.legsWon).toBe(1);
  });
});

describe('Mur de la cuisine', () => {
  const g = (mode, settings, darts) => ({ id: 'g', mode, settings, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z',
    data: { legs: [{ order: ['a'], darts, validated: 9, done: true, ranking: ['a'], finishedAt: '2026-01-01T20:05:00Z' }] } });
  it('au Shanghai, « Raté » (bouton) ne compte pas, un vrai hors cible si', () => {
    const btn = computeAchievements([g('shanghai', { from: 1, to: 1 }, [D(0, 0), D(0, 0), D(0, 0)])], 'a').__counters;
    expect(btn.misses).toBe(0);
    expect(btn.threeMiss).toBe(false);
    const board = computeAchievements([g('shanghai', { from: 1, to: 1 }, [{ seg: 0, mult: 0, x: 0, y: -1.2 }, D(0, 0), D(0, 0)])], 'a').__counters;
    expect(board.misses).toBe(1);
    const x01 = computeAchievements([g('x01', { start: 301 }, [D(0, 0), D(0, 0), D(0, 0)])], 'a').__counters;
    expect(x01.misses).toBe(3);
  });
});

describe('Succès cachés (8 nouveaux)', () => {
  const d = (seg, mult) => ({ seg, mult });
  const M = d(0, 0);
  const g = (id, darts, extra = {}, ids = ['a', 'b'], ranking = ['a', 'b'], at = '2026-01-01T20:00:00Z', mode = 'x01', settings = { start: 301, in: 'single', out: 'double' }) => ({
    id, mode, settings, player_ids: ids, status: 'finished', created_at: at,
    data: { legs: [{ order: ids, darts, validated: 999, done: true, ranking, finishedAt: at, ...extra }] } });
  const un = (games, id) => computeAchievements(games, 'a')[id];
  it('trio infernal : 3 fois le même segment', () => {
    expect(un([g('1', [d(19, 3), d(19, 3), d(19, 3)])], 'hidden-trio').unlocked).toBeTruthy();
    expect(un([g('1', [d(19, 3), d(19, 3), d(19, 2)])], 'hidden-trio').unlocked).toBeNull();
  });
  it('minuit pile', () => {
    const at = new Date(2026, 0, 1, 23, 59, 30).toISOString();
    expect(un([g('1', [d(20, 1)], {}, ['a', 'b'], ['a', 'b'], at)], 'hidden-midnight').unlocked).toBeTruthy();
    expect(un([g('1', [d(20, 1)], {}, ['a', 'b'], ['a', 'b'], new Date(2026, 0, 1, 21, 0).toISOString())], 'hidden-midnight').unlocked).toBeNull();
  });
  it('serviette : 42 minutes de jeu actif', () => {
    expect(un([g('1', [d(20, 1)], { activeMs: 42 * 60000 + 5000 })], 'hidden-towel').unlocked).toBeTruthy();
    expect(un([g('1', [d(20, 1)], { activeMs: 30 * 60000 })], 'hidden-towel').unlocked).toBeNull();
  });
  it('retour de flamme : départ raté puis victoire, avec le lien vers la partie', () => {
    // a : 3 ratés, b : 20 20 20 ; puis a finit... on simule juste le classement (a gagne)
    const r = un([g('G1', [M, M, M, d(1, 1), d(1, 1), d(1, 1)])], 'hidden-comeback');
    expect(r.unlocked).toBeTruthy();
    expect(r.game).toBe('G1');
    expect(un([g('G1', [d(20, 1), M, M, d(1, 1), d(1, 1), d(1, 1)])], 'hidden-comeback').unlocked).toBeNull();
  });
  it('bon perdant : 5 legs perdus d\'affilée', () => {
    const lost = (i) => g(`L${i}`, [d(1, 1)], {}, ['a', 'b'], ['b', 'a'], `2026-01-0${i + 1}T20:00:00Z`);
    expect(un([1, 2, 3, 4, 5].map(lost), 'hidden-goodloser').unlocked).toBeTruthy();
    expect(un([1, 2, 3, 4].map(lost), 'hidden-goodloser').unlocked).toBeNull();
  });
  it('élève modèle : battre tous les adversaires', () => {
    const w = (id, opp) => g(id, [d(1, 1)], {}, ['a', opp], ['a', opp]);
    const games = [w('1', 'b'), g('2', [d(1, 1)], {}, ['a', 'c'], ['c', 'a'])];
    expect(un(games, 'hidden-everyone').unlocked).toBeNull();
    expect(un([...games, w('3', 'c')], 'hidden-everyone').unlocked).toBeTruthy();
  });
  it('bull, bull : deux bulls de part et d\'autre du tour adverse', () => {
    const B = d(25, 2);
    expect(un([g('1', [M, M, B, M, M, M, B, M, M])], 'hidden-bullbull').unlocked).toBeTruthy();
    expect(un([g('1', [M, M, B, M, M, M, M, B, M])], 'hidden-bullbull').unlocked).toBeNull();
  });
  it('presque : 3 fois à 1 point du finish le même jour', () => {
    const bust1 = (i) => g(`P${i}`, [d(20, 3), d(20, 3), d(20, 3), M, M, M, d(20, 3), d(20, 3)], {}, ['a', 'b'], ['a', 'b'], `2026-01-01T${10 + i}:00:00Z`);
    expect(un([1, 2, 3].map(bust1), 'hidden-almost').unlocked).toBeTruthy();
    expect(un([1, 2].map(bust1), 'hidden-almost').unlocked).toBeNull();
  });
  it('les succès cachés donnent leur explication complète', () => {
    for (const a of EXPLOIT_LIST.filter((x) => x.hidden)) expect(a.desc.length).toBeGreaterThan(30);
  });
});

describe('Palmarès de la semaine et face à face', () => {
  const mk = (id, ids, ranking, darts, at, mode = 'x01') => ({ id, mode, settings: { start: 301, in: 'single', out: 'single' }, player_ids: ids, status: 'finished', created_at: at,
    data: { legs: [{ order: ids, darts, validated: 999, done: true, ranking, finishedAt: at }] } });
  const now = new Date();
  const at = new Date(weekStartOf(now).getTime() + 3600000).toISOString();
  const players = [{ id: 'a', name: 'Yves', color: '#fff' }, { id: 'b', name: 'Nico', color: '#000' }];
  it('rien si aucune partie cette semaine', () => { expect(computeWeekly([], players)).toBeNull(); });
  it('décerne un roi et compte les legs', () => {
    const gs = [mk('1', ['a', 'b'], ['a', 'b'], [], at), mk('2', ['a', 'b'], ['a', 'b'], [], at), mk('3', ['a', 'b'], ['b', 'a'], [], at)];
    const w = computeWeekly(gs, players);
    expect(w.legs).toBe(3);
    expect(w.highlights[0][0]).toMatch(/Roi de la semaine/);
    expect(w.highlights[0][2]).toBe('Yves');
  });
  it('face à face : par mode, derniers legs, série', () => {
    const gs = [mk('1', ['a', 'b'], ['a', 'b'], [], '2026-01-01T20:00:00Z'), mk('2', ['a', 'b'], ['b', 'a'], [], '2026-01-02T20:00:00Z', 'cricket'), mk('3', ['a', 'b'], ['b', 'a'], [], '2026-01-03T20:00:00Z')];
    const h = headToHead(gs, 'a', 'b');
    expect(h.recent).toEqual(['a', 'b', 'b']);
    expect(h.streak).toEqual({ who: 'b', n: 2 });
    expect(h.byMode.cricket).toEqual({ a: 0, b: 1 });
  });
});

