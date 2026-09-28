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
