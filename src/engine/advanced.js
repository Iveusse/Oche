// Stats avancées par mode, calculées à partir des legs rejoués.
import { replayed, afterReset } from './stats.js';
import { CRICKET_NUMS, shanghaiNumbers, startOf, BASEBALL_INNINGS } from './modes.js';
import { oneDartFinish } from '../lib/board.js';

const avg = (a, b) => (b ? a / b : null);
const DAY = 86400000;

export const COLUMNS = [
  ['today', "Aujourd'hui"],
  ['30j', '30 jours'],
  ['all', 'Tout'],
];

export function periodFilter(games, key) {
  if (key === 'all') return games;
  if (key === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return games.filter((g) => new Date(g.created_at).getTime() >= d.getTime());
  }
  const since = Date.now() - 30 * DAY;
  return games.filter((g) => new Date(g.created_at).getTime() >= since);
}

function forEachLeg(games, pid, mode, fn) {
  for (const g of afterReset(games, pid)) {
    if (g.mode !== mode || !g.player_ids.includes(pid)) continue;
    for (const { leg, r } of replayed(g)) {
      const idx = leg.order.indexOf(pid);
      if (idx < 0 || !leg.done) continue;
      fn({ g, leg, r, idx, turns: r.turns.filter((t) => t.p === idx) });
    }
  }
}

function duration(games, pid, mode) {
  // Temps de jeu actif (chrono en jeu, écran allumé) quand il existe ;
  // sinon, pour les vieilles parties, écart création -> fin du dernier leg.
  let total = 0; let n = 0; let legsN = 0;
  for (const g of afterReset(games, pid)) {
    if (g.mode !== mode || !g.player_ids.includes(pid)) continue;
    const done = g.data.legs.filter((l) => l.done);
    if (!done.length) continue;
    let ms;
    if (done.every((l) => typeof l.activeMs === 'number')) ms = done.reduce((a, l) => a + l.activeMs, 0);
    else {
      const ends = done.map((l) => l.finishedAt).filter(Boolean).sort();
      if (!ends.length) continue;
      ms = new Date(ends[ends.length - 1]) - new Date(g.created_at);
    }
    if (ms > 0 && ms < 6 * 3600000) { total += ms; n += 1; legsN += done.length; }
  }
  return { total, avg: avg(total, n), perLeg: avg(total, legsN) };
}

export const TURN_BUCKETS = [
  ['Aucun point', 0, 0], ['1-19', 1, 19], ['20+', 20, 39], ['40+', 40, 59], ['60+', 60, 79], ['80+', 80, 99],
  ['100+', 100, 119], ['120+', 120, 139], ['140+', 140, 159], ['160+', 160, 179], ['180', 180, 180],
];

export const ALT_BUCKETS = [
  ['Aucun point', 0, 0], ['1-29', 1, 29], ['30+', 30, 49], ['50+', 50, 69], ['70+', 70, 89], ['90+', 90, 109],
  ['110+', 110, 129], ['130+', 130, 159], ['160+', 160, 179], ['180', 180, 180],
];

