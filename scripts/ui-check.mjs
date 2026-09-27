// Vérification visuelle : sert dist/, simule Supabase, joue une partie, prend des captures.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { runLeg } from '../src/engine/runner.js';
import { zoneCenter } from '../src/lib/board.js';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';

// ---------- faux backend ----------
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico', 'Julien', 'Seb', 'Max', 'Tom', 'Clément'].map((name, i) => ({
  id: uid(), name, color: ['#5fc8ff', '#ff9f5a', '#b69cff', '#6ee7b7', '#ff7a9c', '#ffd166', '#7aa2ff'][i], created_at: new Date().toISOString(),
}));
const P = Object.fromEntries(players.map((p) => [p.name, p.id]));
const games = [];

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
function throwAt(seg, mult, skill) {
  const c = zoneCenter(seg, mult);
  const x = c.x + gauss() * skill; const y = c.y + gauss() * skill;
  return { x: +x.toFixed(4), y: +y.toFixed(4) };
}
import { hitTest } from '../src/lib/board.js';
function simX01(ids, skills, daysAgo) {
  const settings = { start: 501, in: 'single', out: 'double' };
  const leg = { order: ids, darts: [], validated: 0, continueForPlaces: false };
  for (let k = 0; k < 600; k++) {
    const r = runLeg('x01', settings, leg);
    if (r.over) break;
    const p = r.current ? r.current.p : r.cur;
    const rem = r.ps[p].rem;
    let aim = [20, 3];
    if (rem <= 40 && rem % 2 === 0) aim = [rem / 2, 2];
    else if (rem <= 40) aim = [1, 1];
    else if (rem < 60) aim = [rem - 40 > 20 ? 20 : rem - 40, 1];
    const pt = throwAt(aim[0], aim[1], skills[p]);
    leg.darts.push({ ...hitTest(pt.x, pt.y), ...pt });
    leg.validated = runLeg('x01', settings, leg).turns.length;
  }
  const r = runLeg('x01', settings, leg);
  leg.done = true; leg.ranking = r.ranking;
  const d = new Date(Date.now() - daysAgo * 86400000).toISOString();
  games.push({ id: uid(), mode: 'x01', settings, player_ids: ids, status: 'finished', data: { legs: [leg], legsToWin: 1 }, created_at: d, updated_at: d });
}
for (let i = 0; i < 9; i++) {
  simX01([P.Yves, P.Nico], [0.16 - i * 0.004, 0.19], 26 - i * 3);
  if (i % 3 === 0) simX01([P.Julien, P.Seb, P.Yves], [0.22, 0.27, 0.15], 25 - i * 3);
}

async function mock(route) {
  const url = route.request().url();
  const fn = url.split('/rpc/')[1]?.split('?')[0];
  const body = JSON.parse(route.request().postData() || '{}');
  const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'oche_check') return json(body.p_code === 'test');
  if (body.p_code !== 'test') return json({ message: 'bad_code', code: 'P0001' }, 400);
  if (fn === 'oche_players') return json([...players].sort((a, b) => a.name.localeCompare(b.name)));
  if (fn === 'oche_add_player') { const p = { id: uid(), name: body.p_name, color: body.p_color }; players.push(p); return json(p); }
  if (fn === 'oche_games') return json(games);
  if (fn === 'oche_save_game') {
    const g = body.p_game; const i = games.findIndex((x) => x.id === g.id);
    if (i < 0) games.push(g); else if (games[i].status !== 'finished') games[i] = g;
    return json(null);
  }
  return json({ message: 'unknown' }, 404);
}

