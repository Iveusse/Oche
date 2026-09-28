// Calcule la rareté de chaque succès par simulation et écrit src/engine/rarity.js
// Joueur de référence : dispersion SIGMA (≈ 33 de moyenne en 301), contre un adversaire du même niveau.
// Usage : node scripts/calibrate.mjs
import { writeFileSync } from 'fs';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { computeAchievements, EXPLOIT_LIST, SERIES } from '../src/engine/achievements.js';
import { playerStats } from '../src/engine/stats.js';
import { hitTest, zoneCenter } from '../src/lib/board.js';

const SIGMA = 0.20;
const rnd = makeRng(20260927);
const sim = makeSim(rnd);
const P = ['a', 'b'];
let t = Date.UTC(2020, 0, 1);
const mk = (mode, settings, leg) => {
  t += 3600000;
  const d = new Date(t).toISOString();
  return { id: `g${t}`, mode, settings, player_ids: P, status: 'finished', created_at: d, data: { legs: [{ ...leg, finishedAt: d }], legsToWin: 1 } };
};
const SETUPS = {
  x01: () => ['x01', { start: 301, in: 'single', out: 'single' }],
  cricket: () => ['cricket', { points: true }],
  shanghai: () => (rnd() < 0.4 ? ['shanghai', { from: 1, to: 7, instantWin: true }] : ['shanghai', { from: 1, to: 20, instantWin: true }]),
  atc: () => ['atc', { zones: ['S', 'D', 'T'], order: 'asc', bull: false, skip: false }],
};
const MIX = { x01: 0.5, cricket: 0.2, shanghai: 0.15, atc: 0.15 };
const N = { x01: 4000, cricket: 800, shanghai: 4000, atc: 500 };

const oneLeg = (mode) => {
  const [m, s] = SETUPS[mode]();
  const extra = m === 'atc' ? { targets: sim.atcTargets(s) } : {};
  return mk(m, s, sim.play(m, s, P, () => SIGMA, extra));
};

const t0 = Date.now();
const byMode = {};
for (const mode of Object.keys(N)) {
  byMode[mode] = Array.from({ length: N[mode] }, () => oneLeg(mode));
  console.log(mode, byMode[mode].length, 'legs', Math.round((Date.now() - t0) / 1000), 's');
}
const avg = playerStats(byMode.x01, 'a').avg;
console.log('moyenne 3 fléchettes du joueur de référence :', avg.toFixed(1));

// ---- rythmes des compteurs, par leg ----
const counters = Object.fromEntries(Object.entries(byMode).map(([m, gs]) => [m, computeAchievements(gs, 'a').__counters]));
const per = (m, f) => f(counters[m]) / N[m];
const mixed = (f) => Object.keys(MIX).reduce((a, m) => a + MIX[m] * per(m, f), 0);

// probabilité de toucher T20 en visant T20 (pour les événements trop rares à observer)
let hit = 0; const TRIES = 2e6; const c20 = zoneCenter(20, 3);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
for (let i = 0; i < TRIES; i++) { const h = hitTest(c20.x + gauss() * SIGMA, c20.y + gauss() * SIGMA); if (h.seg === 20 && h.mult === 3) hit += 1; }
const pT20 = hit / TRIES;
const turnsPerLeg = counters.x01.darts / N.x01 / 3;
console.log('P(T20 en visant T20) =', pT20.toFixed(4), '| tours par leg de 301 :', turnsPerLeg.toFixed(1));
const rate180 = Math.max(per('x01', (c) => c.c180), turnsPerLeg * 0.8 * pT20 ** 3);

const series = {
  games: 1, x01: 1, cricket: 1, shanghai: 1, atc: 1,
  'legs-won': mixed((c) => c.legsWon),
  darts: mixed((c) => c.darts),
  triples: mixed((c) => c.triples),
  doubles: mixed((c) => c.doubles),
  bull50: mixed((c) => c.bulls),
  bull25: mixed((c) => c.bull25),
  misses: mixed((c) => c.misses),
  tons: per('x01', (c) => c.tons),
  ton40: per('x01', (c) => c.c140),
  180: rate180,
  checkouts: per('x01', (c) => c.checkouts),
  'big-co': per('x01', (c) => c.bigCheckouts),
  'x01-points': per('x01', (c) => c.x01Points),
  busts: per('x01', (c) => c.busts),
  'x01-wins': per('x01', (c) => c.winsByMode.x01),
  'cricket-wins': per('cricket', (c) => c.winsByMode.cricket),
  'shanghai-wins': per('shanghai', (c) => c.winsByMode.shanghai),
  'atc-wins': per('atc', (c) => c.winsByMode.atc),
  marks: per('cricket', (c) => c.marks),
  'shanghai-hits': per('shanghai', (c) => c.shanghaiHits),
  shanghais: per('shanghai', (c) => c.shanghais),
};

