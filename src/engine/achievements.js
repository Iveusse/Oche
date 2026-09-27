// Succès : calculés à partir de l'historique, dans l'ordre chronologique.
// Deux familles : des séries à paliers (1, 10, 50...) et des exploits uniques.
import { replayed, afterReset } from './stats.js';
import { isTraining, shanghaiNumbers, CRICKET_NUMS } from './modes.js';
import RARITY from './rarity.js';

export const TIER = { 1: 'Bronze', 2: 'Argent', 3: 'Or', 4: 'Platine' };

// Niveau d'après le nombre de parties qu'il faut en moyenne pour y arriver
// (joueur de référence ~33 de moyenne, calculé par simulation : voir scripts/calibrate.mjs)
export const tierFromE = (e) => (e == null ? 4 : e <= 10 ? 1 : e <= 50 ? 2 : e <= 250 ? 3 : 4);
// Rareté exprimée en legs (une partie peut enchaîner plusieurs legs)
const BASIS_LABEL = { all: 'legs', x01: 'legs de X01', cricket: 'legs de Cricket', shanghai: 'legs de Shanghai', atc: "legs d'ATC", games: 'parties' };
export const rarityText = (e, basis = 'all', cumulative = false) => {
  if (e == null) return null;
  const lbl = BASIS_LABEL[basis] || 'parties';
  if (e > 100000) return 'Moins d\'une chance sur 100 000 par leg : légendaire';
  if (e <= 1.2) return cumulative ? 'Dès le premier leg ou presque' : 'Arrive presque à chaque leg';
  const n = e < 20 ? Math.round(e) : e < 100 ? Math.round(e / 5) * 5 : e < 1000 ? Math.round(e / 50) * 50 : Math.round(e / 500) * 500;
  return cumulative ? `En moyenne au bout de ${n.toLocaleString('fr-FR')} ${lbl}` : `Environ 1 fois toutes les ${n.toLocaleString('fr-FR')} ${lbl}`;
};

