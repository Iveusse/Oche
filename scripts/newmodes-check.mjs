// Vérifie : handicap, annonces vocales, saisie à la voix, récap de soirée, coach.
// Voix, micro et partage sont simulés (le navigateur de test n'en a pas).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { makeRng, makeSim } from '../src/engine/sim.js';
import { mkdirSync } from 'fs';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const uid = () => crypto.randomUUID();
const players = ['Yves', 'Nico', 'Stéph', 'Tom'].map((name, i) => ({ id: uid(), name, color: ['#5fc8ff', '#ff9f5a', '#b69cff', '#6ee7b7'][i], created_at: new Date().toISOString() }));
const P = Object.fromEntries(players.map((p) => [p.name, p.id]));
const games = [];
const sim = makeSim(makeRng(3));
// soirée d'aujourd'hui : 14 legs de 301 et 3 Shanghai, Yves bon au scoring mais sigma plus large sur les doubles n'existe pas dans le modèle,
// donc on lui donne juste un niveau : le coach doit dire « équilibré » ou pointer un écart.
let t = Date.now() - 3 * 3600000;
const add = (mode, settings, ids, sig) => {
  t += 8 * 60000;
  const leg = { ...sim.play(mode, settings, ids, (i) => sig[i]), finishedAt: new Date(t + 7 * 60000).toISOString(), activeMs: 6 * 60000 };
  const d = new Date(t).toISOString();
  games.push({ id: uid(), mode, settings, player_ids: ids, status: 'finished', created_at: d, updated_at: d, data: { legs: [leg], legsToWin: 1 } });
};
for (let i = 0; i < 14; i++) add('x01', { start: 301, in: 'single', out: 'double' }, [P.Yves, P.Nico], [0.17, 0.22]);
for (let i = 0; i < 4; i++) add('shanghai', { from: 1, to: 20, instantWin: true }, [P.Yves, P.Stéph], [0.2, 0.25]);

async function mock(route) {
  const fn = route.request().url().split('/rpc/')[1]?.split('?')[0];
  const body = JSON.parse(route.request().postData() || '{}');
  const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  if (fn === 'oche_join') return json(body.p_code === 'test' ? { id: 'team-test', name: 'Test', has_admin: false } : null);
  if (fn === 'oche_check') return json(body.p_code === 'test');
  if (fn === 'oche_players') return json(players);
  if (fn === 'oche_games') return json(games);
  if (fn === 'oche_save_game') { const g = body.p_game; const i = games.findIndex((x) => x.id === g.id); if (i < 0) games.push(g); else games[i] = g; return json(null); }
  return json(null);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__spoken = [];
  class U { constructor(t) { this.text = t; } }
  window.SpeechSynthesisUtterance = U;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, getVoices: () => [], cancel() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); } } });
  class R { start() { window.__rec = this; } stop() { window.__rec = null; this.onend && this.onend(); } }
  window.webkitSpeechRecognition = R; window.SpeechRecognition = R;
  window.__say = (text) => { const res = [{ transcript: text }]; res.isFinal = true; window.__rec.onresult({ resultIndex: 0, results: [res] }); };
  window.__shared = null;
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__shared = d.files.map((f) => `${f.name} ${f.size}o`); };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
await page.route('**/rest/v1/rpc/**', mock);
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const check = (label, ok, extra = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} ${extra}`);

await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click();
await page.getByLabel("Code de l'équipe").fill('test');
await page.getByRole('button', { name: 'Continuer' }).click();
await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByText('Qui es-tu ?').waitFor();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().waitFor();
await page.waitForTimeout(300);


const start = async (mode, others) => {
  await page.getByText('Nouvelle partie').first().click();
  await page.locator('.choice', { hasText: mode }).click();
  if (others.length) {
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    for (const n of others) await page.getByRole('button', { name: new RegExp('^' + n) }).click();
    await page.getByRole('button', { name: /^OK/ }).click();
  }
  await page.getByRole('button', { name: 'Lancer la partie' }).click();
  await page.waitForTimeout(300);
};
await page.getByRole('button', { name: 'Options' }).count();

// ---------- Baseball ----------
await start('Baseball', ['Nico']);
await page.getByText('Boutons').click();
await shot('n1-baseball');
for (let n = 1; n <= 9; n++) {
  for (const p of [0, 1]) {
    await page.getByRole('button', { name: `Triple ${n}` }).click();
    await page.getByRole('button', { name: 'Raté', exact: true }).click();
    await page.getByRole('button', { name: `Simple ${n}` }).click();
    await page.waitForTimeout(60);
  }
}
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Valider la fin' }).click();
await page.waitForTimeout(500);
await shot('n2-baseball-fin', true);
const txt = await page.locator('.screen').innerText();
check('baseball : 9 manches jouées, 4 pts par manche = 36', /36/.test(txt), txt.replace(/\n/g, ' ').slice(0, 200));
console.log(games.filter((g) => g.mode === 'baseball').length, 'partie(s) baseball sauvegardée(s)');

// ---------- Killer ----------
await page.goto(BASE);
await page.getByText('Nouvelle partie').first().waitFor();
await start('Killer', ['Tom']);
await page.getByText('Boutons').click();
const cardTexts = await page.locator('.score-card').allInnerTexts();
const nums = cardTexts.map((t) => Number((t.match(/D(\d+) pour tuer/) || [])[1]));
check('killer : 3 numéros distincts', new Set(nums).size === 3 && nums.every(Boolean), JSON.stringify(cardTexts.map((t) => t.replace(/\n/g, ' '))));
await shot('n3-killer');
const dbl = async (seg) => { await page.getByRole('button', { name: 'Double', exact: true }).click(); await page.getByRole('button', { name: `D${seg}`, exact: true }).click(); };
const miss = () => page.getByRole('button', { name: 'Raté', exact: true }).click();
// chacun devient killer
for (let i = 0; i < 3; i++) { await dbl(nums[i]); await miss(); await miss(); await page.waitForTimeout(80); }
let cards = await page.locator('.score-card').allInnerTexts();
check('killer : les 3 sont killers', cards.every((t) => /killer/.test(t)), JSON.stringify(cards.map((t) => t.replace(/\n/g, ' '))));
// P0 tue P1 (3 doubles sur son numéro)
await dbl(nums[1]); await dbl(nums[1]); await dbl(nums[1]);
await page.waitForTimeout(100);
cards = await page.locator('.score-card').allInnerTexts();
check('killer : P1 éliminé', /éliminé/.test(cards[1]), cards[1].replace(/\n/g, ' '));
await shot('n4-killer-elim');
// P1 est sauté : c'est à P2, qui tue P0
await dbl(nums[0]); await dbl(nums[0]); await dbl(nums[0]);
await page.waitForTimeout(600);
if (await page.getByRole('button', { name: 'Valider la fin' }).count()) await page.getByRole('button', { name: 'Valider la fin' }).click();
await page.waitForTimeout(500);
await shot('n5-killer-fin', true);
const end = await page.locator('.screen').innerText();
check('killer : fin de leg, Tom gagne', /Tom/.test(end), end.replace(/\n/g, ' ').slice(0, 160));
console.log(games.filter((g) => g.mode === 'killer').length, 'partie(s) killer sauvegardée(s)');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
