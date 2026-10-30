// Cibles Shanghai/Cricket : captures en jeu et en fin de manche, mesure de la hauteur laissée à la saisie.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.argv[2] || '.';
const H = Number(process.argv[3] || 844);
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico', 'Marie', 'Paul'].map((name, i) => ({ id: uid(), name, color: ['#5fc8ff', '#ff9f5a', '#f07bd0', '#7be0b0'][i], created_at: new Date().toISOString() }));
const games = [];
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
let page; let ctx; const errs = [];
async function start(mode, names) {
  if (ctx) await ctx.close();
  games.length = 0;
  ctx = await browser.newContext({ viewport: { width: 393, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/rest/v1/rpc/**', mock);
  await page.goto(BASE);
  if (await page.getByText('Rejoindre une équipe').count()) {
    await page.getByText('Rejoindre une équipe').click();
    await page.getByLabel("Code de l'équipe").fill('test');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Rejoindre' }).click();
    await page.getByText('Qui es-tu ?').waitFor();
    await page.getByRole('button', { name: /Yves/ }).first().click();
  }
  await page.getByText('Nouvelle partie').first().click();
  await page.locator('select').first().selectOption({ label: mode });
  for (const n of names) {
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${n}`) }).click();
    await page.getByRole('button', { name: /^OK/ }).click();
  }
  await page.getByRole('button', { name: 'Lancer la partie' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('radio', { name: 'Boutons' }).click().catch(() => {});
}
const metrics = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const play = document.querySelector('.play');
  return { slot: r('.board-slot'), cards: r('.scores') || r('.cricket-panel'), overflow: play ? play.scrollHeight - play.clientHeight : null };
})));
const b = (name) => page.getByRole('button', { name, exact: true }).click();
const only = process.argv[4];
if (only === 'x') { await start('X01', ['Nico']); await b('Triple'); await b('T20'); await b('Triple'); await b('T20'); await b('Triple'); await b('T20'); await b('Triple'); await b('T20'); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/x01-${H}.png` }); console.log('errors', errs); await browser.close(); process.exit(0); }
if (!only || only === 'sh') {
  for (const names of [['Nico'], ['Nico', 'Marie'], ['Nico', 'Marie', 'Paul']]) {
    await start('Shanghai', names);
    await b('Simple 1'); await b('Triple 1'); await b('Raté');
    await b('Double 1'); await b('Raté'); await b('Simple 1');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/sh${names.length + 1}-${H}.png` }); await metrics(`shanghai ${names.length + 1} joueurs`);
  }
  await start('Shanghai', ['Nico']);
  await b('Simple 1'); await b('Double 1'); await b('Triple 1');
  await page.getByRole('button', { name: 'Valider la fin' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/sh-end-${H}.png`, fullPage: true });
}
if (!only || only === 'cr') {
  for (const names of [['Nico'], ['Nico', 'Marie', 'Paul']]) {
    await start('Cricket', names);
    await b('Triple'); await b('T20'); await b('Triple'); await b('T19'); await b('Double'); await b('D18');
    for (let k = 0; k < names.length; k++) { await b('Raté'); await b('Raté'); await b('Raté'); }
    await b('Triple'); await b('T20'); await b('Triple'); await b('T19'); await b('18');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/cr${names.length + 1}-${H}.png` }); await metrics(`cricket ${names.length + 1} joueurs`);
  }
}
if (!only || only === 'ki') {
  await start('Killer', ['Nico', 'Marie']);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/ki1-${H}.png` });
  await page.getByRole('button', { name: /pour devenir killer/ }).click();
  await page.getByRole('button', { name: 'Raté' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ki2-${H}.png` });
  await metrics('killer');
}
console.log('errors', errs);
await browser.close();
