// Règles de chaque mode. Chaque mode fournit :
//  init(settings, leg, idx)            -> état initial d'un joueur
//  dart(ps, d, ctx)                    -> { info, bust?, finished?, endTurn?, instantWin? } (mute ps)
//  afterTurn?(ps, turn, ctx)           -> ajustement en fin de tour
//  status(ctx)                         -> { over, needDecision }
//  rankKey(ps)                         -> nombre, plus grand = mieux (pour les non-finis)
//  race: true si "le premier qui finit" (question continuer pour les places)

import { dartScore, isOutDart } from '../lib/board.js';

const CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25];

function raceStatus({ finishedOrder, n, leg }) {
  if (finishedOrder.length === 0) return { over: false, needDecision: false };
  if (n <= 2) return { over: true, needDecision: false };
  if (leg.continueForPlaces == null) return { over: false, needDecision: true };
  if (leg.continueForPlaces === false) return { over: true, needDecision: false };
  return { over: finishedOrder.length >= n - 1, needDecision: false };
}

// Score de départ d'un joueur (handicap possible : settings.starts = { idJoueur: 701 })
export const startOf = (g, pid) => Number(g.settings?.starts?.[pid] ?? g.settings?.start) || 501;
export const hasHandicap = (settings) => !!settings?.starts && Object.values(settings.starts).some((v) => Number(v) !== Number(settings.start));

export const x01 = {
  race: true,
  init: (s, leg, i) => ({ rem: Number(s.starts?.[leg?.order?.[i]] ?? s.start) || 501, opened: (s.in || 'single') === 'single' }),
  dart(ps, d, { settings }) {
    const inRule = settings.in || 'single';
    const out = settings.out || 'single';
    const info = { remBefore: ps.rem, opened: ps.opened, pts: 0 };
    if (!ps.opened) {
      const opens = inRule === 'double' ? d.mult === 2 : inRule === 'master' ? d.mult >= 2 : d.mult >= 1;
      if (!opens) return { info };
      ps.opened = true;
    }
    const score = dartScore(d);
    const nr = ps.rem - score;
    const bust = nr < 0 || (nr === 0 && !isOutDart(d, out)) || (nr === 1 && out !== 'single');
    if (bust) return { info, bust: true };
    ps.rem = nr;
    info.pts = score;
    return { info, finished: nr === 0 };
  },
  status: raceStatus,
  rankKey: (ps) => -ps.rem,
};

function atcZoneOk(d, target, zones) {
  if (d.seg !== target || !d.mult) return false;
  if (target === 25) {
    const z = d.mult === 2 ? 'D' : 'S';
    return zones.includes(z) || (!zones.includes('S') && !zones.includes('D'));
  }
  const z = d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S';
  return zones.includes(z);
}

export function atcTargets(settings, rng = Math.random) {
  // numéros choisis (ex. entraînement du coach sur tes numéros faibles), sinon 1 à 20
  let t = settings.nums?.length ? settings.nums.filter((n) => n !== 25) : Array.from({ length: 20 }, (_, i) => i + 1);
  if (settings.order === 'desc') t.reverse();
  if (settings.order === 'random') {
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
  }
  if (settings.bull || settings.nums?.includes(25)) t.push(25);
  return t;
}

export const atc = {
  race: true,
  init: () => ({ pos: 0 }),
  dart(ps, d, { settings, leg }) {
    const targets = leg.targets;
    const target = targets[ps.pos];
    const zones = settings.zones && settings.zones.length ? settings.zones : ['S', 'D', 'T'];
    const hit = atcZoneOk(d, target, zones);
    if (hit) {
      const adv = settings.skip && target !== 25 ? d.mult : 1;
      ps.pos = Math.min(ps.pos + adv, targets.length);
    }
    return { info: { target, hit }, finished: ps.pos >= targets.length };
  },
  status: raceStatus,
  rankKey: (ps) => ps.pos,
};