// ---------- Séries à paliers ----------
// basis : sur quelles parties se mesure le rythme ; les paliers sont générés à partir du rythme simulé
export const SERIES = [
  { key: 'games', countsGames: true, name: 'Parties jouées', unit: 'parties', basis: 'all', get: (c) => c.games },
  { key: 'legs-won', name: 'Legs gagnés', unit: 'legs', basis: 'all', get: (c) => c.legsWon },
  { key: 'darts', name: 'Fléchettes lancées', unit: 'fléchettes', basis: 'all', get: (c) => c.darts },
  { key: 'triples', name: 'Triples', unit: 'triples', basis: 'all', get: (c) => c.triples },
  { key: 'doubles', name: 'Doubles', unit: 'doubles', basis: 'all', get: (c) => c.doubles },
  { key: 'bull50', name: 'Bulls à 50', unit: 'bulls', basis: 'all', get: (c) => c.bulls },
  { key: 'bull25', name: 'Bulls à 25', unit: 'bulls', basis: 'all', get: (c) => c.bull25 },
  { key: 'tons', name: 'Tours à 100+', unit: 'tours', basis: 'x01', get: (c) => c.tons },
  { key: 'ton40', name: 'Tours à 140+', unit: 'tours', basis: 'x01', get: (c) => c.c140 },
  { key: '180', name: '180', unit: 'fois 180', basis: 'x01', get: (c) => c.c180 },
  { key: 'checkouts', name: 'Checkouts réussis', unit: 'checkouts', basis: 'x01', get: (c) => c.checkouts },
  { key: 'big-co', name: 'Checkouts à 100+', unit: 'checkouts', basis: 'x01', get: (c) => c.bigCheckouts },
  { key: 'x01-points', name: 'Points marqués en X01', unit: 'points', basis: 'x01', get: (c) => c.x01Points },
  { key: 'x01', countsGames: true, name: 'Parties de X01', unit: 'parties', basis: 'x01', get: (c) => c.byMode.x01 },
  { key: 'cricket', countsGames: true, name: 'Parties de Cricket', unit: 'parties', basis: 'cricket', get: (c) => c.byMode.cricket },
  { key: 'shanghai', countsGames: true, name: 'Parties de Shanghai', unit: 'parties', basis: 'shanghai', get: (c) => c.byMode.shanghai },
  { key: 'atc', countsGames: true, name: "Parties d'Around the Clock", unit: 'parties', basis: 'atc', get: (c) => c.byMode.atc },
  { key: 'x01-wins', name: 'Victoires en X01', unit: 'victoires', basis: 'x01', get: (c) => c.winsByMode.x01 },
  { key: 'cricket-wins', name: 'Victoires au Cricket', unit: 'victoires', basis: 'cricket', get: (c) => c.winsByMode.cricket },
  { key: 'shanghai-wins', name: 'Victoires au Shanghai', unit: 'victoires', basis: 'shanghai', get: (c) => c.winsByMode.shanghai },
  { key: 'atc-wins', name: "Victoires à l'ATC", unit: 'victoires', basis: 'atc', get: (c) => c.winsByMode.atc },
  { key: 'marks', name: 'Marques au Cricket', unit: 'marques', basis: 'cricket', get: (c) => c.marks },
  { key: 'shanghai-hits', name: 'Touches au Shanghai', unit: 'touches', basis: 'shanghai', get: (c) => c.shanghaiHits },
  { key: 'shanghais', name: 'Shanghais réussis', unit: 'shanghais', basis: 'shanghai', get: (c) => c.shanghais },
  { key: 'misses', name: 'Mur de la cuisine', unit: 'fléchettes hors cible', basis: 'all', get: (c) => c.misses },
  { key: 'busts', name: 'Roi du bust', unit: 'busts', basis: 'x01', get: (c) => c.busts },
  // Rythmes non simulables : fixés à la main
  { key: 'trainings', name: 'Entraînements', unit: 'sessions', manual: [[1, 1], [5, 1], [15, 2], [40, 3], [100, 4]], get: (c) => c.trainings },
  { key: 'days', name: 'Jours de jeu', unit: 'jours', manual: [[1, 1], [5, 1], [15, 2], [40, 3], [100, 4], [200, 4]], get: (c) => c.days.size },
];

const NICE = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000, 100000, 150000, 250000, 500000, 1000000];
const TARGET_E = [1, 5, 15, 40, 100, 250, 600];
const nice = (x) => NICE.reduce((b, v) => (Math.abs(Math.log(v / x)) < Math.abs(Math.log(b / x)) ? v : b), 1);

// Paliers d'une série à partir de son rythme (quantité moyenne par partie)
export function seriesLevels(rate) {
  if (!rate) return [[1, 4]];
  const out = [];
  for (const e of TARGET_E) {
    const n = nice(Math.max(1, rate * e));
    if (out.length && n <= out[out.length - 1][0]) continue;
    const realE = n / rate;
    if (realE > 1500) break;
    out.push([n, tierFromE(realE), realE]);
  }
  if (!out.length) out.push([1, 4, 1 / rate]);
  return out;
}

for (const s of SERIES) {
  const rate = RARITY.series?.[s.key];
  s.levels = s.manual || seriesLevels(rate);
  s.steps = s.levels.map((l) => l[0]);
  s.tiers = s.levels.map((l) => l[1]);
  s.expect = s.levels.map((l) => l[2] ?? null);
}

