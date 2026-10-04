import { describe, it, expect } from 'vitest';
import { hitTest, zoneCenter, suggestCheckout, dartLabel, ORDER } from '../lib/board.js';
import { runLeg } from './runner.js';
import { playerStats } from './stats.js';

const D = (seg, mult) => ({ seg, mult });
const miss = D(0, 0);
const leg = (order, darts, extra = {}) => ({ order, darts, validated: 0, continueForPlaces: null, ...extra });

describe('board', () => {
  it('hitTest retrouve chaque zone depuis son centre', () => {
    for (const n of ORDER) for (const m of [1, 2, 3]) {
      const c = zoneCenter(n, m);
      expect(hitTest(c.x, c.y)).toEqual({ seg: n, mult: m });
    }
    expect(hitTest(0, 0)).toEqual({ seg: 25, mult: 2 });
    expect(hitTest(0, -0.07)).toEqual({ seg: 25, mult: 1 });
    expect(hitTest(0, -1.1)).toEqual({ seg: 0, mult: 0 });
  });
  it('suggère des finishs', () => {
    expect(suggestCheckout(170).map(dartLabel)).toEqual(['T20', 'T20', 'Bull']);
    expect(suggestCheckout(40).map(dartLabel)).toEqual(['D20']);
    expect(suggestCheckout(169)).toBeNull();
    expect(suggestCheckout(1)).toBeNull();
    expect(suggestCheckout(121, 'single').map(dartLabel)).toEqual(['T20', 'T20', '1']);
    expect(suggestCheckout(61, 'single', 2).map(dartLabel)).toEqual(['T20', '1']);
    expect(suggestCheckout(100, 'double', 2).map(dartLabel)).toEqual(['T20', 'D20']);
  });
});

describe('x01', () => {
  const s = { start: 101, in: 'single', out: 'double' };
  it('compte, bust et finit', () => {
    let r = runLeg('x01', s, leg(['a', 'b'], [D(20, 3), D(1, 1), D(20, 1)]));
    expect(r.ps[0].rem).toBe(20);
    expect(r.cur).toBe(1);
    // b fait bust (dépasse)
    r = runLeg('x01', s, leg(['a', 'b'], [D(20, 3), D(1, 1), D(20, 1), D(20, 3), D(20, 2)]));
    expect(r.ps[1].rem).toBe(101);
    expect(r.turns[1].bust).toBe(true);
    expect(r.cur).toBe(0);
    // a finit sur D10
    r = runLeg('x01', s, leg(['a', 'b'], [D(20, 3), D(1, 1), D(20, 1), D(20, 3), D(20, 2), D(10, 2)]));
    expect(r.over).toBe(true);
    expect(r.ranking).toEqual(['a', 'b']);
  });
  it('bust si on finit sans double en double out', () => {
    const r = runLeg('x01', { start: 20, out: 'double' }, leg(['a', 'b'], [D(20, 1)]));
    expect(r.turns[0].bust).toBe(true);
    expect(r.ps[0].rem).toBe(20);
  });
  it('double in', () => {
    const r = runLeg('x01', { start: 501, in: 'double' }, leg(['a'], [D(20, 3), D(5, 2), D(20, 1)]));
    expect(r.ps[0].rem).toBe(501 - 10 - 20);
  });
  it('3 joueurs : décision de continuer', () => {
    const darts = [D(20, 1), miss, miss, miss, miss, miss]; // start 20, a finit direct en simple out
    let r = runLeg('x01', { start: 20 }, leg(['a', 'b', 'c'], darts.slice(0, 1)));
    expect(r.needDecision).toBe(true);
    expect(r.over).toBe(false);
    r = runLeg('x01', { start: 20 }, leg(['a', 'b', 'c'], darts.slice(0, 1), { continueForPlaces: false }));
    expect(r.over).toBe(true);
    r = runLeg('x01', { start: 20 }, leg(['a', 'b', 'c'], [D(20, 1), miss, miss, miss, D(5, 1)], { continueForPlaces: true }));
    expect(r.cur).toBe(2);
    expect(r.over).toBe(false);
    r = runLeg('x01', { start: 20 }, leg(['a', 'b', 'c'], [D(20, 1), miss, miss, miss, D(10, 2)], { continueForPlaces: true }));
    expect(r.over).toBe(true);
    expect(r.ranking).toEqual(['a', 'c', 'b']);
  });
});

describe('atc', () => {
  it('zones autorisées et sauts', () => {
    const l = leg(['a'], [D(1, 3), D(1, 1), D(2, 2)], { targets: [1, 2, 3] });
    let r = runLeg('atc', { zones: ['S', 'D'] }, l);
    expect(r.ps[0].pos).toBe(2);
    r = runLeg('atc', { zones: ['S', 'D', 'T'], skip: true }, leg(['a'], [D(1, 3)], { targets: [1, 2, 3, 4, 5] }));
    expect(r.ps[0].pos).toBe(3);
  });
});

