// Rejoue un leg à partir de la liste des fléchettes. Tout l'état est dérivé :
// annuler = retirer la dernière fléchette et rejouer.

import { MODES } from './modes.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Rejoue un leg et renvoie tout ce qu'on peut en dire.
 * @param {string} mode      'x01', 'cricket', 'shanghai'... (clé de MODES)
 * @param {object} settings  réglages de la partie (départ, sortie double...)
 * @param {import('../types.js').Leg} leg
 * @returns {import('../types.js').RunResult}
 */
export function runLeg(mode, settings, leg) {
  const modeRules = MODES[mode];
  const playerCount = leg.order.length;
  // ps = « player states » : l'état de chaque joueur (reste à marquer, points, cibles...), dans l'ordre de jeu
  const ps = leg.order.map((id, i) => ({ ...modeRules.init(settings, leg, i), id, finished: false }));
  const finishedOrder = []; // indices des joueurs, dans l'ordre où ils ont fini
  const turns = [];          // tours terminés
  const turnsPlayed = new Array(playerCount).fill(0);
  let current = 0;           // indice du joueur qui lance
  let turn = null;           // tour en cours (3 fléchettes max)
  let instantWin = false;
  let status = { over: false, needDecision: false };

  // joueur suivant qui n'a pas encore fini
  const nextPlayerAfter = (i) => {
    for (let k = 1; k <= playerCount; k++) {
      const j = (i + k) % playerCount;
      if (!ps[j].finished) return j;
    }
    return i;
  };
  const computeStatus = () => modeRules.status({ ps, turns, finishedOrder, n: playerCount, leg, settings, instantWin });

  for (const dart of leg.darts) {
    if (status.over || (status.needDecision && leg.continueForPlaces == null)) break;
    if (!turn) {
      turn = {
        p: current, darts: [], start: clone(ps[current]),
        round: Math.floor(turns.length / playerCount), nth: turnsPlayed[current],
      };
    }
    const context = { settings, leg, turn, all: ps, idx: current };
    const outcome = modeRules.dart(ps[current], dart, context);
    turn.darts.push({ ...dart, ...outcome.info });
    if (outcome.bust) {
      // bust : le joueur revient à l'état d'avant son tour
      const keep = { id: ps[current].id, finished: false };
      ps[current] = { ...clone(turn.start), ...keep };
      turn.bust = true;
    }
    if (outcome.finished) {
      ps[current].finished = true;
      finishedOrder.push(current);
      turn.finished = true;
    }
    if (outcome.instantWin) instantWin = true;
    const turnEnds = outcome.finished || outcome.bust || outcome.endTurn || turn.darts.length === 3;
    if (turnEnds) {
      turn.complete = true;
      if (modeRules.afterTurn) modeRules.afterTurn(ps[current], turn, context);
      turns.push(turn);
      turnsPlayed[current] += 1;
      turn = null;
      status = computeStatus();
      if (!status.over && !status.needDecision) current = nextPlayerAfter(current);
      else if (status.needDecision && leg.continueForPlaces != null) {
        status = computeStatus();
        if (!status.over) current = nextPlayerAfter(current);
      }
    }
  }
  // décision déjà prise après coup : recalculer
  if (!turn) status = computeStatus();
  if (!turn && !status.over && !status.needDecision && turns.length && turns[turns.length - 1].p === current && ps[current].finished) {
    current = nextPlayerAfter(current);
  }

  const ranking = computeRanking(modeRules, ps, finishedOrder, instantWin);
  const awaiting = turns.length > (leg.validated || 0); // des tours attendent d'être validés
  return {
    ps, turns, current: turn, cur: current, finishedOrder, ranking,
    over: status.over, needDecision: status.needDecision && leg.continueForPlaces == null,
    awaiting, instantWin,
  };
}

// Classement : ceux qui ont fini d'abord (dans l'ordre), puis les autres selon la clé de tri du mode
function computeRanking(modeRules, ps, finishedOrder, instantWin) {
  const first = finishedOrder.map((i) => ps[i].id);
  const rest = ps
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !finishedOrder.includes(i))
    .sort((a, b) => modeRules.rankKey(b.p) - modeRules.rankKey(a.p) || a.i - b.i)
    .map(({ p }) => p.id);
  return [...first, ...rest];
}

// Qui a gagné combien de legs
export function legsWon(game) {
  const w = {};
  for (const id of game.player_ids) w[id] = 0;
  for (const leg of game.data.legs) if (leg.done && leg.ranking?.length) w[leg.ranking[0]] += 1;
  return w;
}

export function gameWinner(game) {
  const w = legsWon(game);
  let best = null;
  for (const id of game.player_ids) if (best == null || w[id] > w[best]) best = id;
  const top = Object.values(w).filter((v) => v === w[best]).length;
  return top === 1 ? best : null;
}
