// Succès : calculés à partir de l'historique, dans l'ordre chronologique.
// Deux familles : des séries à paliers (1, 10, 50...) et des exploits uniques.
import { replayed, afterReset } from './stats.js';
import { isTraining, shanghaiNumbers, CRICKET_NUMS } from './modes.js';

export const TIER = { 1: 'Bronze', 2: 'Argent', 3: 'Or', 4: 'Platine' };

// ---------- Séries à paliers ----------
// unit : le mot affiché dans la progression ("143 / 250 triples")
export const SERIES = [
  { key: 'games', name: 'Parties jouées', unit: 'parties', levels: [[1,1],[10,1],[25,1],[50,2],[100,2],[250,3],[500,3],[1000,4]], get: (c) => c.games },
  { key: 'legs-won', name: 'Legs gagnés', unit: 'legs', levels: [[1,1],[10,1],[25,2],[50,2],[100,3],[250,3],[500,4]], get: (c) => c.legsWon },
  { key: 'darts', name: 'Fléchettes lancées', unit: 'fléchettes', levels: [[100,1],[500,1],[1000,1],[5000,2],[10000,2],[25000,3],[50000,3],[100000,4]], get: (c) => c.darts },
  { key: 'triples', name: 'Triples', unit: 'triples', levels: [[1,1],[10,1],[50,2],[100,2],[250,3],[500,3],[1000,4],[2500,4]], get: (c) => c.triples },
  { key: 'doubles', name: 'Doubles', unit: 'doubles', levels: [[1,1],[10,1],[50,2],[100,2],[250,3],[500,3],[1000,4]], get: (c) => c.doubles },
  { key: 'bull50', name: 'Bulls à 50', unit: 'bulls', levels: [[1,1],[5,2],[10,2],[25,3],[50,3],[100,4],[250,4]], get: (c) => c.bulls },
  { key: 'bull25', name: 'Bulls à 25', unit: 'bulls', levels: [[1,1],[10,1],[50,2],[100,2],[250,3],[500,3]], get: (c) => c.bull25 },
  { key: 'tons', name: 'Tours à 100+', unit: 'tours', levels: [[1,2],[10,2],[50,3],[100,3],[250,4],[500,4]], get: (c) => c.tons },
  { key: 'ton40', name: 'Tours à 140+', unit: 'tours', levels: [[1,3],[5,3],[10,3],[25,4],[50,4],[100,4]], get: (c) => c.c140 },
  { key: '180', name: '180', unit: 'fois 180', levels: [[1,4],[3,4],[10,4],[25,4],[50,4],[100,4]], get: (c) => c.c180 },
  { key: 'checkouts', name: 'Checkouts réussis', unit: 'checkouts', levels: [[1,1],[10,1],[25,2],[50,2],[100,3],[250,3],[500,4]], get: (c) => c.checkouts },
  { key: 'big-co', name: 'Checkouts à 100+', unit: 'checkouts', levels: [[1,3],[5,3],[10,4],[25,4],[50,4]], get: (c) => c.bigCheckouts },
  { key: 'x01-points', name: 'Points marqués en X01', unit: 'points', levels: [[1000,1],[10000,1],[50000,2],[100000,2],[250000,3],[500000,4]], get: (c) => c.x01Points },
  { key: 'x01', name: 'Parties de X01', unit: 'parties', levels: [[1,1],[10,1],[50,2],[100,3],[250,4]], get: (c) => c.byMode.x01 },
  { key: 'cricket', name: 'Parties de Cricket', unit: 'parties', levels: [[1,1],[10,1],[50,2],[100,3],[250,4]], get: (c) => c.byMode.cricket },
  { key: 'shanghai', name: 'Parties de Shanghai', unit: 'parties', levels: [[1,1],[10,1],[50,2],[100,3],[250,4]], get: (c) => c.byMode.shanghai },
  { key: 'atc', name: 'Parties d\'Around the Clock', unit: 'parties', levels: [[1,1],[10,1],[50,2],[100,3],[250,4]], get: (c) => c.byMode.atc },
  { key: 'cricket-wins', name: 'Victoires au Cricket', unit: 'victoires', levels: [[1,1],[10,2],[25,2],[50,3],[100,4]], get: (c) => c.winsByMode.cricket },
  { key: 'shanghai-wins', name: 'Victoires au Shanghai', unit: 'victoires', levels: [[1,1],[10,2],[25,2],[50,3],[100,4]], get: (c) => c.winsByMode.shanghai },
  { key: 'atc-wins', name: 'Victoires à l\'ATC', unit: 'victoires', levels: [[1,1],[10,2],[25,2],[50,3],[100,4]], get: (c) => c.winsByMode.atc },
  { key: 'marks', name: 'Marques au Cricket', unit: 'marques', levels: [[50,1],[250,1],[1000,2],[2500,3],[5000,3],[10000,4]], get: (c) => c.marks },
  { key: 'shanghais', name: 'Shanghais réussis', unit: 'shanghais', levels: [[1,3],[3,3],[10,4],[25,4]], get: (c) => c.shanghais },
  { key: 'trainings', name: 'Entraînements', unit: 'sessions', levels: [[1,1],[10,1],[25,2],[50,2],[100,3],[250,4]], get: (c) => c.trainings },
  { key: 'days', name: 'Jours de jeu', unit: 'jours', levels: [[1,1],[7,1],[30,2],[100,3],[200,3],[365,4]], get: (c) => c.days.size },
  { key: 'misses', name: 'Mur de la cuisine', unit: 'fléchettes hors cible', levels: [[10,1],[100,1],[500,2],[1000,2]], get: (c) => c.misses, fun: true },
  { key: 'busts', name: 'Roi du bust', unit: 'busts', levels: [[1,1],[10,1],[50,2],[100,2]], get: (c) => c.busts, fun: true },
];

