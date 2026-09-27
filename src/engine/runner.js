// Rejoue un leg à partir de la liste des fléchettes. Tout l'état est dérivé :
// annuler = retirer la dernière fléchette et rejouer.

import { MODES } from './modes.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function runLeg(mode, settings, leg) {
  const M = MODES[mode];
  const n = leg.order.length;
  const ps = leg.order.map((id, i) => ({ ...M.init(settings, leg, i), id, finished: false }));
  const finishedOrder = [];
  const turns = [];
  const turnCount = new Array(n).fill(0);
  let cur = 0;
  let turn = null;
  let instantWin = false;
  let st = { over: false, needDecision: false };

  const nextFrom = (i) => {
    for (let k = 1; k <= n; k++) {
      const j = (i + k) % n;
      if (!ps[j].finished) return j;
    }
    return i;
  };

  for (const d of leg.darts) {
    if (st.over || (st.needDecision && leg.continueForPlaces == null)) break;
    if (!turn) {
      turn = {
        p: cur, darts: [], start: clone(ps[cur]),
        round: Math.floor(turns.length / n), nth: turnCount[cur],
      };
    }
    const ctx = { settings, leg, turn, all: ps, idx: cur };
    const res = M.dart(ps[cur], d, ctx);
    turn.darts.push({ ...d, ...res.info });
    if (res.bust) {
      const keep = { id: ps[cur].id, finished: false };
      ps[cur] = { ...clone(turn.start), ...keep };
      turn.bust = true;
    }
    if (res.finished) {
      ps[cur].finished = true;
      finishedOrder.push(cur);
      turn.finished = true;
    }
    if (res.instantWin) instantWin = true;
    const end = res.finished || res.bust || res.endTurn || turn.darts.length === 3;
    if (end) {
      turn.complete = true;
      if (M.afterTurn) M.afterTurn(ps[cur], turn, ctx);
      turns.push(turn);
      turnCount[cur] += 1;
      turn = null;
      st = M.status({ ps, turns, finishedOrder, n, leg, settings, instantWin });
      if (!st.over && !st.needDecision) cur = nextFrom(cur);
      else if (st.needDecision && leg.continueForPlaces != null) {
        st = M.status({ ps, turns, finishedOrder, n, leg, settings, instantWin });
        if (!st.over) cur = nextFrom(cur);
      }
    }
  }
  // décision déjà prise après coup : recalculer
  if (!turn) st = M.status({ ps, turns, finishedOrder, n, leg, settings, instantWin });
  if (!turn && !st.over && !st.needDecision && turns.length && turns[turns.length - 1].p === cur && ps[cur].finished) {
    cur = nextFrom(cur);
  }

  const ranking = computeRanking(M, ps, finishedOrder, instantWin);
  const awaiting = turns.length > (leg.validated || 0);
  return {
    ps, turns, current: turn, cur, finishedOrder, ranking,
    over: st.over, needDecision: st.needDecision && leg.continueForPlaces == null,
    awaiting, instantWin,
  };
}

function computeRanking(M, ps, finishedOrder, instantWin) {
  const first = finishedOrder.map((i) => ps[i].id);
  const rest = ps
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !finishedOrder.includes(i))
    .sort((a, b) => M.rankKey(b.p) - M.rankKey(a.p) || a.i - b.i)
    .map(({ p }) => p.id);
  if (instantWin || !M.race) return [...first, ...rest];
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
