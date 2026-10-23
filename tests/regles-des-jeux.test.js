import { describe, it, expect } from 'vitest';
import { hitTest, zoneCenter, suggestCheckout, dartLabel, ORDER } from '../src/lib/board.js';
import { runLeg } from '../src/engine/runner.js';
import { playerStats } from '../src/engine/stats.js';
import { shanghaiNeed, shanghaiDecided } from '../src/screens/Play.jsx';
import { killerNumbers } from '../src/engine/modes.js';
import { D, miss, leg } from './helpers.js';

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

describe('handicap', () => {
  it('chaque joueur part de son propre score', () => {
    const s = { start: 501, in: 'single', out: 'single', starts: { a: 301, b: 501 } };
    const r = runLeg('x01', s, leg(['a', 'b'], [D(20, 3), D(20, 3), D(20, 3), D(20, 1)]));
    expect(r.ps[0].rem).toBe(121);
    expect(r.ps[1].rem).toBe(481);
  });
});

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

describe('count up', () => {
  it('additionne les fléchettes sur 8 manches', async () => {
    const { runLeg } = await import('../src/engine/runner.js');
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
    const { runLeg } = await import('../src/engine/runner.js');
    const r = runLeg('countup', { rounds: 8 }, { order: ['a'], darts: [{ seg: 20, mult: 1 }, { seg: 20, mult: 1 }, { seg: 20, mult: 1 }], validated: 0 });
    expect(r.over).toBe(false);
    expect(r.ps[0].pts).toBe(60);
  });
});

describe('hors cible', () => {
  it('deux taux : toute la cible vs tous modes', async () => {
    const { playerStats } = await import('../src/engine/stats.js');
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

