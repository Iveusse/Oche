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
});

