// Compare le modèle de probabilité aux résultats de matchs simulés.
import { makeRng, makeSim } from '../src/engine/sim.js';
import { x01Profile, x01Probs } from '../src/engine/winprob.js';
const sim = makeSim(makeRng(77));
const N = Number(process.argv[2] || 250);
const mk = (settings, sa, sb, n, t0, ids = ['a', 'b']) => Array.from({ length: n }, (_, i) => { const leg = sim.play('x01', settings, ids, (k) => (k === 0 ? sa : sb)); return { id: `g${t0}-${i}`, mode: 'x01', settings, player_ids: ids, created_at: new Date(1e12 + t0 + i).toISOString(), data: { legs: [{ ...leg, done: true }], legsToWin: 1 } }; });
let worst = 0;
for (const [out, start] of [['double', 501], ['single', 301], ['double', 301]]) for (const [sa, sb] of [[0.1, 0.1], [0.1, 0.16], [0.08, 0.2], [0.13, 0.2]]) {
  const settings = { start, in: 'single', out };
  const hist = mk(settings, sa, sb, Number(process.argv[3]||30), 0);
  const pa = x01Profile(hist, 'a', out); const pb = x01Profile(hist, 'b', out);
  const test = mk(settings, sa, sb, N, 1000);
  const real = test.filter((g) => g.data.legs[0].ranking[0] === 'a').length / N;
  const model = x01Probs([pa, pb], [start, start], out, 1, 8000)[0];
  worst = Math.max(worst, Math.abs(real - model));
  console.log(`${out} ${start} σ ${sa}/${sb}  réel A ${(real * 100).toFixed(0)} %  modèle ${(model * 100).toFixed(0)} %  (scoring ${pa.score.toFixed(0)} vs ${pb.score.toFixed(0)})`);
}
console.log('écart max', (worst * 100).toFixed(0), 'pts');
