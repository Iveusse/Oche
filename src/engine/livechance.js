// Chances de victoire en cours de partie pour Cricket, Around the Clock, Baseball, Killer et Count Up.
// On fait rejouer la fin de la partie par le vrai moteur de règles : chaque joueur « lance » des fléchettes tirées au hasard
// selon ce qu'il réussit d'habitude (simple / double / triple / raté), en visant ce qu'un joueur raisonnable viserait.
import { runLeg } from './runner.js';
import { afterReset } from './stats.js';
import { cricketAdvanced, atcAdvanced, baseballAdvanced, killerAdvanced, countupAdvanced } from './advanced.js';
import { CRICKET_NUMS, killerTargets, countUpRounds } from './modes.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// loi d'une fléchette : parts de simple, double, triple (le reste est raté), tirée vers un joueur moyen si l'historique est mince
const PRIOR = { cricket: { s: 0.32, d: 0.05, t: 0.04 }, baseball: { s: 0.3, d: 0.05, t: 0.03 }, atc: { s: 0.3, d: 0, t: 0 }, killer: { s: 0, d: 0.08, t: 0 } };
function law(mode, a) {
  const base = PRIOR[mode]; const n = a?.darts || 0; const k = 30;
  if (mode === 'atc') { const h = ((a?.hits || 0) + k * base.s) / (n + k); return { s: h, d: 0, t: 0 }; }
  if (mode === 'killer') { const h = ((a?.offHits || 0) + 20 * base.d) / ((a?.offDarts || 0) + 20); return { s: 0, d: h, t: 0 }; }
  const m = (x, key) => ((x || 0) + k * base[key]) / (n + k);
  return { s: m(a?.sgl, 's'), d: m(a?.d, 'd'), t: m(a?.t, 't') };
}
const mult = (L, u) => (u < L.s ? 1 : u < L.s + L.d ? 2 : u < L.s + L.d + L.t ? 3 : 0);

// quel numéro viser (Cricket) : le plus haut de ceux qu'on n'a pas fermés ; sinon le plus haut où un adversaire peut encore être touché
function aimCricket(r, i) {
  const me = r.ps[i];
  const mine = [...CRICKET_NUMS].reverse().find((n) => me.marks[n] < 3);
  if (mine != null) return mine;
  return [...CRICKET_NUMS].reverse().find((n) => r.ps.some((o, j) => j !== i && o.marks[n] < 3)) ?? 20;
}

export const LIVE_MODES = ['cricket', 'atc', 'baseball', 'killer', 'countup'];

// Retourne { id: probabilité } ou null (mode non géré, un seul joueur, leg fini)
export function liveChances(game, leg, history, iters = 150, budgetMs = 220) {
  const mode = game.mode;
  if (!LIVE_MODES.includes(mode) || leg.order.length < 2) return null;
  const past = history.filter((g) => g.id !== game.id && !g.mode.startsWith('train-'));
  const ids = leg.order; const n = ids.length; const R = rng(20261125);
  const adv = { cricket: cricketAdvanced, atc: atcAdvanced, baseball: baseballAdvanced, killer: killerAdvanced, countup: countupAdvanced }[mode];
  const stats = ids.map((id) => adv(afterReset(past, id), id));
  const base = runLeg(mode, game.settings, leg);
  if (base.over) return null;

  if (mode === 'countup') {
    const rounds = countUpRounds(game.settings);
    const done = base.ps.map((_, i) => base.turns.filter((t) => t.p === i).length);
    const pts = base.ps.map((p) => p.pts);
    // volée en cours : elle compte comme déjà entamée (ses points sont dans pts), il reste donc moins à jouer
    if (base.current) done[base.current.p] += base.current.darts.length / 3;
    const wins = new Array(n).fill(0);
    const m = stats.map((s) => (s.turns >= 6 ? { avg: s.turnAvg, sd: Math.max(s.sd || 0, 6) } : { avg: 30, sd: 15 }));
    for (let it = 0; it < 2000; it++) {
      let best = -1; let bv = -Infinity;
      for (let i = 0; i < n; i++) {
        const left = Math.max(rounds - done[i], 0);
        const v = pts[i] + m[i].avg * left + gauss(R) * m[i].sd * Math.sqrt(left);
        if (v > bv) { bv = v; best = i; }
      }
      wins[best] += 1;
    }
    return Object.fromEntries(ids.map((id, i) => [id, wins[i] / 2000]));
  }

  const laws = stats.map((s) => law(mode, s));
  const wins = new Array(n).fill(0);
  const t0 = Date.now(); let done = 0;
  for (let it = 0; it < iters; it++) {
    if (it >= 30 && Date.now() - t0 > budgetMs) break; // le téléphone ne doit pas ramer : on s'arrête dès que le budget de temps est écoulé
    done += 1;
    const darts = leg.darts.slice(); let r = base; let guard = 0;
    while (!r.over && guard++ < 600) {
      const i = r.cur; const L = laws[i]; const me = r.ps[i];
      let d;
      if (mode === 'cricket') {
        const num = aimCricket(r, i); const m = mult(L, R());
        d = m ? { seg: num, mult: num === 25 ? Math.min(m, 2) : m } : { seg: 0, mult: 0 };
      } else if (mode === 'atc') {
        const target = leg.targets[me.pos];
        d = R() < L.s ? { seg: target, mult: 1 } : { seg: 0, mult: 0 };
      } else if (mode === 'baseball') {
        const inning = (r.current ? r.current.round : Math.floor(r.turns.length / n)) + 1;
        const m = mult(L, R());
        d = m ? { seg: inning, mult: m } : { seg: 0, mult: 0 };
      } else { // killer : son double pour devenir killer, puis le double d'un adversaire
        const tg = me.killer ? killerTargets(me, r.ps) : [me.num];
        d = R() < L.d && tg.length ? { seg: tg[Math.floor(R() * tg.length)], mult: 2 } : { seg: 0, mult: 0 };
      }
      darts.push(d);
      r = runLeg(mode, game.settings, { ...leg, darts, continueForPlaces: false });
    }
    const w = r.ranking?.[0];
    const wi = ids.indexOf(w); if (wi >= 0) wins[wi] += 1; else wins.forEach((_, k) => { wins[k] += 1 / n; });
  }
  // la simulation est courte (le téléphone ne doit pas ramer) : on arrondit à 5 % près pour ne pas afficher une précision qu'on n'a pas
  const r5 = (v) => (v < 0.01 ? v : Math.round(v * 20) / 20);
  return Object.fromEntries(ids.map((id, i) => [id, r5(wins[i] / done)]));
}
