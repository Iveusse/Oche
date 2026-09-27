import { runLeg } from './runner.js';
import { oneDartFinish } from '../lib/board.js';
import { isTraining } from './modes.js';

const DAY = 86400000;

// Remise à zéro de profil : on ignore, pour ce joueur, tout ce qui est avant sa date de reset.
let RESETS = {};
export function setResets(players) {
  RESETS = {};
  for (const p of players || []) if (p.reset_at) RESETS[p.id] = new Date(p.reset_at).getTime();
}
export function afterReset(games, ...pids) {
  const since = Math.max(0, ...pids.map((id) => RESETS[id] || 0));
  return since ? games.filter((g) => new Date(g.created_at).getTime() >= since) : games;
}

export function filterByPeriod(games, period) {
  const days = { '7j': 7, '30j': 30, '1an': 365 }[period];
  if (!days) return games;
  const since = Date.now() - days * DAY;
  return games.filter((g) => new Date(g.created_at).getTime() >= since);
}

// Rejoue chaque leg terminé une seule fois (mémo par identité d'objet)
const cache = new WeakMap();
export function replayed(game) {
  if (cache.has(game)) return cache.get(game);
  const legs = (game.data?.legs || [])
    .filter((l) => l.done || isTraining(game.mode))
    .map((leg) => ({ leg, r: runLeg(game.mode, game.settings || {}, leg) }));
  cache.set(game, legs);
  return legs;
}

export function emptyStats() {
  return {
    x01Darts: 0, x01Points: 0, first9Darts: 0, first9Points: 0,
    coAttempts: 0, coHits: 0, bestFinish: 0, c180: 0, c140: 0, c100: 0,
    legsPlayed: 0, legsWon: 0, gamesPlayed: 0,
    cricketMarks: 0, cricketTurns: 0,
    doubles: {}, heat: [], totalDarts: 0, missDarts: 0,
    series: [],
  };
}

export function playerStats(allGames, pid) {
  const games = afterReset(allGames, pid);
  const s = emptyStats();
  for (const g of games) {
    if (!g.player_ids.includes(pid)) continue;
    const training = isTraining(g.mode);
    if (!training) s.gamesPlayed += 1;
    let gDarts = 0; let gPts = 0;
    for (const { leg, r } of replayed(g)) {
      const idx = leg.order.indexOf(pid);
      if (idx < 0) continue;
      if (!training && leg.done) {
        s.legsPlayed += 1;
        if (leg.ranking?.[0] === pid) s.legsWon += 1;
      }
      const out = g.settings?.out || 'single';
      for (const t of r.turns) {
        if (t.p !== idx) continue;
        for (const d of t.darts) {
          s.totalDarts += 1;
          if (!d.mult) s.missDarts += 1;
          if (typeof d.x === 'number') s.heat.push({ x: d.x, y: d.y, mode: g.mode });
        }
        if (g.mode === 'x01') {
          const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
          s.x01Darts += t.darts.length; s.x01Points += pts;
          gDarts += t.darts.length; gPts += pts;
          if (t.nth < 3) { s.first9Darts += t.darts.length; s.first9Points += pts; }
          if (!t.bust && t.darts.length === 3) {
            if (pts === 180) s.c180 += 1;
            else if (pts >= 140) s.c140 += 1;
            else if (pts >= 100) s.c100 += 1;
          }
          if (t.finished) s.bestFinish = Math.max(s.bestFinish, t.darts[0].remBefore);
          t.darts.forEach((d, k) => {
            if (!d.opened || !oneDartFinish(d.remBefore, out)) return;
            s.coAttempts += 1;
            const hit = t.finished && k === t.darts.length - 1;
            if (hit) s.coHits += 1;
            if (out === 'double') {
              const key = d.remBefore === 50 ? 'Bull' : `D${d.remBefore / 2}`;
              s.doubles[key] = s.doubles[key] || { att: 0, hit: 0 };
              s.doubles[key].att += 1;
              if (hit) s.doubles[key].hit += 1;
            }
          });
        }
        if (g.mode === 'cricket') {
          s.cricketTurns += 1;
          s.cricketMarks += t.darts.reduce((a, d) => a + (d.marks || 0), 0);
        }
      }
    }
    if (g.mode === 'x01' && gDarts > 0) {
      s.series.push({ date: g.created_at, avg: (gPts / gDarts) * 3 });
    }
  }
  s.avg = s.x01Darts ? (s.x01Points / s.x01Darts) * 3 : null;
  s.first9 = s.first9Darts ? (s.first9Points / s.first9Darts) * 3 : null;
  s.checkout = s.coAttempts ? s.coHits / s.coAttempts : null;
  s.winRate = s.legsPlayed ? s.legsWon / s.legsPlayed : null;
  s.mpr = s.cricketTurns ? s.cricketMarks / s.cricketTurns : null;
  s.missRate = s.totalDarts ? s.missDarts / s.totalDarts : null;
  return s;
}

// Face à face : legs où les deux jouaient
export function headToHead(allGames, a, b) {
  const games = afterReset(allGames, a, b);
  const res = { a: 0, b: 0, legs: 0, games: [] };
  for (const g of games) {
    if (isTraining(g.mode) || !g.player_ids.includes(a) || !g.player_ids.includes(b)) continue;
    res.games.push(g);
    for (const leg of g.data.legs) {
      if (!leg.done || !leg.ranking) continue;
      const ia = leg.ranking.indexOf(a); const ib = leg.ranking.indexOf(b);
      if (ia < 0 || ib < 0) continue;
      res.legs += 1;
      if (ia < ib) res.a += 1; else res.b += 1;
    }
  }
  const shared = res.games;
  res.statsA = playerStats(shared, a);
  res.statsB = playerStats(shared, b);
  return res;
}

// Résultat d'une session d'entraînement
export function trainingResult(game) {
  const legs = replayed(game);
  if (!legs.length) return null;
  const { r } = legs[0];
  const ps = r.ps[0];
  const darts = r.turns.reduce((a, t) => a + t.darts.length, 0);
  switch (game.mode) {
    case 'train-doubles': return r.over ? { value: darts, label: `${darts} fl.`, better: 'low' } : null;
    case 'train-focus20': return r.over ? { value: ps.pts, label: `${ps.pts} pts`, better: 'high' } : null;
    case 'train-checkout': return r.over ? { value: ps.succ, label: `${ps.succ} / 20`, better: 'high' } : null;
    case 'train-free': return { value: darts, label: `${darts} fl.`, better: 'high' };
    default: return null;
  }
}

export function lastPlayed(games) {
  const m = {};
  for (const g of games) for (const id of g.player_ids) {
    const t = new Date(g.created_at).getTime();
    if (!m[id] || t > m[id]) m[id] = t;
  }
  return m;
}
