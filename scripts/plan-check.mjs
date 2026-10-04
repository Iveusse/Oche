// Vérifie visuellement le programme de la semaine et la courbe de niveau avec des parties simulées.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { runLeg } from '../src/engine/runner.js';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { atcTargets } from '../src/engine/modes.js';
const OUT = process.argv[2];
const rnd = makeRng(99); const sim = makeSim(rnd);
const DAY = 86400000; const now = Date.now();
const games = [];
const at = (d) => new Date(now - d * DAY).toISOString();
// niveau qui progresse : sigma baisse avec le temps
for (let i = 0; i < 40; i++) {
  const d = 70 - i * 1.7; const sg = 0.16 - (i / 40) * 0.05;
  for (const [mode, settings] of [['x01', { start: 301, in: 'single', out: 'double' }], ['cricket', {}]]) {
    const leg = sim.play(mode, settings, ['a', 'b'], (k) => (k === 0 ? sg : 0.12));
    games.push({ id: `g${i}${mode}`, mode, settings, player_ids: ['a', 'b'], status: 'finished', created_at: at(d), updated_at: at(d), data: { legs: [{ ...leg, done: true, finishedAt: at(d) }], legsToWin: 1 } });
  }
}
function drill(mode, sigma, d, id) {
  const leg = { order: ['a'], darts: [], validated: 1e9 };
  if (mode === 'train-doubles') leg.targets = atcTargets({ order: 'asc', bull: true });
  if (mode === 'train-killer') leg.num = 1 + Math.floor(rnd() * 20);
  for (let k = 0; k < 800; k++) {
    const r = runLeg(mode, {}, leg); if (r.over) break;
    let aim = [20, 3];
    if (mode === 'train-doubles') aim = [leg.targets[r.ps[0].pos], 2];
    if (mode === 'train-killer') aim = [leg.num, 2];
    leg.darts.push(sim.throwAt(aim[0], aim[1], sigma));
  }
  const r = runLeg(mode, {}, leg); leg.validated = r.turns.length; leg.done = true; leg.ranking = r.ranking; leg.finishedAt = at(d);
  return { id, mode, settings: {}, player_ids: ['a'], status: 'finished', created_at: at(d), updated_at: at(d), data: { legs: [leg], legsToWin: 1 } };
}
games.push(drill('train-doubles', 0.14, 20, 't1'), drill('train-doubles', 0.12, 3, 't2'), drill('train-focus20', 0.1, 10, 't3'), drill('train-focus20', 0.1, 0.01, 't4'));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.route('**/rest/v1/rpc/**', (route) => {
  const fn = route.request().url().split('/rpc/')[1];
  const d = fn === 'oche_join' ? { id: 'team-x', name: 'Test', has_admin: false } : fn === 'oche_check' ? true : fn === 'oche_players' ? [{ id: 'a', name: 'Yves', color: '#5fc8ff' }, { id: 'b', name: 'Nico', color: '#ff9f5a' }] : fn === 'oche_games' ? games : null;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:4173');
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('x');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByRole('button', { name: 'Entraînement' }).last().click();
await page.getByText('Programme de la semaine').waitFor();
await page.screenshot({ path: `${OUT}/p1-plan.png`, fullPage: true });
await page.getByRole('button', { name: 'Stats' }).click();
await page.getByRole('radio', { name: 'Analyse' }).click();
await page.locator('.chip-pill', { hasText: 'Tout' }).click().catch(() => {});
await page.getByText('Évolution du niveau').waitFor();
await page.screenshot({ path: `${OUT}/p2-curve.png`, fullPage: true });
console.log('errs', errs);
await browser.close();
