// Niveau par jeu et niveau global (0 à 100, avec une lettre).
// Chaque indicateur est converti en score grâce aux seuils calibrés (voir grades.js).
import { x01Advanced, cricketAdvanced, shanghaiAdvanced, atcAdvanced, baseballAdvanced, killerAdvanced, countupAdvanced } from './advanced.js';
import { afterReset } from './stats.js';
import { DRILL_GRADE, GRADES, GRADE_LABEL, gradeOfScore, gradeTraining, scoreOf, gradedDrills } from './grades.js';
import { isTraining } from './modes.js';

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)} %`);
const f1 = (v) => (v == null ? '-' : v.toFixed(1));

// Indicateurs de niveau. thr = valeurs qui donnent S, A, B, C, D.
export const METRICS = {
  x01avg: { label: 'Moyenne 3 fléchettes', thr: { S: 66, A: 51, B: 40, C: 31, D: 24 }, best: 95, worst: 12, fmt: f1 },
  x01fin: { label: 'Taux de checkout', thr: { S: 0.24, A: 0.18, B: 0.115, C: 0.077, D: 0.043 }, best: 0.46, worst: 0.01, fmt: pct },
  cricket: { label: 'Marques par tour (MPR)', thr: { S: 3.6, A: 2.7, B: 2.15, C: 1.7, D: 1.35 }, best: 4.6, worst: 1.0, fmt: (v) => (v == null ? '-' : v.toFixed(2)) },
  countup: { label: 'Points par volée', thr: { S: 84, A: 63, B: 53, C: 44, D: 38.5 }, best: 110, worst: 28, fmt: f1 },
  shanghai: { label: 'Précision sur le numéro', thr: { S: 0.85, A: 0.72, B: 0.6, C: 0.48, D: 0.32 }, best: 0.98, worst: 0.1, fmt: pct },
  atc: { label: 'Précision sur la cible', thr: { S: 0.59, A: 0.43, B: 0.36, C: 0.28, D: 0.185 }, best: 0.81, worst: 0.1, fmt: pct },
  baseball: { label: 'Points par partie', thr: { S: 37, A: 27, B: 21, C: 16, D: 11 }, best: 50, worst: 4, fmt: f1 },
  killer: { label: 'Précision sur ton double', thr: { S: 0.27, A: 0.19, B: 0.135, C: 0.09, D: 0.05 }, best: 0.44, worst: 0.01, fmt: pct },
};

// poids dans le niveau global (le X01 compte le plus, c'est le jeu de référence)
export const LEVEL_MODES = [
  { id: 'x01', label: 'X01', weight: 3, need: 'au moins 3 legs et 60 fléchettes' },
  { id: 'cricket', label: 'Cricket', weight: 2, need: 'au moins 3 legs' },
  { id: 'countup', label: 'Count Up', weight: 1.5, need: 'au moins 2 parties' },
  { id: 'shanghai', label: 'Shanghai', weight: 1, need: 'au moins 2 parties' },
  { id: 'atc', label: 'Around the Clock', weight: 1, need: 'au moins 2 parties' },
  { id: 'baseball', label: 'Baseball', weight: 1, need: 'au moins 2 parties' },
  { id: 'killer', label: 'Killer', weight: 1, need: 'au moins 3 legs' },
  { id: 'train', label: 'Entraînements', weight: 1.5, need: 'au moins 1 séance notée' },
];

const clip = (v) => Math.max(0, Math.min(100, v));
const mk = (key, v) => { const s = scoreOf(METRICS[key], v); return s == null ? null : { key, value: v, shown: METRICS[key].fmt(v), score: s }; };
const blend = (parts) => {
  const ok = parts.filter((p) => p.m);
  if (!ok.length) return null;
  const w = ok.reduce((a, p) => a + p.w, 0);
  return clip(ok.reduce((a, p) => a + p.m.score * p.w, 0) / w);
};

// score d'entraînement : moyenne des 3 dernières séances de chaque exercice, puis moyenne des exercices
export function trainingLevel(games, pid) {
  const per = {};
  for (const g of afterReset(games, pid)) {
    if (!isTraining(g.mode) || !g.player_ids.includes(pid) || !DRILL_GRADE[g.mode]) continue;
    const gr = gradeTraining(g);
    if (!gr) continue;
    (per[g.mode] ||= []).push({ at: new Date(g.created_at).getTime(), score: gr.score });
  }
  const drills = Object.entries(per).map(([id, arr]) => {
    const last = arr.sort((a, b) => a.at - b.at).slice(-3);
    const score = last.reduce((a, x) => a + x.score, 0) / last.length;
    return { id, score, grade: gradeOfScore(score), n: arr.length };
  });
  if (!drills.length) return null;
  const score = drills.reduce((a, d) => a + d.score, 0) / drills.length;
  return { score, grade: gradeOfScore(score), drills, sessions: drills.reduce((a, d) => a + d.n, 0) };
}

export function levelOf(games, pid) {
  const gs = afterReset(games, pid);
  const out = {};
  const x = x01Advanced(gs, pid);
  if (x.legs >= 3 && x.darts >= 60) {
    const parts = [{ m: mk('x01avg', x.avgAll), w: 0.75 }, { m: x.coAtt >= 10 ? mk('x01fin', x.coRate) : null, w: 0.25 }];
    const score = blend(parts);
    out.x01 = { score, metrics: parts.filter((p) => p.m).map((p) => p.m), n: x.legs, unit: 'legs' };
  }
  const c = cricketAdvanced(gs, pid);
  if (c.legs >= 3 && c.mpr != null) { const m = mk('cricket', c.mpr); out.cricket = { score: m.score, metrics: [m], n: c.legs, unit: 'legs' }; }
  const cu = countupAdvanced(gs, pid);
  if (cu.legs >= 2 && cu.turnAvg != null) { const m = mk('countup', cu.turnAvg); out.countup = { score: m.score, metrics: [m], n: cu.legs, unit: 'parties' }; }
  const sh = shanghaiAdvanced(gs, pid);
  if (sh.legs >= 2 && sh.pct.hit != null) { const m = mk('shanghai', sh.pct.hit); out.shanghai = { score: m.score, metrics: [m], n: sh.legs, unit: 'parties' }; }
  const at = atcAdvanced(gs, pid);
  if (at.legs >= 2 && at.acc != null) { const m = mk('atc', at.acc); out.atc = { score: m.score, metrics: [m], n: at.legs, unit: 'parties' }; }
  const bb = baseballAdvanced(gs, pid);
  if (bb.legs >= 2 && bb.ptsAvg != null) { const m = mk('baseball', bb.ptsAvg); out.baseball = { score: m.score, metrics: [m], n: bb.legs, unit: 'parties' }; }
  const k = killerAdvanced(gs, pid);
  if (k.legs >= 3 && k.doubleAcc != null) { const m = mk('killer', k.doubleAcc); out.killer = { score: m.score, metrics: [m], n: k.legs, unit: 'legs' }; }
  const tr = trainingLevel(gs, pid);
  if (tr) out.train = { score: tr.score, metrics: [], n: tr.sessions, unit: 'séances', drills: tr.drills };

  let wsum = 0; let acc = 0;
  const modes = LEVEL_MODES.map((m) => {
    const r = out[m.id];
    if (!r) return { ...m, ok: false };
    wsum += m.weight; acc += r.score * m.weight;
    return { ...m, ok: true, ...r, score: r.score, grade: gradeOfScore(r.score) };
  });
  const score = wsum ? acc / wsum : null;
  return { score, grade: score == null ? null : gradeOfScore(score), label: score == null ? null : GRADE_LABEL[gradeOfScore(score)], modes, used: modes.filter((m) => m.ok).length };
}

export { GRADES, GRADE_LABEL, gradeOfScore, gradedDrills };
