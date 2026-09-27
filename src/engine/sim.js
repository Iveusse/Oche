// Simulation de lancers pour estimer la rareté de chaque action.
// Modèle : chaque fléchette tombe autour du point visé avec une dispersion gaussienne (sigma,
// en unités de la cible où 1 = bord extérieur du double). Stratégie simple de joueur amateur.
import { runLeg } from './runner.js';
import { atcTargets, CRICKET_NUMS, shanghaiNumbers } from './modes.js';
import { hitTest, zoneCenter, suggestCheckout } from '../lib/board.js';

export function makeRng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function makeSim(rnd) {
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const throwAt = (seg, mult, sigma) => {
    const c = zoneCenter(seg, mult);
    const x = +(c.x + gauss() * sigma).toFixed(4); const y = +(c.y + gauss() * sigma).toFixed(4);
    return { ...hitTest(x, y), x, y };
  };
  // sigmaOf(index du joueur) -> dispersion
  const play = (mode, settings, order, sigmaOf, extra = {}) => {
    const leg = { order, darts: [], validated: 1e9, continueForPlaces: false, ...extra };
    for (let k = 0; k < 1500; k++) {
      const r = runLeg(mode, settings, leg);
      if (r.over) break;
      const p = r.current ? r.current.p : r.cur;
      const ps = r.ps[p];
      const left = 3 - (r.current ? r.current.darts.length : 0);
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
      } else if (mode === 'atc' || mode === 'train-doubles') {
        const tg = leg.targets[ps.pos];
        aim = tg === 25 ? [25, mode === 'atc' ? 1 : 2] : [tg, mode === 'atc' ? 1 : 2];
      }
      leg.darts.push(throwAt(aim[0], aim[1], sigmaOf(p)));
    }
    const r = runLeg(mode, settings, leg);
    leg.validated = r.turns.length; leg.done = true; leg.ranking = r.ranking;
    return leg;
  };
  return { play, throwAt, atcTargets: (s) => atcTargets(s, rnd) };
}