describe('shanghai', () => {
  it('points et shanghai immédiat', () => {
    const s = { from: 1, to: 2, instantWin: true };
    let r = runLeg('shanghai', s, leg(['a', 'b'], [D(1, 1), D(1, 3), miss, D(1, 2), miss, miss]));
    expect(r.ps[0].pts).toBe(4);
    expect(r.turns[2]).toBeUndefined();
    r = runLeg('shanghai', s, leg(['a', 'b'], [D(1, 1), D(1, 2), D(1, 3)]));
    expect(r.over).toBe(true);
    expect(r.ranking[0]).toBe('a');
    // partie complète
    r = runLeg('shanghai', { from: 1, to: 1 }, leg(['a', 'b'], [D(1, 1), miss, miss, D(1, 3), miss, miss]));
    expect(r.over).toBe(true);
    expect(r.ranking).toEqual(['b', 'a']);
  });
});

describe('cricket', () => {
  it('ferme, marque, gagne', () => {
    const closeAll = [D(20, 3), D(19, 3), D(18, 3)];
    const rest = [D(17, 3), D(16, 3), D(15, 3)];
    const b = [miss, miss, miss];
    const r = runLeg('cricket', {}, leg(['a', 'b'], [...closeAll, ...b, ...rest, ...b, D(25, 2), D(25, 1)]));
    expect(r.over).toBe(true);
    expect(r.ranking[0]).toBe('a');
    const r2 = runLeg('cricket', {}, leg(['a', 'b'], [D(20, 3), D(20, 3)]));
    expect(r2.ps[0].pts).toBe(60);
  });
});

describe('entraînements', () => {
  it('checkout 41-100', () => {
    const r = runLeg('train-checkout', {}, leg(['a'], [D(1, 1), D(20, 2), miss, miss, miss], { targets: [41, 60] }));
    expect(r.ps[0].succ).toBe(1);
    expect(r.ps[0].idx).toBe(2);
    expect(r.over).toBe(true);
  });
  it('focus 20 finit à 99', () => {
    const r = runLeg('train-focus20', {}, leg(['a'], Array(99).fill(D(20, 1))));
    expect(r.over).toBe(true);
    expect(r.ps[0].pts).toBe(1980);
  });
});

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

describe('handicap', () => {
  it('chaque joueur part de son propre score', () => {
    const s = { start: 501, in: 'single', out: 'single', starts: { a: 301, b: 501 } };
    const r = runLeg('x01', s, leg(['a', 'b'], [D(20, 3), D(20, 3), D(20, 3), D(20, 1)]));
    expect(r.ps[0].rem).toBe(121);
    expect(r.ps[1].rem).toBe(481);
  });
});

import { parseSpeech } from '../lib/voice.js';
describe('saisie vocale', () => {
  const p = (t, o) => parseSpeech(t, o).darts.map((d) => `${d.mult}x${d.seg}`).join(' ');
  it('comprend les formulations courantes', () => {
    expect(p('triple vingt, cinq, raté')).toBe('3x20 1x5 0x0');
    expect(p('Triple 20 double 16 bull')).toBe('3x20 2x16 2x25');
    expect(p('T20 T19 D12')).toBe('3x20 3x19 2x12');
    expect(p('dix-huit, hors cible, vingt-cinq')).toBe('1x18 0x0 1x25');
    expect(p('simple bull')).toBe('1x25');
    expect(p('double dix sept')).toBe('2x17');
    expect(p('simple double triple', { target: 4 })).toBe('1x4 2x4 3x4');
    expect(parseSpeech('valider').cmd).toBe('validate');
    expect(parseSpeech('annuler').cmd).toBe('undo');
    expect(p("d'accord 5")).toBe('1x5');
  });
});

