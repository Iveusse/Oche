// Plusieurs parties en cours : lancer, quitter, en lancer une autre, reprendre chacune, les terminer,
// récupérer celles du serveur sur un téléphone vierge, ne pas garder une partie jamais commencée.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { zoneCenter } from '../src/lib/board.js';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || 'shots'; mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const players = [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }, { id: 'p2', name: 'Nico', color: '#ff9f5a' }, { id: 'p3', name: 'Stéph', color: '#b69cff' }];
const games = [];
const mock = async (route) => {
  const fn = route.request().url().split('/rpc/')[1]?.split('?')[0];
  const b = JSON.parse(route.request().postData() || '{}');
  const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'oche_join') return json({ id: 'team-m', name: 'Test', has_admin: false });
  if (fn === 'oche_players') return json(players);
  if (fn === 'oche_games') return json(games);
  if (fn === 'oche_save_game') { const g = { ...b.p_game, updated_at: new Date().toISOString() }; const i = games.findIndex((x) => x.id === g.id); if (i < 0) games.push(g); else if (games[i].status !== 'finished') games[i] = g; return json(null); }
  return json(null);
};
const ok = (label, cond, extra = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`);
const b = await chromium.launch();
async function phone() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('dialog', (d) => d.accept());
  await page.route('**/rest/v1/rpc/**', mock);
  return { ctx, page, errs };
}
async function login(page) {
  await page.goto(BASE);
  await page.getByText('Rejoindre une équipe').click(); await page.getByLabel("Code de l'équipe").fill('x'); await page.getByRole('button', { name: 'Continuer' }).click(); await page.getByRole('button', { name: 'Rejoindre' }).click();
  await page.getByRole('button', { name: /Yves/ }).first().click();
  await page.getByText('Nouvelle partie').first().waitFor();
}
async function newGame(page, mode, other) {
  await page.getByText('Nouvelle partie').first().click();
  await page.locator('.choice', { hasText: mode }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${other}`) }).click();
  await page.getByRole('button', { name: /^OK/ }).click();
  await page.getByRole('button', { name: 'Lancer la partie' }).click();
  await page.getByRole('radio', { name: 'Boutons' }).click().catch(() => {});
}
const key = async (page, n) => { await page.getByRole('button', { name: n, exact: true }).click(); await page.waitForTimeout(60); };

const A = await phone(); const page = A.page;
await login(page);

// 1. X01 : 3 fléchettes (Yves a joué son tour)
await newGame(page, 'X01', 'Nico');
await page.getByRole('radio', { name: 'Boutons' }).click().catch(() => {});
await page.getByRole('button', { name: 'Triple', exact: true }).click(); await key(page, 'T20');
await page.getByRole('button', { name: 'Triple', exact: true }).click(); await key(page, 'T20');
await page.getByRole('button', { name: 'Triple', exact: true }).click(); await key(page, 'T20');
await page.getByRole('button', { name: 'Retour' }).click();
await page.getByText('Nouvelle partie').first().waitFor();
ok('1 partie en cours', (await page.locator('.live-card').count()) === 1);

// 2. Cricket : lancé SANS remplacer le X01, quelques fléchettes
await newGame(page, 'Cricket', 'Stéph');
await page.getByRole('button', { name: 'Triple', exact: true }).click(); await key(page, 'T20');
await page.getByRole('button', { name: 'Retour' }).click();
await page.getByText('Nouvelle partie').first().waitFor();
ok('2 parties en cours (rien de remplacé)', (await page.locator('.live-card').count()) === 2, (await page.locator('.live-card').allInnerTexts()).join(' || ').replace(/\n/g, ' '));

// 3. Partie ouverte puis quittée sans jouer : ne reste pas dans la liste
await newGame(page, 'Shanghai', 'Nico');
await page.getByRole('button', { name: 'Retour' }).click();
await page.getByText('Nouvelle partie').first().waitFor();
ok('partie jamais commencée non gardée', (await page.locator('.live-card').count()) === 2);
await page.screenshot({ path: `${OUT}/m1-liste.png`, fullPage: true });

// 4. Reprendre le X01 : le score est bien celui du X01 (Yves 421)
await page.getByRole('button', { name: /Reprendre 501/ }).click().catch(async () => { await page.locator('.live-card', { hasText: '501' }).click(); });
await page.waitForTimeout(300);
const rem = await page.locator('.score-card .v').first().innerText();
ok('reprise du X01 (reste 321)', rem === '321', rem);
await page.getByRole('button', { name: 'Retour' }).click();

// 5. Reprendre le Cricket
await page.locator('.live-card', { hasText: 'Cricket' }).click();
await page.waitForTimeout(300);
ok('reprise du Cricket', (await page.getByText('Cricket').count()) > 0 && (await page.locator('.cricket-grid').count()) === 1);

// 6. Abandonner le Cricket depuis les options : il disparaît de la liste, le X01 reste
await page.getByRole('button', { name: 'Options' }).click();
await page.getByRole('button', { name: 'Abandonner la partie' }).click();
await page.getByText('Nouvelle partie').first().waitFor();
ok('abandon : reste 1 partie (X01)', (await page.locator('.live-card').count()) === 1 && (await page.locator('.live-card').first().innerText()).includes('501'));

// 7. Téléphone vierge : retrouve la partie en cours depuis le serveur
const B = await phone();
await login(B.page);
ok('autre téléphone : récupère la partie du serveur', (await B.page.locator('.live-card').count()) === 1, String(await B.page.locator('.live-card').count()));
await B.ctx.close();

// 8. Persistance locale : rechargement
await page.reload();
await page.getByText('Nouvelle partie').first().waitFor();
ok('après rechargement : toujours 1 partie', (await page.locator('.live-card').count()) === 1);
console.log('serveur : parties en cours', games.filter((g) => g.status === 'in_progress').length, '| terminées', games.filter((g) => g.status === 'finished').length);
console.log('errors', A.errs);
await b.close();
