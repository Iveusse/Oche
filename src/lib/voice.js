// Annonces vocales (synthèse) et saisie à la voix (reconnaissance), en français.
import { load, save } from './store.js';

// ---------- annonces ----------
export const voiceOn = () => load('voice', false);
export const setVoiceOn = (v) => { save('voice', v); if (v) speak('Annonces activées', true); };

let frVoice = null;
function pickVoice() {
  if (frVoice || !('speechSynthesis' in window)) return frVoice;
  const vs = window.speechSynthesis.getVoices();
  frVoice = vs.find((v) => v.lang === 'fr-FR' && /premium|enhanced|amélioré/i.test(v.name))
    || vs.find((v) => v.lang === 'fr-FR') || vs.find((v) => v.lang?.startsWith('fr')) || null;
  return frVoice;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { frVoice = null; pickVoice(); };
}

let quietUntil = 0; // la reconnaissance ignore ce qu'elle entend pendant qu'on parle
export const isSpeaking = () => ('speechSynthesis' in window && window.speechSynthesis.speaking) || Date.now() < quietUntil;

export function speak(text, force = false) {
  if (!text || (!force && !voiceOn()) || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const v = pickVoice(); if (v) u.voice = v;
  u.rate = 1.05;
  u.onend = () => { quietUntil = Date.now() + 700; };
  quietUntil = Date.now() + 400 + text.length * 90;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export const dartWords = (d) => {
  if (!d.mult) return 'raté';
  if (d.seg === 25) return d.mult === 2 ? 'bull' : '25';
  return d.mult === 3 ? `triple ${d.seg}` : d.mult === 2 ? `double ${d.seg}` : String(d.seg);
};

// ---------- reconnaissance ----------
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = !!SR;

export function startListening(onAlternatives, onState) {
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  let active = true;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal || isSpeaking()) continue;
      onAlternatives(Array.from(e.results[i]).map((a) => a.transcript));
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { active = false; onState(false, 'Micro refusé : autorise-le dans les réglages de l\'iPhone.'); }
  };
  rec.onend = () => { if (active) { try { rec.start(); } catch { active = false; onState(false); } } else onState(false); };
  try { rec.start(); onState(true); } catch { onState(false, 'Impossible de lancer le micro.'); }
  return () => { active = false; try { rec.stop(); } catch { /* déjà arrêté */ } };
}

// ---------- compréhension de « triple vingt, cinq, raté » ----------
const NUM = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, set: 7, huit: 8, neuf: 9,
  dix: 10, dis: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vin: 20, vins: 20, vint: 20, cinquante: 50,
};
const MULT = { triple: 3, triples: 3, tripler: 3, trible: 3, t: 3, double: 2, doubles: 2, d: 2, simple: 1, simples: 1, s: 1 };
const MISS = new Set(['rate', 'rater', 'rates', 'raté', 'zero', 'dehors', 'hors', 'manque', 'out', 'rien', 'dans le mur', 'mur', 'loupe']);
const BULL = new Set(['bull', 'bulle', 'boule', 'bool', 'centre', 'mouche']);

// renvoie { darts: [...], cmd: 'validate' | 'undo' | null }
export function parseSpeech(text, { target } = {}) {
  let s = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/hors cible/g, ' rate ').replace(/demi[- ]?bull/g, ' 25 ')
    .replace(/vingt[- ]et[- ]un/g, ' 21 ').replace(/vingt[- ]cinq/g, ' 25 ')
    .replace(/dix[- ](sept|huit|neuf)/g, (_, u) => ` ${10 + NUM[u]} `)
    .replace(/\b([tdsTDS])\s?(\d{1,2})\b/g, (_, m, n) => ` ${m} ${n} `);
  const words = s.split(/[\s,.;!?'-]+/).filter(Boolean);
  const darts = []; let cmd = null; let mult = null;
  const push = (seg, m) => { darts.push({ seg, mult: m }); mult = null; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^(valide|valider|validez|suivant|ok|okay)$/.test(w)) { cmd = 'validate'; continue; }
    if (/^(annule|annuler|annulez|efface|effacer|retour)$/.test(w)) { cmd = 'undo'; continue; }
    if (/^[a-z]$/.test(w) && !/^\d/.test(words[i + 1] || '')) continue; // « d », « s » isolés : on ignore
    if (MULT[w] != null) {
      if (mult != null && target) push(target, mult); // « simple double triple » sans numéro : cible en cours
      mult = MULT[w]; continue;
    }
    if (MISS.has(w)) { push(0, 0); continue; }
    if (BULL.has(w)) { push(25, mult === 1 ? 1 : 2); continue; }
    let n = /^\d+$/.test(w) ? Number(w) : NUM[w];
    if (n == null) continue;
    if (n === 50) { push(25, 2); continue; }
    if (n === 25) { push(25, mult === 2 ? 2 : 1); continue; }
    if (n >= 1 && n <= 20) { push(n, mult || 1); continue; }
    // « 205 » quand on a dit « 20, 5 » trop vite
    const str = String(n);
    if (str.length === 3 && Number(str.slice(0, 2)) <= 20 && Number(str[2]) >= 1) { push(Number(str.slice(0, 2)), mult || 1); push(Number(str[2]), 1); }
  }
  if (mult != null && target) push(target, mult);
  return { darts, cmd };
}