import { shanghaiNeed, shanghaiDecided } from '../screens/Play.jsx';
describe('Shanghai : rester en vie', () => {
  const s = { from: 1, to: 3, instantWin: true };
  // état minimal : points, tours déjà joués par joueur, tour en cours
  const R = (a, b, doneA, doneB, cur = null) => ({
    ps: [{ pts: a }, { pts: b }],
    turns: [...Array(doneA).fill({ p: 0, darts: [] }), ...Array(doneB).fill({ p: 1, darts: [] })],
    current: cur,
  });
  it('dit simple / double / triple / Shanghai', () => {
    // dernière manche (le 3), 3 de retard -> un simple ; 6 -> un double ; 9 -> un triple
    expect(shanghaiNeed(s, R(12, 15, 2, 3), 0)).toMatchObject({ kind: 'need', text: 'un simple' });
    expect(shanghaiNeed(s, R(9, 15, 2, 3), 0)).toMatchObject({ kind: 'need', text: 'un double' });
    expect(shanghaiNeed(s, R(6, 15, 2, 3), 0)).toMatchObject({ kind: 'need', text: 'un triple' });
    expect(shanghaiNeed(s, R(0, 18, 2, 3), 0)).toMatchObject({ kind: 'need', text: 'un Shanghai (ou 2 triples)' });
    // 40 de retard, max 27 sur le 3 : seul un Shanghai
    expect(shanghaiNeed(s, R(0, 40, 2, 3), 0).kind).toBe('shanghai');
    expect(shanghaiNeed({ ...s, instantWin: false }, R(0, 40, 2, 3), 0).kind).toBe('dead');
    // 1 fléchette restante, un simple 3 déjà touché, besoin de 9 : Shanghai encore possible ? non (manquent D et T)
    expect(shanghaiNeed(s, R(3, 15, 2, 3, { p: 0, darts: [{ hit: true, mult: 1 }, { hit: false, mult: 0 }] }), 0).kind).toBe('dead');
    expect(shanghaiNeed(s, R(30, 20, 1, 1), 0)).toMatchObject({ kind: 'lead', gap: 10 });
  });
  it('voit quand plus personne ne peut rattraper le premier', () => {
    expect(shanghaiDecided(s, R(0, 40, 2, 3))).toEqual({ leader: 1, shanghai: true });
    // le perdant a fini tous ses tours : plus aucun Shanghai adverse possible
    expect(shanghaiDecided(s, R(0, 40, 3, 3))).toEqual({ leader: 1, shanghai: false });
    expect(shanghaiDecided(s, R(20, 40, 2, 3))).toBeNull();
  });
});

import { computeAchievements, EXPLOIT_LIST } from './achievements.js';
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

import { weakest } from './coach.js';
describe('coach : points faibles', () => {
  it('repère un double nettement raté, ignore le bull et le hasard', () => {
    const p = {};
    for (const n of [20, 16, 8, 10, 12, 18]) p[n] = { darts: 60, hits: 9 };
    p[16] = { darts: 60, hits: 1 };
    p[25] = { darts: 40, hits: 0 };
    expect(weakest(p, 12, 0.6).weak.map((w) => w.n)).toEqual([16]);
    p[16] = { darts: 60, hits: 7 }; // un peu en dessous : hasard
    expect(weakest(p, 12, 0.6)).toBeNull();
  });
});

describe('Around the Clock ciblé (coach)', () => {
  it('se termine seul et ne débloque aucun succès d\'ATC', () => {
    const settings = { zones: ['S', 'D', 'T'], nums: [8, 4] };
    const leg0 = { order: ['a'], targets: [8, 4], darts: [D(8, 1), D(4, 1)], validated: 9, continueForPlaces: null };
    const r = runLeg('train-atc', settings, leg0);
    expect(r.over).toBe(true);
    const g = { id: 'g', mode: 'train-atc', settings, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z', data: { legs: [{ ...leg0, done: true, ranking: ['a'], finishedAt: '2026-01-01T20:01:00Z' }] } };
    const c = computeAchievements([g], 'a').__counters;
    expect(c.bestAtc).toBeNull();
    expect(c.byMode.atc).toBe(0);
    // ancien format (mode atc + numéros choisis) : pas de record d'ATC non plus
    const old = computeAchievements([{ ...g, mode: 'atc' }], 'a').__counters;
    expect(old.bestAtc).toBeNull();
  });
});

describe('Around the Clock complet en entraînement', () => {
  it('compte pour les records d\'ATC s\'il fait les 20 numéros, sans sauts', () => {
    const targets = Array.from({ length: 20 }, (_, i) => i + 1);
    const mk = (settings) => ({ id: 'g', mode: 'train-atc', settings, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z',
      data: { legs: [{ order: ['a'], targets, darts: targets.map((n) => D(n, 1)), validated: 99, done: true, ranking: ['a'], finishedAt: '2026-01-01T20:05:00Z' }] } });
    expect(computeAchievements([mk({ zones: ['S', 'D', 'T'] })], 'a').__counters.bestAtc).toBe(20);
    expect(computeAchievements([mk({ zones: ['S', 'D', 'T'], skip: true })], 'a').__counters.bestAtc).toBeNull();
  });
});

import { roastTurn, setTrashOn, praiseTurn, resetRoast } from '../lib/roast.js';
describe('Mode vanne', () => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  const t = (darts, extra = {}) => ({ darts, ...extra });
  const m = { mult: 0, seg: 0 };
  it('silencieux quand désactivé', () => { setTrashOn(false); expect(roastTurn('x01', t([m, m, m]), 'Nico', 0)).toBeNull(); });
  it('vanne sur tour raté, 42 et bust', () => {
    setTrashOn(true);
    expect(roastTurn('x01', t([m, m, m]), 'Nico', 0)).toMatch(/Nico/);
    expect(roastTurn('x01', t([{ mult: 1, seg: 20 }, m, m], { bust: true }), 'Nico', 20)).toMatch(/Nico/);
    expect(roastTurn('x01', t([{ mult: 3, seg: 20 }, { mult: 3, seg: 20 }, { mult: 3, seg: 20 }]), 'Nico', 180)).toBeNull();
    setTrashOn(false);
  });
});

