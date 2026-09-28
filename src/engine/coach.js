// Le coach : repère le point faible d'un joueur en X01 et propose l'entraînement qui va avec.
// Principe : on estime ton niveau de scoring, puis on regarde ce qu'un joueur de ce niveau
// réussit normalement sur ses finish (table simulée, voir scripts/coach-calibrate.mjs).
import REF from './coachref.js';
import { x01Advanced, cricketAdvanced, atcAdvanced, shanghaiAdvanced } from './advanced.js';
import { oneDartFinish } from '../lib/board.js';
import { afterReset, replayed } from './stats.js';

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

// ---------- profils par numéro, tous modes confondus ----------
// numéros visés connus : Shanghai (numéro de la manche), Around the Clock / tour des doubles (cible),
// X01 en sortie double (le double qui finit)
function numberProfiles(gs, pid) {
  const nums = { shanghai: {}, atc: {} }; const dbl = {};
  const add = (m, k, hit) => { const c = (m[k] ||= { darts: 0, hits: 0 }); c.darts += 1; if (hit) c.hits += 1; };
  for (const g of gs) {
    if (!g.player_ids.includes(pid)) continue;
    for (const { leg, r } of replayed(g)) {
      const idx = leg.order.indexOf(pid);
      if (idx < 0) continue;
      for (const t of r.turns) {
        if (t.p !== idx) continue;
        t.darts.forEach((d, k) => {
          // Shanghai (on vise le triple) et ATC (souvent le simple) ne se comparent pas : profils séparés
          if (g.mode === 'shanghai' || g.mode === 'atc') { if (d.target != null) add(nums[g.mode], d.target, d.hit); }
          if (g.mode === 'train-doubles' && d.target != null) add(dbl, d.target, d.hit);
          if (g.mode === 'x01' && (g.settings?.out || 'single') === 'double' && d.opened && oneDartFinish(d.remBefore, 'double')) {
            const target = d.remBefore === 50 ? 25 : d.remBefore / 2;
            add(dbl, target, t.finished && k === t.darts.length - 1);
          }
        });
      }
    }
  }
  return { nums, dbl };
}

// les plus faibles d'un profil : nettement sous la moyenne du joueur ET pas explicable par le hasard
// (test binomial, seuil sévère car on teste plusieurs numéros à la fois). Le bull, plus petit, est à part.
export function weakest(profile, minDarts, ratio = 0.7, max = 3) {
  const rows = Object.entries(profile).filter(([n, c]) => Number(n) !== 25 && c.darts >= minDarts).map(([n, c]) => ({ n: Number(n), acc: c.hits / c.darts, darts: c.darts, hits: c.hits }));
  if (rows.length < 4) return null;
  const mean = rows.reduce((a, x) => a + x.hits, 0) / rows.reduce((a, x) => a + x.darts, 0);
  if (!mean) return null;
  const H = rows.reduce((a, x) => a + x.hits, 0); const D = rows.reduce((a, x) => a + x.darts, 0);
  // comparé à la réussite sur TOUS LES AUTRES numéros
  const z = (x) => { const m = (H - x.hits) / (D - x.darts); return m > 0 ? (x.hits - x.darts * m) / Math.sqrt(x.darts * m * (1 - m)) : 0; };
  const weak = rows.filter((x) => x.acc < mean * ratio && z(x) <= -2.6).sort((a, b) => a.acc - b.acc).slice(0, max);
  return weak.length ? { weak, mean } : null;
}
const nm = (n) => (n === 25 ? 'bull' : String(n));
const atcDrill = (nums, zones, label) => ({ kind: 'atc', label, settings: { zones, order: 'asc', bull: false, skip: false, ...(nums ? { nums } : {}) } });

