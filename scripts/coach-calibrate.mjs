// Table de référence du coach : pour chaque niveau de dispersion, ce qu'on attend d'un joueur.
// Usage : node scripts/coach-calibrate.mjs  -> écrit src/engine/coachref.js
import { writeFileSync } from 'fs';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { x01Advanced } from '../src/engine/advanced.js';

const rnd = makeRng(777);
const sim = makeSim(rnd);
let t = Date.UTC(2020, 0, 1);
const rows = [];
for (let sigma = 0.10; sigma <= 0.42; sigma += 0.02) {
  const games = [];
  for (const out of ['single', 'double']) {
    const settings = { start: 301, in: 'single', out };
    for (let i = 0; i < 700; i++) {
      t += 3600000; const d = new Date(t).toISOString();
      const leg = { ...sim.play('x01', settings, ['a', 'b'], () => sigma), finishedAt: d };
      games.push({ id: `g${t}`, mode: 'x01', settings, player_ids: ['a', 'b'], status: 'finished', created_at: d, data: { legs: [leg], legsToWin: 1 } });
    }
  }
  const a = x01Advanced(games, 'a', 'all');
  const row = {
    sigma: +sigma.toFixed(2),
    avg: +a.avgAll.toFixed(1),
    scoring: +a.avgUntil[100].toFixed(1),
    co1: +(a.coBy.single[1] / a.coBy.single[0]).toFixed(3),
    co2: +(a.coBy.double[1] / a.coBy.double[0]).toFixed(3),
    zero: +(a.buckets[0] / a.turns).toFixed(3),
  };
  rows.push(row);
  console.log(row);
}
writeFileSync(new URL('../src/engine/coachref.js', import.meta.url), `// Généré par scripts/coach-calibrate.mjs, ne pas modifier à la main.\n// Par niveau de dispersion : moyenne, moyenne de scoring (> 100 restants), réussite des tentatives de finish (sortie simple / double), part de tours à 0.\nexport default ${JSON.stringify(rows, null, 1)};\n`);