import { resetRoast } from '../lib/roast.js';
describe('Mode vanne : stock', () => {
  it('jamais deux fois la même pique dans un leg, puis silence', () => {
    const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: () => {} };
    setTrashOn(true);
    const m = { mult: 0, seg: 0 }; const h = { mult: 1, seg: 20 };
    const got = Array.from({ length: 60 }, () => roastTurn('x01', { darts: [h, h, m] }, 'Nico', 40)).filter(Boolean);
    expect(got.length).toBeGreaterThan(50);
    expect(got.length).toBeLessThan(60); // stock fini : le reste est silencieux
    expect(new Set(got).size).toBe(got.length);
    resetRoast();
    expect(roastTurn('x01', { darts: [h, h, m] }, 'Nico', 40)).not.toBeNull();
    setTrashOn(false);
  });
  it('Shanghai et modes à un seul numéro : pas de vanne pour 1 ou 2 ratés, mais oui pour 3', () => {
    setTrashOn(true);
    const m = { mult: 0, seg: 0, hit: false }; const h = { mult: 1, seg: 7, hit: true };
    for (const mode of ['shanghai', 'atc', 'train-atc']) {
      expect(roastTurn(mode, { darts: [h, m, m] }, 'Nico', 7)).toBeNull();
      expect(roastTurn(mode, { darts: [h, h, m] }, 'Nico', 14)).toBeNull();
      expect(roastTurn(mode, { darts: [m, m, m] }, 'Nico', 0)).not.toBeNull();
    }
    setTrashOn(false);
  });
});

import { numberQuip } from '../lib/roast.js';
describe('Clins d\'oeil 42 / 31 / 44 / 29 / 28', () => {
  it('une phrase pour chaque score, jamais sur un bust ni hors X01/Shanghai', () => {
    for (const n of [42, 31, 44, 29, 28]) { resetRoast(); expect(numberQuip('x01', { darts: [] }, n)).toBeTruthy(); }
    resetRoast();
    expect(numberQuip('x01', { darts: [], bust: true }, 42)).toBeNull();
    expect(numberQuip('cricket', { darts: [] }, 42)).toBeNull();
    expect(numberQuip('x01', { darts: [] }, 40)).toBeNull();
  });
  it('succès caché du 42', () => {
    const g = (pts) => ({ id: 'g' + pts, mode: 'x01', settings: { start: 301, in: 'single', out: 'double' }, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z',
      data: { legs: [{ order: ['a'], darts: pts, validated: 3, done: true, ranking: ['a'], finishedAt: '2026-01-01T20:05:00Z' }] } });
    const d = (seg, mult) => ({ seg, mult });
    expect(computeAchievements([g([d(20, 1), d(20, 1), d(2, 1)])], 'a')['answer-42'].unlocked).toBeTruthy();
    expect(computeAchievements([g([d(20, 1), d(20, 1), d(3, 1)])], 'a')['answer-42'].unlocked).toBeNull();
    // 31 = 20 + 10 + 1
    const r31 = computeAchievements([g([d(20, 1), d(10, 1), d(1, 1)])], 'a');
    expect(r31['hidden-31'].unlocked).toBeTruthy();
    expect(r31['hidden-44'].unlocked).toBeNull();
  });
});

import { computeWeekly, weekStartOf } from '../lib/weekly.js';
import { headToHead } from './stats.js';
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

