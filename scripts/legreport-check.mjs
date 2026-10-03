// Vérifie : bilan « Ta partie » sur l'écran de fin de leg (Count Up joué en ratés face à un historique correct).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico'].map((name, i) => ({ id: uid(), name, color: ['#5fc8ff', '#ff9f5a'][i], created_at: new Date().toISOString() }));
const P = Object.fromEntries(players.map((p) => [p.name, p.id]));
const games = [];
const sim = makeSim(makeRng(8));
let t = Date.now() - 10 * 86400000;
for (let i = 0; i < 6; i++) { t += 3600000; const leg = sim.play('countup', {}, [P.Yves], () => 0.13); const d = new Date(t).toISOString(); games.push({ id: uid(), mode: 'countup', settings: {}, player_ids: [P.Yves], status: 'finished', created_at: d, updated_at: d, data: { legs: [{ ...leg, done: true, finishedAt: d, activeMs: 300000 }], legsToWin: 1 } }); }
async function mock(route) {
  const fn = route.request().url().split('/rpc/')[1]?.split('?')[0];
  const body = JSON.parse(route.request().postData() || '{}');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
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
const check = (l, ok, x = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${l} ${x}`);
await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('test');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByText('Qui es-tu ?').waitFor();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().waitFor();
await page.getByText('Nouvelle partie').first().click();
await page.selectOption('select[aria-label="Mode de jeu"]', { label: 'Count Up' });
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.waitForTimeout(300);
await page.getByText('Boutons').click();
await page.getByRole('button', { name: 'Triple', exact: true }).click(); await page.getByRole('button', { name: 'T20', exact: true }).click(); await page.getByRole('button', { name: 'Triple', exact: true }).click(); await page.getByRole('button', { name: 'T20', exact: true }).click();
for (let i = 0; i < 22; i++) await page.getByRole('button', { name: 'Raté', exact: true }).click({ timeout: 3000 });
await page.waitForTimeout(400);
if (await page.getByRole('button', { name: 'Valider la fin' }).count()) await page.getByRole('button', { name: 'Valider la fin' }).click();
await page.waitForTimeout(600);
const tx = (await page.locator('body').innerText()).replace(/\n/g, ' ');
check('bilan affiché', /Ta partie/.test(tx), tx.slice(0, 300));
check('verdict', /En dessous de ton niveau|Dans ta moyenne|Meilleure que/.test(tx));
await page.screenshot({ path: `${OUT}/lr.png`, fullPage: true });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