export function coachAdvice(games, pid, days = 90) {
  const since = Date.now() - days * DAY;
  const gs = afterReset(games, pid).filter((g) => new Date(g.created_at).getTime() >= since);
  const plans = []; // { mode, score (gravité), title, text, drill }
  const tips = [];
  const need = [];
  let levels = null;

  // ---- X01 : scoring contre finish ----
  const a = x01Advanced(gs, pid, 'all');
  const scoringDarts = a.until[100][0];
  const att = a.coAtt;
  if (scoringDarts >= 90 && att >= 20) {
    const scoring = a.avgUntil[100];
    const sScore = interp('scoring', scoring, 'sigma');
    const sFin = finishSigma(a.coBy);
    const lvlScore = interp('sigma', sScore, 'avg');
    const lvlFin = interp('sigma', sFin, 'avg');
    const hitRate = a.coHit / att;
    const att1 = a.coBy.single[0]; const att2 = a.coBy.double[0] + a.coBy.master[0];
    const expRate = (att1 * interp('sigma', sScore, 'co1') + att2 * interp('sigma', sScore, 'co2')) / att;
    const gap = lvlScore - lvlFin;
    const z = (a.coHit - att * expRate) / Math.sqrt(att * expRate * (1 - expRate) || 1);
    levels = { lvlScore, lvlFin, weak: null };
    if (gap >= 4 && z <= -1.65) {
      levels.weak = 'finish';
      plans.push({ mode: 'X01', score: 2 + Math.min(2, -z / 2), title: 'X01 : tes finish te coûtent des legs', drill: { kind: 'drill', id: att2 >= att1 ? 'train-doubles' : 'train-checkout' },
        text: `Ton scoring vaut celui d'un joueur à ${r0(lvlScore)} de moyenne, mais tes finish sont au niveau ${r0(lvlFin)} : tu réussis ${pc(hitRate)} de tes tentatives, un joueur de ton niveau environ ${pc(expRate)}.` });
    } else if (gap <= -4 && z >= 1.65) {
      levels.weak = 'scoring';
      plans.push({ mode: 'X01', score: 2 + Math.min(2, z / 2), title: 'X01 : ton scoring te freine', drill: { kind: 'drill', id: 'train-focus20' },
        text: `Tes finish sont au niveau d'un joueur à ${r0(lvlFin)} de moyenne, mais ton scoring plafonne à ${r0(lvlScore)} (${scoring.toFixed(1)} tant qu'il reste plus de 100). Monter plus vite vers le finish te ferait gagner des legs.` });
    } else {
      plans.push({ mode: 'X01', score: 0.6, title: Math.abs(gap) >= 4 ? 'X01 : pas encore de tendance nette' : 'X01 : jeu équilibré', drill: { kind: 'drill', id: 'train-focus20' },
        text: Math.abs(gap) >= 4
          ? `Tes finish ont l'air ${gap > 0 ? 'un peu en dessous' : 'un peu au-dessus'} de ton scoring (niveau ${r0(lvlFin)} contre ${r0(lvlScore)}), mais sur ${att} tentatives ça peut encore être le hasard.`
          : `Scoring et finish au même niveau (autour de ${r0((lvlScore + lvlFin) / 2)} de moyenne). Le scoring sur le 20 reste le plus rentable.` });
    }
    const early = [0, 1, 2].map((i) => a.roundAvg[i]).filter((v) => v != null);
    const late = [3, 4, 5].map((i) => a.roundAvg[i]).filter((v) => v != null);
    if (early.length === 3 && late.length === 3 && a.round[5][0] >= 10) {
      const e = early.reduce((x, y) => x + y) / 3; const l = late.reduce((x, y) => x + y) / 3;
      if (l < e * 0.85) tips.push(`X01 : ta moyenne baisse de ${Math.round((1 - l / e) * 100)} % après les 3 premiers tours (${e.toFixed(1)} puis ${l.toFixed(1)}). Garde le même rythme, respire entre les volées.`);
    }
  } else if (a.legs > 0) {
    need.push(`X01 : encore ${Math.max(Math.ceil((90 - scoringDarts) / 30), 0) || 1} leg(s) et ${Math.max(0, 20 - att)} tentatives de finish`);
  }

  const { nums, dbl } = numberProfiles(gs, pid);

  // ---- doubles faibles (X01 sortie double + tour des doubles) ----
  const wd = weakest(dbl, 12, 0.6);
  if (wd) {
    const list = wd.weak.map((w) => w.n);
    plans.push({ mode: 'Doubles', score: 1.2 + (1 - wd.weak[0].acc / wd.mean), title: `Doubles à travailler : ${list.map((n) => (n === 25 ? 'bull' : `D${n}`)).join(', ')}`,
      drill: atcDrill(list, ['D'], `Around the Clock sur ${list.map((n) => (n === 25 ? 'bull' : `D${n}`)).join(', ')}`),
      text: `Tu réussis ${wd.weak.map((w) => `${w.n === 25 ? 'le bull' : `D${w.n}`} : ${pc(w.acc)}`).join(', ')}, contre ${pc(wd.mean)} en moyenne sur tes doubles. Un Around the Clock uniquement sur ces doubles les fait travailler.` });
  }

  // ---- numéros faibles (Shanghai + Around the Clock) ----
  const ws = weakest(nums.shanghai, 9, 0.75); const wa = weakest(nums.atc, 9, 0.75);
  const wn = ws && wa ? { weak: [...ws.weak, ...wa.weak.filter((x) => !ws.weak.some((y) => y.n === x.n))].slice(0, 3), mean: ws.mean, both: true } : ws || wa;
  if (wn) {
    const list = wn.weak.map((w) => w.n);
    plans.push({ mode: 'Shanghai / ATC', score: 1 + (1 - wn.weak[0].acc / wn.mean), title: `Numéros faibles : ${list.map(nm).join(', ')}`,
      drill: atcDrill(list, ['S', 'D', 'T'], `Around the Clock sur ${list.length > 1 ? 'les' : 'le'} ${list.map(nm).join(', ')}`),
      text: `${ws && !wa ? 'Au Shanghai' : wa && !ws ? "À l'Around the Clock" : "Au Shanghai et à l'Around the Clock"}, tu touches ${wn.weak.map((w) => `le ${nm(w.n)} : ${pc(w.acc)}`).join(', ')} du temps, nettement moins que sur tes autres numéros (${pc(wn.mean)} en moyenne).` });
  }

  // ---- Shanghai : conseil général, même avec peu de parties ----
  const sa = shanghaiAdvanced(gs, pid);
  if (sa.legs >= 2 && sa.darts >= 60) {
    const hit = sa.pct.hit ?? 0; const tri = sa.pct.t ?? 0;
    const legsAll = sa.legs + a.legs + (cricketAdvanced(gs, pid).legs || 0) + (atcAdvanced(gs, pid).legs || 0);
    const weight = 0.5 + 0.6 * (sa.legs / Math.max(1, legsAll)); // plus tu joues au Shanghai, plus ce conseil compte
    // tendance (pas encore prouvée) sur les numéros les moins touchés
    const rows = Object.entries(sa.num).filter(([, c]) => c.darts >= 9).map(([n, c]) => ({ n: Number(n), acc: c.hits / c.darts }));
    const lows = rows.length >= 6 ? rows.filter((x) => x.acc < hit * 0.6).sort((x, y) => x.acc - y.acc).slice(0, 3) : [];
    const lowTxt = lows.length && !wn ? ` À surveiller : ${lows.map((w) => `le ${w.n} (${pc(w.acc)})`).join(', ')}, mais c'est encore trop tôt pour être sûr.` : '';
    if (hit < 0.3) {
      plans.push({ mode: 'Shanghai', score: weight, title: 'Shanghai : touche plus souvent le bon numéro',
        drill: lows.length >= 2 ? atcDrill(lows.map((w) => w.n), ['S', 'D', 'T'], `Around the Clock sur ${lows.map((w) => w.n).join(', ')}`) : atcDrill(null, ['S', 'D', 'T'], 'Around the Clock 1 → 20'),
        text: `Tu touches le numéro de la manche ${pc(hit)} du temps (${sa.darts} fléchettes). Avant de chercher les triples, la priorité est de toucher le numéro à chaque volée : un Around the Clock travaille exactement ça.${lowTxt}` });
    } else if (tri < 0.07) {
      plans.push({ mode: 'Shanghai', score: weight, title: 'Shanghai : il te manque des triples',
        drill: atcDrill(null, ['T'], 'Around the Clock en triples'),
        text: `Tu touches le bon numéro ${pc(hit)} du temps, mais seulement ${pc(tri)} de tes fléchettes font un triple. Au Shanghai, un triple vaut 3 simples : c'est là que se gagnent les points.${lowTxt}` });
    } else {
      plans.push({ mode: 'Shanghai', score: weight * 0.7, title: 'Shanghai : va chercher les Shanghai',
        drill: atcDrill(null, ['D', 'T'], 'Around the Clock doubles et triples'),
        text: `Bonne précision (${pc(hit)} sur le numéro, ${pc(tri)} de triples). Prochaine étape : les doubles, qui te manquent pour boucler simple + double + triple dans le même tour.${lowTxt}` });
    }
  }

  // ---- Cricket ----
  const c = cricketAdvanced(gs, pid);
  if (c.legs >= 8) {
    const rows = [20, 19, 18, 17, 16, 15].map((n) => ({ n, m: c.perNumAvg[n] ?? 0 }));
    const mean = rows.reduce((x, y) => x + y.m, 0) / rows.length;
    const weak = rows.filter((x) => mean > 0 && x.m < mean * 0.6).sort((x, y) => x.m - y.m).slice(0, 2);
    const bull = c.perNumAvg[25] ?? 0;
    if (weak.length) {
      const list = weak.map((w) => w.n);
      plans.push({ mode: 'Cricket', score: 1 + (1 - weak[0].m / mean), title: `Cricket : le ${list.join(' et le ')} te manquent`,
        drill: atcDrill(list, ['T'], `Around the Clock triples sur ${list.join(', ')}`),
        text: `Tu marques ${weak.map((w) => `${w.m.toFixed(1)} fois le ${w.n}`).join(', ')} par leg, contre ${mean.toFixed(1)} en moyenne sur les numéros du 15 au 20. Des triples sur ces numéros t'aideront à les fermer plus vite.` });
    } else if (bull < 1 && c.legs >= 6) {
      plans.push({ mode: 'Cricket', score: 1.1, title: 'Cricket : le bull te bloque', drill: atcDrill([25], ['S', 'D'], 'Around the Clock sur le bull'),
        text: `Tu ne marques que ${bull.toFixed(1)} fois le bull par leg : c'est souvent lui qui décide la fin d'un Cricket.` });
    }
    if (c.pct?.t != null && c.pct.t < 0.08 && c.darts >= 60) tips.push(`Cricket : seulement ${pc(c.pct.t)} de tes fléchettes font des triples. Viser le triple même quand un simple suffit accélère la fermeture des numéros.`);
  } else if (c.legs > 0) need.push(`Cricket : encore ${8 - c.legs} leg(s)`);

  // ---- Around the Clock : vitesse ----
  const t = atcAdvanced(gs, pid);
  if (t.finished >= 3 && t.acc != null && t.acc < 0.2) tips.push(`Around the Clock : ${pc(t.acc)} de réussite par fléchette. Commence par les simples seulement, puis ajoute doubles et triples quand tu passes 30 %.`);

  if (!plans.length) return { ready: false, need: need.length ? need.join(' · ') : 'quelques parties (X01, Shanghai, Cricket ou Around the Clock)', days };
  plans.sort((x, y) => y.score - x.score);
  return { ready: true, days, main: plans[0], others: plans.slice(1), tips, levels };
}