import { runLeg } from './runner.js';
import { killerNumbers } from './modes.js';
describe('Baseball', () => {
  const leg = (darts) => ({ order: ['a', 'b'], darts, validated: 0 });
  it('la manche N vaut le numéro N, simple 1 / double 2 / triple 3', () => {
    // manche 1 : a T1 (3), S1... b rate ; manche 2 : a D2 (2)
    const r = runLeg('baseball', {}, leg([D(1, 3), D(5, 1), D(0, 0), D(0, 0), D(0, 0), D(0, 0), D(2, 2), D(2, 1), D(2, 1)]));
    expect(r.ps[0].pts).toBe(3 + 2 + 1 + 1);
    expect(r.ps[1].pts).toBe(0);
    expect(r.turns[0].darts[0]).toMatchObject({ target: 1, hit: true, pts: 3 });
  });
  it('9 manches puis fin', () => {
    const many = Array.from({ length: 9 * 2 * 3 }, () => D(0, 0));
    const r = runLeg('baseball', {}, leg(many));
    expect(r.over).toBe(true);
    expect(r.turns.length).toBe(18);
  });
});
describe('Killer', () => {
  const nums = { a: 20, b: 19, c: 18 };
  const leg = (darts, order = ['a', 'b', 'c']) => ({ order, darts, validated: 0, killerNums: nums });
  const M = D(0, 0);
  it('on devient killer avec le double de son numéro, pas avec un simple', () => {
    const r = runLeg('killer', {}, leg([D(20, 1), D(20, 3), D(20, 2)]));
    expect(r.ps[0].killer).toBe(true);
    expect(r.turns[0].darts[2].becameKiller).toBe(true);
  });
  it('un killer retire des vies aux autres, puis les élimine', () => {
    // a devient killer, b/c ratent ; a double 19 x3 -> b éliminé
    const seq = [D(20, 2), M, M, M, M, M, M, M, M, D(19, 2), D(19, 2), D(19, 2)];
    const r = runLeg('killer', {}, leg(seq));
    expect(r.ps[1].out).toBe(true);
    expect(r.ps[0].kills).toBe(1);
    expect(r.over).toBe(false); // c est encore en vie
    // tour suivant : c joue (b est sauté), puis a élimine c
    const seq2 = [...seq, M, M, M, D(18, 2), D(18, 2), D(18, 2)];
    const r2 = runLeg('killer', {}, leg(seq2));
    expect(r2.over).toBe(true);
    expect(r2.ranking[0]).toBe('a');
    expect(r2.ranking[1]).toBe('c');
    expect(r2.ranking[2]).toBe('b'); // éliminé en premier = dernier
  });
  it('un joueur qui n\'est pas killer ne tue personne', () => {
    const r = runLeg('killer', {}, leg([M, M, M, D(20, 2), D(20, 2), D(20, 2)]));
    expect(r.ps[0].lives).toBe(3); // b n'est pas killer (il faut le 19 double)
  });
  it('numéros distincts', () => {
    const n = killerNumbers(['a', 'b', 'c', 'd']);
    expect(new Set(Object.values(n)).size).toBe(4);
  });
});

import { trainingResult } from './stats.js';
import { coachAdvice } from './coach.js';
describe('Entraînements Baseball / Killer et succès des nouveaux modes', () => {
  const tg = (mode, settings, darts, extra = {}) => ({ id: 'T', mode, settings, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z', data: { legs: [{ order: ['a'], darts, validated: 999, num: 20, done: true, ranking: ['a'], ...extra }] } });
  it('Baseball solo : 9 manches, résultat en points', () => {
    const darts = Array.from({ length: 27 }, (_, i) => (i % 3 === 0 ? D(Math.floor(i / 3) + 1, 3) : D(0, 0)));
    const r = trainingResult(tg('train-baseball', {}, darts));
    expect(r).toMatchObject({ value: 27, better: 'high' });
  });
  it('Doubles de Killer : 30 fléchettes, touches sur le double du numéro', () => {
    const darts = Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? D(20, 2) : D(20, 1)));
    const r = trainingResult(tg('train-killer', { num: 20 }, darts));
    expect(r).toMatchObject({ value: 6, label: '6 / 30' });
  });
  it('succès Baseball : coup de circuit, sans faute, bon match', () => {
    const darts = [];
    for (let n = 1; n <= 9; n++) { darts.push(D(n, 3), D(n, 3), D(n, 3)); }
    const g = { id: 'B', mode: 'baseball', settings: {}, player_ids: ['a'], status: 'finished', created_at: '2026-01-01T20:00:00Z', data: { legs: [{ order: ['a'], darts, validated: 999, done: true, ranking: ['a'], finishedAt: '2026-01-01T20:10:00Z' }] } };
    const res = computeAchievements([g], 'a');
    expect(res['baseball-homerun'].unlocked).toBeTruthy();
    expect(res['baseball-clean'].unlocked).toBeTruthy();
    expect(res['baseball-50'].unlocked).toBeTruthy(); // 81 points
  });
  it('succès Killer : express, doublé mortel, intouchable', () => {
    const nums = { a: 20, b: 19, c: 18 };
    const seq = [D(20, 2), D(19, 2), D(0, 0), D(0, 0), D(0, 0), D(0, 0), // a killer d\'emblée
      D(19, 2), D(19, 2), D(0, 0), // b encore dans le jeu ? non : ordre a, b, c -> b
    ];
    void seq; void nums;
    // a: D20 (killer) ; b: rate x3 ; c: rate x3 ; a: D19 x3 (b out) ; c: rate x3 ; a: D18 x3 (c out) -> double kill non (2 tours)
    const M = D(0, 0);
    const darts = [D(20, 2), M, M, M, M, M, M, M, M, D(19, 2), D(19, 2), D(19, 2), M, M, M, D(18, 2), D(18, 2), D(18, 2)];
    const g = { id: 'K', mode: 'killer', settings: { lives: 3 }, player_ids: ['a', 'b', 'c'], status: 'finished', created_at: '2026-01-01T20:00:00Z', data: { legs: [{ order: ['a', 'b', 'c'], darts, killerNums: nums, validated: 999, done: true, ranking: ['a', 'c', 'b'], finishedAt: '2026-01-01T20:10:00Z' }] } };
    const res = computeAchievements([g], 'a');
    expect(res['killer-express'].unlocked).toBeTruthy();
    expect(res['killer-flawless'].unlocked).toBeTruthy();
    expect(res['killer-double'].unlocked).toBeNull();
    expect(res['killer-kills-1'].unlocked).toBeTruthy();
  });
  it('coach : propose des Doubles de Killer quand le double de départ est raté', () => {
    const M = D(0, 0);
    const legs = [];
    for (let i = 0; i < 3; i++) {
      // deux joueurs, personne ne devient killer en 30 fléchettes (a ne touche jamais son double)
      const darts = Array.from({ length: 30 }, () => M);
      legs.push({ id: `k${i}`, mode: 'killer', settings: { lives: 3 }, player_ids: ['a', 'b'], status: 'finished', created_at: new Date(Date.now() - i * 3600000).toISOString(),
        data: { legs: [{ order: ['a', 'b'], darts, killerNums: { a: 20, b: 19 }, validated: 999, done: true, ranking: ['a', 'b'], finishedAt: new Date().toISOString() }] } });
    }
    const c = coachAdvice(legs, 'a');
    expect(c.ready).toBe(true);
    expect(c.main.mode).toBe('Killer');
    expect(c.main.drill.kind).toBe('train-killer');
  });
});

