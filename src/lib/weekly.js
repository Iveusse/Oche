// Palmarès de la semaine : titres décernés d'après les parties du lundi au dimanche.
import { replayed, playerStats } from '../engine/stats.js';
import { isTraining, MODE_LABEL } from '../engine/modes.js';
import { computeAchievements, ACHIEVEMENTS } from '../engine/achievements.js';

export const weekStartOf = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const inWeek = (g, start) => { const t = new Date(g.created_at).getTime(); return t >= start.getTime() && t < start.getTime() + 7 * 86400000; };

function aggregate(games, players) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const P = {};
  const get = (id) => (P[id] ||= { id, name: byId[id]?.name || '?', color: byId[id]?.color || '#888', games: 0, legs: 0, won: 0, darts: 0, pts: 0, high: 0, c180: 0, co: 0, busts: 0, offBoard: 0, shanghai: 0, baseball: 0, kills: 0, lives: 0 });
  let legsN = 0;
  for (const g of games) {
    if (isTraining(g.mode)) continue;
    for (const id of new Set(g.player_ids)) get(id).games += 1;
    for (const { leg, r } of replayed(g)) {
      legsN += 1;
      leg.order.forEach((id, idx) => {
        const p = get(id);
        p.legs += 1;
        if (leg.order.length > 1 && leg.ranking?.[0] === id) p.won += 1;
        for (const t of r.turns) {
          if (t.p !== idx) continue;
          for (const d of t.darts) if (!d.mult && !((g.mode === 'shanghai' || g.mode === 'baseball') && typeof d.x !== 'number')) p.offBoard += 1;
          if (g.mode !== 'x01') continue;
          const s = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
          p.darts += t.darts.length; p.pts += s; p.high = Math.max(p.high, s);
          if (t.bust) p.busts += 1;
          if (s === 180) p.c180 += 1;
          if (t.finished) p.co = Math.max(p.co, t.darts[0].remBefore);
        }
        if (g.mode === 'shanghai') p.shanghai = Math.max(p.shanghai, r.ps[idx].pts);
        if (g.mode === 'baseball') p.baseball = Math.max(p.baseball, r.ps[idx].pts);
        if (g.mode === 'killer') { p.kills += r.ps[idx].kills; p.lives += r.ps[idx].lost; }
      });
    }
  }
  const rows = Object.values(P).map((p) => ({ ...p, avg: p.darts >= 30 ? (p.pts / p.darts) * 3 : null, rate: p.legs ? p.won / p.legs : 0 }));
  return { rows, legsN };
}

