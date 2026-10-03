// Notes (S à E) et niveau (0 à 100).
// Les seuils viennent de joueurs simulés de plusieurs niveaux (scripts/train-calibrate.mjs) :
//   S = niveau d'un joueur à ~66 de moyenne en X01, A ~51, B ~40, C ~31, D ~24, E en dessous.
import { trainingResult } from './stats.js';

export const GRADES = ['S', 'A', 'B', 'C', 'D', 'E'];
export const GRADE_LABEL = { S: 'Élite', A: 'Expert', B: 'Confirmé', C: 'Régulier', D: 'Initié', E: 'Débutant' };
export const GRADE_MIN = { S: 90, A: 75, B: 60, C: 45, D: 30, E: 0 };
export const gradeOfScore = (s) => GRADES.find((g) => s >= GRADE_MIN[g]) || 'E';

// thr = valeurs qui donnent S, A, B, C, D ; best = valeur parfaite (100) ; worst = valeur plancher (0)
// Dans les deux sens : plus petit = mieux (fléchettes) ou plus grand = mieux (points)
const SC = [['S', 90], ['A', 75], ['B', 60], ['C', 45], ['D', 30]];

export function anchorsOf(cfg) {
  return [[cfg.worst, 0], ...[...SC].reverse().map(([g, s]) => [cfg.thr[g], s]), [cfg.best, 100]];
}

// score 0..100 d'une valeur, par interpolation entre les seuils
export function scoreOf(cfg, v) {
  if (v == null || Number.isNaN(v)) return null;
  const a = anchorsOf(cfg);
  const up = a[a.length - 1][0] > a[0][0];
  const x = up ? v : -v; // on se ramène au sens « plus grand = mieux »
  const pts = a.map(([val, s]) => [up ? val : -val, s]);
  if (x <= pts[0][0]) return 0;
  if (x >= pts[pts.length - 1][0]) return 100;
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, s0] = pts[i - 1]; const [x1, s1] = pts[i];
      return s0 + ((x - x0) / (x1 - x0 || 1)) * (s1 - s0);
    }
  }
  return 100;
}

export const gradeOfValue = (cfg, v) => { const s = scoreOf(cfg, v); return s == null ? null : gradeOfScore(s); };

// ---------- Entraînements ----------
const ATC_ANY = { thr: { S: 0.55, A: 0.43, B: 0.36, C: 0.28, D: 0.19 }, best: 0.8, worst: 0.08 };
const ATC_DBL = { thr: { S: 0.26, A: 0.175, B: 0.117, C: 0.078, D: 0.047 }, best: 0.44, worst: 0.026 };
const ATC_TRI = { thr: { S: 0.13, A: 0.1, B: 0.075, C: 0.055, D: 0.035 }, best: 0.25, worst: 0.015 };

export const DRILL_GRADE = {
  'train-doubles': {
    low: true, unit: 'fléchettes', what: 'Nombre de fléchettes pour faire D1 à D20 puis le bull. Moins = mieux.',
    thr: { S: 80, A: 120, B: 180, C: 270, D: 450 }, best: 48, worst: 800,
    fmt: (v) => `${Math.round(v)} fl.`,
  },
  'train-focus20': {
    unit: 'points', what: 'Points marqués sur le 20 avec tes 99 fléchettes (simple 20, double 40, triple 60).',
    thr: { S: 2600, A: 2000, B: 1500, C: 1150, D: 750 }, best: 3650, worst: 300,
    fmt: (v) => `${Math.round(v)} pts`,
  },
  'train-checkout': {
    unit: 'finish', what: 'Nombre de finish réussis sur 20 (de 41 à 100, 3 fléchettes, sortie double).',
    thr: { S: 5, A: 4, B: 3, C: 2, D: 1 }, best: 10, worst: 0,
    fmt: (v) => `${Math.round(v)} / 20`,
  },
  'train-baseball': {
    unit: 'points', what: 'Points sur les 9 manches (maximum 81).',
    thr: { S: 37, A: 27, B: 21, C: 16, D: 11 }, best: 50, worst: 4,
    fmt: (v) => `${Math.round(v)} pts`,
  },
  'train-killer': {
    unit: 'doubles', what: 'Doubles touchés sur tes 30 fléchettes.',
    thr: { S: 8, A: 6, B: 4, C: 3, D: 2 }, best: 13, worst: 0,
    fmt: (v) => `${Math.round(v)} / 30`,
  },
  'train-atc': {
    unit: 'cibles / fléchette', what: 'Cibles validées par fléchette lancée (plus le tir est dur, plus le seuil est bas : double ou triple seuls comptent moins).',
    fmt: (v) => `${Math.round(v * 100)} %`,
  },
};

