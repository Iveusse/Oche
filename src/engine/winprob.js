// Probabilité de victoire avant la partie, à partir du niveau de chacun.
// X01 : darts par leg = 3 × départ / moyenne (exact quand la moyenne est mesurée avec la même règle), dispersion calibrée
// par simulation (scripts/winprob-calibrate.mjs) ; Count Up : totaux gaussiens ; autres jeux : écart de niveau.
import { x01Advanced, countupAdvanced } from './advanced.js';
import { levelOf } from './level.js';
import { afterReset } from './stats.js';

// générateur déterministe : le même écran donne toujours les mêmes pourcentages
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

export const MIN_X01 = { legs: 3, darts: 60 };

// Réussite attendue sur un finish selon la moyenne de scoring (simulation) : sert d'a priori quand on a peu de tentatives
const P_PRIOR = {
  double: [[31.9, 0.024], [35.8, 0.03], [38.8, 0.054], [42.9, 0.09], [48.5, 0.115], [58.8, 0.161], [71.5, 0.232], [88.8, 0.335]],
  single: [[32.1, 0.085], [36.2, 0.113], [38, 0.15], [42.5, 0.16], [47.5, 0.203], [58.5, 0.279], [68.3, 0.323], [86.9, 0.376]],
};
function priorP(scoreAvg, out) {
  const t = P_PRIOR[out === 'single' ? 'single' : 'double'];
  if (scoreAvg <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (scoreAvg <= t[i][0]) { const [x0, y0] = t[i - 1]; const [x1, y1] = t[i]; return y0 + ((scoreAvg - x0) / (x1 - x0)) * (y1 - y0); }
  return t[t.length - 1][1];
}

// profil X01 d'un joueur : moyenne de scoring (tant qu'il reste plus de 100) et réussite aux finish pour la règle de sortie
// (la moyenne globale serait biaisée : le perdant ne passe jamais ses longues phases de finish)
export function x01Profile(games, pid, out) {
  const a = x01Advanced(afterReset(games, pid), pid, 'all');
  if (a.legs < MIN_X01.legs || a.darts < MIN_X01.darts || a.avgUntil[100] == null || a.until[100][0] < 30) return null;
  const score = a.avgUntil[100];
  const by = a.coBy[out] || [0, 0];
  const prior = priorP(score, out) * (out === 'master' ? 1.25 : 1);
  const K = 10; // poids de l'a priori, en tentatives
  const p = Math.max(0.02, Math.min(0.5, (by[1] + K * prior) / (by[0] + K)));
  return { score, p, approx: by[0] < 8, attempts: by[0], legs: a.legs };
}

// phase de scoring puis phase de finish : moyennes et dispersions calibrées sur des legs simulés
function legLaw(profile, start, out) {
  const ds = (3 * Math.max(start - 100, 0)) / profile.score + 2;
  const sdS = 0.22 * ds;
  const df = out === 'single' ? 1.2 / profile.p + 1.3 : 1.25 / profile.p + 1.5;
  const sdF = df * (out === "single" ? 0.65 : 0.9);
  const v = Math.log(1 + (sdF / df) ** 2);
  return { ds, sdS, muF: Math.log(df) - v / 2, sigF: Math.sqrt(v), mean: ds + df };
}

// simule des matchs : renvoie la part de victoires de chacun
function simulateX01(laws, legsToWin, iters, seed) {
  const n = laws.length; const wins = new Array(n).fill(0); const r = rng(seed);
  for (let it = 0; it < iters; it++) {
    const got = new Array(n).fill(0); let first = 0; let winner = -1;
    while (winner < 0) {
      let best = -1; let bv = Infinity;
      for (let k = 0; k < n; k++) {
        const i = (first + k) % n; // le premier lanceur gagne les égalités
        const L = laws[i];
        const t = Math.max(1, L.ds + L.sdS * gauss(r)) + Math.exp(L.muF + L.sigF * gauss(r));
        const visits = Math.ceil(t / 3);
        if (visits < bv) { bv = visits; best = i; }
      }
      got[best] += 1; if (got[best] >= legsToWin) winner = best;
      first = (first + 1) % n;
    }
    wins[winner] += 1;
  }
  return wins.map((w) => w / iters);
}

export function x01Probs(profiles, starts, out, legsToWin = 1, iters = 4000) {
  const laws = profiles.map((p, i) => legLaw(p, starts[i], out));
  return simulateX01(laws, legsToWin, iters, 20251003);
}

function countupProbs(stats, rounds, iters = 4000) {
  const r = rng(7); const n = stats.length; const wins = new Array(n).fill(0);
  for (let it = 0; it < iters; it++) {
    let best = -1; let bv = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = stats[i].turnAvg * rounds + gauss(r) * stats[i].sd * Math.sqrt(rounds);
      if (v > bv) { bv = v; best = i; }
    }
    wins[best] += 1;
  }
  return wins.map((w) => w / iters);
}

