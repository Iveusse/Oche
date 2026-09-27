import { makeRng, makeSim } from '../src/engine/sim.js';
import { playerStats } from '../src/engine/stats.js';
const rnd = makeRng(7); const sim = makeSim(rnd);
for (const sg of [0.14, 0.18, 0.22, 0.26, 0.30, 0.34]) {
  const games = [];
  for (let i = 0; i < 150; i++) {
    const leg = sim.play('x01', { start: 301, in: 'single', out: 'single' }, ['a', 'b'], () => sg);
    games.push({ id: 'g' + i, mode: 'x01', settings: { start: 301, out: 'single' }, player_ids: ['a', 'b'], created_at: new Date().toISOString(), data: { legs: [leg] } });
  }
  const s = playerStats(games, 'a');
  console.log('sigma', sg, 'avg', s.avg.toFixed(1), 'first9', s.first9.toFixed(1), 'darts/leg', (s.x01Darts / 150).toFixed(1));
}