const atcCfg = (zones) => {
  const z = zones && zones.length ? zones : ['S', 'D', 'T'];
  if (z.includes('S')) return { ...DRILL_GRADE['train-atc'], ...ATC_ANY, tip: 'toutes zones' };
  if (z.length === 1 && z[0] === 'D') return { ...DRILL_GRADE['train-atc'], ...ATC_DBL, tip: 'doubles seuls' };
  return { ...DRILL_GRADE['train-atc'], ...ATC_TRI, tip: 'triples' };
};

export const gradedDrills = Object.keys(DRILL_GRADE);

// valeur comparable d'une séance (pour ATC : cibles par fléchette)
export function drillValue(game) {
  const res = trainingResult(game);
  if (!res) return null;
  if (game.mode !== 'train-atc') return { cfg: DRILL_GRADE[game.mode], value: res.value, res };
  const leg = game.data?.legs?.[0];
  const n = leg?.targets?.length;
  if (!n || !res.value) return null;
  return { cfg: atcCfg(game.settings?.zones), value: n / res.value, res };
}

// texte d'un seuil : « 80 fléchettes ou moins » / « 2 000 points ou plus »
const nf = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('fr-FR') : (Math.abs(v) < 1 ? `${Math.round(v * 100)} %` : String(v)));
export function criteria(cfg) {
  const u = cfg.unit === 'cibles / fléchette' ? '' : ` ${cfg.unit}`;
  const rows = SC.map(([g]) => {
    const v = cfg.thr[g];
    const txt = cfg.unit === 'cibles / fléchette' ? `${nf(v)} ou plus` : cfg.low ? `${nf(v)}${u} ou moins` : `${nf(v)}${u} ou plus`;
    return { grade: g, label: GRADE_LABEL[g], text: txt, value: v };
  });
  const dv = cfg.thr.D;
  rows.push({ grade: 'E', label: GRADE_LABEL.E, text: cfg.unit === 'cibles / fléchette' ? `moins de ${nf(dv)}` : cfg.low ? `plus de ${nf(dv)}${u}` : `moins de ${nf(dv)}${u}`, value: null });
  return rows;
}

// note d'une séance : lettre, score, et ce qu'il manque pour la lettre du dessus
export function gradeTraining(game) {
  const dv = drillValue(game);
  if (!dv) return null;
  const { cfg, value, res } = dv;
  const score = scoreOf(cfg, value);
  const grade = gradeOfScore(score);
  const gi = GRADES.indexOf(grade);
  let next = null;
  if (gi > 0) {
    const ng = GRADES[gi - 1]; const target = cfg.thr[ng];
    const gap = cfg.low ? value - target : target - value;
    const n = cfg.unit === 'cibles / fléchette' ? Math.max(1, Math.ceil(gap * 100)) : Math.max(1, Math.ceil(gap));
    const text = cfg.unit === 'cibles / fléchette' ? `Encore ${n} point${n > 1 ? 's' : ''} de pourcentage de plus pour décrocher le ${ng}`
      : cfg.low ? `Encore ${n} ${cfg.unit} de moins pour décrocher le ${ng}` : `Encore ${n} ${cfg.unit} de plus pour décrocher le ${ng}`;
    next = { grade: ng, target, gap, text };
  }
  return { grade, score, label: GRADE_LABEL[grade], value, res, cfg, next, rows: criteria(cfg) };
}