describe('félicitations', () => {
  const T = (pts, extra = {}) => ({ darts: [{ mult: 1, seg: 20 }, { mult: 1, seg: 20 }, { mult: 1, seg: 20 }], ...extra });
  it('x01 : bien au-dessus de la moyenne', () => {
    resetRoast();
    expect(praiseTurn('x01', T(), 'Yves', 100, { avg: 45 })).toMatch(/Yves/);
    expect(praiseTurn('x01', T(), 'Yves', 60, { avg: 45 })).toBeNull();
    expect(praiseTurn('x01', T(), 'Yves', 100, { avg: 80 })).toBeNull();
    expect(praiseTurn('x01', T(0, { bust: true }), 'Yves', 100, { avg: 45 })).toBeNull();
  });
  it('cricket : marques', () => {
    resetRoast();
    const t = { darts: [{ marks: 3 }, { marks: 3 }, { marks: 2 }] };
    expect(praiseTurn('cricket', t, 'Yves', 0, { mpr: 2 })).toMatch(/Yves/);
    resetRoast();
    expect(praiseTurn('cricket', t, 'Yves', 0, { mpr: 5 })).toBeNull();
  });
});

describe('count up', () => {
  it('additionne les fléchettes sur 8 manches', async () => {
    const { runLeg } = await import('./runner.js');
    const T20 = { seg: 20, mult: 3 }; const M = { seg: 0, mult: 0 };
    const darts = [];
    for (let i = 0; i < 8; i++) darts.push(T20, { seg: 25, mult: 2 }, M, M, M, M);
    const leg = { order: ['a', 'b'], darts, validated: 16 };
    const r = runLeg('countup', { rounds: 8 }, leg);
    expect(r.ps[0].pts).toBe(8 * 110);
    expect(r.ps[1].pts).toBe(0);
    expect(r.over).toBe(true);
  });
  it('pas fini avant la dernière manche', async () => {
    const { runLeg } = await import('./runner.js');
    const r = runLeg('countup', { rounds: 8 }, { order: ['a'], darts: [{ seg: 20, mult: 1 }, { seg: 20, mult: 1 }, { seg: 20, mult: 1 }], validated: 0 });
    expect(r.over).toBe(false);
    expect(r.ps[0].pts).toBe(60);
  });
});

describe('hors cible', () => {
  it('deux taux : toute la cible vs tous modes', async () => {
    const { playerStats } = await import('./stats.js');
    const M = { seg: 0, mult: 0 }; const S = { seg: 20, mult: 1 };
    const mk = (mode, settings, darts) => ({ id: `${mode}-${Math.random()}`, mode, settings, player_ids: ['a'], status: 'finished', created_at: new Date().toISOString(), data: { legs: [{ order: ['a'], darts, validated: 0, done: true, ranking: ['a'] }], legsToWin: 1 } });
    const x = mk('x01', { start: 301, in: 'single', out: 'single' }, [S, M, S]);
    const sh = mk('shanghai', { from: 1, to: 7, instantWin: true }, [M, M, M]);
    const s = playerStats([x, sh], 'a');
    expect(s.wholeDarts).toBe(3);
    expect(s.wholeMiss).toBe(1);
    expect(s.totalDarts).toBe(6);
    expect(s.missDarts).toBe(4);
  });
});

