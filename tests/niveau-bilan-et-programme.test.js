import { describe, it, expect } from 'vitest';
import { x01Probs, balanceStarts, winProbs } from '../src/engine/winprob.js';
import { weeklyPlan, nextGoal, levelHistory, weekStart } from '../src/engine/plan.js';
import { shanghaiAdvanced } from '../src/engine/advanced.js';
import { legReport } from '../src/engine/legreport.js';
import { D, miss, leg } from './helpers.js';

describe('notes et niveau', async () => {
  const { gradeOfValue, scoreOf, gradeTraining, DRILL_GRADE, criteria } = await import('../src/engine/grades.js');
  const { levelOf } = await import('../src/engine/level.js');
  const { countupAdvanced, trainingAdvanced } = await import('../src/engine/advanced.js');
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
  const { legReport } = await import('../src/engine/legreport.js');
  const { makeRng, makeSim } = await import('../src/engine/sim.js');
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

describe('shanghai formats', () => {
  const mkSh = (id, from, to, hitEvery) => {
    const nums = []; for (let n = from; n <= to; n++) nums.push(n);
    const darts = []; nums.forEach((n, i) => { for (let k = 0; k < 3; k++) darts.push(k === 0 && i % hitEvery === 0 ? { seg: n, mult: 2 } : { seg: 0, mult: 0 }); for (let k = 0; k < 3; k++) darts.push({ seg: 0, mult: 0 }); });
    return { id, mode: 'shanghai', settings: { from, to, instantWin: true }, player_ids: ['a', 'b'], status: 'finished', created_at: new Date(2026, 0, Number(id.slice(1))).toISOString(),
      data: { legs: [{ order: ['a', 'b'], darts, validated: 1e9, done: true, ranking: ['a', 'b'] }], legsToWin: 1 } };
  };
  it('touches par manche indépendantes du format, rapport sur même format', () => {
    const a7 = shanghaiAdvanced([mkSh('g1', 1, 7, 1)], 'a'); const a20 = shanghaiAdvanced([mkSh('g2', 1, 20, 1)], 'a');
    expect(a7.markAvg).toBeCloseTo(a20.markAvg, 5);
    expect(Object.keys(shanghaiAdvanced([mkSh('g1', 1, 7, 1), mkSh('g2', 1, 20, 1)], 'a').fmt).sort()).toEqual(['1-20', '1-7']);
    const hist = [mkSh('g3', 1, 7, 1), mkSh('g4', 1, 7, 1), mkSh('g5', 1, 20, 1)];
    const rep = legReport(mkSh('g6', 1, 7, 1), hist, 'a');
    expect(rep.rows.some((r) => r.label === 'Points')).toBe(true);
    expect(rep.rows.some((r) => r.label === 'Touches par manche')).toBe(true);
    const rep2 = legReport(mkSh('g7', 1, 10, 1), hist, 'a');
    expect(rep2.rows.some((r) => r.label === 'Points')).toBe(false);
  });
  it('chances de victoire au Shanghai : le plus fort devant, somme à 1, Shanghai adverse impossible si fini', async () => {
    const { shanghaiLive } = await import('../src/engine/winprob.js');
    const strong = { darts: 90, pct: { s: 0.35, d: 0.1, t: 0.1, miss: 0.45 }, numMix: {} };
    const weak = { darts: 90, pct: { s: 0.2, d: 0.02, t: 0.01, miss: 0.77 }, numMix: {} };
    const nums = [1, 2, 3, 4, 5, 6, 7];
    const p = shanghaiLive(nums, [0, 0], [0, 0], [strong, weak]);
    expect(p[0] + p[1]).toBeCloseTo(1, 5);
    expect(p[0]).toBeGreaterThan(0.7);
    // le faible mène de 100 points à la dernière manche : il gagne presque sûrement
    const q = shanghaiLive(nums, [0, 100], [6, 6], [strong, weak]);
    expect(q[1]).toBeGreaterThan(0.95);
  });
  it('chances de victoire en X01 : le joueur qui est devant gagne plus souvent', async () => {
    const { x01Live } = await import('../src/engine/winprob.js');
    const pr = { score: 45, p: 0.15 };
    const even = x01Live([pr, pr], [501, 501], 0, 0, [501, 501], 'double', [0, 0]);
    expect(even[0] + even[1]).toBeCloseTo(1, 5);
    expect(even[0]).toBeGreaterThan(0.4); expect(even[0]).toBeLessThan(0.6);
    const ahead = x01Live([pr, pr], [60, 301], 1, 0, [501, 501], 'double', [0, 0]);
    expect(ahead[0]).toBeGreaterThan(0.8); // l'autre doit passer 301 avant d'en finir 60
    const match = x01Live([pr, pr], [501, 501], 0, 0, [501, 501], 'double', [1, 0], 2);
    expect(match[0]).toBeGreaterThan(0.6); // mène 1 leg à 0 dans un match en 2 legs
  });
  it('chances au Shanghai mises à jour dès la première fléchette de la volée', async () => {
    const { shanghaiLive } = await import('../src/engine/winprob.js');
    const h = { darts: 90, pct: { s: 0.3, d: 0.08, t: 0.06, miss: 0.56 }, numMix: {} };
    const nums = [1, 2, 3, 4, 5];
    const avant = shanghaiLive(nums, [0, 0], [0, 0], [h, h]);
    // 1er joueur : simple + double + triple déjà faits ? Impossible en 2 darts, donc simple + double puis 1 fléchette restante pour le triple
    const apres = shanghaiLive(nums, [3, 0], [0, 0], [h, h], true, 1500, { i: 0, left: 1, seen: 3 });
    expect(apres[0]).toBeGreaterThan(avant[0] + 0.04);
  });
  it('indice de précision : voisins corrects, côté opposé très mauvais', async () => {
    const { dartPrecision } = await import('../src/engine/precision.js');
    const mean = (t, segs) => segs.reduce((p, x) => p + dartPrecision(t, x), 0) / segs.length;
    expect(dartPrecision(1, 1)).toBe(100);
    expect(dartPrecision(1, 0)).toBe(0);
    expect(mean(1, [20, 18, 1])).toBeGreaterThan(55); // 1 visé : 20, 18, 1 = pas mal
    expect(mean(1, [1, 16, 2])).toBeLessThan(40); // 1 visé : 1, 16, 2 = mauvais
    expect(dartPrecision(1, 20)).toBeGreaterThan(dartPrecision(1, 4)); // plus c'est loin, plus c'est bas
  });
  it('répartition simple / double / triple / raté sur chaque numéro', () => {
    const a = shanghaiAdvanced([mkSh('g1', 1, 7, 1), mkSh('g2', 1, 7, 1)], 'a');
    expect(a.numMix[3].darts).toBe(6);
    expect(a.numMix[3].d).toBeCloseTo(1 / 3, 5);
    expect(a.numMix[3].miss).toBeCloseTo(2 / 3, 5);
    expect(a.numMix[3].s + a.numMix[3].d + a.numMix[3].t + a.numMix[3].miss).toBeCloseTo(1, 5);
  });
});


describe('chances de victoire : tous les jeux', () => {
  it('somme à 1 et un joueur largement devant est favori', async () => {
    const { liveChances } = await import('../src/engine/livechance.js');
    const D = (seg, mult) => ({ seg, mult });
    // Cricket : a ferme 20, 19, 18, 17 ; b n'a rien
    const darts = [];
    for (const n of [20, 19, 18, 17]) { darts.push(D(n, 3), D(0, 0), D(0, 0)); darts.push(D(0, 0), D(0, 0), D(0, 0)); }
    const game = { id: 'g', mode: 'cricket', settings: {}, player_ids: ['a', 'b'] };
    const c = liveChances(game, { order: ['a', 'b'], darts }, []);
    expect(Math.abs(c.a + c.b - 1)).toBeLessThan(0.06); // arrondi à 5 % près
    expect(c.a).toBeGreaterThan(0.7);
    // Count Up : même chose, a mène de beaucoup
    const g2 = { id: 'h', mode: 'countup', settings: { rounds: 8 }, player_ids: ['a', 'b'] };
    const c2 = liveChances(g2, { order: ['a', 'b'], darts: [D(20, 3), D(20, 3), D(20, 3), D(0, 0), D(0, 0), D(0, 0)] }, []);
    expect(c2.a).toBeGreaterThan(0.6);
  });
});
