// Coach multi-modes : un joueur qui rate toujours le 16 au Shanghai -> ATC sur le 16
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || 'shots'; mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const ps = [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }, { id: 'p2', name: 'Nico', color: '#ff9f5a' }];
const games = [];
for (let g = 0; g < 4; g++) {
  const darts = [];
  for (let n = 1; n <= 20; n++) {
    darts.push(...(n === 16 ? [{ seg: 0, mult: 0 }, { seg: 0, mult: 0 }, { seg: 0, mult: 0 }] : [{ seg: n, mult: 1 }, { seg: 0, mult: 0 }, { seg: n, mult: 1 }]));
    darts.push({ seg: n, mult: 1 }, { seg: 0, mult: 0 }, { seg: 0, mult: 0 }); // Nico
  }
  const d = new Date(Date.now() - (g + 1) * 86400000).toISOString();
  games.push({ id: `g${g}`, mode: 'shanghai', settings: { from: 1, to: 20, instantWin: false }, player_ids: ['p1', 'p2'], status: 'finished', created_at: d, data: { legsToWin: 1, legs: [{ order: ['p1', 'p2'], darts, validated: 999, done: true, ranking: ['p1', 'p2'], finishedAt: d }] } });
}
const saved = [];
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.route('**/rest/v1/rpc/**', (r) => { const fn = r.request().url().split('/rpc/')[1]; if (fn === 'oche_save_game') saved.push(JSON.parse(r.request().postData()).p_game); const d = fn === 'oche_join' ? { id: 't', name: 'Test', has_admin: false } : fn === 'oche_players' ? ps : fn === 'oche_games' ? games : null; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) }); });
await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click(); await page.getByLabel("Code de l'équipe").fill('x'); await page.getByRole('button', { name: 'Continuer' }).click(); await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByRole('button', { name: /Entraînement/ }).click();
await page.waitForTimeout(400);
await page.locator('.coach').screenshot({ path: `${OUT}/coach.png` });
const txt = await page.locator('.coach').innerText();
console.log(/16/.test(txt) ? 'OK   coach repère le 16' : 'FAIL coach', '|', txt.split('\n').slice(0, 3).join(' | '));
await page.locator('.coach .btn-primary').click();
await page.waitForTimeout(400);
const sub = (await page.locator('body').innerText()).split('\n').slice(0, 4).join(' ');
console.log(/16/.test(sub) ? 'OK   ATC lancé sur le 16' : 'FAIL ATC', '|', sub.replace(/\n/g, ' '), '|', JSON.stringify(saved.at(-1)?.settings));
console.log('errors', errs);
await b.close();