export function computeWeekly(allGames, players, start = weekStartOf()) {
  const finished = allGames.filter((g) => !isTraining(g.mode) && g.data?.legs?.some((l) => l.done));
  const cur = finished.filter((g) => inWeek(g, start));
  if (!cur.length) return null;
  const prev = finished.filter((g) => inWeek(g, new Date(start.getTime() - 7 * 86400000)));
  const { rows: raw, legsN } = aggregate(cur, players);
  const before = Object.fromEntries(aggregate(prev, players).rows.map((r) => [r.id, r]));
  const rows = [...raw].sort((a, b) => b.won - a.won || b.rate - a.rate || (b.avg || 0) - (a.avg || 0));

  const pick = (f, min) => { const c = rows.filter((p) => f(p) != null && f(p) >= min).sort((a, b) => f(b) - f(a)); return c[0] && c[0]; };
  const awards = [];
  const add = (icon, title, p, value) => { if (p) awards.push([`${icon} ${title}`, value, p.name]); };
  const king = rows[0]?.won >= 2 ? rows[0] : null;
  add('👑', 'Roi de la semaine', king, king && `${king.won} legs`);
  const sn = pick((p) => p.avg, 0); add('🎯', 'Sniper', sn, sn && sn.avg.toFixed(1));
  const bt = pick((p) => p.high, 60); add('💪', 'Plus gros tour', bt, bt && String(bt.high));
  const c1 = pick((p) => p.c180, 1); add('🔥', '180', c1, c1 && `${c1.c180} ×`);
  const co = pick((p) => p.co, 50); add('🏁', 'Plus beau finish', co, co && String(co.co));
  const sh = pick((p) => p.shanghai, 20); add('🀄', 'Meilleur Shanghai', sh, sh && `${sh.shanghai} pts`);
  const bb = pick((p) => p.baseball, 10); add('⚾', 'Meilleur Baseball', bb, bb && `${bb.baseball} pts`);
  const kl = pick((p) => p.kills, 1); add('☠️', 'Tueur de la semaine', kl, kl && `${kl.kills} élim.`);
  const bu = pick((p) => p.busts, 2); add('💥', 'Roi du bust', bu, bu && `${bu.busts} ×`);
  const mu = pick((p) => p.offBoard, 3); add('🧱', 'Mur de la cuisine', mu, mu && `${mu.offBoard} hors cible`);
  const as = pick((p) => p.games, 2); add('📅', 'Le plus assidu', as, as && `${as.games} parties`);
  const prog = rows.filter((p) => p.avg != null && before[p.id]?.avg != null).map((p) => ({ p, d: p.avg - before[p.id].avg })).sort((a, b) => b.d - a.d)[0];
  if (prog && prog.d >= 1) add('📈', 'Progression', prog.p, `+${prog.d.toFixed(1)} de moy.`);
  const lamp = rows.filter((p) => p.legs >= 3).sort((a, b) => a.rate - b.rate || a.won - b.won)[0];
  if (lamp && lamp !== king && rows.length > 1 && lamp.rate < 0.5) add('🏮', 'Lanterne rouge', lamp, `${lamp.won} / ${lamp.legs} legs`);

  // succès débloqués pendant la semaine (le palier le plus haut par série et par joueur)
  const t0 = start.getTime(); const t1 = t0 + 7 * 86400000;
  const best = new Map();
  for (const p of rows) {
    const res = computeAchievements(allGames, p.id);
    for (const ach of ACHIEVEMENTS) {
      const d = res[ach.id].unlocked && new Date(res[ach.id].unlocked).getTime();
      if (!d || d < t0 || d >= t1) continue;
      const k = ach.series ? `${p.name}|${ach.series}` : `${p.name}|${ach.id}`;
      const c = best.get(k);
      if (!c || (ach.level || 0) > (c.ach.level || 0)) best.set(k, { name: p.name, color: p.color, ach });
    }
  }
  const unlocked = [...best.values()].sort((x, y) => y.ach.tier - x.ach.tier);
  const modes = {};
  for (const g of cur) modes[g.mode] = (modes[g.mode] || 0) + 1;
  const end = new Date(t1 - 86400000);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return {
    title: 'Palmarès de la semaine',
    date: start, sub: `Du ${fmt(start)} au ${fmt(end)} · ${cur.length} partie${cur.length > 1 ? 's' : ''} · ${legsN} leg${legsN > 1 ? 's' : ''}`,
    modes: Object.entries(modes).map(([m, n]) => `${n} ${MODE_LABEL[m]}`).join(' · '),
    activeMs: 0, games: cur.length, legs: legsN, rows, highlights: awards, unlocked, hlTitle: 'Les titres',
  };
}


