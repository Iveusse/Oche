import { describe, it, expect } from 'vitest';
import { runLeg } from '../src/engine/runner.js';
import { trainingResult } from '../src/engine/stats.js';
import { computeAchievements } from '../src/engine/achievements.js';
import { coachAdvice } from '../src/engine/coach.js';
import { levelPool, progressiveTargets, nextLevel, checkoutProfile, CO_LEVELS } from '../src/engine/checkout.js';
import { D, miss, leg } from './helpers.js';

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

describe('checkouts progressifs', () => {
  it('chaque niveau a un pool faisable en 3 fléchettes', () => {
    for (let n = 1; n <= 5; n++) { const p = levelPool(n); expect(p.length).toBeGreaterThan(10); expect(Math.min(...p)).toBeGreaterThanOrEqual(CO_LEVELS[n - 1].lo); }
    expect(levelPool(1)).toContain(40); expect(levelPool(1)).toContain(50); expect(levelPool(1)).not.toContain(41);
  });
  it('20 cibles, les finish ratés reviennent, niveau monte/descend', () => {
    const t = progressiveTargets(2, [37, 52, 61], () => 0.3);
    expect(t.length).toBe(20); expect(t).toContain(37); expect(t).toContain(52);
    expect(nextLevel(2, 0.6)).toBe(3); expect(nextLevel(2, 0.25)).toBe(1); expect(nextLevel(2, 0.4)).toBe(2); expect(nextLevel(5, 1)).toBe(5); expect(nextLevel(1, 0)).toBe(1);
    expect(checkoutProfile([], 'x').level).toBe(1);
  });
  it('le mode accepte les petites cibles', () => {
    const leg = { order: ['a'], darts: [{ seg: 1, mult: 2 }, { seg: 25, mult: 2 }], validated: 0, targets: [2, 50] };
    const r = runLeg('train-checkout', { level: 1 }, leg);
    expect(r.ps[0].succ).toBe(2);
  });
});