export function x01Advanced(games, pid, start = 'all') {
  const gs = start === 'all' ? games : games.filter((g) => String(startOf(g, pid)) === String(start));
  const s = {
    legs: 0, won: 0, darts: 0, pts: 0, byOut: { single: [0, 0], double: [0, 0], master: [0, 0] },
    first: { 9: [0, 0], 12: [0, 0], 15: [0, 0] }, until: { 100: [0, 0], 170: [0, 0] },
    wonDarts: 0, co: [], coAtt: 0, coHit: 0, dblAtt: 0, dblHit: 0, coBy: { single: [0, 0], double: [0, 0], master: [0, 0] },
    bestLeg: null, bestLegAvg: null, high: 0, buckets: TURN_BUCKETS.map(() => 0), alt: ALT_BUCKETS.map(() => 0), turns: 0,
    round: Array.from({ length: 10 }, () => [0, 0]), remAfter: { 3: [0, 0], 6: [0, 0], 9: [0, 0], 12: [0, 0], 15: [0, 0] },
  };
  forEachLeg(gs, pid, 'x01', ({ g, leg, turns }) => {
    const out = g.settings?.out || 'single';
    s.legs += 1;
    const won = leg.ranking?.[0] === pid;
    if (won) s.won += 1;
    let legD = 0; let legP = 0; let dartsSoFar = 0;
    const start0 = turns[0]?.darts[0]?.remBefore ?? startOf(g, pid);
    const remAfterTurn = [];
    for (const t of turns) {
      const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
      const n = t.darts.length;
      const remStart = t.darts[0].remBefore;
      legD += n; legP += pts;
      s.byOut[out][0] += n; s.byOut[out][1] += pts;
      for (const k of [9, 12, 15]) if (dartsSoFar < k) { s.first[k][0] += n; s.first[k][1] += pts; }
      for (const k of [100, 170]) if (remStart > k) { s.until[k][0] += n; s.until[k][1] += pts; }
      if (t.nth < 10) { s.round[t.nth][0] += 1; s.round[t.nth][1] += pts; }
      if (!t.finished) {
        s.turns += 1;
        const bi = TURN_BUCKETS.findIndex(([, lo, hi]) => pts >= lo && pts <= hi);
        if (bi >= 0) s.buckets[bi] += 1;
        const ai = ALT_BUCKETS.findIndex(([, lo, hi]) => pts >= lo && pts <= hi);
        if (ai >= 0) s.alt[ai] += 1;
      }
      s.high = Math.max(s.high, pts);
      if (t.finished) s.co.push(remStart);
      t.darts.forEach((d, k) => {
        if (!d.opened || !oneDartFinish(d.remBefore, out)) return;
        const hit = t.finished && k === t.darts.length - 1;
        s.coAtt += 1; if (hit) s.coHit += 1;
        s.coBy[out][0] += 1; if (hit) s.coBy[out][1] += 1;
        if (out === 'double') { s.dblAtt += 1; if (hit) s.dblHit += 1; }
      });
      dartsSoFar += n;
      remAfterTurn.push(t.bust ? remStart : remStart - pts);
    }
    for (const k of [3, 6, 9, 12, 15]) {
      const i = k / 3 - 1;
      const rem = i < remAfterTurn.length ? remAfterTurn[i] : (won || leg.ranking.indexOf(pid) >= 0 ? (remAfterTurn.at(-1) ?? start0) : null);
      if (rem != null) { s.remAfter[k][0] += 1; s.remAfter[k][1] += rem; }
    }
    s.darts += legD; s.pts += legP;
    if (won) {
      s.wonDarts += legD;
      s.bestLeg = s.bestLeg == null ? legD : Math.min(s.bestLeg, legD);
    }
    if (legD) s.bestLegAvg = Math.max(s.bestLegAvg ?? 0, (legP / legD) * 3);
  });
  const a3 = (p) => avg(p[1], p[0]) != null ? (p[1] / p[0]) * 3 : null;
  return {
    ...s,
    winRate: avg(s.won, s.legs),
    avgAll: a3([s.darts, s.pts]),
    avgOut: { single: a3(s.byOut.single), double: a3(s.byOut.double), master: a3(s.byOut.master) },
    avgFirst: { 9: a3(s.first[9]), 12: a3(s.first[12]), 15: a3(s.first[15]) },
    avgUntil: { 100: a3(s.until[100]), 170: a3(s.until[170]) },
    dartsPerLeg: avg(s.wonDarts, s.won),
    coAvg: avg(s.co.reduce((a, b) => a + b, 0), s.co.length),
    coHigh: s.co.length ? Math.max(...s.co) : null,
    coRate: avg(s.coHit, s.coAtt),
    dblRate: avg(s.dblHit, s.dblAtt),
    roundAvg: s.round.map(([n, p]) => avg(p, n)),
    remAfterAvg: Object.fromEntries(Object.entries(s.remAfter).map(([k, [n, sum]]) => [k, avg(sum, n)])),
    duration: duration(gs, pid, 'x01'),
  };
}