// ---------- Ma semaine : bilan perso, progrès et reculs par rapport à la semaine d'avant ----------
const METRICS = [
  { k: 'avg', label: 'Moyenne X01', val: (s) => s.avg, ok: (s) => s.x01Darts >= 30, f: (v) => v.toFixed(1), d: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`, better: 1 },
  { k: 'first9', label: 'Moy. 9 premières', val: (s) => s.first9, ok: (s) => s.first9Darts >= 18, f: (v) => v.toFixed(1), d: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`, better: 1 },
  { k: 'checkout', label: 'Checkout', val: (s) => s.checkout, ok: (s) => s.coAttempts >= 5, f: (v) => `${Math.round(v * 100)} %`, d: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts`, better: 1, rate: true },
  { k: 'win', label: 'Legs gagnés', val: (s) => s.winRate, ok: (s) => s.legsPlayed >= 3, f: (v) => `${Math.round(v * 100)} %`, d: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts`, better: 1, rate: true },
  { k: 'miss', label: 'Hors cible', val: (s) => s.missRate, ok: (s) => s.totalDarts >= 60, f: (v) => `${Math.round(v * 100)} %`, d: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)} pts`, better: -1, rate: true },
  { k: 'mpr', label: 'Cricket (MPR)', val: (s) => s.mpr, ok: (s) => s.cricketTurns >= 5, f: (v) => v.toFixed(2), d: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`, better: 1 },
  { k: 'finish', label: 'Meilleur finish', val: (s) => s.bestFinish || null, ok: (s) => s.bestFinish > 0, f: (v) => String(v), d: (v) => `${v > 0 ? '+' : ''}${v}`, better: 1 },
];

export function computePersonalWeekly(allGames, players, pid, start = weekStartOf()) {
  const me = players.find((p) => p.id === pid);
  if (!me) return null;
  const mine = allGames.filter((g) => g.player_ids.includes(pid));
  const cur = mine.filter((g) => inWeek(g, start));
  if (!cur.some((g) => g.data?.legs?.some((l) => l.done))) return null;
  const prevStart = new Date(start.getTime() - 7 * 86400000);
  const prev = mine.filter((g) => inWeek(g, prevStart));
  const sc = playerStats(cur, pid); const sp = playerStats(prev, pid);
  const stats = [];
  for (const m of METRICS) {
    if (!m.ok(sc)) continue;
    const c = m.val(sc);
    const p = m.ok(sp) ? m.val(sp) : null;
    let dir = 'new'; let delta = null; let rel = 0;
    if (p != null) {
      const diff = c - p;
      delta = m.d(diff);
      rel = m.rate ? diff : diff / Math.abs(p || 1);
      const sig = Math.abs(rel) >= 0.03;
      dir = !sig ? 'same' : rel * m.better > 0 ? 'up' : 'down';
    }
    stats.push({ k: m.k, label: m.label, cur: m.f(c), prev: p != null ? m.f(p) : null, delta, dir, strength: Math.abs(rel) });
  }
  const up = stats.filter((s) => s.dir === 'up').sort((a, b) => b.strength - a.strength);
  const down = stats.filter((s) => s.dir === 'down').sort((a, b) => b.strength - a.strength);
  const t0 = start.getTime(); const t1 = t0 + 7 * 86400000;
  const res = computeAchievements(allGames, pid);
  const best = new Map();
  for (const ach of ACHIEVEMENTS) {
    const d = res[ach.id].unlocked && new Date(res[ach.id].unlocked).getTime();
    if (!d || d < t0 || d >= t1) continue;
    const k = ach.series || ach.id; const c = best.get(k);
    if (!c || (ach.level || 0) > (c.ach.level || 0)) best.set(k, { name: me.name, color: me.color, ach });
  }
  const unlocked = [...best.values()].sort((x, y) => y.ach.tier - x.ach.tier);
  const real = cur.filter((g) => !isTraining(g.mode));
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const end = new Date(t1 - 86400000);
  return {
    personal: true, title: `La semaine de ${me.name}`, date: start, name: me.name, color: me.color,
    sub: `Du ${fmt(start)} au ${fmt(end)}`,
    tiles: [['Parties', String(real.length)], ['Legs gagnés', `${sc.legsWon} / ${sc.legsPlayed}`], ['Fléchettes', String(sc.totalDarts)]],
    stats, up, down, unlocked, hasPrev: sp.totalDarts > 0,
  };
}
