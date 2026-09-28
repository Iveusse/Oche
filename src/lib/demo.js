// Mode démo : génère localement des joueurs et des mois de parties simulées.
// Rien n'est envoyé au serveur.
import { runLeg } from '../engine/runner.js';
import { atcTargets, CRICKET_NUMS, shanghaiNumbers } from '../engine/modes.js';
import { hitTest, zoneCenter, suggestCheckout } from './board.js';

export const DEMO_PREFIX = 'demo-';
export const DEMO_PLAYERS = [
  { id: 'demo-testeur', name: 'Testeur', color: '#b69cff', demo: true },
  { id: 'demo-bot-pote', name: 'Bot Pote', color: '#ffd166', demo: true },
  { id: 'demo-bot-costaud', name: 'Bot Costaud', color: '#ff7a9c', demo: true },
];
export const isDemoId = (id) => typeof id === 'string' && id.startsWith(DEMO_PREFIX);

function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function generateDemo(days = 180, seed = 42) {
  const rnd = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const throwAt = (seg, mult, sigma) => {
    const c = zoneCenter(seg, mult);
    const x = +(c.x + gauss() * sigma).toFixed(4); const y = +(c.y + gauss() * sigma).toFixed(4);
    return { ...hitTest(x, y), x, y };
  };
  const [T, POTE, COSTAUD] = DEMO_PLAYERS.map((p) => p.id);
  // Testeur progresse doucement : dispersion de 0.30 à 0.19. Pas un champion.
  const sigma = (id, t) => (id === T ? 0.30 - 0.11 * t : id === POTE ? 0.26 : 0.17);
  const games = [];
  let n = 0;

  const play = (mode, settings, order, t, extra = {}) => {
    const leg = { order, darts: [], validated: 1e9, continueForPlaces: false, ...extra };
    for (let k = 0; k < 900; k++) {
      const r = runLeg(mode, settings, leg);
      if (r.over) break;
      const p = r.current ? r.current.p : r.cur;
      const ps = r.ps[p];
      const left = 3 - (r.current ? r.current.darts.length : 0);
      const sg = sigma(order[p], t);
      let aim = [20, 3];
      if (mode === 'x01') {
        const route = ps.rem <= 170 ? suggestCheckout(ps.rem, settings.out, left) : null;
        if (route) aim = [route[0].seg, route[0].mult];
        else if (ps.rem < 60) aim = [Math.min(20, Math.max(1, ps.rem - 40 > 0 ? ps.rem - 40 : 1)), 1];
      } else if (mode === 'cricket') {
        const opens = CRICKET_NUMS.filter((c) => ps.marks[c] < 3);
        const open = opens.length ? opens[Math.floor(rnd() * Math.min(3, opens.length))] : 20;
        aim = open === 25 ? [25, 1] : [open, 3];
      } else if (mode === 'shanghai') {
        aim = [shanghaiNumbers(settings)[Math.floor(r.turns.length / order.length)] || 1, 3];
      } else if (mode === 'atc') {
        const tg = leg.targets[ps.pos];
        aim = tg === 25 ? [25, 1] : [tg, 1];
      } else if (mode === 'train-doubles') {
        const tg = leg.targets[ps.pos];
        aim = tg === 25 ? [25, 2] : [tg, 2];
      }
      leg.darts.push(throwAt(aim[0], aim[1], sg));
    }
    const r = runLeg(mode, settings, leg);
    leg.validated = r.turns.length; leg.done = true; leg.ranking = r.ranking;
    // temps actif réaliste : 5 à 9 s par fléchette (lancer, retirer, saisir)
    leg.activeMs = Math.round(leg.darts.length * (5000 + rnd() * 4000));
    return leg;
  };

  const start = Date.now() - days * 86400000;
  for (let day = 0; day < days; day++) {
    // 2 à 3 soirées par semaine
    if (rnd() > 0.38) continue;
    const t = day / days;
    const sessions = 2 + Math.floor(rnd() * 4);
    for (let s = 0; s < sessions; s++) {
      const date = new Date(start + day * 86400000 + (19 + s * 0.4) * 3600000);
      const roll = rnd();
      let mode; let settings;
      if (roll < 0.55) { mode = 'x01'; settings = { start: rnd() < 0.8 ? 301 : 501, in: 'single', out: rnd() < 0.6 ? 'double' : 'single' }; }
      else if (roll < 0.72) { mode = 'cricket'; settings = { points: true }; }
      else if (roll < 0.86) { mode = 'shanghai'; settings = rnd() < 0.7 ? { from: 1, to: 7, instantWin: true } : { from: 1, to: 20, instantWin: true }; }
      else { mode = 'atc'; settings = { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false }; }
      const others = rnd() < 0.6 ? [POTE] : [POTE, COSTAUD];
      const order = rnd() < 0.5 ? [T, ...others] : [...others, T];
      const legsN = mode === 'x01' ? 1 + Math.floor(rnd() * 3) : 1;
      const legs = [];
      let ord = order; let clock = date.getTime();
      for (let l = 0; l < legsN; l++) {
        const extra = mode === 'atc' ? { targets: atcTargets(settings, rnd) } : {};
        const leg = play(mode, settings, ord, t, extra);
        clock += leg.activeMs + 60000;
        leg.finishedAt = new Date(clock).toISOString();
        legs.push(leg);
        ord = [...ord.slice(1), ord[0]];
      }
      games.push({ id: `demo-g${n++}`, mode, settings, player_ids: order, status: 'finished', created_at: date.toISOString(), data: { legs, legsToWin: 1 }, demo: true });
    }
    // un entraînement de temps en temps
    if (rnd() < 0.25) {
      const date = new Date(start + day * 86400000 + 18 * 3600000);
      const leg = play('train-doubles', {}, [T], t, { targets: atcTargets({ order: 'asc', bull: true }) });
      leg.finishedAt = new Date(date.getTime() + leg.activeMs).toISOString();
      games.push({ id: `demo-g${n++}`, mode: 'train-doubles', settings: {}, player_ids: [T], status: 'finished', created_at: date.toISOString(), data: { legs: [leg], legsToWin: 1 }, demo: true });
    }
  }
  return { players: DEMO_PLAYERS, games };
}