export function cricketAdvanced(games, pid) {
  const s = {
    legs: 0, won: 0, darts: 0, turns: 0, marks: 0, t: 0, d: 0, sgl: 0, miss: 0,
    pts: 0, maxPts: 0, m9: 0, m7: 0, m5: 0, perNum: Object.fromEntries(CRICKET_NUMS.map((n) => [n, 0])),
    hitsNum: Object.fromEntries(CRICKET_NUMS.map((n) => [n, 0])), maxT: 0, maxD: 0, maxS: 0,
  };
  forEachLeg(games, pid, 'cricket', ({ leg, r, idx, turns }) => {
    s.legs += 1; if (leg.ranking?.[0] === pid) s.won += 1;
    const p = r.ps[idx].pts; s.pts += p; s.maxPts = Math.max(s.maxPts, p);
    let lt = 0; let ld = 0; let ls = 0;
    for (const t of turns) for (const d of t.darts) if (d.marks) { if (d.mult === 3) lt += 1; else if (d.mult === 2) ld += 1; else ls += 1; }
    s.maxT = Math.max(s.maxT, lt); s.maxD = Math.max(s.maxD, ld); s.maxS = Math.max(s.maxS, ls);
    for (const t of turns) {
      s.turns += 1;
      const m = t.darts.reduce((a, d) => a + (d.marks || 0), 0);
      s.marks += m;
      if (m >= 9) s.m9 += 1; else if (m >= 7) s.m7 += 1; else if (m >= 5) s.m5 += 1;
      for (const d of t.darts) {
        s.darts += 1;
        if (!d.marks) { s.miss += 1; continue; }
        if (d.mult === 3) s.t += 1; else if (d.mult === 2) s.d += 1; else s.sgl += 1;
        s.perNum[d.seg] += d.marks;
        s.hitsNum[d.seg] += 1;
      }
    }
  });
  return {
    ...s, winRate: avg(s.won, s.legs), mpr: avg(s.marks, s.turns), ptsAvg: avg(s.pts, s.legs),
    pct: { t: avg(s.t, s.darts), d: avg(s.d, s.darts), s: avg(s.sgl, s.darts), miss: avg(s.miss, s.darts), hit: avg(s.darts - s.miss, s.darts) },
    perNumAvg: Object.fromEntries(CRICKET_NUMS.map((n) => [n, avg(s.perNum[n], s.legs)])),
    duration: duration(games, pid, 'cricket'),
  };
}

export function shanghaiAdvanced(games, pid) {
  const s = {
    legs: 0, won: 0, shanghais: 0, pts: 0, best7: null, best20: null, darts: 0, t: 0, d: 0, sgl: 0, miss: 0,
    num: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, { darts: 0, hits: 0, pts: 0, turns: 0, sh: 0 }])),
  };
  forEachLeg(games, pid, 'shanghai', ({ g, leg, r, idx, turns }) => {
    s.legs += 1; if (leg.ranking?.[0] === pid) s.won += 1;
    const p = r.ps[idx].pts; s.pts += p;
    const nums = shanghaiNumbers(g.settings || {});
    if (nums[0] === 1 && nums.length === 7) s.best7 = Math.max(s.best7 ?? 0, p);
    if (nums[0] === 1 && nums.length === 20) s.best20 = Math.max(s.best20 ?? 0, p);
    for (const t of turns) {
      const target = nums[t.round];
      const cell = s.num[target];
      if (cell) cell.turns += 1;
      for (const d of t.darts) {
        s.darts += 1;
        if (d.shanghai) { s.shanghais += 1; if (cell) cell.sh += 1; }
        if (cell) { cell.darts += 1; cell.pts += d.pts || 0; }
        if (!d.hit) { s.miss += 1; continue; }
        if (cell) cell.hits += 1;
        if (d.mult === 3) s.t += 1; else if (d.mult === 2) s.d += 1; else s.sgl += 1;
      }
    }
  });
  return {
    ...s, winRate: avg(s.won, s.legs), ptsAvg: avg(s.pts, s.legs),
    pct: { hit: avg(s.darts - s.miss, s.darts), t: avg(s.t, s.darts), d: avg(s.d, s.darts), s: avg(s.sgl, s.darts), miss: avg(s.miss, s.darts) },
    numAcc: Object.fromEntries(Object.entries(s.num).map(([k, c]) => [k, avg(c.hits, c.darts)])),
    numPts: Object.fromEntries(Object.entries(s.num).map(([k, c]) => [k, avg(c.pts, c.turns)])),
    duration: duration(games, pid, 'shanghai'),
  };
}

export function atcAdvanced(games, pid) {
  const s = {
    legs: 0, won: 0, finished: 0, finDarts: 0, best: null, darts: 0, hits: 0,
    num: Object.fromEntries([...Array.from({ length: 20 }, (_, i) => i + 1), 25].map((n) => [n, { darts: 0, hits: 0 }])),
  };
  forEachLeg(games, pid, 'atc', ({ leg, r, idx, turns }) => {
    s.legs += 1; if (leg.ranking?.[0] === pid) s.won += 1;
    let n = 0;
    for (const t of turns) for (const d of t.darts) {
      n += 1; s.darts += 1;
      const c = s.num[d.target];
      if (c) c.darts += 1;
      if (d.hit) { s.hits += 1; if (c) c.hits += 1; }
    }
    if (r.ps[idx].finished) { s.finished += 1; s.finDarts += n; s.best = s.best == null ? n : Math.min(s.best, n); }
  });
  return {
    ...s, winRate: avg(s.won, s.legs), finAvg: avg(s.finDarts, s.finished), acc: avg(s.hits, s.darts),
    numAcc: Object.fromEntries(Object.entries(s.num).map(([k, c]) => [k, avg(c.hits, c.darts)])),
    duration: duration(games, pid, 'atc'),
  };
}