export function shanghaiNumbers(settings) {
  const from = settings.from || 1;
  const to = settings.to || 7;
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

export const shanghai = {
  race: false,
  init: () => ({ pts: 0 }),
  dart(ps, d, { settings, turn }) {
    const nums = shanghaiNumbers(settings);
    const target = nums[turn.round];
    const hit = d.seg === target && d.mult > 0;
    const pts = hit ? d.seg * d.mult : 0;
    ps.pts += pts;
    const info = { target, hit, pts };
    if (settings.instantWin !== false && turn.darts.length === 2) {
      const all = [...turn.darts, { ...d, hit }];
      const mults = new Set(all.filter((x) => x.seg === target && x.mult > 0).map((x) => x.mult));
      if (mults.has(1) && mults.has(2) && mults.has(3)) {
        return { info: { ...info, shanghai: true }, finished: true, instantWin: true };
      }
    }
    return { info };
  },
  status({ turns, n, settings, instantWin, leg }) {
    if (instantWin) return { over: true, needDecision: false };
    // partie arrêtée parce que plus personne ne pouvait rattraper le premier
    if (leg?.stoppedAt != null && turns.reduce((a, t) => a + t.darts.length, 0) >= leg.stoppedAt) return { over: true, needDecision: false };
    return { over: turns.length >= n * shanghaiNumbers(settings).length, needDecision: false };
  },
  rankKey: (ps) => ps.pts,
};

export const cricket = {
  race: false,
  init: () => ({ marks: Object.fromEntries(CRICKET_NUMS.map((k) => [k, 0])), pts: 0, hits: 0 }),
  dart(ps, d, { settings, all, idx }) {
    const info = { marks: 0 };
    if (d.mult && CRICKET_NUMS.includes(d.seg)) {
      const before = ps.marks[d.seg];
      const after = before + d.mult;
      const scoring = Math.max(0, after - 3) - Math.max(0, before - 3);
      ps.marks[d.seg] = after;
      ps.hits += d.mult;
      info.marks = d.mult;
      if (scoring > 0 && settings.points !== false) {
        const open = all.some((o, j) => j !== idx && o.marks[d.seg] < 3);
        if (open) ps.pts += scoring * d.seg;
      }
    }
    const closedAll = CRICKET_NUMS.every((k) => ps.marks[k] >= 3);
    const best = settings.points === false || all.every((o, j) => j === idx || ps.pts >= o.pts);
    return { info, finished: closedAll && best };
  },
  status: ({ finishedOrder }) => ({ over: finishedOrder.length > 0, needDecision: false }),
  rankKey: (ps) => CRICKET_NUMS.filter((k) => ps.marks[k] >= 3).length * 10000 + ps.pts,
};
export { CRICKET_NUMS };

// ---------- Entraînements (solo) ----------

export const trainFree = {
  race: false,
  init: () => ({ pts: 0 }),
  dart(ps, d) { ps.pts += dartScore(d); return { info: { pts: dartScore(d) } }; },
  status: () => ({ over: false, needDecision: false }),
  rankKey: (ps) => ps.pts,
};

export const trainDoubles = {
  ...atc,
  race: false,
  dart: (ps, d, ctx) => atc.dart(ps, d, { ...ctx, settings: { zones: ['D'] } }),
  status: ({ finishedOrder }) => ({ over: finishedOrder.length > 0, needDecision: false }),
};

export const trainFocus20 = {
  race: false,
  init: () => ({ pts: 0, darts: 0 }),
  dart(ps, d) {
    const pts = d.seg === 20 ? 20 * d.mult : 0;
    ps.pts += pts; ps.darts += 1;
    return { info: { target: 20, hit: pts > 0, pts } };
  },
  status: ({ ps }) => ({ over: ps[0].darts >= 99, needDecision: false }),
  rankKey: (ps) => ps.pts,
};

// 41 à 100 : tous faisables en 3 fléchettes avec sortie double
export function checkoutTargets(rng = Math.random, count = 20) {
  return Array.from({ length: count }, () => 41 + Math.floor(rng() * 60));
}

export const trainCheckout = {
  race: false,
  init: (s, leg) => ({ idx: 0, succ: 0, rem: leg.targets[0] }),
  dart(ps, d, { leg }) {
    const target = leg.targets[ps.idx];
    const nr = ps.rem - dartScore(d);
    const info = { target, remBefore: ps.rem, opened: true };
    if (nr < 0 || nr === 1 || (nr === 0 && d.mult !== 2)) return { info: { ...info, bust: true }, endTurn: true };
    ps.rem = nr;
    if (nr === 0) { ps.succ += 1; return { info: { ...info, done: true }, endTurn: true }; }
    return { info };
  },
  afterTurn(ps, turn, { leg }) {
    ps.idx += 1;
    ps.rem = leg.targets[ps.idx];
  },
  status: ({ ps, leg }) => ({ over: ps[0].idx >= leg.targets.length, needDecision: false }),
  rankKey: (ps) => ps.succ,
};

// Around the Clock d'entraînement (proposé par le coach, sur des numéros choisis) : ne compte ni
// dans les stats d'ATC ni dans les succès, seulement comme entraînement
export const trainAtc = {
  ...atc,
  race: false,
  status: ({ finishedOrder }) => ({ over: finishedOrder.length > 0, needDecision: false }),
};


// ---------- Baseball ----------
// 9 manches, la manche N se joue sur le numéro N. Simple = 1 point, double = 2, triple = 3
// (on compte les « courses », pas la valeur du segment). Le plus de points après 9 manches gagne.
export const BASEBALL_INNINGS = 9;
export const baseballNumbers = () => Array.from({ length: BASEBALL_INNINGS }, (_, i) => i + 1);

export const baseball = {
  race: false,
  init: () => ({ pts: 0 }),
  dart(ps, d, { turn }) {
    const target = turn.round + 1;
    const hit = d.seg === target && d.mult > 0;
    const pts = hit ? d.mult : 0;
    ps.pts += pts;
    return { info: { target, hit, pts } };
  },
  status: ({ turns, n }) => ({ over: turns.length >= n * BASEBALL_INNINGS, needDecision: false }),
  rankKey: (ps) => ps.pts,
};

// ---------- Count Up ----------
// 8 manches (réglable) de 3 fléchettes : on additionne tout ce qu'on touche (T20 = 60, bull = 50).
// Le plus gros total gagne.
export const COUNTUP_ROUNDS = 8;
export const countUpRounds = (s) => Number(s?.rounds) || COUNTUP_ROUNDS;
export const countup = {
  race: false,
  init: () => ({ pts: 0 }),
  dart(ps, d) {
    const pts = dartScore(d);
    ps.pts += pts;
    return { info: { pts } };
  },
  status: ({ turns, n, settings }) => ({ over: turns.length >= n * countUpRounds(settings), needDecision: false }),
  rankKey: (ps) => ps.pts,
};

// ---------- Killer ----------
// Chaque joueur a un numéro. On devient « killer » en touchant le DOUBLE de son propre numéro.
// Ensuite, chaque double sur le numéro d'un adversaire lui retire une vie. Le dernier en vie gagne.
export const KILLER_LIVES = 3;
export function killerNumbers(ids, rng = Math.random) {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Object.fromEntries(ids.map((id, i) => [id, pool[i]]));
}

export const killer = {
  race: false,
  init: (s, leg, i) => ({ num: leg.killerNums?.[leg.order[i]] ?? i + 1, lives: Number(s.lives) || KILLER_LIVES, killer: false, out: false, outAt: 0, kills: 0, lost: 0 }),
  dart(ps, d, { all, idx }) {
    const info = { hit: false };
    if (!ps.killer) info.target = ps.num;
    if (d.mult === 2 && d.seg >= 1 && d.seg <= 20) {
      if (!ps.killer) {
        if (d.seg === ps.num) { ps.killer = true; info.hit = true; info.becameKiller = true; }
      } else {
        const vi = all.findIndex((o, j) => j !== idx && !o.out && o.num === d.seg);
        if (vi >= 0) {
          const v = all[vi];
          v.lives -= 1; v.lost += 1; ps.kills += v.lives <= 0 ? 1 : 0;
          info.hit = true; info.victim = v.id; info.livesLeft = v.lives;
          if (v.lives <= 0) { v.out = true; v.finished = true; v.outAt = all.filter((o) => o.out).length; info.killed = true; }
        }
      }
    }
    return { info };
  },
  status: ({ ps, n }) => ({ over: n > 1 && ps.filter((p) => !p.out).length <= 1, needDecision: false }),
  rankKey: (ps) => (ps.out ? ps.outAt : 1000 + ps.lives),
};
export const killerTargets = (ps, all) => all.filter((o) => o.id !== ps.id && !o.out).map((o) => o.num);

// ---------- Entraînements liés ----------
// Baseball solo : 9 manches, on compte ses points
export const trainBaseball = {
  ...baseball,
  status: ({ turns }) => ({ over: turns.length >= BASEBALL_INNINGS, needDecision: false }),
};

// Doubles de Killer : 30 fléchettes sur le double d'un même numéro (le tien, ou celui du coach)
export const trainKiller = {
  race: false,
  init: (s, leg) => ({ num: leg.num || Number(s.num) || 20, hits: 0, darts: 0 }),
  dart(ps, d) {
    const hit = d.seg === ps.num && d.mult === 2;
    ps.darts += 1; if (hit) ps.hits += 1;
    return { info: { target: ps.num, hit } };
  },
  status: ({ ps }) => ({ over: ps[0].darts >= 30, needDecision: false }),
  rankKey: (ps) => ps.hits,
};

export const MODES = {
  x01, cricket, atc, shanghai, baseball, killer, countup,
  'train-free': trainFree,
  'train-baseball': trainBaseball,
  'train-killer': trainKiller,
  'train-atc': trainAtc,
  'train-doubles': trainDoubles,
  'train-focus20': trainFocus20,
  'train-checkout': trainCheckout,
};

export const MODE_LABEL = {
  x01: 'X01', cricket: 'Cricket', atc: 'Around the Clock', shanghai: 'Shanghai', baseball: 'Baseball', killer: 'Killer', countup: 'Count Up',
  'train-baseball': 'Baseball solo', 'train-killer': 'Doubles de Killer',
  'train-free': 'Session libre', 'train-doubles': 'Tour des doubles',
  'train-focus20': 'Focus 20', 'train-checkout': 'Checkouts 41-100', 'train-atc': 'Around the Clock ciblé',
};

export const isTraining = (mode) => mode.startsWith('train-');