// ---------- scénario ----------
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: +(process.env.VW || 390), height: +(process.env.VH || 844) }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/rest/v1/rpc/**', mock);
page.on('dialog', (d) => d.accept());

const shot = async (name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
const board = async () => page.locator('.board-wrap').boundingBox();
async function tapZone(seg, mult) {
  const b = await board();
  const c = seg === 0 ? { x: 0, y: -1.2 } : zoneCenter(seg, mult);
  const k = b.width / 2.6;
  await page.mouse.move(b.x + (c.x + 1.3) * k, b.y + (c.y + 1.3) * k);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(30);
}
const valider = () => page.getByRole('button', { name: 'Valider' }).click();

await page.goto(BASE);
await shot('01-code');
await page.getByLabel('Code du groupe').fill('test');
await page.getByRole('button', { name: 'Entrer' }).click();
await page.getByText('Qui es-tu ?').waitFor();
await page.waitForTimeout(300);
await shot('02-profil');
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().waitFor();
await page.waitForTimeout(200);
await shot('03-accueil', true);

// nouvelle partie X01 à 3
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('radio', { name: '301' }).click();
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /^Nico/ }).click();
await page.getByRole('button', { name: /^Julien/ }).click();
await shot('04-picker');
await page.getByRole('button', { name: /^OK/ }).click();
await shot('05-nouvelle-partie', true);
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.waitForTimeout(200);

// Yves 180
for (let i = 0; i < 3; i++) await tapZone(20, 3);
await shot('06-saisie-tour');
await valider();
// Nico : un triple 19 puis loupe
await tapZone(19, 3);
{
  const b = await board(); const c = zoneCenter(16, 2); const k = b.width / 2.6;
  await page.mouse.move(b.x + (c.x + 1.3) * k, b.y + (c.y + 1.3) * k);
  await page.mouse.down();
  await page.mouse.move(b.x + (c.x + 1.3) * k + 1, b.y + (c.y + 1.3) * k + 1);
  await page.waitForTimeout(100);
  await shot('07-loupe');
  await page.mouse.up();
}
await page.getByRole('button', { name: 'Hors cible', exact: true }).click();
await valider();
for (let i = 0; i < 3; i++) await tapZone(0, 0);
await valider();
// Yves : 121 -> T20, T20, S1
await shot('07b-finish-debut');
await tapZone(20, 3);
await shot('07c-finish-apres-1');
await tapZone(20, 3); await tapZone(1, 1);
await valider();
await page.getByText('termine !').waitFor();
await shot('08-decision');
await page.getByRole('button', { name: 'Arrêter le leg ici' }).click();
await page.getByText(/gagne le leg/).waitFor();
await shot('09-fin-de-leg', true);
await page.getByRole('button', { name: 'Jouer le leg 2' }).click();
await page.waitForTimeout(200);
await shot('10-leg2');
await page.getByRole('button', { name: 'Options' }).click();
await page.getByRole('button', { name: 'Abandonner la partie' }).click();
await page.waitForTimeout(300);

// cricket
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: /^Cricket/ }).click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await tapZone(20, 3); await tapZone(20, 1); await tapZone(19, 2);
await valider();
await tapZone(18, 3);
await shot('11-cricket');
await page.getByRole('button', { name: 'Options' }).click();
await page.getByRole('button', { name: 'Abandonner la partie' }).click();
await page.waitForTimeout(200);

// ATC réglages
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: /^Around the Clock/ }).click();
await shot('12-reglages-atc', true);
await page.getByRole('button', { name: /^Shanghai/ }).click();
await shot('13-reglages-shanghai', true);
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.getByRole('radio', { name: 'Boutons' }).click();
await page.getByRole('button', { name: 'Simple 1' }).click();
await page.getByRole('button', { name: 'Raté' }).click();
await shot('14a-shanghai-boutons');
await page.getByRole('button', { name: 'Annuler la dernière fléchette' }).click();
await page.getByRole('button', { name: 'Double 1' }).click();
await page.getByRole('button', { name: 'Triple 1' }).click();
await page.waitForTimeout(100);
await shot('14-shanghai');
await page.getByRole('button', { name: 'Valider' }).click();
await page.waitForTimeout(300);
await shot('14b-shanghai-fin');
await page.getByRole('button', { name: 'Terminer la partie' }).click();
await page.waitForTimeout(300);

await shot('15-accueil-apres', true);
await page.getByRole('button', { name: 'Stats' }).click();
await page.waitForTimeout(400);
await shot('16-stats', true);
await page.getByLabel('Comparer avec').selectOption({ label: 'Nico' });
await page.waitForTimeout(300);
await shot('16b-stats-compare', true);
await page.getByRole('button', { name: 'Classement' }).click();
await page.waitForTimeout(300);
await shot('17-classement', true);
await page.getByRole('button', { name: 'Entraînement' }).click();
await page.waitForTimeout(200);
await shot('18-entrainement', true);
await page.getByText('Checkouts 41-100').click();
await page.waitForTimeout(200);
await shot('19-train-checkout');
await tapZone(20, 1);
await shot('19b-train-checkout-apres-1');

// reprise après perte du stockage local (réinstallation)
await page.getByRole('button', { name: 'Retour' }).click();
await page.getByRole('button', { name: 'Jouer' }).click();
await page.getByText('Nouvelle partie').first().click();
await page.getByRole('button', { name: /^X01/ }).click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await tapZone(20, 1); await tapZone(20, 1); await tapZone(20, 1);
await valider();
await page.evaluate(() => { localStorage.removeItem('oche.current'); localStorage.removeItem('oche.cacheGames'); });
await page.reload();
await page.getByText('Partie en cours').waitFor({ timeout: 5000 });
await page.getByText('Reprendre').click();
await page.waitForTimeout(300);
await shot('20-reprise');
console.log('reprise OK, score affiché :', await page.locator('.score-card .v').first().textContent());
console.log('saved games:', games.length, 'players:', players.length);
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
