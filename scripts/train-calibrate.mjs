// Calibre les notes d'entraînement et le niveau global avec des joueurs simulés.
// Usage : node scripts/train-calibrate.mjs
import { runLeg } from '../src/engine/runner.js';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { atcTargets, checkoutTargets } from '../src/engine/modes.js';
import { suggestCheckout } from '../src/lib/board.js';
import { x01Advanced, cricketAdvanced, shanghaiAdvanced, atcAdvanced, baseballAdvanced } from '../src/engine/advanced.js';
import { trainingResult } from '../src/engine/stats.js';

const rnd = makeRng(4242);
const sim = makeSim(rnd);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function drill(mode, sigma, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const leg = { order: ['a'], darts: [], validated: 1e9 };
    if (mode === 'train-doubles') leg.targets = atcTargets({ order: 'asc', bull: true });
    if (mode === 'train-checkout') leg.targets = checkoutTargets(rnd);
    if (mode === 'train-killer') leg.num = 1 + Math.floor(rnd() * 20);
    for (let k = 0; k < 800; k++) {
      const r = runLeg(mode, {}, leg);
      if (r.over) break;
      const ps = r.ps[0]; const left = 3 - (r.current ? r.current.darts.length : 0);
      let aim = [20, 3];
      if (mode === 'train-doubles') { const t = leg.targets[ps.pos]; aim = [t, 2]; }
      if (mode === 'train-checkout') { const route = suggestCheckout(ps.rem, 'double', left); aim = route ? [route[0].seg, route[0].mult] : [Math.max(1, Math.min(20, ps.rem - 40)), 1]; }
      if (mode === 'train-baseball') aim = [r.turns.length + 1, 3];
      if (mode === 'train-killer') aim = [leg.num, 2];
      leg.darts.push(sim.throwAt(aim[0], aim[1], sigma));
    }
    const r = runLeg(mode, {}, leg); leg.validated = r.turns.length; leg.done = true; leg.ranking = r.ranking;
    const g = { id: 'x', mode, settings: {}, player_ids: ['a'], data: { legs: [leg] } };
    const tr = trainingResult(g); out.push(tr ? tr.value : (mode === 'train-doubles' ? 800 : 0));
  }
  return out;
}

const SIG = (process.argv[3] || '0.065,0.09,0.115,0.15,0.22,0.30').split(',').map(Number);
const N = Number(process.argv[2] || 120);
const modes = ['train-doubles', 'train-focus20', 'train-checkout', 'train-baseball', 'train-killer'];
const rows = {};
for (const s of SIG) {
  const row = { sigma: s };
  for (const m of modes) row[m] = +mean(drill(m, s, N)).toFixed(1);
  // niveaux de jeu
  const mk = (mode, settings, order) => Array.from({ length: N }, (_, i) => {
    const leg = sim.play(mode, settings, order, () => s, mode === 'atc' ? { targets: sim.atcTargets(settings) } : {});
    return { id: `g${i}`, mode, settings, player_ids: order, status: 'finished', created_at: new Date(2020, 0, 1 + i).toISOString(), data: { legs: [{ ...leg, finishedAt: new Date().toISOString() }], legsToWin: 1 } };
  });
  const x = x01Advanced(mk('x01', { start: 301, in: 'single', out: 'double' }, ['a', 'b']), 'a');
  row.x01avg = +x.avgAll.toFixed(1); row.co = +x.coRate.toFixed(3);
  const c = cricketAdvanced(mk('cricket', {}, ['a', 'b']), 'a'); row.mpr = +c.mpr.toFixed(2);
  const sh = shanghaiAdvanced(mk('shanghai', { from: 1, to: 7 }, ['a', 'b']), 'a'); row.shHit = +sh.pct.hit.toFixed(3); row.shPts = +sh.ptsAvg.toFixed(0);
  const at = atcAdvanced(mk('atc', { zones: ['S', 'D', 'T'] }, ['a', 'b']), 'a'); row.atcAcc = +at.acc.toFixed(3);
  const cu = mk('countup', {}, ['a', 'b']).map((g) => { const r = runLeg('countup', {}, g.data.legs[0]); const t = r.turns.filter((x) => x.p === 0); return t.reduce((a, x) => a + x.darts.reduce((b, d) => b + (d.pts || 0), 0), 0) / t.length; }); row.cuTurn = +mean(cu).toFixed(1);
  console.log(JSON.stringify(row));
}
