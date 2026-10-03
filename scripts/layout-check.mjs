// Vérifie : en X01 la mise en page ne bouge pas (barre de finish réservée, cartes joueurs de hauteur fixe).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://localhost:4173';
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico'].map((name, i) => ({ id: uid(), name, color: ['#5fc8ff', '#ff9f5a'][i], created_at: new Date().toISOString() }));
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.route('**/rest/v1/rpc/**', mock);
await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('test');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByText('Qui es-tu ?').waitFor();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().waitFor();
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.getByRole('button', { name: /^Nico/ }).click();
await page.getByRole('button', { name: /^OK/ }).click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.waitForTimeout(300);
await page.getByText('Boutons').click();
const measure = async (label) => {
  const m = await page.evaluate(() => {
    const y = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top * 10) / 10 : null; };
    const h = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height * 10) / 10 : null; };
    return { scoresH: h('.scores'), coH: h('.checkout-bar'), stripY: y('.turn-strip'), actionsY: y('.actions') };
  });
  console.log(label.padEnd(26), JSON.stringify(m));
  return m;
};
const hit = async (mult, n) => { await page.getByRole('button', { name: mult, exact: true }).click(); await page.getByRole('button', { name: n, exact: true }).click(); };
const base = await measure('départ');
const all = [base];
await hit('Triple', 'T20'); all.push(await measure('1 fl. Yves'));
await hit('Triple', 'T20'); await hit('Triple', 'T20'); all.push(await measure('fin du tour Yves'));
const v = page.getByRole('button', { name: 'Valider la fin' }); if (await v.count()) await v.click();
await page.waitForTimeout(200);
all.push(await measure('tour de Nico'));
await hit('Triple', 'T20'); await hit('Triple', 'T20'); await hit('Triple', 'T20'); if (await v.count()) await v.click(); await page.waitForTimeout(200);
all.push(await measure('retour Yves (reste<170)'));
await page.screenshot({ path: process.argv[2] ? `${process.argv[2]}/lay.png` : 'lay.png' });
const ys = new Set(all.map((m) => m.stripY)); const hs = new Set(all.map((m) => m.scoresH)); const cs = new Set(all.map((m) => m.coH));
console.log(ys.size === 1 && hs.size === 1 && cs.size === 1 ? 'OK   mise en page stable' : `FAIL mise en page instable (strip ${[...ys]}, scores ${[...hs]}, finish ${[...cs]})`);
await browser.close();
