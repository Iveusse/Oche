// Vérifie : onglets Niveau / Count Up / Entraînement de l'analyse, note de fin d'entraînement et critères.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { atcTargets } from '../src/engine/modes.js';
import { runLeg } from '../src/engine/runner.js';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico'].map((name, i) => ({ id: uid(), name, color: ['#5fc8ff', '#ff9f5a'][i], created_at: new Date().toISOString() }));
const P = Object.fromEntries(players.map((p) => [p.name, p.id]));
const games = [];
const sim = makeSim(makeRng(5));
let t = Date.now() - 20 * 86400000;
const push = (mode, settings, ids, leg) => { t += 3600000; const d = new Date(t).toISOString(); games.push({ id: uid(), mode, settings, player_ids: ids, status: 'finished', created_at: d, updated_at: d, data: { legs: [{ ...leg, done: true, finishedAt: d, activeMs: 300000 }], legsToWin: 1 } }); };
const add = (mode, settings, ids, extra = {}) => push(mode, settings, ids, sim.play(mode, settings, ids, (i) => [0.13, 0.2][i], extra));
for (let i = 0; i < 6; i++) { add('x01', { start: 301, in: 'single', out: 'double' }, [P.Yves, P.Nico]); add('cricket', {}, [P.Yves, P.Nico]); add('countup', {}, [P.Yves, P.Nico]); add('shanghai', { from: 1, to: 7 }, [P.Yves, P.Nico]); }
for (let i = 0; i < 3; i++) add('train-doubles', {}, [P.Yves], { targets: atcTargets({ order: 'asc', bull: true }) });
for (let i = 0; i < 2; i++) {
  const leg = { order: [P.Yves], darts: [], validated: 1e9 };
  for (let k = 0; k < 99; k++) leg.darts.push(sim.throwAt(20, 3, 0.12 + i * 0.03));
  const r = runLeg('train-focus20', {}, leg); leg.validated = r.turns.length;
  push('train-focus20', {}, [P.Yves], leg);
}

async function mock(route) {
  const fn = route.request().url().split('/rpc/')[1]?.split('?')[0];
  const body = JSON.parse(route.request().postData() || '{}');
  const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'oche_join') return json(body.p_code === 'test' ? { id: 'team-test', name: 'Test', has_admin: false } : null);
  if (fn === 'oche_check') return json(body.p_code === 'test');
  if (fn === 'oche_players') return json(players);
  if (fn === 'oche_games') return json(games);
  if (fn === 'oche_save_game') { const g = body.p_game; const i = games.findIndex((x) => x.id === g.id); if (i < 0) games.push(g); else games[i] = g; return json(null); }
  return json(null);
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/rest/v1/rpc/**', mock);
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const check = (label, ok, extra = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${extra}`);
const text = async () => (await page.locator('body').innerText()).replace(/\n/g, ' ');

await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('test');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByText('Qui es-tu ?').waitFor();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().waitFor();
await page.getByRole('button', { name: 'Stats' }).click();
await page.getByRole('radio', { name: 'Analyse' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Tout', exact: true }).click();
await page.waitForTimeout(300);
let tx = await text();
check('niveau global affiché', /niveau global/i.test(tx) && /\/ 100/.test(tx), tx.match(/Niveau global[^A-Za-z]*/)?.[0]);
await shot('lv1', true);
await page.getByRole('button', { name: "Comment c'est noté ?" }).click();
await page.getByRole('button', { name: 'Voir les seuils de chaque jeu' }).click();
await page.waitForTimeout(200);
await shot('lv2', true);
await page.getByRole('button', { name: 'Count Up', exact: true }).click();
await page.waitForTimeout(300);
tx = await text();
check('Count Up : analyse', /points par volée/i.test(tx) && /profil de volées/i.test(tx));
await shot('cu', true);
await page.locator('.chip-pill', { hasText: 'Entraînement' }).click();
await page.waitForTimeout(300);
tx = await text();
check('Entraînement : vue d\'ensemble', /Tes notes par exercice/.test(tx));
await shot('tr1', true);
await page.getByRole('button', { name: /^Doubles/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Voir les critères de notation' }).click();
await shot('tr2', true);
await page.getByRole('button', { name: /^Focus 20/ }).click();
await page.waitForTimeout(300);
await shot('tr3', true);

// fin d'entraînement
await page.getByRole('navigation').getByRole('button', { name: 'Entraînement' }).click();
await page.getByText('Doubles de Killer').first().click();
await page.waitForTimeout(400);
await shot('k0');
for (let i = 0; i < 30; i++) {
  const b = page.getByRole('button', { name: 'Hors cible', exact: true });
  if (await b.count()) await b.click();
}
await page.waitForTimeout(600);
console.log('BTN', await page.getByRole('button').allInnerTexts());
if (await page.getByRole('button', { name: 'Valider la fin' }).count()) await page.getByRole('button', { name: 'Valider la fin' }).click();
await page.waitForTimeout(600);
tx = await text();
check('fin d\'entraînement : note', /Ta note/i.test(tx), tx.slice(0, 160));
await shot('k1', true);
await page.getByRole('button', { name: 'Voir les critères de notation' }).click();
await page.waitForTimeout(200);
await shot('k2', true);
check('critères visibles', /Élite/.test(await text()));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
