// Vérifie : l'appli s'ouvre hors ligne (service worker) et renvoie les tours au retour du réseau.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE = 'http://127.0.0.1:4173';
const saved = [];
const players = [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }, { id: 'p2', name: 'Nico', color: '#ff9f5a' }];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
await ctx.route('**/rest/v1/rpc/**', async (route) => {
  const fn = route.request().url().split('/rpc/')[1];
  const body = JSON.parse(route.request().postData() || '{}');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'oche_join') return json({ id: 'team-x', name: 'Test', has_admin: false });
  if (fn === 'oche_check') return json(true);
  if (fn === 'oche_players') return json(players);
  if (fn === 'oche_games') return json([]);
  if (fn === 'oche_save_game') { saved.push(body.p_game); return json(null); }
  return json(null);
});
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('x');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready, null, { timeout: 5000 });
await page.reload(); // prise de contrôle par le service worker
await page.waitForTimeout(800);
console.log('SW actif :', await page.evaluate(() => !!navigator.serviceWorker.controller));

await ctx.setOffline(true);
await page.reload();
await page.getByText('Nouvelle partie').first().waitFor({ timeout: 5000 });
console.log('Ouverture hors ligne : OK');
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.getByRole('button', { name: /^Nico/ }).click();
await page.getByRole('button', { name: /^OK/ }).click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.getByRole('button', { name: 'Hors cible' }).click();
await page.getByRole('button', { name: 'Hors cible' }).click();
await page.getByRole('button', { name: 'Hors cible' }).click();
if (await page.getByRole('button', { name: /^Valider/ }).count()) await page.getByRole('button', { name: /^Valider/ }).click();
const pending = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('oche.pending') || '{}')).length);
console.log('Tour joué hors ligne, en attente :', pending, '| envoyés :', saved.length);
await ctx.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(1500);
const left = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('oche.pending') || '{}')).length);
console.log('Après retour réseau, en attente :', left, '| envoyés :', saved.length, '| dernier état :', saved.at(-1)?.data.legs[0].validated, 'tour(s) validé(s)');
await browser.close();
