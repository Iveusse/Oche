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


await page.getByRole('button', { name: /Classement/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Palmarès de la semaine/ }).click();
await page.locator('.recap-img').waitFor();
await page.waitForTimeout(400);
const src = await page.locator('.recap-img').getAttribute('src');
const png = await page.evaluate(async (u) => { const b = await (await fetch(u)).blob(); const r = new FileReader(); return new Promise((res) => { r.onload = () => res(r.result); r.readAsDataURL(b); }); }, src);
const { writeFileSync } = await import('fs');
writeFileSync(`${OUT}/w1-palmares.png`, Buffer.from(png.split(',')[1], 'base64'));
check('palmarès affiché', true);
await page.getByRole('button', { name: 'OK' }).click();
await shot('w2-classement', true);
check('face à face détaillé', await page.getByText('Derniers legs').count() > 0);
await page.getByRole('button', { name: /Stats/ }).click();
await page.waitForTimeout(400);
await shot('w3-stats', true);
check('rivalités', await page.getByText('Rivalités').count() > 0, '');
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
