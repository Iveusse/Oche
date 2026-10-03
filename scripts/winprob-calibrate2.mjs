// Phase de scoring (reste > 100) et phase de finish séparées : moyenne/écart-type du finish selon la réussite aux finish.
import { runLeg } from '../src/engine/runner.js';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { x01Advanced } from '../src/engine/advanced.js';
const rnd = makeRng(99); const sim = makeSim(rnd);
const N = Number(process.argv[2] || 150);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
for (const out of ['single', 'double']) for (const sigma of [0.06, 0.08, 0.10, 0.13, 0.16, 0.20, 0.25, 0.32]) {
  const start = 501; const settings = { start, in: 'single', out };
  const games = []; const sc = []; const fin = [];
  for (let i = 0; i < N; i++) {
    const leg = sim.play('x01', settings, ['a'], () => sigma);
    const r = runLeg('x01', settings, leg);
    let dS = 0; let dF = 0;
    for (const t of r.turns) { const rem = t.darts[0].remBefore; if (rem > 100) dS += t.darts.length; else dF += t.darts.length; }
    sc.push(dS); fin.push(dF);
    games.push({ id: 'g' + i, mode: 'x01', settings, player_ids: ['a'], created_at: new Date(1e12 + i).toISOString(), data: { legs: [{ ...leg, done: true, ranking: ['a'] }] } });
  }
  const a = x01Advanced(games, 'a');
  const by = a.coBy[out]; const p = by[0] ? by[1] / by[0] : null;
  console.log(JSON.stringify({ out, sigma, scoreAvg: +a.avgUntil[100].toFixed(1), p: p && +p.toFixed(3), scoreDarts: +mean(sc).toFixed(1), scoreSd: +sd(sc).toFixed(1), finMean: +mean(fin).toFixed(1), finSd: +sd(fin).toFixed(1) }));
}
