import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { zoneCenter } from '../src/lib/board.js';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.route('**/rest/v1/rpc/**', (route) => {
  const fn = route.request().url().split('/rpc/')[1];
  const d = fn === 'oche_check' ? true : fn === 'oche_players' ? [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }, { id: 'p2', name: 'Nico', color: '#ff9f5a' }] : fn === 'oche_games' ? [] : null;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4173');
await page.getByLabel('Code du groupe').fill('x');
await page.getByRole('button', { name: 'Entrer' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
const b = await page.locator('.board-wrap').boundingBox();
const k = b.width / 2.6;
for (const [name, seg, mult] of [['t20', 20, 3], ['d16', 16, 2], ['s5', 5, 1], ['bull', 25, 2], ['miss', 0, 0], ['d3', 3, 2]]) {
  const c = seg === 0 ? { x: 0.3, y: 1.15 } : zoneCenter(seg, mult);
  await page.mouse.move(b.x + (c.x + 1.3) * k, b.y + (c.y + 1.3) * k);
  await page.mouse.down();
  await page.mouse.move(b.x + (c.x + 1.3) * k + 0.5, b.y + (c.y + 1.3) * k + 0.5);
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/loupe-${name}.png`, clip: { x: 0, y: 0, width: 393, height: b.y + b.height + 20 } });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Annuler la dernière fléchette' }).click();
}
await browser.close();
