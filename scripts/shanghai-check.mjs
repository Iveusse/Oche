import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.route('**/rest/v1/rpc/**', (route) => {
  const fn = route.request().url().split('/rpc/')[1];
  const body = JSON.parse(route.request().postData() || '{}');
  if (fn === 'oche_reset_player') {
    if (body.p_code !== 'x') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'bad_code' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new Date().toISOString()) });
  }
  const d = fn === 'oche_join' ? { id: 'team-x', name: 'Test', has_admin: false } : fn === 'oche_check' ? true : fn === 'oche_players' ? [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }] : fn === 'oche_games' ? [] : null;
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
await page.getByRole('button', { name: 'Réglages' }).click();
await page.getByRole('switch', { name: 'Mode démo' }).click();
await page.getByRole('button', { name: 'OK' }).click();
await page.getByRole('button', { name: 'Stats' }).click();
const t0 = Date.now();
await page.getByText('simulés sur 6 mois').waitFor({ timeout: 30000 });
console.log('demo ready in', Date.now() - t0, 'ms');
await page.getByRole('button', { name: /^Yves/ }).click();
await page.screenshot({ path: `${OUT}/dbg.png` }); await page.locator('[role=option]', { hasText: 'Testeur' }).click();
await page.screenshot({ path: `${OUT}/a0-resume.png`, fullPage: true });
await page.getByRole('radio', { name: 'Analyse' }).click();
await page.waitForTimeout(400);
await page.locator('.chip-pill', { hasText: 'Tout' }).click();
await page.locator('.chip-pill', { hasText: 'Shanghai' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/sh1.png` });
const seg = page.locator('[role=radio]', { hasText: '1 à 7' });
if (await seg.count()) { await seg.first().click(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/sh2.png` }); }
console.log('errs', errs);
await browser.close();
