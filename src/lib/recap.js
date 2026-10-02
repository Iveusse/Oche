// Récap de soirée : regroupe les dernières parties jouées d'affilée et fabrique une image à partager.
import { replayed } from '../engine/stats.js';
import { isTraining, MODE_LABEL, startOf } from '../engine/modes.js';
import { computeAchievements, ACHIEVEMENTS } from '../engine/achievements.js';

const GAP = 3 * 3600000; // plus de 3 h sans jouer = nouvelle soirée
const endOf = (g) => {
  const ends = (g.data?.legs || []).map((l) => l.finishedAt).filter(Boolean).sort();
  return new Date(ends[ends.length - 1] || g.updated_at || g.created_at).getTime();
};

export function lastSession(games) {
  const gs = games.filter((g) => !isTraining(g.mode) && g.status === 'finished' && g.data?.legs?.some((l) => l.done))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!gs.length) return null;
  const out = [gs[gs.length - 1]];
  for (let i = gs.length - 2; i >= 0; i--) {
    if (new Date(out[0].created_at).getTime() - endOf(gs[i]) > GAP) break;
    out.unshift(gs[i]);
  }
  return { games: out, start: new Date(out[0].created_at).getTime(), end: Math.max(...out.map(endOf)) };
}

// Soirées par jour : une soirée qui passe minuit reste sur le jour où elle a commencé (coupure à 6 h du matin)
const dayKey = (iso) => { const d = new Date(new Date(iso).getTime() - 6 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const finishedGames = (games) => games.filter((g) => !isTraining(g.mode) && g.status === 'finished' && g.data?.legs?.some((l) => l.done));
// jours avec des parties terminées, le plus récent d'abord : [{ key, date, games, pids }]
export function recapDays(games) {
  const m = new Map();
  for (const g of finishedGames(games)) {
    const k = dayKey(g.created_at);
    const e = m.get(k) || { key: k, date: new Date(new Date(g.created_at).getTime() - 6 * 3600000), games: [], pids: new Set() };
    e.games.push(g); g.player_ids.forEach((id) => e.pids.add(id)); m.set(k, e);
  }
  return [...m.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
// groupe de joueurs (ensemble exact) qui a joué le plus de parties ce jour-là
export function mainGroup(dayGames) {
  const m = new Map();
  for (const g of dayGames) { const k = [...new Set(g.player_ids)].sort().join('|'); m.set(k, (m.get(k) || 0) + 1); }
  const best = [...m.entries()].sort((a, b) => b[1] - a[1] || b[0].split('|').length - a[0].split('|').length)[0];
  return best ? best[0].split('|') : [];
}
// session d'un jour donné, restreinte aux parties jouées exactement entre les joueurs choisis (même nombre de parties pour tous)
export function sessionOfDay(games, key, pids) {
  const gs = finishedGames(games).filter((g) => dayKey(g.created_at) === key && (!pids || (g.player_ids.length === pids.size && g.player_ids.every((id) => pids.has(id)))))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!gs.length) return null;
  return { games: gs, start: new Date(gs[0].created_at).getTime(), end: Math.max(...gs.map(endOf)) };
}

export function computeRecap(allGames, players, session = lastSession(allGames), pids = null) {
  if (!session) return null;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const P = {};
  const get = (id) => (P[id] ||= { id, name: byId[id]?.name || '?', color: byId[id]?.color || '#888', legs: 0, won: 0, darts: 0, pts: 0, high: 0, c180: 0, co: 0, bestLeg: null, bestLegStart: null, shanghai: 0, marks: 0, cTurns: 0, baseball: 0, countup: 0, kills: 0 });
  let legsN = 0; let activeMs = 0; const modes = {};
  for (const g of session.games) {
    modes[g.mode] = (modes[g.mode] || 0) + 1;
    for (const { leg, r } of replayed(g)) {
      legsN += 1; activeMs += leg.activeMs || 0;
      leg.order.forEach((id, idx) => {
        if (pids && !pids.has(id)) return;
        const p = get(id);
        p.legs += 1;
        if (leg.order.length > 1 && leg.ranking?.[0] === id) p.won += 1;
        let legDarts = 0;
        for (const t of r.turns) {
          if (t.p !== idx) continue;
          legDarts += t.darts.length;
          if (g.mode === 'x01') {
            const s = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
            p.darts += t.darts.length; p.pts += s; p.high = Math.max(p.high, s);
            if (s === 180) p.c180 += 1;
            if (t.finished) p.co = Math.max(p.co, t.darts[0].remBefore);
          }
          if (g.mode === 'cricket') { p.marks += t.darts.reduce((a, d) => a + (d.marks || 0), 0); p.cTurns += 1; }
        }
        if (g.mode === 'x01' && leg.ranking?.[0] === id && (p.bestLeg == null || legDarts < p.bestLeg)) { p.bestLeg = legDarts; p.bestLegStart = startOf(g, id); }
        if (g.mode === 'shanghai') p.shanghai = Math.max(p.shanghai, r.ps[idx].pts);
        if (g.mode === 'countup') p.countup = Math.max(p.countup, r.ps[idx].pts);
        if (g.mode === 'baseball') p.baseball = Math.max(p.baseball, r.ps[idx].pts);
        if (g.mode === 'killer') p.kills += r.ps[idx].kills;
      });
    }
  }
  if (!Object.keys(P).length) return null;
  const rows = Object.values(P).map((p) => ({ ...p, avg: p.darts ? (p.pts / p.darts) * 3 : null, mpr: p.cTurns ? p.marks / p.cTurns : null, rate: p.legs ? p.won / p.legs : 0 }))
    .sort((a, b) => b.won - a.won || b.rate - a.rate || (b.avg || 0) - (a.avg || 0));

  // les faits marquants de la soirée
  const top = (f, min = 0) => { const best = rows.filter((p) => f(p) != null && f(p) > min).sort((a, b) => f(b) - f(a))[0]; return best ? { p: best, v: f(best) } : null; };
  const hl = [];
  const a = top((p) => p.avg); if (a) hl.push(['Meilleure moyenne', `${a.v.toFixed(1)}`, a.p.name]);
  const h = top((p) => p.high); if (h) hl.push(['Plus gros tour', String(h.v), h.p.name]);
  const c = top((p) => p.c180); if (c) hl.push(['180', `${c.v} ×`, c.p.name]);
  const co = top((p) => p.co); if (co) hl.push(['Plus gros finish', String(co.v), co.p.name]);
  const fast = rows.filter((p) => p.bestLeg).sort((x, y) => x.bestLeg - y.bestLeg)[0];
  if (fast) hl.push(['Leg le plus rapide', `${fast.bestLeg} fl.`, `${fast.name} (${fast.bestLegStart})`]);
  const sh = top((p) => p.shanghai); if (sh) hl.push(['Meilleur Shanghai', `${sh.v} pts`, sh.p.name]);
  const bb = top((p) => p.baseball); if (bb) hl.push(['Meilleur Baseball', `${bb.v} pts`, bb.p.name]);
  const cu = top((p) => p.countup); if (cu) hl.push(['Meilleur Count Up', `${cu.v} pts`, cu.p.name]);
  const kl = top((p) => p.kills); if (kl) hl.push(['Éliminations au Killer', `${kl.v} ☠`, kl.p.name]);
  const mp = top((p) => p.mpr); if (mp) hl.push(['Meilleur MPR', mp.v.toFixed(2), mp.p.name]);

  // succès débloqués pendant la soirée
  const unlocked = [];
  for (const p of rows) {
    const res = computeAchievements(allGames, p.id);
    for (const ach of ACHIEVEMENTS) {
      const d = res[ach.id].unlocked;
      if (pids && res[ach.id].game && !session.games.some((g) => g.id === res[ach.id].game)) continue;
      if (d && new Date(d).getTime() >= session.start - 60000 && new Date(d).getTime() <= session.end + 60000) unlocked.push({ name: p.name, color: p.color, ach });
    }
  }
  // une seule ligne par série et par joueur (le palier le plus haut), les plus rares d'abord
  const best = new Map();
  for (const u of unlocked) {
    const k = u.ach.series ? `${u.name}|${u.ach.series}` : `${u.name}|${u.ach.id}`;
    const cur = best.get(k);
    if (!cur || (u.ach.level || 0) > (cur.ach.level || 0)) best.set(k, u);
  }
  unlocked.length = 0; unlocked.push(...best.values());
  unlocked.sort((x, y) => y.ach.tier - x.ach.tier || (x.ach.series ? 1 : 0) - (y.ach.series ? 1 : 0));

  return {
    date: new Date(session.start), games: session.games.length, legs: legsN, activeMs,
    modes: Object.entries(modes).map(([m, n]) => `${n} ${MODE_LABEL[m]}`).join(' · '),
    rows, highlights: hl, unlocked,
  };
}

// ---------- image ----------
const TIER_COLOR = { 1: '#d08b52', 2: '#c3cbd6', 3: '#f2c14e', 4: '#8fe3ff' };

export function drawRecap(recap) {
  const css = getComputedStyle(document.documentElement);
  const v = (n, f) => css.getPropertyValue(n).trim() || f;
  const C = { bg: v('--bg', '#0f1115'), panel: v('--panel', '#171a21'), card: v('--card', '#1f232c'), text: v('--text', '#f4f5f7'), muted: v('--muted', '#8b93a3'), accent: v('--accent', '#e8ff59'), good: v('--good', '#6ee7b7') };
  const W = 1080; const pad = 64;
  const ach = recap.unlocked.slice(0, 8);
  const H = 360 + recap.rows.length * 96 + 120 + Math.ceil(recap.highlights.length / 2) * 150 + (ach.length ? 110 + ach.length * 64 : 0) + 110;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const font = (w, s) => { x.font = `${w} ${s}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif`; };
  const rr = (X, Y, w, h, r, fill) => { x.beginPath(); x.roundRect(X, Y, w, h, r); x.fillStyle = fill; x.fill(); };
  const txt = (t, X, Y, color, align = 'left') => { x.fillStyle = color; x.textAlign = align; x.fillText(t, X, Y); };
  const fit = (t, max) => { let s = t; while (x.measureText(s).width > max && s.length > 3) s = s.slice(0, -2); return s === t ? t : `${s}…`; };

  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  // en-tête
  font(800, 30); txt('OCHE', pad, 96, C.accent);
  font(800, 64); txt(recap.title || 'Récap de la soirée', pad, 180, C.text);
  font(500, 32);
  const d = recap.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const mins = Math.round(recap.activeMs / 60000);
  if (recap.sub) txt(recap.sub, pad, 232, C.muted);
  else txt(`${d.charAt(0).toUpperCase()}${d.slice(1)} · ${recap.games} partie${recap.games > 1 ? 's' : ''} · ${recap.legs} leg${recap.legs > 1 ? 's' : ''}${mins ? ` · ${mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`} de jeu` : ''}`, pad, 232, C.muted);
  font(500, 28); txt(recap.modes, pad, 276, C.muted);

  // classement
  let y = 340;
  recap.rows.forEach((p, i) => {
    rr(pad, y, W - pad * 2, 80, 20, i === 0 ? C.card : C.panel);
    font(800, 36); txt(i === 0 ? '🏆' : `${i + 1}`, pad + 44, y + 53, i === 0 ? C.accent : C.muted, 'center');
    x.beginPath(); x.arc(pad + 112, y + 40, 18, 0, Math.PI * 2); x.fillStyle = p.color; x.fill();
    font(700, 36); txt(fit(p.name, 360), pad + 146, y + 53, C.text);
    font(800, 36); txt(`${p.won} / ${p.legs}`, W - pad - 30, y + 53, i === 0 ? C.accent : C.text, 'right');
    font(500, 24); txt(p.avg != null ? `moy. ${p.avg.toFixed(1)}` : '', W - pad - 190, y + 50, C.muted, 'right');
    y += 96;
  });
  font(500, 24); txt('legs gagnés / joués', W - pad - 30, y + 6, C.muted, 'right');
  y += 60;

  // faits marquants
  if (recap.highlights.length) {
    font(800, 34); txt(recap.hlTitle || 'Les moments forts', pad, y, C.text); y += 30;
    const cw = (W - pad * 2 - 24) / 2;
    recap.highlights.forEach(([k, val, who], i) => {
      const cx = pad + (i % 2) * (cw + 24); const cy = y + Math.floor(i / 2) * 150;
      rr(cx, cy, cw, 130, 22, C.panel);
      font(600, 24); txt(k, cx + 28, cy + 42, C.muted);
      font(800, 46); txt(val, cx + 28, cy + 96, C.accent);
      font(600, 26); txt(fit(who, cw - 60 - x.measureText(val).width), cx + cw - 28, cy + 96, C.text, 'right');
    });
    y += Math.ceil(recap.highlights.length / 2) * 150 + 40;
  }

  // succès
  if (ach.length) {
    font(800, 34); txt('Succès débloqués', pad, y + 30, C.text); y += 60;
    for (const u of ach) {
      x.beginPath(); x.arc(pad + 16, y + 26, 14, 0, Math.PI * 2); x.fillStyle = TIER_COLOR[u.ach.tier]; x.fill();
      font(700, 28); txt(fit(u.ach.name, 520), pad + 48, y + 36, C.text);
      font(500, 26); txt(fit(u.name, 300), W - pad, y + 36, C.muted, 'right');
      y += 64;
    }
    if (recap.unlocked.length > ach.length) { font(500, 24); txt(`+ ${recap.unlocked.length - ach.length} autres`, pad + 48, y + 20, C.muted); }
  }
  font(500, 22); txt('Oche · compteur de fléchettes maison', W / 2, H - 40, C.muted, 'center');
  return cv;
}