// ---------- Exploits ----------
// basis/cumulative : pour afficher la rareté ; tier : utilisé seulement si la simulation ne donne rien
const best = (v, lbl) => (v ? `${lbl} : ${v}` : null);
const avgHint = (c) => (c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)} de moyenne` : null);
const b301 = (c) => best(c.bestLeg[301], 'Meilleur 301 gagné en') && `${best(c.bestLeg[301], 'Meilleur 301 gagné en')} fléchettes`;
const legIn = (n) => ({ id: `301-${n}`, basis: 'x01', name: n === 6 ? 'Le 301 parfait' : `301 en ${n}`, desc: n === 6 ? 'Gagner un 301 en 6 fléchettes (180 puis 121)' : `Gagner un 301 en ${n} fléchettes ou moins`, goal: (c) => [c.bestLeg[301] != null && c.bestLeg[301] <= n ? 1 : 0, 1], hint: b301 });
const EXPLOITS = [
  { id: 'all-modes', basis: 'all', cumulative: true, name: 'Touche-à-tout', desc: 'Jouer aux 4 modes : X01, Cricket, ATC, Shanghai', goal: (c) => [c.modesSet.size, 4], tier: 1 },
  { id: 'all-numbers', basis: 'all', cumulative: true, name: 'Tour du cadran', desc: 'Toucher chaque numéro de 1 à 20 au moins une fois', goal: (c) => [c.numbersHit.size, 20] },
  { id: 'all-doubles', basis: 'all', cumulative: true, name: 'Collection de doubles', desc: 'Toucher chaque double, de D1 à D20, plus le bull', goal: (c) => [c.doublesHit.size, 21] },
  { id: 'all-trebles', basis: 'all', cumulative: true, name: 'Collection de triples', desc: 'Toucher le triple de chaque numéro, de T1 à T20', goal: (c) => [c.treblesHit.size, 20] },
  { id: 'bed-breakfast', basis: 'x01', name: 'Bed & Breakfast', desc: 'Faire exactement 26 en un tour (le fameux 20, 5, 1)', goal: (c) => [c.got26 ? 1 : 0, 1] },
  { id: 'wall', basis: 'all', name: 'Dans le mur', desc: 'Trois fléchettes hors cible dans le même tour', goal: (c) => [c.threeMiss ? 1 : 0, 1] },
  { id: 'three-trebles', basis: 'all', name: 'Trois en un', desc: 'Trois triples dans le même tour (n\'importe lesquels)', goal: (c) => [c.maxTreblesTurn, 3] },
  { id: 'two-trebles', basis: 'all', name: 'Doublé de triples', desc: 'Deux triples dans le même tour', goal: (c) => [c.maxTreblesTurn >= 2 ? 1 : 0, 1] },
  { id: 'hat-trick', basis: 'all', name: 'Hat trick', desc: 'Trois bulls (25 ou 50) dans le même tour', goal: (c) => [c.maxBullsTurn, 3] },
  { id: 'bull-finish', basis: 'x01', name: 'Finish au centre', desc: 'Finir un leg de X01 sur le bull 50', goal: (c) => [c.bullFinish ? 1 : 0, 1] },
  { id: 'big-finish', basis: 'x01', name: 'Grand finish', desc: 'Réussir un checkout de 100 ou plus', goal: (c) => [c.highCheckout >= 100 ? 1 : 0, 1], hint: (c) => best(c.highCheckout, 'Meilleur checkout') },
  { id: 'big-fish', basis: 'x01', name: 'Big Fish', desc: 'Finir 170 : T20, T20, Bull', goal: (c) => [c.highCheckout >= 170 ? 1 : 0, 1], hint: (c) => best(c.highCheckout, 'Meilleur checkout') },
  { id: 'remontada', basis: 'x01', name: 'Remontada', desc: 'Gagner un leg de X01 après avoir eu 100 points de retard', goal: (c) => [c.remontada ? 1 : 0, 1] },
  { id: 'leg-avg-40', basis: 'x01', name: 'Rythme de croisière', desc: 'Moyenne de 40 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 40 ? 1 : 0, 1], hint: avgHint },
  { id: 'leg-avg-50', basis: 'x01', name: 'Machine à scorer', desc: 'Moyenne de 50 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 50 ? 1 : 0, 1], hint: avgHint },
  { id: 'leg-avg-60', basis: 'x01', name: 'Niveau pub league', desc: 'Moyenne de 60 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 60 ? 1 : 0, 1], hint: avgHint },
  { id: 'leg-avg-80', basis: 'x01', name: 'Niveau télé', desc: 'Moyenne de 80 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 80 ? 1 : 0, 1], hint: avgHint },
  legIn(24), legIn(18), legIn(15), legIn(12), legIn(9), legIn(6),
  { id: 'two-180', basis: 'x01', name: 'Doublé de 180', desc: 'Deux 180 dans le même leg', goal: (c) => [c.max180Leg, 2] },
  { id: 'cricket-5', basis: 'cricket', name: 'Marqueur', desc: '5 marques en un tour au Cricket', goal: (c) => [c.maxMarks >= 5 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour (marques)') },
  { id: 'cricket-7', basis: 'cricket', name: 'Grosse volée', desc: '7 marques en un tour au Cricket', goal: (c) => [c.maxMarks >= 7 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour (marques)') },
  { id: 'cricket-9', basis: 'cricket', name: 'Neuf marques', desc: '3 triples sur des numéros du Cricket dans un tour', goal: (c) => [c.maxMarks >= 9 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour (marques)') },
  { id: 'whitewash', basis: 'cricket', name: 'Blanchissage', desc: 'Gagner au Cricket sans que l\'adversaire ferme un seul numéro', goal: (c) => [c.whitewash ? 1 : 0, 1] },
  { id: 'shanghai-done', basis: 'shanghai', name: 'Shanghai !', desc: 'Simple, double et triple du même numéro dans un tour', goal: (c) => [c.shanghais ? 1 : 0, 1] },
  { id: 'shanghai-clean', basis: 'shanghai', name: 'Sans faute', desc: 'Au Shanghai de 1 à 7, toucher le bon numéro à chaque manche', goal: (c) => [c.shanghaiClean ? 1 : 0, 1] },
  { id: 'shanghai7-40', basis: 'shanghai', name: 'Bon Shanghai', desc: '40 points ou plus sur un Shanghai de 1 à 7', goal: (c) => [c.best1to7 >= 40 ? 1 : 0, 1], hint: (c) => best(c.best1to7, 'Meilleur 1 à 7') },
  { id: 'shanghai7-70', basis: 'shanghai', name: 'Grand Shanghai', desc: '70 points ou plus sur un Shanghai de 1 à 7', goal: (c) => [c.best1to7 >= 70 ? 1 : 0, 1], hint: (c) => best(c.best1to7, 'Meilleur 1 à 7') },
  { id: 'atc-60', basis: 'atc', name: 'Tour de l\'horloge', desc: 'Finir un Around the Clock (simple, double ou triple) en 60 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 60 ? 1 : 0, 1], hint: (c) => best(c.bestAtc, 'Meilleur ATC (fléchettes)') },
  { id: 'atc-40', basis: 'atc', name: 'Horloger', desc: 'Finir un Around the Clock en 40 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 40 ? 1 : 0, 1], hint: (c) => best(c.bestAtc, 'Meilleur ATC (fléchettes)') },
  { id: 'atc-30', basis: 'atc', name: 'Chirurgien', desc: 'Finir un Around the Clock en 30 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 30 ? 1 : 0, 1], hint: (c) => best(c.bestAtc, 'Meilleur ATC (fléchettes)') },
  // Enchaînements : probabilités calculées (legs gagnés d'affilée à 1 contre 1 de même niveau)
  { id: 'streak-3', basis: 'all', cumulative: true, name: 'Sur ta lancée', desc: 'Gagner 3 legs d\'affilée', goal: (c) => [c.bestStreak, 3] },
  { id: 'streak-5', basis: 'all', cumulative: true, name: 'Intouchable', desc: 'Gagner 5 legs d\'affilée', goal: (c) => [c.bestStreak, 5] },
  { id: 'streak-7', basis: 'all', cumulative: true, name: 'Série noire (pour les autres)', desc: 'Gagner 7 legs d\'affilée', goal: (c) => [c.bestStreak, 7] },
  { id: 'streak-10', basis: 'all', cumulative: true, name: 'Légende du salon', desc: 'Gagner 10 legs d\'affilée', goal: (c) => [c.bestStreak, 10] },
  { id: 'clean-sweep', basis: 'all', name: 'Carton plein', desc: 'Gagner tous les legs d\'une partie d\'au moins 3 legs', goal: (c) => [c.sweep ? 1 : 0, 1], tier: 2 },
  // Habitudes : pas de hasard là-dedans, niveau fixé à la main
  { id: 'night', name: 'Nuit blanche', desc: 'Jouer une partie entre minuit et 5 h', goal: (c) => [c.night ? 1 : 0, 1], tier: 1 },
  { id: 'early', name: 'Lève-tôt', desc: 'Jouer une partie avant 9 h du matin', goal: (c) => [c.early ? 1 : 0, 1], tier: 1 },
  { id: 'marathon', name: 'Marathon', desc: 'Jouer 10 parties le même jour', goal: (c) => [c.maxGamesDay, 10], tier: 2 },
  { id: 'week', name: 'Semaine de feu', desc: 'Jouer 7 jours d\'affilée', goal: (c) => [c.bestDayStreak, 7], tier: 3 },
  { id: 'nine-darter', basis: 'x01', name: 'Neuf fléchettes', desc: 'La légende : gagner un 501 en 9 fléchettes', goal: (c) => [c.bestLeg[501] != null && c.bestLeg[501] <= 9 ? 1 : 0, 1], hint: (c) => best(c.bestLeg[501], 'Meilleur 501 gagné en') },
];

// Streaks : legs gagnés d'affilée à 50 % de chances : 2^(k+1) - 2 legs en moyenne
const STREAK_E = { 'streak-3': 14, 'streak-5': 62, 'streak-7': 254, 'streak-10': 2046 };
for (const a of EXPLOITS) {
  const e = STREAK_E[a.id] ?? RARITY.exploits?.[a.id];
  a.expect = e ?? null;
  if (e != null) a.tier = tierFromE(e);
  else if (!a.tier) a.tier = 4;
  a.rarity = rarityText(a.expect, a.basis, a.cumulative) || (a.basis && a.tier === 4 && !STREAK_E[a.id] ? 'Jamais arrivé dans les simulations : très rare' : null);
}

// Liste à plat : chaque palier de série devient un succès
export const ACHIEVEMENTS = [
  ...SERIES.flatMap((s) => s.steps.map((n, i) => ({
    id: `${s.key}-${n}`, series: s.key, level: i + 1, levelCount: s.steps.length, tier: s.tiers[i],
    name: `${s.name} · ${n.toLocaleString('fr-FR')}`, desc: `${n.toLocaleString('fr-FR')} ${s.unit}`,
    rarity: s.countsGames || s.manual ? null : s.expect[i] != null ? rarityText(s.expect[i], s.basis, true) : null,
    goal: (c) => [s.get(c), n],
  }))),
  ...EXPLOITS,
];
export const EXPLOIT_LIST = EXPLOITS;

function emptyCounters() {
  return {
    games: 0, legsWon: 0, darts: 0, triples: 0, doubles: 0, bulls: 0, bull25: 0, tons: 0, c140: 0, c180: 0,
    checkouts: 0, bigCheckouts: 0, x01Points: 0, marks: 0, shanghais: 0, trainings: 0, misses: 0, busts: 0,
    byMode: { x01: 0, cricket: 0, shanghai: 0, atc: 0 }, winsByMode: { x01: 0, cricket: 0, shanghai: 0, atc: 0 },
    days: new Set(), dayCount: {}, modesSet: new Set(), numbersHit: new Set(), treblesHit: new Set(), doublesHit: new Set(),
    got26: false, threeMiss: false, night: false, early: false, streak: 0, bestStreak: 0, maxMarks: 0, maxTreblesTurn: 0,
    bestLegAvg: 0, maxGamesDay: 0, bestDayStreak: 0, bullFinish: false, shanghaiClean: false,
    highCheckout: 0, bestAtc: null, d1Finish: false, maxBullsTurn: 0, remontada: false, whitewash: false, sweep: false,
    best1to20: 0, best1to7: 0, max180Leg: 0, bestLeg: {}, shanghaiHits: 0,
  };
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayStreak(days) {
  const ts = [...days].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); }).sort((a, b) => a - b);
  let bestRun = 0; let run = 0; let prev = null;
  for (const t of ts) {
    run = prev != null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    bestRun = Math.max(bestRun, run); prev = t;
  }
  return bestRun;
}

// Renvoie { [achId]: { unlocked: date|null, cur, max, hint } }
export function computeAchievements(games, pid) {
  const c = emptyCounters();
  const out = {};
  const check = (date) => {
    for (const a of ACHIEVEMENTS) {
      if (out[a.id]) continue;
      const [cur, max] = a.goal(c);
      if (cur >= max) out[a.id] = date;
    }
  };
  const sorted = [...afterReset(games, pid)].filter((g) => g.player_ids.includes(pid)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const g of sorted) {
    const legs = replayed(g);
    if (!legs.length) continue;
    const training = isTraining(g.mode);
    const when = new Date(g.created_at);
    const dk = dayKey(when);
    c.days.add(dk);
    c.bestDayStreak = dayStreak(c.days);
    if (training) c.trainings += 1;
    else {
      c.games += 1; c.modesSet.add(g.mode);
      if (c.byMode[g.mode] != null) c.byMode[g.mode] += 1;
      c.dayCount[dk] = (c.dayCount[dk] || 0) + 1;
      c.maxGamesDay = Math.max(c.maxGamesDay, c.dayCount[dk]);
      const h = when.getHours();
      if (h < 5) c.night = true;
      else if (h < 9) c.early = true;
    }
    let gameLegsDone = 0; let gameLegsWon = 0;
    for (const { leg, r } of legs) {
      const idx = leg.order.indexOf(pid);
      if (idx < 0) continue;
      const date = leg.finishedAt || g.created_at;
      let legDarts = 0; let legPts = 0; let leg180 = 0;
      // suivi du retard en X01 (remontada)
      const rems = leg.order.map(() => Number(g.settings?.start) || 501);
      let wasBehind = false;
      for (const t of r.turns) {
        if (g.mode === 'x01') {
          const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
          rems[t.p] -= pts;
          if (rems[idx] - Math.min(...rems.filter((_, j) => j !== idx)) >= 100) wasBehind = true;
        }
        if (t.p !== idx) continue;
        let bullsTurn = 0; let marks = 0; let trebles = 0; let missTurn = 0;
        for (const d of t.darts) {
          c.darts += 1; legDarts += 1;
          if (!d.mult) { c.misses += 1; missTurn += 1; }
          if (d.mult === 3) { c.triples += 1; trebles += 1; if (d.seg <= 20) c.treblesHit.add(d.seg); }
          if (d.mult === 2) { c.doubles += 1; c.doublesHit.add(d.seg); }
          if (d.seg === 25 && d.mult === 2) c.bulls += 1;
          if (d.seg === 25 && d.mult === 1) c.bull25 += 1;
          if (d.seg === 25 && d.mult > 0) bullsTurn += 1;
          if (d.mult && d.seg <= 20) c.numbersHit.add(d.seg);
          marks += d.marks || 0;
          if (d.shanghai) c.shanghais += 1;
          if (g.mode === 'shanghai' && d.hit) c.shanghaiHits += 1;
        }
        c.maxBullsTurn = Math.max(c.maxBullsTurn, bullsTurn);
        c.maxTreblesTurn = Math.max(c.maxTreblesTurn, trebles);
        if (t.darts.length === 3 && missTurn === 3) c.threeMiss = true;
        if (g.mode === 'cricket') { c.maxMarks = Math.max(c.maxMarks, marks); c.marks += marks; }
        if (g.mode === 'x01') {
          if (t.bust) c.busts += 1;
          const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
          legPts += pts; c.x01Points += pts;
          if (pts === 26 && t.darts.length === 3) c.got26 = true;
          if (pts >= 100) c.tons += 1;
          if (pts >= 140) c.c140 += 1;
          if (pts === 180) { c.c180 += 1; leg180 += 1; }
          if (t.finished) {
            c.checkouts += 1;
            const co = t.darts[0].remBefore;
            c.highCheckout = Math.max(c.highCheckout, co);
            if (co >= 100) c.bigCheckouts += 1;
            const last = t.darts[t.darts.length - 1];
            if (last.seg === 1 && last.mult === 2 && g.settings?.out === 'double') c.d1Finish = true;
            if (last.seg === 25 && last.mult === 2) c.bullFinish = true;
          }
        }
      }
      c.max180Leg = Math.max(c.max180Leg, leg180);
      if (training) { check(date); continue; }
      const multi = leg.order.length > 1;
      const won = multi && leg.ranking?.[0] === pid;
      if (leg.done) gameLegsDone += 1;
      if (won) gameLegsWon += 1;
      if (multi) {
        if (won) { c.legsWon += 1; c.winsByMode[g.mode] = (c.winsByMode[g.mode] || 0) + 1; c.streak += 1; c.bestStreak = Math.max(c.bestStreak, c.streak); } else c.streak = 0;
      }
      if (g.mode === 'x01' && legDarts >= 9) c.bestLegAvg = Math.max(c.bestLegAvg, (legPts / legDarts) * 3);
      if (g.mode === 'x01' && won) { const st = Number(g.settings?.start); c.bestLeg[st] = c.bestLeg[st] == null ? legDarts : Math.min(c.bestLeg[st], legDarts); }
      if (g.mode === 'x01' && won && wasBehind) c.remontada = true;
      if (g.mode === 'atc' && r.ps[idx].finished) c.bestAtc = c.bestAtc == null ? legDarts : Math.min(c.bestAtc, legDarts);
      if (g.mode === 'cricket' && won && r.ps.every((p, j) => j === idx || CRICKET_NUMS.every((n) => p.marks[n] < 3))) c.whitewash = true;
      if (g.mode === 'shanghai') {
        if (g.settings?.from === 1 && g.settings?.to === 20) c.best1to20 = Math.max(c.best1to20, r.ps[idx].pts);
        if (g.settings?.from === 1 && g.settings?.to === 7) c.best1to7 = Math.max(c.best1to7, r.ps[idx].pts);
        const mine = r.turns.filter((t) => t.p === idx);
        if (g.settings?.from === 1 && g.settings?.to === 7 && mine.length === 7 && mine.every((t) => t.darts.some((d) => d.hit))) c.shanghaiClean = true;
      }
      check(date);
    }
    if (!training && gameLegsDone >= 3 && gameLegsWon === gameLegsDone) { c.sweep = true; check(g.created_at); }
  }
  const res = {};
  for (const a of ACHIEVEMENTS) {
    const [cur, max] = a.goal(c);
    res[a.id] = { unlocked: out[a.id] || null, cur: Math.min(cur, max), max, hint: a.hint ? a.hint(c) : null };
  }
  res.__counters = c;
  return res;
}

export function newlyUnlocked(before, after) {
  return ACHIEVEMENTS.filter((a) => !before[a.id]?.unlocked && after[a.id]?.unlocked);
}

// Meilleur nombre de fléchettes pour gagner un leg X01, par score de départ
export function bestLegDarts(games, pid, start, excludeGameId) {
  let bestN = null;
  for (const g of afterReset(games, pid)) {
    if (g.mode !== 'x01' || g.id === excludeGameId || Number(g.settings?.start) !== Number(start) || !g.player_ids.includes(pid)) continue;
    for (const { leg, r } of replayed(g)) {
      if (leg.ranking?.[0] !== pid || leg.order.length < 2) continue;
      const idx = leg.order.indexOf(pid);
      const n = r.turns.filter((t) => t.p === idx).reduce((a, t) => a + t.darts.length, 0);
      bestN = bestN == null ? n : Math.min(bestN, n);
    }
  }
  return bestN;
}
