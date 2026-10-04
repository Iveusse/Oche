// Programme de la semaine, objectif de niveau et courbe de progression.
import { levelOf } from './level.js';
import { DRILL_GRADE, GRADES, GRADE_MIN, GRADE_LABEL, gradeOfScore, gradeTraining, criteria } from './grades.js';
import { afterReset } from './stats.js';
import { isTraining } from './modes.js';

const WEEK = 7 * 86400000;
const DRILL_IDS = ['train-doubles', 'train-focus20', 'train-checkout', 'train-baseball', 'train-killer'];
export const DRILL_NAME = {
  'train-doubles': 'Tour des doubles', 'train-focus20': 'Focus 20', 'train-checkout': 'Checkouts 41-100',
  'train-baseball': 'Baseball solo', 'train-killer': 'Doubles de Killer',
};
const GAME_NAME = { x01: 'X01', cricket: 'Cricket', countup: 'Count Up', shanghai: 'Shanghai', atc: 'Around the Clock', baseball: 'Baseball', killer: 'Killer' };

export function weekStart(now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
  return d.getTime();
}

// niveau global cumulé à la fin de chacune des dernières semaines
export function levelHistory(games, pid, weeks = 12, now = Date.now()) {
  const mine = games.filter((g) => g.player_ids.includes(pid));
  const pts = [];
  const w0 = weekStart(now);
  for (let k = weeks - 1; k >= 0; k--) {
    const end = k === 0 ? now : w0 - (k - 1) * WEEK;
    const gs = mine.filter((g) => new Date(g.created_at).getTime() <= end);
    if (!gs.length) continue;
    const L = levelOf(gs, pid);
    if (L.score != null) pts.push({ at: end, score: L.score, grade: L.grade });
  }
  return pts;
}

// objectif : la lettre du dessus, ce qui rapporterait le plus de points
export function nextGoal(L) {
  if (!L || L.score == null) return null;
  const gi = GRADES.indexOf(L.grade);
  if (gi === 0) return { reached: true, grade: 'S', score: L.score };
  const to = GRADES[gi - 1]; const need = GRADE_MIN[to] - L.score;
  const ok = L.modes.filter((m) => m.ok);
  // levier : poids × marge de progression
  const lever = [...ok].sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score))[0];
  return { reached: false, from: L.grade, to, label: GRADE_LABEL[to], need, score: L.score, target: GRADE_MIN[to], lever: lever ? { id: lever.id, label: lever.label, score: lever.score } : null };
}

// séances de la semaine en cours par exercice
function doneThisWeek(games, pid, now) {
  const t0 = weekStart(now); const m = {};
  for (const g of afterReset(games, pid)) {
    if (!isTraining(g.mode) || !g.player_ids.includes(pid) || new Date(g.created_at).getTime() < t0) continue;
    if (!g.data?.legs?.some((l) => l.done)) continue;
    m[g.mode] = (m[g.mode] || 0) + 1;
  }
  return m;
}

export function weeklyPlan(games, pid, now = Date.now()) {
  const gs = afterReset(games, pid);
  const L = levelOf(gs, pid);
  const per = {};
  for (const g of gs) {
    if (!isTraining(g.mode) || !g.player_ids.includes(pid) || !DRILL_GRADE[g.mode]) continue;
    const gr = gradeTraining(g);
    if (gr) (per[g.mode] ||= []).push({ at: new Date(g.created_at).getTime(), gr });
  }
  const done = doneThisWeek(gs, pid, now);
  const rows = DRILL_IDS.map((id) => {
    const arr = (per[id] || []).sort((a, b) => a.at - b.at);
    const last3 = arr.slice(-3);
    const score = last3.length ? last3.reduce((a, x) => a + x.gr.score, 0) / last3.length : null;
    const last = arr[arr.length - 1];
    return { id, score, grade: score == null ? null : gradeOfScore(score), n: arr.length, lastAt: last?.at || 0, lastGrade: last?.gr.grade || null };
  });
  // priorité : jamais fait d'abord, puis les notes les plus basses, puis les plus anciens
  const order = [...rows].sort((a, b) => (a.score ?? -1) - (b.score ?? -1) || a.lastAt - b.lastAt);
  const items = order.slice(0, 3).map((r, i) => {
    const cfg = DRILL_GRADE[r.id];
    const gi = r.grade ? GRADES.indexOf(r.grade) : GRADES.length - 1;
    const to = gi > 0 ? GRADES[gi - 1] : null;
    const crit = criteria(cfg);
    const goal = to ? crit.find((c) => c.grade === to)?.text : null;
    const times = i < 2 ? 2 : 1;
    const why = r.score == null ? 'Pas encore essayé : fais une première séance pour avoir ta note'
      : r.grade === 'S' ? 'Au top, une séance pour entretenir'
        : `Ta note actuelle : ${r.grade}${i === 0 ? ', ton point faible' : ''}`;
    return { id: r.id, name: DRILL_NAME[r.id], grade: r.grade, why, goal: goal ? `Pour le ${to} : ${goal}` : null, times, done: done[r.id] || 0 };
  });
  // jeu à jouer en partie : le plus faible des jeux qu'il pratique
  const modes = L.modes.filter((m) => m.ok && GAME_NAME[m.id]);
  const weakest = [...modes].sort((a, b) => a.score - b.score)[0];
  const game = weakest && modes.length >= 2 ? { id: weakest.id, name: GAME_NAME[weakest.id], grade: weakest.grade, why: `Ton jeu le plus faible (${weakest.grade}) : joue-en une partie cette semaine` } : null;
  const total = items.reduce((a, x) => a + x.times, 0);
  const finished = items.reduce((a, x) => a + Math.min(x.done, x.times), 0);
  return { items, game, total, finished, goal: nextGoal(L), level: L, weekStart: weekStart(now) };
}
