// Vérifie les équipes : migration d'un téléphone de l'ancienne version, création, rejoindre,
// changement d'équipe, cloisonnement, admin, code changé.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const uid = () => crypto.randomUUID();
const norm = (c) => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

// ---- faux serveur multi-équipes (mêmes règles que 003_equipes.sql) ----
const teams = [{ id: uid(), name: 'Famille', codes: ['fleches44'], admin: null }];
const FAM = teams[0].id;
const players = [
  { id: uid(), name: 'Yves', color: '#5fc8ff', team_id: FAM },
  { id: uid(), name: 'Nico', color: '#ff9f5a', team_id: FAM },
];
const games = [{
  id: uid(), mode: 'x01', settings: { start: 301, in: 'single', out: 'single' }, player_ids: [players[0].id, players[1].id], status: 'finished', team_id: FAM,
  created_at: new Date(Date.now() - 86400000).toISOString(),
  data: { legsToWin: 1, legs: [{ order: [players[0].id, players[1].id], darts: [], validated: 0, done: true, ranking: [players[0].id, players[1].id], finishedAt: new Date(Date.now() - 86000000).toISOString() }] },
}];
const teamOf = (code) => teams.find((t) => t.codes.some((c) => c === code || norm(c) === norm(code)));
let n = 0;
async function mock(route) {
  const fn = route.request().url().split('/rpc/')[1]?.split('?')[0];
  const b = JSON.parse(route.request().postData() || '{}');
  const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const bad = () => json({ message: 'bad_code', code: 'P0001' }, 400);
  const t = teamOf(b.p_code);
  switch (fn) {
    case 'oche_join': return json(t ? { id: t.id, name: t.name, has_admin: !!t.admin } : null);
    case 'oche_create_team': { const c = `AB${n}-X${n}Z`; n += 1; const nt = { id: uid(), name: b.p_name, codes: [c], admin: `tok${n}` }; teams.push(nt); return json({ id: nt.id, name: nt.name, code: c, admin_token: nt.admin }); }
    case 'oche_claim_admin': if (!t) return bad(); if (t.admin) return json({ message: 'already_admin' }, 400); t.admin = 'famtok'; return json('famtok');
    case 'oche_rename_team': if (!t || t.admin !== b.p_token) return json({ message: 'not_admin' }, 400); t.name = b.p_name; return json(null);
    case 'oche_regen_code': if (!t || t.admin !== b.p_token) return json({ message: 'not_admin' }, 400); t.codes = [`NEW-${n++}AA`]; return json(t.codes[0]);
    case 'oche_players': return t ? json(players.filter((p) => p.team_id === t.id)) : bad();
    case 'oche_add_player': if (!t) return bad(); { const p = { id: uid(), name: b.p_name, color: b.p_color, team_id: t.id }; players.push(p); return json(p); }
    case 'oche_games': return t ? json(games.filter((g) => g.team_id === t.id)) : bad();
    case 'oche_save_game': { if (!t) return bad(); const i = games.findIndex((g) => g.id === b.p_game.id); if (i < 0) games.push({ ...b.p_game, team_id: t.id }); else if (games[i].team_id === t.id) games[i] = { ...b.p_game, team_id: t.id }; return json(null); }
    default: return json(null);
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// téléphone qui avait l'ancienne version : code + profil + une partie en cache
await ctx.addInitScript(([yid]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('oche.code', JSON.stringify('fleches44'));
  localStorage.setItem('oche.profile', JSON.stringify(yid));
  localStorage.setItem('oche.theme', JSON.stringify('neon'));
}, [players[0].id]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/400/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
await page.route('**/rest/v1/rpc/**', mock);
const shot = (s, full = false) => page.screenshot({ path: `${OUT}/${s}.png`, fullPage: full });
const check = (label, ok, extra = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${extra}`);
const pill = () => page.locator('.team-pill span').innerText();

// 1. migration ancienne version
await page.goto(BASE);
await page.locator('.team-pill').waitFor();
await page.waitForTimeout(400);
check('ancien téléphone migré sans rien ressaisir', (await pill()) === 'Famille' && (await page.getByText('Yves').count()) > 0, await pill());
check('clé legacy nettoyée + profil rangé', await page.evaluate(() => !localStorage.getItem('oche.code') && !localStorage.getItem('oche.profile') && Object.keys(localStorage).some((k) => /^oche\.t\..*\.profile$/.test(k))));
await shot('t1-accueil-famille');

// 2. menu équipes, devenir admin, renommer
await page.locator('.team-pill').click();
await page.getByRole('button', { name: "Devenir admin de l'équipe" }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Renommer' }).click();
await page.getByLabel('Nouveau nom').fill('Famille P.');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.waitForTimeout(200);
await shot('t2-menu-admin');
check('renommée côté serveur', teams[0].name === 'Famille P.');

// 3. créer une 2e équipe
await page.getByRole('button', { name: /Rejoindre ou créer/ }).click();
await page.getByText('Créer une équipe').click();
await page.getByLabel("Nom de l'équipe").fill('Les potes');
await page.getByRole('button', { name: "Créer l'équipe" }).click();
await page.locator('.team-code').waitFor();
await shot('t3-code-cree');
const potesCode = await page.locator('.team-code').innerText();
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByText('Qui es-tu ?').waitFor();
check('nouvelle équipe : aucun joueur de la famille', (await page.getByRole('button', { name: /^Nico/ }).count()) === 0);
await shot('t4-qui-es-tu-vide');
await page.getByRole('button', { name: /Nouveau joueur|Ajouter|Je ne suis pas/ }).first().click();
await page.waitForTimeout(200);
await shot('t4b-apres-clic');
const inputs = page.locator('input.input');
if (await inputs.count()) { await inputs.first().fill('Yvo'); await page.keyboard.press('Enter'); }
await page.waitForTimeout(400);
await page.locator('.team-pill').waitFor();
check('dans « Les potes »', (await pill()) === 'Les potes', await pill());
check('pas de partie de la famille visible', (await page.getByText('Aucune partie pour l\'instant').count()) > 0);
await shot('t5-accueil-potes');

// 4. retour à la famille : profil Yves retrouvé
await page.locator('.team-pill').click();
await page.locator('.list-item', { hasText: 'Famille P.' }).click();
await page.waitForTimeout(400);
check('retour famille', (await pill()) === 'Famille P.', await pill());
check('profil famille conservé', (await page.locator('button', { hasText: 'Yves' }).count()) > 0);

// 5. rejoindre les potes sur un autre téléphone (contexte vierge), code tapé en minuscules sans tiret
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p2 = await ctx2.newPage();
await p2.route('**/rest/v1/rpc/**', mock);
await p2.goto(BASE);
await p2.getByText('Bienvenue !').waitFor();
await p2.screenshot({ path: `${OUT}/t6-bienvenue.png` });
await p2.getByText('Rejoindre une équipe').click();
await p2.getByLabel("Code de l'équipe").fill(potesCode.replace('-', '').toLowerCase());
await p2.getByRole('button', { name: 'Continuer' }).click();
await p2.getByText('Équipe trouvée').waitFor();
await p2.screenshot({ path: `${OUT}/t7-equipe-trouvee.png` });
await p2.getByRole('button', { name: 'Rejoindre' }).click();
await p2.getByText('Qui es-tu ?').waitFor();
check('2e téléphone voit Yvo dans les potes', (await p2.getByRole('button', { name: /Yvo/ }).count()) > 0);
const wrong = await (async () => { await p2.goto(BASE); return true; })();

// 6. l'admin change le code des potes : l'autre téléphone est prévenu
await page.locator('.team-pill').click();
await page.locator('.list-item', { hasText: 'Les potes' }).click();
await page.waitForTimeout(300);
await page.locator('.team-pill').click();
await page.getByRole('button', { name: 'Changer le code' }).click();
await page.waitForTimeout(300);
await shot('t8-nouveau-code');
check('admin garde l\'accès après changement', (await page.getByText(/Nouveau code/).count()) > 0);
await p2.reload();
await p2.waitForTimeout(1500);
await p2.screenshot({ path: `${OUT}/t9-code-change.png` });
check('autre téléphone prévenu du changement de code', (await p2.getByText(/a changé/).count()) > 0);

// 7. quitter une équipe
await page.getByRole('button', { name: 'Quitter cette équipe sur ce téléphone' }).click();
await page.waitForTimeout(300);
check('après avoir quitté : retour famille', (await pill()) === 'Famille P.', await pill());

console.log('serveur : parties famille', games.filter((g) => g.team_id === FAM).length, '| joueurs', players.map((p) => `${p.name}@${teams.find((t) => t.id === p.team_id).name}`).join(', '));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