describe('notes et niveau', async () => {
  const { gradeOfValue, scoreOf, gradeTraining, DRILL_GRADE, criteria } = await import('./grades.js');
  const { levelOf } = await import('./level.js');
  const { countupAdvanced, trainingAdvanced } = await import('./advanced.js');
  const tg = (mode, darts, extra = {}) => ({ id: mode, mode, settings: {}, player_ids: ['a'], status: 'finished', created_at: '2026-09-01T10:00:00Z', data: { legs: [{ order: ['a'], darts, validated: 0, done: true, ...extra }] } });

  it('lettres des exercices (fléchettes : moins = mieux)', () => {
    const c = DRILL_GRADE['train-doubles'];
    expect(gradeOfValue(c, 70)).toBe('S');
    expect(gradeOfValue(c, 130)).toBe('B');
    expect(gradeOfValue(c, 600)).toBe('E');
    expect(scoreOf(c, 80)).toBeCloseTo(90, 5);
    expect(scoreOf(c, 40)).toBe(100);
    expect(scoreOf(c, 900)).toBe(0);
  });
  it('lettres des finish', () => {
    const c = DRILL_GRADE['train-checkout'];
    expect([0, 1, 2, 3, 4, 5].map((v) => gradeOfValue(c, v))).toEqual(['E', 'D', 'C', 'B', 'A', 'S']);
  });
  it('score monotone', () => {
    const c = DRILL_GRADE['train-focus20'];
    let prev = -1;
    for (let v = 0; v <= 4000; v += 50) { const s = scoreOf(c, v); expect(s).toBeGreaterThanOrEqual(prev); prev = s; }
  });
  it('critères : une ligne par lettre, E en dernier', () => {
    const rows = criteria(DRILL_GRADE['train-killer']);
    expect(rows.map((r) => r.grade)).toEqual(['S', 'A', 'B', 'C', 'D', 'E']);
    expect(rows[0].text).toContain('8');
  });
  it('note d\'une séance de Killer avec ce qu\'il manque', () => {
    // 30 fléchettes, 3 doubles sur le 20 : C, il manque 1 pour le B
    const darts = Array.from({ length: 30 }, (_, i) => (i < 3 ? D(20, 2) : miss));
    const gr = gradeTraining(tg('train-killer', darts, { num: 20 }));
    expect(gr.grade).toBe('C');
    expect(gr.next.grade).toBe('B');
    expect(gr.next.text).toContain('1 doubles');
  });
  it('niveau vide sans données', () => {
    expect(levelOf([], 'a').score).toBeNull();
  });
  it('Count Up : points par volée et régularité', () => {
    const t = (n) => Array.from({ length: 3 }, () => D(n, 1));
    const darts = [...t(20), ...t(20), ...t(10), ...t(10), ...t(20), ...t(20), ...t(10), ...t(10)];
    const g = { id: 'c', mode: 'countup', settings: { rounds: 8 }, player_ids: ['a'], status: 'finished', created_at: '2026-09-01T10:00:00Z', data: { legs: [{ order: ['a'], darts, validated: 0, done: true, ranking: ['a'] }] } };
    const a = countupAdvanced([g], 'a');
    expect(a.legs).toBe(1);
    expect(a.turnAvg).toBe(45);
    expect(a.best).toBe(360);
    expect(a.high).toBe(60);
    expect(a.consistency).toBeCloseTo(1 - 15 / 45, 5);
  });
  it('analyse d\'entraînement : record et note par séance', () => {
    const darts = Array.from({ length: 30 }, (_, i) => (i < 5 ? D(20, 2) : miss));
    const a = trainingAdvanced([tg('train-killer', darts, { num: 20 })], 'a');
    expect(a['train-killer'].n).toBe(1);
    expect(a['train-killer'].best.value).toBe(5);
    expect(a['train-killer'].last.grade).toBe('B');
  });
});

