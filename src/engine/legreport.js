// Bilan d'un leg : les stats du leg comparées au niveau habituel du joueur.
// On réutilise les mêmes fonctions que l'analyse, sur le leg seul puis sur l'historique d'avant.
import { x01Advanced, cricketAdvanced, shanghaiAdvanced, atcAdvanced, baseballAdvanced, killerAdvanced, countupAdvanced } from './advanced.js';
import { startOf } from './modes.js';

const f1 = (v) => v.toFixed(1);
const f0 = (v) => String(Math.round(v));
const pc = (v) => `${Math.round(v * 100)} %`;
const f2 = (v) => v.toFixed(2);
const num = (v) => v != null && !Number.isNaN(v);

// up = plus haut = mieux ; w = poids dans le verdict (les finish pèsent peu : trop aléatoires sur un leg)
const row = (label, now, ref, fmt, dir, w = 1, extra = {}) => ({ label, now, ref, fmt, dir, w, ...extra });

function rowsFor(game, pid, a, b, won) {
  const rows = [];
  const add = (...args) => rows.push(row(...args));
  switch (game.mode) {
    case 'x01': {
      add('Moyenne 3 fléchettes', a.avgAll, b.avgAll, f1, 1, 2);
      if (num(a.avgFirst[9])) add('9 premières fléchettes', a.avgFirst[9], b.avgFirst[9], f1, 1);
      if (a.turns) {
        const hi = (x) => (x.turns ? x.buckets.slice(4).reduce((p, c) => p + c, 0) / x.turns : null);
        add('Volées à 60+', hi(a), hi(b), pc, 1);
        add('Volées à 0 point', a.buckets[0] / a.turns, b.turns ? b.buckets[0] / b.turns : null, pc, -1);
      }
      const perLeg = b.legs ? b.darts / b.legs : null;
      // gagné : on compare au nombre de fléchettes habituel pour gagner ; perdu : on montre la longueur habituelle d'un leg, sans juger
      if (won) add('Fléchettes pour gagner', a.darts, b.dartsPerLeg, f0, -1, 1.5);
      else add('Fléchettes lancées', a.darts, perLeg, f0, 0);
      if (a.coAtt) {
        add('Finish tentés', a.coAtt, b.legs ? b.coAtt / b.legs : null, f1, 0, 0, { refText: b.legs ? `${f1(b.coAtt / b.legs)} par leg` : null });
        add('Réussite sur finish', a.coHit / a.coAtt, b.coRate, pc, 1, 0.4, { nowText: `${a.coHit} sur ${a.coAtt}`, refText: num(b.coRate) ? `${pc(b.coRate)}${b.coHit ? ` (1 sur ${f1(b.coAtt / b.coHit)})` : ''}` : null });
      }
      break;
    }
    case 'cricket':
      add('Marques par tour', a.mpr, b.mpr, f2, 1, 2);
      add('Triples', a.pct.t, b.pct.t, pc, 1);
      add('Hors numéros', a.pct.miss, b.pct.miss, pc, -1);
      add('Points', a.ptsAvg, b.ptsAvg, f0, 1, 0.7);
      add('Fléchettes lancées', a.darts, b.legs ? b.darts / b.legs : null, f0, 0);
      break;
    case 'shanghai':
      add('Points', a.ptsAvg, b.ptsAvg, f0, 1, 2);
      add('Précision sur le numéro', a.pct.hit, b.pct.hit, pc, 1);
      add('Triples', a.pct.t, b.pct.t, pc, 1);
      add('Fléchettes lancées', a.darts, b.legs ? b.darts / b.legs : null, f0, 0);
      break;
    case 'atc':
      if (a.finished) add('Fléchettes pour finir', a.finAvg, b.finAvg, f0, -1, 2);
      add('Précision', a.acc, b.acc, pc, 1);
      add('Fléchettes lancées', a.darts, b.legs ? b.darts / b.legs : null, f0, 0);
      break;
    case 'baseball':
      add('Points', a.ptsAvg, b.ptsAvg, f0, 1, 2);
      add('Précision', a.pct.hit, b.pct.hit, pc, 1);
      add('Coups de circuit', a.homeruns, b.legs ? b.homeruns / b.legs : null, f1, 0);
      break;
    case 'killer':
      add('Éliminations', a.kills, b.killsPerLeg, f1, 1);
      add('Vies perdues', a.lostLives, b.lostPerLeg, f1, -1);
      if (num(a.doubleAcc)) add('Précision sur ton double', a.doubleAcc, b.doubleAcc, pc, 1);
      if (num(a.dartsToKillerAvg)) add('Fléchettes pour devenir killer', a.dartsToKillerAvg, b.dartsToKillerAvg, f1, -1);
      break;
    case 'countup':
      add('Points', a.ptsAvg, b.ptsAvg, f0, 1, 2);
      add('Points par volée', a.turnAvg, b.turnAvg, f1, 1);
      add('Régularité', a.consistency, b.consistency, pc, 1, 0.6);
      add('Hors cible', a.pct.miss, b.pct.miss, pc, -1, 0.6);
      break;
    default: break;
  }
  return rows;
}

