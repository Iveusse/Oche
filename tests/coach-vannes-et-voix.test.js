import { describe, it, expect } from 'vitest';
import { parseSpeech } from '../src/lib/voice.js';
import { computeAchievements } from '../src/engine/achievements.js';
import { weakest } from '../src/engine/coach.js';
import { roastTurn, setTrashOn, praiseTurn, resetRoast, numberQuip } from '../src/lib/roast.js';
import { leg } from './helpers.js';

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

describe('Clins d\'oeil 42 / 31 / 44 / 29 / 28', () => {
  it('une phrase pour chaque score, jamais sur un bust ni hors X01/Shanghai', () => {
    for (const n of [42, 31, 44, 29, 28]) { resetRoast(); expect(numberQuip('x01', { darts: [] }, n)).toBeTruthy(); }
    resetRoast();
    expect(numberQuip('x01', { darts: [], bust: true }, 42)).toBeNull();
    expect(numberQuip('cricket', { darts: [] }, 42)).toBeNull();
    expect(numberQuip('x01', { darts: [] }, 40)).toBeNull();
  });
  it('chaque clin d\'oeil une seule fois par partie, même sur plusieurs legs', () => {
    const mem = {};
    globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    try {
      resetRoast();
      expect(numberQuip('x01', { darts: [] }, 42, 'partie-1')).toBeTruthy();
      resetRoast(); // nouveau leg, même partie
      expect(numberQuip('x01', { darts: [] }, 42, 'partie-1')).toBeNull();
      expect(numberQuip('x01', { darts: [] }, 28, 'partie-1')).toBeTruthy();
      resetRoast();
      expect(numberQuip('x01', { darts: [] }, 42, 'partie-2')).toBeTruthy();
    } finally { delete globalThis.localStorage; }
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