// Chaque palier a sa propre difficulté : [seuil, niveau] (1 bronze → 4 platine)
for (const s of SERIES) { s.steps = s.levels.map((l) => l[0]); s.tiers = s.levels.map((l) => l[1]); }

// ---------- Exploits ----------
const best = (v, lbl) => (v ? `${lbl} : ${v}` : null);
const EXPLOITS = [
  // Bronze
  { id: 'all-modes', tier: 1, name: 'Touche-à-tout', desc: 'Jouer aux 4 modes : X01, Cricket, ATC, Shanghai', goal: (c) => [c.modesSet.size, 4] },
  { id: 'all-numbers', tier: 1, name: 'Tour du cadran', desc: 'Toucher chaque numéro de 1 à 20 au moins une fois', goal: (c) => [c.numbersHit.size, 20] },
  { id: 'bed-breakfast', tier: 1, name: 'Bed & Breakfast', desc: 'Faire exactement 26 en un tour (le fameux 20, 5, 1)', goal: (c) => [c.got26 ? 1 : 0, 1] },
  { id: 'wall', tier: 1, name: 'Dans le mur', desc: 'Trois fléchettes hors cible dans le même tour', goal: (c) => [c.threeMiss ? 1 : 0, 1] },
  { id: 'night', tier: 1, name: 'Nuit blanche', desc: 'Jouer une partie entre minuit et 5 h', goal: (c) => [c.night ? 1 : 0, 1] },
  { id: 'early', tier: 1, name: 'Lève-tôt', desc: 'Jouer une partie avant 9 h du matin', goal: (c) => [c.early ? 1 : 0, 1] },
  { id: 'streak-3', tier: 1, name: 'Sur ta lancée', desc: 'Gagner 3 legs d\'affilée', goal: (c) => [c.bestStreak, 3] },
  { id: 'cricket-5', tier: 1, name: 'Marqueur', desc: '5 marques en un tour au Cricket', goal: (c) => [c.maxMarks >= 5 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour') },
  // Argent
  { id: 'three-trebles', tier: 2, name: 'Trois en un', desc: 'Trois triples dans le même tour (n\'importe lesquels)', goal: (c) => [c.maxTreblesTurn, 3] },
  { id: 'all-trebles', tier: 2, name: 'Collection de triples', desc: 'Toucher le triple de chaque numéro, de T1 à T20', goal: (c) => [c.treblesHit.size, 20] },
  { id: 'all-doubles', tier: 2, name: 'Collection de doubles', desc: 'Toucher chaque double, de D1 à D20, plus le bull', goal: (c) => [c.doublesHit.size, 21] },
  { id: 'leg-avg-40', tier: 2, name: 'Rythme de croisière', desc: 'Moyenne de 40 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 40 ? 1 : 0, 1], hint: (c) => (c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null) },
  { id: 'leg-24', tier: 2, name: 'Leg rapide', desc: 'Gagner un 501 en 24 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 24 ? 1 : 0, 1], hint: (c) => best(c.best501, 'Meilleur 501') },
  { id: 'streak-5', tier: 2, name: 'Intouchable', desc: 'Gagner 5 legs d\'affilée', goal: (c) => [c.bestStreak, 5] },
  { id: 'cricket-7', tier: 2, name: 'Grosse volée', desc: '7 marques en un tour au Cricket', goal: (c) => [c.maxMarks >= 7 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour') },
  { id: 'marathon', tier: 2, name: 'Marathon', desc: 'Jouer 10 parties le même jour', goal: (c) => [c.maxGamesDay, 10] },
  { id: 'week', tier: 2, name: 'Semaine de feu', desc: 'Jouer 7 jours d\'affilée', goal: (c) => [c.bestDayStreak, 7] },
  { id: 'bull-finish', tier: 2, name: 'Finish au centre', desc: 'Finir un leg de X01 sur le bull 50', goal: (c) => [c.bullFinish ? 1 : 0, 1] },
  { id: 'shanghai-clean', tier: 2, name: 'Sans faute', desc: 'Au Shanghai, toucher le bon numéro à chaque manche d\'une partie', goal: (c) => [c.shanghaiClean ? 1 : 0, 1] },
  // Or
  { id: 'big-finish', tier: 3, name: 'Grand finish', desc: 'Réussir un checkout de 100 ou plus', goal: (c) => [c.highCheckout >= 100 ? 1 : 0, 1], hint: (c) => best(c.highCheckout, 'Meilleur checkout') },
  { id: 'leg-avg-50', tier: 3, name: 'Machine à scorer', desc: 'Moyenne de 50 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 50 ? 1 : 0, 1], hint: (c) => (c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null) },
  { id: 'leg-18', tier: 3, name: 'Leg express', desc: 'Gagner un 501 en 18 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 18 ? 1 : 0, 1], hint: (c) => best(c.best501, 'Meilleur 501') },
  { id: 'streak-10', tier: 3, name: 'Série noire (pour les autres)', desc: 'Gagner 10 legs d\'affilée', goal: (c) => [c.bestStreak, 10] },
  { id: 'atc-30', tier: 3, name: 'Horloger', desc: 'Finir un Around the Clock en 30 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 30 ? 1 : 0, 1], hint: (c) => best(c.bestAtc, 'Meilleur ATC') },
  { id: 'madhouse', tier: 3, name: 'Madhouse', desc: 'Finir un leg sur le double 1, en sortie double', goal: (c) => [c.d1Finish ? 1 : 0, 1] },
  { id: 'hat-trick', tier: 3, name: 'Hat trick', desc: 'Trois bulls (25 ou 50) dans le même tour', goal: (c) => [c.maxBullsTurn, 3] },
  { id: 'cricket-9', tier: 3, name: 'Neuf marques', desc: '3 triples sur des numéros du Cricket dans un tour', goal: (c) => [c.maxMarks >= 9 ? 1 : 0, 1], hint: (c) => best(c.maxMarks, 'Meilleur tour') },
  { id: 'remontada', tier: 3, name: 'Remontada', desc: 'Gagner un leg de X01 après avoir eu 100 points de retard', goal: (c) => [c.remontada ? 1 : 0, 1] },
  { id: 'whitewash', tier: 3, name: 'Blanchissage', desc: 'Gagner au Cricket sans que l\'adversaire ferme un seul numéro', goal: (c) => [c.whitewash ? 1 : 0, 1] },
  { id: 'clean-sweep', tier: 3, name: 'Carton plein', desc: 'Gagner tous les legs d\'une partie d\'au moins 3 legs', goal: (c) => [c.sweep ? 1 : 0, 1] },
  { id: 'shanghai-300', tier: 3, name: 'Seigneur de Shanghai', desc: '300 points ou plus sur un Shanghai de 1 à 20', goal: (c) => [c.best1to20 >= 300 ? 1 : 0, 1], hint: (c) => best(c.best1to20, 'Meilleur 1 à 20') },
  // Platine
  { id: 'big-fish', tier: 4, name: 'Big Fish', desc: 'Finir 170 : T20, T20, Bull', goal: (c) => [c.highCheckout >= 170 ? 1 : 0, 1], hint: (c) => best(c.highCheckout, 'Meilleur checkout') },
  { id: 'leg-15', tier: 4, name: 'Niveau club', desc: 'Gagner un 501 en 15 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 15 ? 1 : 0, 1], hint: (c) => best(c.best501, 'Meilleur 501') },
  { id: 'leg-12', tier: 4, name: 'Pro', desc: 'Gagner un 501 en 12 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 12 ? 1 : 0, 1], hint: (c) => best(c.best501, 'Meilleur 501') },
  { id: 'nine-darter', tier: 4, name: 'Neuf fléchettes', desc: 'Le leg parfait : un 501 en 9 fléchettes', goal: (c) => [c.best501 != null && c.best501 <= 9 ? 1 : 0, 1], hint: (c) => best(c.best501, 'Meilleur 501') },
  { id: 'leg-avg-60', tier: 4, name: 'Niveau pub league', desc: 'Moyenne de 60 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 60 ? 1 : 0, 1], hint: (c) => (c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null) },
  { id: 'leg-avg-80', tier: 4, name: 'Niveau télé', desc: 'Moyenne de 80 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 80 ? 1 : 0, 1], hint: (c) => (c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null) },
  { id: 'atc-21', tier: 4, name: 'Chirurgien', desc: 'Finir un Around the Clock en 21 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 21 ? 1 : 0, 1], hint: (c) => best(c.bestAtc, 'Meilleur ATC') },
  { id: 'shanghai-500', tier: 4, name: 'Empereur de Shanghai', desc: '500 points ou plus sur un Shanghai de 1 à 20', goal: (c) => [c.best1to20 >= 500 ? 1 : 0, 1], hint: (c) => best(c.best1to20, 'Meilleur 1 à 20') },
  { id: 'streak-20', tier: 4, name: 'Légende du salon', desc: 'Gagner 20 legs d\'affilée', goal: (c) => [c.bestStreak, 20] },
  { id: 'two-180', tier: 4, name: 'Doublé de 180', desc: 'Deux 180 dans le même leg', goal: (c) => [c.max180Leg, 2] },
];

// Liste à plat : chaque palier de série devient un succès
export const ACHIEVEMENTS = [
  ...SERIES.flatMap((s) => s.steps.map((n, i) => ({
    id: `${s.key}-${n}`, series: s.key, level: i + 1, levelCount: s.steps.length, tier: s.tiers[i],
    name: `${s.name} · ${n.toLocaleString('fr-FR')}`, desc: `${n.toLocaleString('fr-FR')} ${s.unit}`,
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
    bestLegAvg: 0, best501: null, maxGamesDay: 0, bestDayStreak: 0, bullFinish: false, shanghaiClean: false,
    highCheckout: 0, bestAtc: null, d1Finish: false, maxBullsTurn: 0, remontada: false, whitewash: false, sweep: false,
    best1to20: 0, max180Leg: 0,
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
      if (g.mode === 'x01' && won && Number(g.settings?.start) === 501) c.best501 = c.best501 == null ? legDarts : Math.min(c.best501, legDarts);
      if (g.mode === 'x01' && won && wasBehind) c.remontada = true;
      if (g.mode === 'atc' && r.ps[idx].finished) c.bestAtc = c.bestAtc == null ? legDarts : Math.min(c.bestAtc, legDarts);
      if (g.mode === 'cricket' && won && r.ps.every((p, j) => j === idx || CRICKET_NUMS.every((n) => p.marks[n] < 3))) c.whitewash = true;
      if (g.mode === 'shanghai') {
        if (g.settings?.from === 1 && g.settings?.to === 20) c.best1to20 = Math.max(c.best1to20, r.ps[idx].pts);
        const mine = r.turns.filter((t) => t.p === idx);
        if (mine.length === shanghaiNumbers(g.settings || {}).length && mine.every((t) => t.darts.some((d) => d.hit))) c.shanghaiClean = true;
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
