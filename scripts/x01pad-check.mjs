// X01 : saisie au clavier + annonce du nouveau finish quand on rate la fléchette conseillée
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const OUT = process.argv[2] || 'shots'; mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const ps = [{ id: 'p1', name: 'Yves', color: '#5fc8ff' }, { id: 'p2', name: 'Nico', color: '#ff9f5a' }];
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { localStorage.setItem('oche.voice', 'true'); window.__spoken = []; class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, getVoices: () => [], cancel() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); } } }); });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.route('**/rest/v1/rpc/**', (r) => { const fn = r.request().url().split('/rpc/')[1]; const d = fn === 'oche_join' ? { id: 't', name: 'Test', has_admin: false } : fn === 'oche_players' ? ps : fn === 'oche_games' ? [] : null; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) }); });
await page.goto(BASE);
await page.getByText('Rejoindre une équipe').click(); await page.getByLabel("Code de l'équipe").fill('x'); await page.getByRole('button', { name: 'Continuer' }).click(); await page.getByRole('button', { name: 'Rejoindre' }).click();
await page.getByRole('button', { name: /Yves/ }).first().click();
await page.getByText('Nouvelle partie').first().click();
await page.locator('.choice', { hasText: 'X01' }).click();
await page.getByRole('radio', { name: '301' }).click();
await page.locator('.seg').nth(2).getByRole('radio', { name: 'Double' }).click();
await page.getByRole('button', { name: 'Ajouter', exact: true }).click(); await page.getByRole('button', { name: /^Nico/ }).click(); await page.getByRole('button', { name: /^OK/ }).click();
await page.getByRole('button', { name: 'Lancer la partie' }).click();
await page.getByRole('radio', { name: 'Boutons' }).click();
const key = async (mod, n) => { if (mod) await page.getByRole('button', { name: mod, exact: true }).click(); await page.getByRole('button', { name: n, exact: true }).click(); await page.waitForTimeout(60); };
const miss = () => key(null, 'Raté');
await key('Triple', 'T20'); await key('Triple', 'T20'); await key('Triple', 'T20'); // 121
await miss(); await miss(); await miss();
await key('Triple', 'T20'); await key('Triple', 'T7'); await miss(); // 40
await miss(); await miss(); await miss();
await page.waitForTimeout(1000);
await page.evaluate(() => { window.__spoken = []; });
await key(null, '20'); // conseillé D20, touché S20 -> reste 20, D10
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/x01pad.png` });
const spoken = await page.evaluate(() => window.__spoken);
const rem = await page.locator('.score-card').first().locator('.v').innerText();
console.log(rem === '20' ? 'OK   clavier : reste 20' : `FAIL clavier : reste ${rem}`);
console.log(spoken.some((s) => /Reste 20\. double 10/.test(s)) ? 'OK   annonce du nouveau finish' : 'FAIL annonce', JSON.stringify(spoken));
console.log('errors', errs);
await b.close();
