// Calibre le modèle de probabilité de victoire : moyenne et écart-type de fléchettes par leg selon la moyenne du joueur.
// Usage : node scripts/winprob-calibrate.mjs [N]
import { runLeg } from '../src/engine/runner.js';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { x01Advanced } from '../src/engine/advanced.js';

const rnd = makeRng(2024); const sim = makeSim(rnd);
const N = Number(process.argv[2] || 150);
const SIG = [0.06, 0.08, 0.10, 0.13, 0.16, 0.20, 0.25, 0.32];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
for (const out of ['single', 'double']) for (const start of [301, 501]) {
  for (const sigma of SIG) {
    const settings = { start, in: 'single', out };
    const games = []; const darts = [];
    for (let i = 0; i < N; i++) {
      const leg = sim.play('x01', settings, ['a'], () => sigma);
      const r = runLeg('x01', settings, leg);
      darts.push(r.turns.reduce((a, t) => a + t.darts.length, 0));
      games.push({ id: 'g' + i, mode: 'x01', settings, player_ids: ['a'], created_at: new Date(1e12 + i).toISOString(), data: { legs: [{ ...leg, done: true, ranking: ['a'] }] } });
    }
    const a = x01Advanced(games, 'a');
    console.log(JSON.stringify({ out, start, sigma, avg: +a.avgAll.toFixed(1), mean: +mean(darts).toFixed(1), sd: +sd(darts).toFixed(1) }));
  }
}
