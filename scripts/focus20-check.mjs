import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.route('**/rest/v1/rpc/**', (route) => {
  const fn = route.request().url().split('/rpc/')[1];
  const d = fn === 'oche_join' ? { id: 'team-x', name: 'Test', has_admin: false } : fn === 'oche_check' ? true : fn === 'oche_players' ? [{ id: 'a', name: 'Yves', color: '#5fc8ff' }] : fn === 'oche_games' ? [] : null;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
});
const page = await ctx.newPage();
await page.goto('http://localhost:4173');
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('x');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByRole('button', { name: 'Entraînement' }).last().click();
await page.getByText('Focus 20').first().click();
await page.waitForTimeout(500);
const svg = page.locator('.board-slot svg').first();
const bb = await svg.boundingBox();
const cx = bb.x + bb.width / 2; const cy = bb.y + bb.height / 2; const R = bb.width / 2;
// anneaux (échelle plateau 1 = bord extérieur) : triple ~0.58-0.63 du rayon total de ~1.02
for (let k = 0; k < 99; k++) { await page.mouse.click(cx, cy - R * 0.46); if (k % 3 === 2) { await page.waitForTimeout(40); } }
await page.waitForTimeout(600);
console.log((await page.locator('.dart-box').allInnerTexts()).join(' ; ').replace(/\n/g,' '), '||', await page.locator('.info-box').innerText().catch(()=>''));
await page.screenshot({ path: `${OUT}/f20.png`, fullPage: true });
await browser.close();
