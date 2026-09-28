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

// Parle. Avec un tableau de phrases, marque une petite pause entre chacune
// (ex. « Raté. 6 points » ... pause ... « Nico. Le 7 »).
let seq = 0;
export function speak(text, force = false, queue = false, gap = 700) {
  const parts = (Array.isArray(text) ? text : [text]).map((t) => (t || '').trim()).filter(Boolean);
  if (!parts.length || (!force && !voiceOn()) || !('speechSynthesis' in window)) return;
  const id = queue ? seq : ++seq;
  if (!queue) window.speechSynthesis.cancel();
  const say = (i) => {
    if (id !== seq || i >= parts.length) return;
    const u = new SpeechSynthesisUtterance(parts[i]);
    u.lang = 'fr-FR';
    const v = pickVoice(); if (v) u.voice = v;
    u.rate = 1.05;
    u.onend = () => {
      quietUntil = Date.now() + 700 + (i < parts.length - 1 ? gap : 0);
      if (i < parts.length - 1) setTimeout(() => say(i + 1), gap);
    };
    quietUntil = Math.max(quietUntil, Date.now()) + 400 + parts[i].length * 90;
    window.speechSynthesis.speak(u);
  };
  say(0);
}

export const dartWords = (d) => {
  if (!d.mult) return 'raté';
  if (d.seg === 25) return d.mult === 2 ? 'bull' : '25';
  return d.mult === 3 ? `triple ${d.seg}` : d.mult === 2 ? `double ${d.seg}` : String(d.seg);
};

// ---------- reconnaissance ----------
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = !!SR;

// Écoute « au fil de l'eau » : sur iPhone, la reconnaissance renvoie souvent des résultats
// jamais marqués « finaux ». On prend donc le texte dès qu'il n'a plus bougé pendant ~0,9 s.
// Si iOS coupe l'écoute et refuse de la relancer seul, on le signale (un tap sur le micro relance).
const ERRORS = {
  'not-allowed': 'Micro refusé : autorise le micro pour Oche (Réglages de l\'iPhone > Safari > Micro) et vérifie que la Dictée est activée (Réglages > Général > Clavier).',
  'service-not-allowed': 'La reconnaissance vocale est bloquée : active la Dictée (Réglages > Général > Clavier > Dictée), puis réessaie.',
  'audio-capture': 'Aucun micro disponible.',
  network: 'La reconnaissance vocale a besoin d\'internet.',
};
export function startListening(onAlternatives, onState, onInfo = () => {}) {
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  let active = true; let done = 0; let timer = null; let last = null; let restarts = 0; let prevFull = '';
  const flush = () => {
    timer = null;
    if (!last || isSpeaking()) { last = null; return; }
    const alts = last; last = null;
    onAlternatives(alts);
  };
  rec.onresult = (e) => {
    restarts = 0;
    // texte complet depuis le début de l'écoute, on ne garde que la partie pas encore traitée
    const full = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    // le moteur a repris son texte à zéro (certains iPhone le font) : on repart de zéro aussi
    if (full.length < done || !full.startsWith(prevFull.slice(0, done))) done = 0;
    prevFull = full;
    const alts = Array.from(e.results[e.results.length - 1]).map((a) => a.transcript);
    const fresh = full.slice(done).trim();
    if (!fresh) return;
    if (isSpeaking()) { done = full.length; return; }
    onInfo(`… ${fresh}`);
    last = [fresh, ...alts.filter((a) => a.trim() && a.trim() !== fresh)];
    const isFinal = e.results[e.results.length - 1].isFinal;
    clearTimeout(timer);
    const len = full.length;
    timer = setTimeout(() => { done = len; flush(); }, isFinal ? 150 : 900);
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (ERRORS[e.error]) { active = false; onState(false, ERRORS[e.error]); return; }
    onInfo(`Micro : ${e.error}`);
  };
  rec.onend = () => {
    done = 0; prevFull = '';
    if (!active) { onState(false); return; }
    restarts += 1;
    if (restarts > 3) { active = false; onState(false, 'Le micro s\'est coupé : touche-le pour reprendre.'); return; }
    try { rec.start(); } catch { active = false; onState(false, 'Le micro s\'est coupé : touche-le pour reprendre.'); }
  };
  try { rec.start(); onState(true); } catch { onState(false, 'Impossible de lancer le micro.'); }
  return () => { active = false; clearTimeout(timer); try { rec.stop(); } catch { /* déjà arrêté */ } };
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