const ADV = { x01: x01Advanced, cricket: cricketAdvanced, shanghai: shanghaiAdvanced, atc: atcAdvanced, baseball: baseballAdvanced, killer: killerAdvanced, countup: countupAdvanced };
const MIN_REF = 2; // legs d'historique mini pour comparer

export function legReport(game, history, pid) {
  const fn = ADV[game.mode];
  if (!fn) return null;
  const legs = game.data.legs;
  const leg = legs[legs.length - 1];
  if (!leg || leg.order.indexOf(pid) < 0) return null;
  const won = leg.ranking?.[0] === pid && leg.order.length > 1;
  const syn = [{ ...game, data: { ...game.data, legs: [{ ...leg, done: true }] } }];
  const earlier = legs.slice(0, -1);
  const prior = [...history.filter((g) => g.id !== game.id && g.player_ids.includes(pid)), ...(earlier.length ? [{ ...game, data: { ...game.data, legs: earlier } }] : [])];
  let start = 'all'; let a; let b;
  if (game.mode === 'x01') {
    start = startOf(game, pid);
    a = fn(syn, pid, 'all'); b = fn(prior, pid, start);
    if (b.legs < MIN_REF) b = fn(prior, pid, 'all');
  } else { a = fn(syn, pid); b = fn(prior, pid); }
  if (!a.legs) return null;
  const enough = b.legs >= MIN_REF;
  const rows = rowsFor(game, pid, a, b, won).filter((r) => num(r.now)).map((r) => {
    const ok = enough && num(r.ref) && r.dir !== 0;
    // réf. à zéro (ex. 0 % hors cible d'habitude) : on évite la division par zéro avec un plancher
    const rel = ok ? (r.dir * (r.now - r.ref)) / Math.max(Math.abs(r.ref), r.fmt === pc ? 0.05 : 0.5) : null;
    return {
      label: r.label, now: r.now, ref: ok || r.refText ? r.ref : null, nowShown: r.nowText || r.fmt(r.now),
      refShown: enough && (r.refText || (num(r.ref) ? r.fmt(r.ref) : null)),
      rel, tone: rel == null ? 0 : rel > 0.05 ? 1 : rel < -0.05 ? -1 : 0, w: r.w,
    };
  });
  const scored = rows.filter((r) => r.rel != null && r.w > 0);
  let verdict = null; let score = null;
  if (scored.length) {
    const wsum = scored.reduce((x, r) => x + r.w, 0);
    // chaque écart est plafonné à ±40 % pour qu'un seul chiffre ne décide pas de tout
    score = scored.reduce((x, r) => x + Math.max(-0.4, Math.min(0.4, r.rel)) * r.w, 0) / wsum;
    verdict = score > 0.07 ? 'good' : score < -0.07 ? 'bad' : 'ok';
  }
  return { pid, mode: game.mode, won, enough, refLegs: b.legs, rows, verdict, score };
}
