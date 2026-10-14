// Checkouts progressifs : 5 niveaux, on monte quand ça passe, on descend quand ça coince.
// Le niveau de départ vient de tes finish réels en X01 ; les finish que tu rates régulièrement reviennent plus souvent.
import { replayed, afterReset } from './stats.js';
import { suggestCheckout } from '../lib/board.js';

export const CO_LEVELS = [
  { n: 1, label: 'Doubles directs', hint: 'D1 à D20 et bull', lo: 2, hi: 50 },
  { n: 2, label: '2 fléchettes faciles', hint: 'de 3 à 60', lo: 3, hi: 60 },
  { n: 3, label: '2 fléchettes', hint: 'de 61 à 80', lo: 61, hi: 80 },
  { n: 4, label: '2 à 3 fléchettes', hint: 'de 81 à 100', lo: 81, hi: 100 },
  { n: 5, label: '3 fléchettes', hint: 'de 101 à 130', lo: 101, hi: 130 },
];
const doable = (r) => !!suggestCheckout(r, 'double', 3);

export function levelPool(n) {
  const out = [];
  if (n === 1) { for (let r = 2; r <= 40; r += 2) out.push(r); out.push(50); return out; }
  if (n === 2) { for (let r = 3; r <= 39; r += 2) out.push(r); for (let r = 41; r <= 60; r++) out.push(r); return out.filter(doable); }
  const { lo, hi } = CO_LEVELS[n - 1];
  for (let r = lo; r <= hi; r++) out.push(r);
  return out.filter(doable);
}

export const rateOf = (g) => {
  const t = g.data?.legs?.[0]?.targets?.length || 20;
  const done = replayed(g)[0]?.r.ps?.[0]?.succ ?? 0;
  return done / t;
};
export const nextLevel = (level, rate) => (rate >= 0.6 ? Math.min(5, level + 1) : rate <= 0.25 ? Math.max(1, level - 1) : level);

// niveau de départ + finish à retravailler d'après les parties X01 à sortie double
export function checkoutProfile(games, pid, now = Date.now()) {
  const gs = afterReset(games, pid);
  const prog = gs.filter((g) => g.mode === 'train-checkout' && g.settings?.level && g.player_ids.includes(pid) && g.data?.legs?.some((l) => l.done))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const fin = []; const stat = {};
  for (const g of gs) {
    if (g.mode !== 'x01' || (g.settings?.out || 'single') !== 'double' || !g.player_ids.includes(pid)) continue;
    if (now - new Date(g.created_at).getTime() > 120 * 86400000) continue;
    for (const { leg, r } of replayed(g)) {
      const idx = leg.order.indexOf(pid); if (idx < 0) continue;
      for (const t of r.turns) {
        if (t.p !== idx) continue;
        const rem = t.darts[0]?.remBefore;
        if (!rem || rem > 130 || !doable(rem)) continue;
        const s = (stat[rem] ||= [0, 0]); s[0] += 1; if (t.finished) { s[1] += 1; fin.push(rem); }
      }
    }
  }
  let level; let source;
  if (prog.length) {
    const last = prog[prog.length - 1];
    level = nextLevel(last.settings.level, rateOf(last)); source = 'séances';
  } else if (fin.length >= 3) {
    const m = [...fin].sort((a, b) => a - b)[Math.floor(fin.length / 2)];
    level = m <= 40 ? 1 : m <= 60 ? 2 : m <= 80 ? 3 : m <= 100 ? 4 : 5; source = 'x01';
  } else { level = 1; source = 'défaut'; }
  const failed = Object.entries(stat).filter(([, [a, s]]) => a - s >= 1 && s / a < 0.5).map(([r]) => Number(r)).sort((a, b) => stat[b][0] - stat[a][0]);
  return { level, source, failed, last: prog.length ? { level: prog[prog.length - 1].settings.level, rate: rateOf(prog[prog.length - 1]) } : null, sessions: prog.length };
}

// 20 cibles : surtout le niveau, un peu en dessous et au-dessus, plus quelques finish que tu rates en match
export function progressiveTargets(level, failed = [], rng = Math.random, count = 20) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const cur = levelPool(level); const below = level > 1 ? levelPool(level - 1) : cur; const above = level < 5 ? levelPool(level + 1) : cur;
  const maxHi = CO_LEVELS[Math.min(5, level + 1) - 1].hi;
  const redo = failed.filter((r) => r <= maxHi);
  const out = [];
  const nRedo = Math.min(redo.length, 4);
  for (let i = 0; i < nRedo; i++) out.push(redo[i]);
  while (out.length < count) { const x = rng(); out.push(pick(x < 0.7 ? cur : x < 0.85 ? below : above)); }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