// autres jeux : probabilité proportionnelle à exp(niveau / T), T calibré sur des matchs simulés
export const LEVEL_T = 14;
function levelProbs(scores) {
  const e = scores.map((s) => Math.exp(s / LEVEL_T)); const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

// ids dans l'ordre de jeu. Retourne { ok, probs: {id: p}, missing: [ids], approx, kind }
export function winProbs(mode, settings, ids, games, legsToWin = 1) {
  if (ids.length < 2) return { ok: false, probs: {}, missing: [], kind: mode };
  const history = games.filter((g) => !g.mode.startsWith('train-'));
  if (mode === 'x01') {
    const out = settings.out || 'single';
    const profiles = ids.map((id) => x01Profile(history, id, out));
    const missing = ids.filter((_, i) => !profiles[i]);
    if (missing.length) return { ok: false, probs: {}, missing, kind: 'x01', need: `${MIN_X01.legs} legs de X01` };
    const starts = ids.map((id) => Number(settings.starts?.[id] ?? settings.start) || 501);
    const p = x01Probs(profiles, starts, out, legsToWin);
    return { ok: true, probs: Object.fromEntries(ids.map((id, i) => [id, p[i]])), missing: [], approx: profiles.some((x) => x.approx), kind: 'x01', profiles, starts };
  }
  if (mode === 'countup') {
    const stats = ids.map((id) => { const a = countupAdvanced(afterReset(history, id), id); return a.legs >= 2 && a.turns >= 8 && a.sd != null ? a : null; });
    const missing = ids.filter((_, i) => !stats[i]);
    if (missing.length) return { ok: false, probs: {}, missing, kind: 'countup', need: '2 parties de Count Up' };
    const p = countupProbs(stats, Number(settings.rounds) || 8);
    return { ok: true, probs: Object.fromEntries(ids.map((id, i) => [id, p[i]])), missing: [], kind: 'countup' };
  }
  if (['cricket', 'shanghai', 'atc', 'baseball', 'killer'].includes(mode)) {
    const lv = ids.map((id) => levelOf(afterReset(history, id), id).modes.find((m) => m.id === mode));
    const missing = ids.filter((_, i) => !lv[i]?.ok);
    if (missing.length) return { ok: false, probs: {}, missing, kind: mode, need: 'quelques parties de ce jeu' };
    const p = levelProbs(lv.map((m) => m.score));
    return { ok: true, probs: Object.fromEntries(ids.map((id, i) => [id, p[i]])), missing: [], approx: true, kind: 'level' };
  }
  return { ok: false, probs: {}, missing: [], kind: mode };
}

// Handicap équilibré en X01 : le plus fort garde le départ choisi, les autres partent plus bas (par pas de 100)
export function balanceStarts(ids, settings, games, legsToWin = 1) {
  const out = settings.out || 'single';
  const base = Number(settings.start) || 501;
  const history = games.filter((g) => !g.mode.startsWith('train-'));
  const profiles = ids.map((id) => x01Profile(history, id, out));
  if (profiles.some((p) => !p) || ids.length < 2) return null;
  const strongest = profiles.reduce((b, p, i) => (p.score > profiles[b].score ? i : b), 0);
  const starts = ids.map(() => base);
  const target = 1 / ids.length;
  const cost = (st) => { const p = x01Probs(profiles, st, out, legsToWin, 1500); return p.reduce((a, v) => a + (v - target) ** 2, 0); };
  const options = []; for (let v = 101; v <= base; v += 100) options.push(v);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < ids.length; i++) {
      if (i === strongest) continue;
      let best = starts[i]; let bc = Infinity;
      for (const v of options) { const st = [...starts]; st[i] = v; const c = cost(st); if (c < bc) { bc = c; best = v; } }
      starts[i] = best;
    }
  }
  return Object.fromEntries(ids.map((id, i) => [id, starts[i]]));
}