// ---- exploits : probabilité par leg (événements d'un seul leg) ----
const single = EXPLOIT_LIST.filter((a) => a.basis && !a.cumulative);
const prob = {};
for (const a of single) {
  const modes = a.basis === 'all' ? Object.keys(MIX) : [a.basis];
  let p = 0;
  for (const m of modes) {
    // succès propre à une variante (Shanghai 1 à 7 / 1 à 20) : proba parmi les legs de cette variante
    const pool = a.variant ? byMode[m].filter((g) => g.settings?.to === a.variant) : byMode[m];
    const k = pool.filter((g) => computeAchievements([g], 'a')[a.id].unlocked).length;
    p += (a.basis === 'all' ? MIX[m] : 1) * (k / pool.length);
  }
  prob[a.id] = p;
}
// événements trop rares pour la simulation : calcul direct
prob['two-180'] = Math.max(prob['two-180'] || 0, (turnsPerLeg * 0.8 * pT20 ** 3) ** 2 / 2);
// Shanghai sur le 20 : taux de Shanghai par leg de 1 à 20, réparti sur les 20 numéros
{
  const legs20 = byMode.shanghai.filter((g) => g.settings.to === 20);
  const sh = legs20.filter((g) => computeAchievements([g], 'a')['shanghai-done'].unlocked).length / legs20.length;
  prob['shanghai-on-20'] = Math.max(prob['shanghai-on-20'] || 0, sh / 20);
}
prob['301-6'] = Math.max(prob['301-6'] || 0, pT20 ** 3 * pT20 ** 2 * 0.02 * 0.5);

const exploits = {};
for (const [id, p] of Object.entries(prob)) if (p > 0) exploits[id] = +(1 / p).toFixed(1);

// ---- exploits cumulatifs : nombre moyen de legs avant de les débloquer (carrières simulées) ----
const cumul = EXPLOIT_LIST.filter((a) => a.cumulative && a.basis && !a.id.startsWith('streak'));
const CAREERS = 6; const LEN = 500;
const found = Object.fromEntries(cumul.map((a) => [a.id, []]));
for (let k = 0; k < CAREERS; k++) {
  const career = [];
  for (let i = 0; i < LEN; i++) {
    const x = rnd(); let acc = 0; let mode = 'x01';
    for (const [m, w] of Object.entries(MIX)) { acc += w; if (x < acc) { mode = m; break; } }
    career.push(oneLeg(mode));
  }
  const res = computeAchievements(career, 'a');
  for (const a of cumul) {
    const d = res[a.id].unlocked;
    found[a.id].push(d ? career.findIndex((g) => g.data.legs[0].finishedAt === d) + 1 : LEN * 2);
  }
}
for (const a of cumul) exploits[a.id] = +(found[a.id].reduce((x, y) => x + y, 0) / CAREERS).toFixed(1);

const out = {
  meta: { sigma: SIGMA, average: +avg.toFixed(1), pT20: +pT20.toFixed(4), legs: N, mix: MIX, generated: new Date().toISOString().slice(0, 10) },
  series: Object.fromEntries(Object.entries(series).map(([k, v]) => [k, +v.toPrecision(4)])),
  exploits,
};
writeFileSync(new URL('../src/engine/rarity.js', import.meta.url), `// Généré par scripts/calibrate.mjs, ne pas modifier à la main.\n// series : quantité moyenne par leg (ou par partie pour les compteurs de parties)\n// exploits : nombre moyen de legs avant que ça arrive\nexport default ${JSON.stringify(out, null, 2)};\n`);
console.log(JSON.stringify(out, null, 1));
console.log('fini en', Math.round((Date.now() - t0) / 1000), 's');