describe('bilan du leg', async () => {
  const { legReport } = await import('./legreport.js');
  const { makeRng, makeSim } = await import('./sim.js');
  const sim = makeSim(makeRng(11));
  const mkGame = (id, sigma, t, mode = 'x01', settings = { start: 301, in: 'single', out: 'double' }) => {
    const leg = sim.play(mode, settings, ['a', 'b'], () => sigma);
    return { id, mode, settings, player_ids: ['a', 'b'], status: 'finished', created_at: new Date(t).toISOString(), data: { legs: [{ ...leg, done: true, finishedAt: new Date(t).toISOString() }], legsToWin: 1 } };
  };
  const hist = Array.from({ length: 12 }, (_, i) => mkGame('h' + i, 0.15, 1e12 + i * 1e6));
  it('bonne partie : sigma plus serré que l\'historique', () => {
    const g = mkGame('now', 0.07, 2e12);
    const r = legReport(g, hist, 'a');
    expect(r.enough).toBe(true);
    expect(r.rows[0].label).toBe('Moyenne 3 fléchettes');
    expect(r.rows[0].tone).toBe(1);
    expect(r.verdict).toBe('good');
  });
  it('mauvaise partie', () => {
    const r = legReport(mkGame('now2', 0.3, 2e12), hist, 'a');
    expect(r.verdict).toBe('bad');
  });
  it('pas assez d\'historique : pas de verdict', () => {
    const r = legReport(mkGame('now3', 0.15, 2e12), hist.slice(0, 1), 'a');
    expect(r.enough).toBe(false);
    expect(r.verdict).toBeNull();
    expect(r.rows.length).toBeGreaterThan(0);
  });
  it('ne compte pas la partie en cours dans la référence', () => {
    const g = mkGame('now4', 0.07, 2e12);
    const a = legReport(g, hist, 'a'); const b = legReport(g, [...hist, g], 'a');
    expect(b.refLegs).toBe(a.refLegs);
  });
  it('compte les legs précédents de la partie en cours, et donne une référence même en cas de défaite', () => {
    const g1 = mkGame('multi', 0.15, 2e12); const g2 = mkGame('multi2', 0.15, 2e12 + 1);
    const g = { ...g1, data: { ...g1.data, legs: [...g1.data.legs, ...g2.data.legs] } };
    const base = legReport({ ...g, data: { ...g.data, legs: [g.data.legs[1]] } }, hist, 'a').refLegs;
    const r = legReport(g, hist, 'a');
    expect(r.refLegs).toBe(base + 1);
    // un joueur qui perd le dernier leg a quand même la longueur habituelle d'un leg
    const loser = g.data.legs[1].ranking[0] === 'a' ? 'b' : 'a';
    const rl = legReport(g, hist, loser);
    const row = rl.rows.find((x) => x.label === 'Fléchettes lancées');
    expect(row.refShown).not.toBeNull();
    expect(row.refShown).not.toBe('-');
  });
  it('tous les modes produisent un bilan', () => {
    for (const [mode, s] of [['cricket', {}], ['countup', {}], ['shanghai', { from: 1, to: 7 }]]) {
      const h = Array.from({ length: 4 }, (_, i) => mkGame('m' + mode + i, 0.15, 1e12 + i * 1e6, mode, s));
      const r = legReport(mkGame('n' + mode, 0.1, 2e12, mode, s), h, 'a');
      expect(r.rows.length).toBeGreaterThan(1);
      expect(r.verdict).not.toBeNull();
    }
  });
});

import { x01Probs, balanceStarts, winProbs } from './winprob.js';
describe('winprob', () => {
  it('égalité = proche de 50 %, le plus fort favori', () => {
    const eq = x01Probs([{ score: 50, p: 0.15 }, { score: 50, p: 0.15 }], [501, 501], 'double', 3, 3000);
    expect(eq[0] + eq[1]).toBeCloseTo(1, 5);
    expect(Math.abs(eq[0] - 0.5)).toBeLessThan(0.12);
    const st = x01Probs([{ score: 70, p: 0.3 }, { score: 40, p: 0.08 }], [501, 501], 'double', 1, 3000);
    expect(st[0]).toBeGreaterThan(0.8);
  });
  it('refuse sans données', () => {
    const r = winProbs('x01', { start: 501, out: 'double' }, ['a', 'b'], [], 1);
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBe(2);
    expect(balanceStarts(['a', 'b'], { start: 501 }, [], 1)).toBe(null);
  });
});

import { weeklyPlan, nextGoal, levelHistory, weekStart } from './plan.js';
describe('plan', () => {
  it('semaine commence le lundi', () => {
    const d = new Date(weekStart(new Date('2026-10-04T14:00:00').getTime()));
    expect(d.getDay()).toBe(1); expect(d.getDate()).toBe(28);
  });
  it('sans données : 3 exercices à découvrir, pas d\'objectif', () => {
    const p = weeklyPlan([], 'x');
    expect(p.items.length).toBe(3); expect(p.items.every((i) => i.grade == null)).toBe(true);
    expect(p.goal).toBe(null); expect(p.total).toBe(5);
    expect(levelHistory([], 'x')).toEqual([]);
    expect(nextGoal(null)).toBe(null);
  });
});
