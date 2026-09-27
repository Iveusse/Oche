// Succès : calculés à partir de l'historique, dans l'ordre chronologique.
// Chaque succès garde la date où il a été débloqué pour la première fois.
import { replayed } from './stats.js';
import { isTraining } from './modes.js';

// tier : 1 bronze, 2 argent, 3 or, 4 platine
export const ACHIEVEMENTS = [
  { id: 'first-game', tier: 1, name: 'Premier pas', desc: 'Jouer ta première partie', goal: (c) => [c.games, 1] },
  { id: 'first-win', tier: 1, name: 'Première victoire', desc: 'Gagner un leg', goal: (c) => [c.legsWon, 1] },
  { id: 'first-treble', tier: 1, name: 'Triple !', desc: 'Toucher un triple', goal: (c) => [c.triples, 1] },
  { id: 'bullseye', tier: 1, name: 'Dans le mille', desc: 'Toucher le bull à 50', goal: (c) => [c.bulls, 1] },
  { id: 'first-checkout', tier: 1, name: 'Ça rentre', desc: 'Finir un leg de X01', goal: (c) => [c.checkouts, 1] },
  { id: 'first-training', tier: 1, name: 'Élève appliqué', desc: 'Faire une session d\'entraînement', goal: (c) => [c.trainings, 1] },
  { id: 'all-modes', tier: 1, name: 'Touche-à-tout', desc: 'Jouer aux 4 modes : X01, Cricket, ATC, Shanghai', goal: (c) => [c.modes.size, 4] },

  { id: 'ton', tier: 2, name: 'Ton', desc: 'Marquer 100 ou plus en un tour', goal: (c) => [c.bestTurn >= 100 ? 1 : 0, 1], hint: (c) => c.bestTurn ? `Meilleur tour : ${c.bestTurn}` : null },
  { id: 'regular', tier: 2, name: 'Habitué', desc: 'Jouer 25 parties', goal: (c) => [c.games, 25] },
  { id: 'darts-1000', tier: 2, name: 'Mille fléchettes', desc: 'Lancer 1 000 fléchettes', goal: (c) => [c.darts, 1000] },
  { id: 'streak-3', tier: 2, name: 'Sur ta lancée', desc: 'Gagner 3 legs d\'affilée', goal: (c) => [c.bestStreak, 3] },
  { id: 'leg-avg-40', tier: 2, name: 'Rythme de croisière', desc: 'Moyenne de 40 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 40 ? 1 : 0, 1], hint: (c) => c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null },
  { id: 'cricket-5', tier: 2, name: 'Marqueur', desc: '5 marques en un tour au Cricket', goal: (c) => [c.maxMarks >= 5 ? 1 : 0, 1], hint: (c) => c.maxMarks ? `Meilleur tour : ${c.maxMarks} marques` : null },
  { id: 'ton-40', tier: 2, name: 'Ton-40', desc: 'Marquer 140 ou plus en un tour', goal: (c) => [c.bestTurn >= 140 ? 1 : 0, 1], hint: (c) => c.bestTurn ? `Meilleur tour : ${c.bestTurn}` : null },

  { id: 'shanghai', tier: 3, name: 'Shanghai !', desc: 'Simple, double et triple du même numéro dans un tour', goal: (c) => [c.shanghais, 1] },
  { id: 'big-finish', tier: 3, name: 'Grand finish', desc: 'Réussir un checkout de 100 ou plus', goal: (c) => [c.highCheckout >= 100 ? 1 : 0, 1], hint: (c) => c.highCheckout ? `Meilleur checkout : ${c.highCheckout}` : null },
  { id: 'checkouts-25', tier: 3, name: 'Finisseur', desc: 'Réussir 25 checkouts en X01', goal: (c) => [c.checkouts, 25] },
  { id: 'games-100', tier: 3, name: 'Accro', desc: 'Jouer 100 parties', goal: (c) => [c.games, 100] },
  { id: 'darts-10000', tier: 3, name: 'Machine', desc: 'Lancer 10 000 fléchettes', goal: (c) => [c.darts, 10000] },
  { id: 'streak-5', tier: 3, name: 'Intouchable', desc: 'Gagner 5 legs d\'affilée', goal: (c) => [c.bestStreak, 5] },
  { id: 'atc-30', tier: 3, name: 'Horloger', desc: 'Finir un Around the Clock en 30 fléchettes ou moins', goal: (c) => [c.bestAtc != null && c.bestAtc <= 30 ? 1 : 0, 1], hint: (c) => c.bestAtc ? `Meilleur : ${c.bestAtc} fléchettes` : null },
  { id: 'leg-18', tier: 3, name: 'Leg express', desc: 'Gagner un 501 en 18 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 18 ? 1 : 0, 1], hint: (c) => c.best501 ? `Meilleur 501 : ${c.best501} fléchettes` : null },
  { id: 'madhouse', tier: 3, name: 'Madhouse', desc: 'Finir un leg sur le double 1, en sortie double', goal: (c) => [c.d1Finish, 1] },
  { id: 'hat-trick', tier: 3, name: 'Hat trick', desc: 'Trois bulls (25 ou 50) dans le même tour', goal: (c) => [c.maxBullsTurn, 3] },
  { id: 'cricket-9', tier: 3, name: 'Neuf marques', desc: '3 triples sur des numéros du Cricket dans un tour', goal: (c) => [c.maxMarks >= 9 ? 1 : 0, 1], hint: (c) => c.maxMarks ? `Meilleur tour : ${c.maxMarks} marques` : null },

  { id: 'one-eighty', tier: 4, name: '180 !', desc: 'Trois triples 20 dans le même tour', goal: (c) => [c.c180 ? 1 : 0, 1], hint: (c) => c.bestTurn ? `Meilleur tour : ${c.bestTurn}` : null },
  { id: 'big-fish', tier: 4, name: 'Big Fish', desc: 'Finir 170 : T20, T20, Bull', goal: (c) => [c.highCheckout >= 170 ? 1 : 0, 1], hint: (c) => c.highCheckout ? `Meilleur checkout : ${c.highCheckout}` : null },
  { id: 'leg-12', tier: 4, name: 'Pro', desc: 'Gagner un 501 en 12 fléchettes ou moins', goal: (c) => [c.best501 != null && c.best501 <= 12 ? 1 : 0, 1], hint: (c) => c.best501 ? `Meilleur 501 : ${c.best501} fléchettes` : null },
  { id: 'nine-darter', tier: 4, name: 'Neuf fléchettes', desc: 'Le leg parfait : un 501 en 9 fléchettes', goal: (c) => [c.best501 != null && c.best501 <= 9 ? 1 : 0, 1], hint: (c) => c.best501 ? `Meilleur 501 : ${c.best501} fléchettes` : null },
  { id: 'leg-avg-60', tier: 4, name: 'Niveau pub league', desc: 'Moyenne de 60 ou plus sur un leg de X01', goal: (c) => [c.bestLegAvg >= 60 ? 1 : 0, 1], hint: (c) => c.bestLegAvg ? `Meilleur leg : ${c.bestLegAvg.toFixed(1)}` : null },
  { id: 'shanghai-300', tier: 4, name: 'Empereur de Shanghai', desc: '500 points ou plus sur un Shanghai de 1 à 20', goal: (c) => [c.best1to20 >= 500 ? 1 : 0, 1], hint: (c) => c.best1to20 ? `Meilleur : ${c.best1to20} pts` : null },
  { id: 'collector', tier: 4, name: 'Collectionneur', desc: 'Réaliser 10 fois 180', goal: (c) => [c.c180, 10] },
];

export const TIER = { 1: 'Bronze', 2: 'Argent', 3: 'Or', 4: 'Platine' };

function emptyCounters() {
  return {
    games: 0, legsWon: 0, triples: 0, bulls: 0, checkouts: 0, trainings: 0, modes: new Set(),
    bestTurn: 0, c180: 0, darts: 0, streak: 0, bestStreak: 0, bestLegAvg: 0, maxMarks: 0,
    shanghais: 0, highCheckout: 0, bestAtc: null, best501: null, d1Finish: 0, maxBullsTurn: 0, best1to20: 0,
  };
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
  const sorted = [...games].filter((g) => g.player_ids.includes(pid)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const g of sorted) {
    const legs = replayed(g);
    if (!legs.length) continue;
    const training = isTraining(g.mode);
    if (training) c.trainings += 1; else { c.games += 1; c.modes.add(g.mode); }
    for (const { leg, r } of legs) {
      const idx = leg.order.indexOf(pid);
      if (idx < 0) continue;
      const date = leg.finishedAt || g.created_at;
      let legDarts = 0; let legPts = 0;
      for (const t of r.turns) {
        if (t.p !== idx) continue;
        let bullsTurn = 0; let marks = 0;
        for (const d of t.darts) {
          c.darts += 1; legDarts += 1;
          if (d.mult === 3) c.triples += 1;
          if (d.seg === 25 && d.mult === 2) c.bulls += 1;
          if (d.seg === 25 && d.mult > 0) bullsTurn += 1;
          marks += d.marks || 0;
          if (d.shanghai) c.shanghais += 1;
        }
        c.maxBullsTurn = Math.max(c.maxBullsTurn, bullsTurn);
        if (g.mode === 'cricket') c.maxMarks = Math.max(c.maxMarks, marks);
        if (g.mode === 'x01') {
          const pts = t.bust ? 0 : t.darts.reduce((a, d) => a + (d.pts || 0), 0);
          legPts += pts;
          c.bestTurn = Math.max(c.bestTurn, pts);
          if (pts === 180) c.c180 += 1;
          if (t.finished) {
            c.checkouts += 1;
            c.highCheckout = Math.max(c.highCheckout, t.darts[0].remBefore);
            const last = t.darts[t.darts.length - 1];
            if (last.seg === 1 && last.mult === 2 && g.settings?.out === 'double') c.d1Finish += 1;
          }
        }
      }
      if (training) { check(date); continue; }
      const won = leg.ranking?.[0] === pid && leg.order.length > 1;
      if (leg.order.length > 1) {
        if (won) { c.legsWon += 1; c.streak += 1; c.bestStreak = Math.max(c.bestStreak, c.streak); } else c.streak = 0;
      }
      if (g.mode === 'x01' && legDarts >= 9) c.bestLegAvg = Math.max(c.bestLegAvg, (legPts / legDarts) * 3);
      if (g.mode === 'x01' && won && Number(g.settings?.start) === 501) c.best501 = c.best501 == null ? legDarts : Math.min(c.best501, legDarts);
      if (g.mode === 'atc' && r.ps[idx].finished) c.bestAtc = c.bestAtc == null ? legDarts : Math.min(c.bestAtc, legDarts);
      if (g.mode === 'shanghai' && g.settings?.from === 1 && g.settings?.to === 20) c.best1to20 = Math.max(c.best1to20, r.ps[idx].pts);
      check(date);
    }
  }
  const res = {};
  for (const a of ACHIEVEMENTS) {
    const [cur, max] = a.goal(c);
    res[a.id] = { unlocked: out[a.id] || null, cur: Math.min(cur, max), max, hint: a.hint ? a.hint(c) : null };
  }
  return res;
}

export function newlyUnlocked(before, after) {
  return ACHIEVEMENTS.filter((a) => !before[a.id]?.unlocked && after[a.id]?.unlocked);
}

// Meilleur nombre de fléchettes pour gagner un leg X01, par score de départ
export function bestLegDarts(games, pid, start, excludeGameId) {
  let best = null;
  for (const g of games) {
    if (g.mode !== 'x01' || g.id === excludeGameId || Number(g.settings?.start) !== Number(start) || !g.player_ids.includes(pid)) continue;
    for (const { leg, r } of replayed(g)) {
      if (leg.ranking?.[0] !== pid || leg.order.length < 2) continue;
      const idx = leg.order.indexOf(pid);
      const n = r.turns.filter((t) => t.p === idx).reduce((a, t) => a + t.darts.length, 0);
      best = best == null ? n : Math.min(best, n);
    }
  }
  return best;
}
