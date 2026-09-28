// Le coach : repère le point faible d'un joueur en X01 et propose l'entraînement qui va avec.
// Principe : on estime ton niveau de scoring, puis on regarde ce qu'un joueur de ce niveau
// réussit normalement sur ses finish (table simulée, voir scripts/coach-calibrate.mjs).
import REF from './coachref.js';
import { x01Advanced, shanghaiAdvanced } from './advanced.js';
import { afterReset } from './stats.js';

const DAY = 86400000;

// interpolation linéaire dans la table (colonne x croissante ou décroissante)
function interp(xKey, x, yKey) {
  const rows = [...REF].sort((a, b) => a[xKey] - b[xKey]);
  if (x <= rows[0][xKey]) return rows[0][yKey];
  if (x >= rows[rows.length - 1][xKey]) return rows[rows.length - 1][yKey];
  for (let i = 1; i < rows.length; i++) {
    if (x <= rows[i][xKey]) {
      const a = rows[i - 1]; const b = rows[i];
      const k = (x - a[xKey]) / (b[xKey] - a[xKey] || 1);
      return a[yKey] + k * (b[yKey] - a[yKey]);
    }
  }
  return rows[rows.length - 1][yKey];
}

// niveau de finish : le sigma pour lequel les tentatives du joueur auraient donné autant de réussites
function finishSigma(coBy) {
  const att1 = coBy.single[0]; const att2 = coBy.double[0] + coBy.master[0];
  const hits = coBy.single[1] + coBy.double[1] + coBy.master[1];
  const expected = (r) => att1 * r.co1 + att2 * r.co2;
  const rows = [...REF].sort((a, b) => a.sigma - b.sigma); // du meilleur au moins bon
  if (hits >= expected(rows[0])) return rows[0].sigma;
  for (let i = 1; i < rows.length; i++) {
    const e0 = expected(rows[i - 1]); const e1 = expected(rows[i]);
    if (hits >= e1) return rows[i - 1].sigma + ((e0 - hits) / (e0 - e1 || 1)) * (rows[i].sigma - rows[i - 1].sigma);
  }
  return rows[rows.length - 1].sigma;
}

const pc = (v) => `${Math.round(v * 100)} %`;
const r0 = (v) => Math.round(v);

export function coachAdvice(games, pid, days = 90) {
  const since = Date.now() - days * DAY;
  const gs = afterReset(games, pid).filter((g) => new Date(g.created_at).getTime() >= since);
  const a = x01Advanced(gs, pid, 'all');
  const tips = [];
  const scoringDarts = a.until[100][0];
  const att = a.coAtt;

  if (scoringDarts < 90 || att < 20) {
    const need = [];
    if (scoringDarts < 90) need.push(`${Math.ceil((90 - scoringDarts) / 30)} leg${Math.ceil((90 - scoringDarts) / 30) > 1 ? 's' : ''} de X01`);
    if (att < 20) need.push(`${20 - att} tentatives de finish`);
    return { ready: false, need: need.join(' et '), days };
  }

  const scoring = a.avgUntil[100];
  const sScore = interp('scoring', scoring, 'sigma');
  const sFin = finishSigma(a.coBy);
  const lvlScore = interp('sigma', sScore, 'avg');
  const lvlFin = interp('sigma', sFin, 'avg');
  const hitRate = a.coHit / att;
  const att1 = a.coBy.single[0]; const att2 = a.coBy.double[0] + a.coBy.master[0];
  const expRate = (att1 * interp('sigma', sScore, 'co1') + att2 * interp('sigma', sScore, 'co2')) / att;
  const gap = lvlScore - lvlFin; // > 0 : les finish sont en dessous du scoring
  // écart réel ou simple hasard ? (loi binomiale sur les tentatives de finish)
  const z = (a.coHit - att * expRate) / Math.sqrt(att * expRate * (1 - expRate) || 1);

  let main;
  if (gap >= 4 && z <= -1.65) {
    const drill = att2 >= att1 ? 'train-doubles' : 'train-checkout';
    main = {
      kind: 'finish', drill,
      title: 'Ton point faible : les finish',
      text: `Ton scoring vaut celui d'un joueur à ${r0(lvlScore)} de moyenne, mais tes finish sont au niveau ${r0(lvlFin)}. Tu réussis ${pc(hitRate)} de tes tentatives, un joueur de ton niveau en réussit environ ${pc(expRate)}. C'est là que tu perds des legs.`,
    };
  } else if (gap <= -4 && z >= 1.65) {
    main = {
      kind: 'scoring', drill: 'train-focus20',
      title: 'Ton point faible : le scoring',
      text: `Tes finish sont au niveau d'un joueur à ${r0(lvlFin)} de moyenne, mais ton scoring plafonne à ${r0(lvlScore)} (${scoring.toFixed(1)} de moyenne tant qu'il reste plus de 100). Monter plus vite vers le finish te ferait gagner des legs.`,
    };
  } else {
    main = {
      kind: 'balanced', drill: 'train-focus20',
      title: Math.abs(gap) >= 4 ? 'Pas encore de tendance nette' : 'Jeu équilibré',
      text: Math.abs(gap) >= 4
        ? `Tes finish ont l'air ${gap > 0 ? 'un peu en dessous' : 'un peu au-dessus'} de ton scoring (niveau ${r0(lvlFin)} contre ${r0(lvlScore)}), mais sur ${att} tentatives ça peut encore être le hasard. Continue à jouer, je te dirai quand c'est sûr. En attendant, le scoring sur le 20 est toujours rentable.`
        : `Scoring et finish sont au même niveau (autour de ${r0((lvlScore + lvlFin) / 2)} de moyenne). Pour progresser, le plus rentable reste le scoring sur le 20, puis les doubles.`,
    };
  }

  // coup de mou après les premiers tours
  const early = [0, 1, 2].map((i) => a.roundAvg[i]).filter((v) => v != null);
  const late = [3, 4, 5].map((i) => a.roundAvg[i]).filter((v) => v != null);
  if (early.length === 3 && late.length === 3 && a.round[5][0] >= 10) {
    const e = early.reduce((x, y) => x + y) / 3; const l = late.reduce((x, y) => x + y) / 3;
    if (l < e * 0.85) tips.push(`Ta moyenne baisse de ${Math.round((1 - l / e) * 100)} % après les 3 premiers tours (${e.toFixed(1)} puis ${l.toFixed(1)}). Garde le même rythme, respire entre les volées.`);
  }
  // doubles préférés
  if (a.coBy.double[0] >= 20 && a.dblRate != null && a.dblRate < expRate * 0.7) tips.push('En sortie double, vise des doubles "pairs" (D20, D16, D8) : si tu rates en simple, il te reste encore un double.');

  // Shanghai : numéros faibles
  const sh = shanghaiAdvanced(gs, pid);
  const nums = Object.entries(sh.num || {}).filter(([, c]) => c.darts >= 9).map(([n, c]) => ({ n: Number(n), acc: c.hits / c.darts }));
  if (nums.length >= 6) {
    const mean = nums.reduce((x, y) => x + y.acc, 0) / nums.length;
    const weak = nums.filter((x) => x.acc < mean * 0.75).sort((x, y) => x.acc - y.acc).slice(0, 3);
    if (weak.length) tips.push(`Au Shanghai, tes numéros faibles : ${weak.map((w) => `${w.n} (${pc(w.acc)})`).join(', ')}, contre ${pc(mean)} en moyenne. Un Around the Clock les fait travailler.`);
  }

  return { ready: true, days, main, tips, lvlScore, lvlFin, scoring, hitRate, expRate, attempts: att };
}