export function baseballAdvanced(games, pid) {
  const s = {
    legs: 0, won: 0, pts: 0, best: null, darts: 0, t: 0, d: 0, sgl: 0, miss: 0, clean: 0, homeruns: 0,
    num: Object.fromEntries(Array.from({ length: BASEBALL_INNINGS }, (_, i) => [i + 1, { darts: 0, hits: 0, pts: 0, turns: 0 }])),
  };
  forEachLeg(games, pid, 'baseball', ({ leg, r, idx, turns }) => {
    s.legs += 1; if (leg.order.length > 1 && leg.ranking?.[0] === pid) s.won += 1;
    const p = r.ps[idx].pts; s.pts += p; s.best = Math.max(s.best ?? 0, p);
    if (turns.length === BASEBALL_INNINGS && turns.every((t) => t.darts.some((d) => d.hit))) s.clean += 1;
    for (const t of turns) {
      const cell = s.num[t.round + 1];
      if (cell) cell.turns += 1;
      if (t.darts.length === 3 && t.darts.reduce((a, d) => a + (d.pts || 0), 0) === 9) s.homeruns += 1;
      for (const d of t.darts) {
        s.darts += 1;
        if (cell) { cell.darts += 1; cell.pts += d.pts || 0; }
        if (!d.hit) { s.miss += 1; continue; }
        if (cell) cell.hits += 1;
        if (d.mult === 3) s.t += 1; else if (d.mult === 2) s.d += 1; else s.sgl += 1;
      }
    }
  });
  return {
    ...s, winRate: s.legs && s.won ? s.won / s.legs : (s.legs ? 0 : null), ptsAvg: avg(s.pts, s.legs),
    pct: { hit: avg(s.darts - s.miss, s.darts), t: avg(s.t, s.darts), d: avg(s.d, s.darts), s: avg(s.sgl, s.darts), miss: avg(s.miss, s.darts) },
    numAcc: Object.fromEntries(Object.entries(s.num).map(([k, c]) => [k, avg(c.hits, c.darts)])),
    numPts: Object.fromEntries(Object.entries(s.num).map(([k, c]) => [k, avg(c.pts, c.turns)])),
    duration: duration(games, pid, 'baseball'),
  };
}

export function killerAdvanced(games, pid) {
  const s = { legs: 0, won: 0, kills: 0, lostLives: 0, place: 0, became: 0, darts: 0, dartsToKiller: 0, offDarts: 0, offHits: 0, doubles: 0, victims: 0, flawless: 0, express: 0 };
  forEachLeg(games, pid, 'killer', ({ leg, r, idx, turns }) => {
    s.legs += 1;
    const won = leg.ranking?.[0] === pid; if (won) s.won += 1;
    s.place += leg.ranking ? leg.ranking.indexOf(pid) + 1 : 0;
    const me = r.ps[idx];
    s.kills += me.kills; s.lostLives += me.lost;
    if (won && me.lost === 0) s.flawless += 1;
    let n = 0; let got = false;
    for (const t of turns) t.darts.forEach((d, k) => {
      n += 1; s.darts += 1;
      if (d.mult === 2) s.doubles += 1;
      if (!got) {
        s.offDarts += 1;
        if (d.becameKiller) { got = true; s.offHits += 1; s.became += 1; s.dartsToKiller += n; if (n === 1) s.express += 1; }
      }
      if (d.victim) s.victims += 1;
    });
  });
  return {
    ...s, winRate: avg(s.won, s.legs), killsPerLeg: avg(s.kills, s.legs), lostPerLeg: avg(s.lostLives, s.legs),
    avgPlace: avg(s.place, s.legs), becameRate: avg(s.became, s.legs), dartsToKillerAvg: avg(s.dartsToKiller, s.became),
    doubleAcc: avg(s.offHits, s.offDarts), victimRate: avg(s.victims, s.darts),
    duration: duration(games, pid, 'killer'),
  };
}
