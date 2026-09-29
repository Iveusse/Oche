import React, { useEffect, useMemo, useRef, useState } from 'react';
import { runLeg, legsWon } from '../engine/runner.js';
import { MODE_LABEL, CRICKET_NUMS, isTraining, shanghaiNumbers, atcTargets, startOf, hasHandicap } from '../engine/modes.js';
import { dartLabel, dartScore, suggestCheckout } from '../lib/board.js';
import { Dartboard } from '../components/Dartboard.jsx';
import { Icon, Seg, Sheet, Switch, TopBar, tap } from '../components/ui.jsx';
import { PlayerOrder, shuffle } from '../components/PlayerOrder.jsx';
import { trainingResult } from '../engine/stats.js';
import { bestLegDarts, computeAchievements, newlyUnlocked, TIER } from '../engine/achievements.js';
import { Medal } from './Achievements.jsx';
import { load, save } from '../lib/store.js';
import { usePlayClock, useWakeLock } from '../lib/playclock.js';
import { canListen, dartWords, parseSpeech, speak, startListening, voiceOn, setVoiceOn } from '../lib/voice.js';

// ---------- annonces vocales ----------
function turnSpeech(mode, t, name) {
  const sum = (f) => t.darts.reduce((a, d) => a + (f(d) || 0), 0);
  if (mode === 'x01' || mode === 'train-checkout') {
    if (t.bust) return 'Beuste !'; // écrit « à la française » pour que la voix dise bust à l'anglaise
    if (t.finished) return `Jeu ! Bravo ${name}`;
    const pts = sum((d) => d.pts ?? dartScore(d));
    return pts === 180 ? 'Cent quatre-vingts !' : pts ? String(pts) : 'Rien';
  }
  if (mode === 'cricket') { const m = sum((d) => d.marks); return m ? `${m} marque${m > 1 ? 's' : ''}` : 'Rien'; }
  if (mode === 'shanghai') { if (t.darts.some((d) => d.shanghai)) return 'Shanghai !'; const p = sum((d) => d.pts); return p ? `${p} point${p > 1 ? 's' : ''}` : 'Rien'; }
  const h = t.darts.filter((d) => d.hit).length;
  if (h || t.darts.some((d) => 'hit' in d)) return h ? `${h} touché${h > 1 ? 's' : ''}` : 'Rien';
  return String(sum((d) => d.pts ?? dartScore(d)));
}
function rerouteSpeech(game, before, after) {
  if (game.mode !== 'x01' && game.mode !== 'train-checkout') return null;
  const cur = before.current; const cur2 = after.current;
  if (!cur2 || cur2.bust) return null;
  const p = cur2.p;
  const out = game.mode === 'x01' ? (game.settings.out || 'single') : 'double';
  const thrown = cur ? cur.darts.length : 0;
  const psB = before.ps[p]; const psA = after.ps[p];
  if (game.mode === 'x01' && !psA.opened) return null;
  const routeB = psB.rem <= 170 ? suggestCheckout(psB.rem, out, 3 - thrown) : null;
  if (!routeB) return null; // on n'était pas sur un finish
  const d = cur2.darts[cur2.darts.length - 1];
  if (d.seg === routeB[0].seg && d.mult === routeB[0].mult) return null; // fléchette conforme : rien à dire
  const routeA = suggestCheckout(psA.rem, out, 3 - cur2.darts.length);
  return routeA ? `Reste ${psA.rem}. ${routeA.map(dartWords).join(', ')}` : null;
}

function nextSpeech(game, leg, r, byId) {
  const name = (i) => byId[r.ps[i]?.id]?.name || '';
  if (r.over) return r.ranking?.length > 1 ? `Leg pour ${byId[r.ranking[0]]?.name || ''}` : '';
  if (r.needDecision) return 'On continue pour les places ?';
  const i = r.cur; const ps = r.ps[i]; const solo = r.ps.length === 1;
  const who = solo ? '' : `${name(i)}. `;
  if (game.mode === 'x01' || game.mode === 'train-checkout') {
    const out = game.mode === 'x01' ? (game.settings.out || 'single') : 'double';
    const route = ps.rem <= 170 && (game.mode !== 'x01' || ps.opened) ? suggestCheckout(ps.rem, out, 3) : null;
    return `${who}Reste ${ps.rem}${route ? `. ${route.map(dartWords).join(', ')}` : ''}`;
  }
  if (game.mode === 'atc' || game.mode === 'train-atc' || game.mode === 'train-doubles') {
    const t = leg.targets?.[ps.pos];
    return t == null ? who : `${who}Cible ${game.mode === 'train-doubles' ? (t === 25 ? 'boul' : `double ${t}`) : (t === 25 ? 'boul' : t)}`;
  }
  if (game.mode === 'shanghai') {
    // chaque joueur entend son numéro, et ce qu'il lui faut pour rester en vie
    const nums = shanghaiNumbers(game.settings);
    const num = nums[r.turns.filter((t) => t.p === i).length];
    if (!num) return who;
    const nd = shanghaiNeed(game.settings, r, i);
    const extra = nd?.kind === 'need' ? `. Pour rester en vie : ${nd.text}` : nd?.kind === 'shanghai' ? '. Seul un Shanghai peut te sauver' : '';
    return `${who}Le ${num}${extra}`;
  }
  return who;
}

const RULE = { single: 'Simple', double: 'Double', master: 'Master' };

export function modeSubtitle(game) {
  const s = game.settings || {};
  const legNo = game.data.legs.length;
  switch (game.mode) {
    case 'x01': return `${hasHandicap(s) ? 'Handicap · ' : ''}${s.in === s.out ? `${RULE[s.in]} in / out` : `${RULE[s.in]} in · ${RULE[s.out]} out`} · Leg ${legNo}`;
    case 'atc': return s.nums?.length
      ? `${(s.zones || []).join(' + ')} · ${s.nums.map((n) => (n === 25 ? 'bull' : n)).join(', ')} · Leg ${legNo}`
      : `${(s.zones || []).join(' + ')} · ${s.order === 'desc' ? '20 → 1' : s.order === 'random' ? 'aléatoire' : '1 → 20'}${s.bull ? ' + bull' : ''} · Leg ${legNo}`;
    case 'shanghai': return `${s.from} à ${s.to} · Leg ${legNo}`;
    case 'cricket': return `${s.points === false ? 'Sans points' : 'Avec points'} · Leg ${legNo}`;
    case 'train-atc': return `Entraînement · ${(s.zones || []).join(' + ')} · ${(s.nums || []).map((n) => (n === 25 ? 'bull' : n)).join(', ') || '1 → 20'}`;
    default: return 'Entraînement';
  }
}

export function modeTitle(game) {
  return game.mode === 'x01' ? String(game.settings.start) : MODE_LABEL[game.mode];
}

function legAvg(r, idx) {
  let d = 0; let p = 0;
  for (const t of r.turns) if (t.p === idx) { d += t.darts.length; p += t.bust ? 0 : t.darts.reduce((a, x) => a + (x.pts || 0), 0); }
  return d ? (p / d) * 3 : null;
}
function dartsOf(r, idx) {
  return r.turns.filter((t) => t.p === idx).reduce((a, t) => a + t.darts.length, 0) + (r.current?.p === idx ? r.current.darts.length : 0);
}
const targetLabel = (t) => (t === 25 ? 'Bull' : t);

// fléchette en bref : au Shanghai S/D/T/R (le numéro est connu), ailleurs T20, 5, R…
function shortDart(mode, d) {
  if (!d.mult) return 'R';
  if (mode === 'shanghai') return d.hit ? (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S') : 'R';
  if (d.hit === false) return 'R';
  return dartLabel(d);
}
const lastTurnOf = (r, idx) => [...r.turns].reverse().find((t) => t.p === idx);

// ---------- Shanghai : rester en vie ----------
const MARKS_TEXT = { 1: 'un simple', 2: 'un double', 3: 'un triple', 4: 'triple + simple', 5: 'triple + double', 6: 'un Shanghai (ou 2 triples)', 7: 'triple, triple, simple', 8: 'triple, triple, double', 9: '3 triples' };

// Points max qu'un joueur peut encore marquer (tour en cours compris)
function shanghaiRoom(nums, r, j) {
  const done = r.turns.filter((t) => t.p === j).length;
  const thrown = r.current?.p === j ? r.current.darts.length : 0;
  return nums.slice(done).reduce((a, n) => a + 9 * n, 0) - 3 * (nums[done] || 0) * thrown;
}

// Ce qu'il faut au joueur j pour pouvoir encore rattraper le premier (en supposant que le premier ne marque plus)
export function shanghaiNeed(settings, r, j) {
  const nums = shanghaiNumbers(settings);
  const me = r.ps[j].pts;
  const others = r.ps.map((p, k) => (k === j ? -Infinity : p.pts));
  const lead = Math.max(...others);
  if (!Number.isFinite(lead)) return null;
  const gap = lead - me;
  if (gap < 0) return { kind: 'lead', gap: -gap };
  const done = r.turns.filter((t) => t.p === j).length;
  const n = nums[done];
  if (!n) return { kind: 'over', gap };
  const cur = r.current?.p === j ? r.current.darts : [];
  const left = 3 - cur.length;
  const after = nums.slice(done + 1).reduce((a, x) => a + 9 * x, 0);
  const needPts = gap - after;
  if (needPts <= 0) return { kind: 'safe', gap };
  const m = Math.ceil(needPts / n);
  const hitMults = new Set(cur.filter((d) => d.hit && d.mult).map((d) => d.mult));
  const missing = [1, 2, 3].filter((k) => !hitMults.has(k)).length;
  const shanghai = settings.instantWin !== false && missing <= left;
  if (m <= 3 * left) return { kind: 'need', m, text: m >= 6 && shanghai ? (m === 6 ? MARKS_TEXT[6] : 'un Shanghai') : MARKS_TEXT[m], gap };
  if (shanghai) return { kind: 'shanghai', gap };
  return { kind: 'dead', gap };
}

// Plus personne ne peut rattraper le premier aux points ?
export function shanghaiDecided(settings, r) {
  if (r.ps.length < 2 || r.over) return null;
  const nums = shanghaiNumbers(settings);
  const lead = Math.max(...r.ps.map((p) => p.pts));
  const leaders = r.ps.map((p, j) => (p.pts === lead ? j : -1)).filter((j) => j >= 0);
  if (leaders.length > 1) return null;
  const L = leaders[0];
  const ok = r.ps.every((p, j) => j === L || lead - p.pts > shanghaiRoom(nums, r, j));
  return ok ? { leader: L } : null;
}

function cardInfo(game, r, ps, idx) {
  const leg = game.data.legs[game.data.legs.length - 1];
  switch (game.mode) {
    case 'x01': { const a = legAvg(r, idx); return { v: ps.rem, s: a == null ? 'Moy. -' : `Moy. ${a.toFixed(1)}` }; }
    case 'atc': return { v: ps.finished ? '✓' : targetLabel(leg.targets[ps.pos]), s: `${ps.pos} / ${leg.targets.length}` };
    case 'shanghai': return { v: ps.pts, s: 'points' };
    case 'cricket': return { v: ps.pts, s: `${CRICKET_NUMS.filter((k) => ps.marks[k] >= 3).length} / 7 fermés` };
    default: return { v: '', s: '' };
  }
}

function Mark({ n }) {
  if (n <= 0) return <span className="m" />;
  if (n === 1) return <span className="m">/</span>;
  if (n === 2) return <span className="m">✕</span>;
  return <span className="m c">⊗</span>;
}

function CricketGrid({ r, players, thrower }) {
  const cols = r.ps.length;
  return (
    <div className="cricket-grid" style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(0,1fr))` }}>
      <span />
      {r.ps.map((p, i) => <span key={p.id} className={`h ${i === thrower ? 'on' : ''}`}>{players[p.id]?.name}</span>)}
      {CRICKET_NUMS.map((n) => (
        <React.Fragment key={n}>
          <span className="num">{n === 25 ? 'B' : n}</span>
          {r.ps.map((p) => <Mark key={p.id} n={Math.min(3, p.marks[n])} />)}
        </React.Fragment>
      ))}
      <span className="num">Pts</span>
      {r.ps.map((p) => <span key={p.id} className="m" style={{ color: 'var(--text)' }}>{p.pts}</span>)}
    </div>
  );
}

export function Play({ game, players, records, history = [], onUpdate, onLegDone, onEnd, onExit, onReplay }) {
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const legs = game.data.legs;
  const leg = legs[legs.length - 1];
  const r = useMemo(() => runLeg(game.mode, game.settings, leg), [game, leg]);
  const [menu, setMenu] = useState(false);
  // saisie : cible ou boutons, mémorisé par mode (X01, Cricket, Shanghai…)
  const PAD_MODES = ['shanghai', 'x01', 'cricket', 'train-checkout', 'atc'];
  const inputKey = game.mode === 'shanghai' ? 'shanghaiInput' : `input.${game.mode}`;
  const [input, setInputState] = useState(() => (PAD_MODES.includes(game.mode) ? load(inputKey, 'board') : 'board'));
  const setInput = (v) => { setInputState(v); save(inputKey, v); };
  const buttons = input === 'buttons' && PAD_MODES.includes(game.mode);
  const training = isTraining(game.mode);
  useWakeLock(true);
  // pendant le jeu, la page ne doit jamais « rebondir » (sinon iOS prend les taps pour du défilement)
  useEffect(() => {
    if (leg.done) return undefined; // l'écran de fin de leg, lui, doit pouvoir défiler
    document.documentElement.classList.add('playing');
    return () => document.documentElement.classList.remove('playing');
  }, [leg.done]);
  const takeMs = usePlayClock(!leg.done);
  const withTime = (l) => ({ ...l, activeMs: (l.activeMs || 0) + takeMs() });
  const [voice, setVoice] = useState(voiceOn);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const stopRef = useRef(null);
  const voiceRef = useRef(() => {});
  const toggleListen = () => {
    if (listening) { stopRef.current?.(); stopRef.current = null; setListening(false); setHeard(''); return; }
    setHeard('J\'écoute : dis par exemple « triple vingt, cinq, raté »');
    stopRef.current = startListening((alts) => voiceRef.current(alts), (on, err) => { setListening(on); if (err) setHeard(err); else if (!on) setHeard(''); }, (info) => setHeard(info));
  };
  useEffect(() => () => stopRef.current?.(), []);
  useEffect(() => { if (leg.done && stopRef.current) { stopRef.current(); stopRef.current = null; setListening(false); } }, [leg.done]);

  const setLeg = (patch) => {
    const nl = withTime({ ...leg, ...patch });
    onUpdate({ ...game, data: { ...game.data, legs: [...legs.slice(0, -1), nl] } });
  };

  // leg terminé et validé -> on fige le résultat
  useEffect(() => {
    if (!leg.done && r.over && !r.awaiting) {
      const nl = withTime({ ...leg, done: true, ranking: r.ranking, finishedAt: new Date().toISOString() });
      onLegDone({ ...game, data: { ...game.data, legs: [...legs.slice(0, -1), nl] } });
    }
  }, [leg, r]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shanghai : dès que plus personne ne peut rattraper le premier aux points, on le dit une fois
  const decidedSaid = useRef(false);
  const [hideDecided, setHideDecided] = useState(false);
  useEffect(() => { setHideDecided(false); decidedSaid.current = false; }, [legs.length]);
  const decided = game.mode === 'shanghai' && !leg.done && !r.current && !r.awaiting && hideDecided === false ? shanghaiDecided(game.settings, r) : null;
  useEffect(() => {
    if (!decided || decidedSaid.current) return;
    decidedSaid.current = true;
    const name = byId[r.ps[decided.leader].id]?.name || '';
    speak(`Plus personne ne peut rattraper ${name} aux points${game.settings.instantWin !== false ? ', sauf avec un Shanghai' : ''}. Vous pouvez terminer la partie.`, false, true);
  }, [decided]); // eslint-disable-line react-hooks/exhaustive-deps

  if (leg.done) {
    return training
      ? <TrainingEnd game={game} r={r} records={records} onEnd={onEnd} onReplay={onReplay} />
      : <LegEnd game={game} byId={byId} history={history} onUpdate={onUpdate} onEnd={onEnd} />;
  }

  const blocked = r.awaiting || r.needDecision || r.over;
  // ajoute une ou plusieurs fléchettes (cible, boutons ou voix) et annonce la fin du tour
  const addDarts = (list, word = '') => {
    let darts = leg.darts;
    for (const d of list) {
      const rr = runLeg(game.mode, game.settings, { ...leg, darts });
      if (rr.awaiting || rr.needDecision || rr.over) break;
      darts = [...darts, d];
    }
    if (darts === leg.darts) return;
    const r2 = runLeg(game.mode, game.settings, { ...leg, darts });
    const patch = { darts };
    if (!r.awaiting && r2.awaiting) {
      const t = r2.turns[r2.turns.length - 1];
      const said = turnSpeech(game.mode, t, byId[r2.ps[t.p].id]?.name || '');
      // tour fini : on passe au joueur suivant tout seul (la flèche retour permet de corriger).
      // Seule la fin d'un leg (ou la question « on continue ? ») attend une validation.
      const nl = { ...leg, darts, validated: r2.turns.length };
      const r3 = runLeg(game.mode, game.settings, nl);
      const pre = word ? `${word}. ` : '';
      if (!r3.over && !r3.needDecision) { patch.validated = r2.turns.length; speak([`${pre}${said}`, nextSpeech(game, nl, r3, byId)]); }
      else speak(`${pre}${said}`);
    } else {
      // finish en cours : si la fléchette n'est pas celle conseillée mais qu'on peut encore finir, on annonce la nouvelle route
      const re = rerouteSpeech(game, r, r2);
      if (word && re) speak([word, re]);
      else if (re) speak(re);
      else if (word) speak(word);
    }
    setLeg(patch);
  };
  const hit = (d, word) => { if (!blocked) addDarts([d], word); };
  const undo = () => {
    if (!leg.darts.length) return;
    const darts = leg.darts.slice(0, -1);
    const r2 = runLeg(game.mode, game.settings, { ...leg, darts });
    const patch = { darts, validated: Math.min(leg.validated || 0, r2.turns.length) };
    if (r2.finishedOrder.length === 0) patch.continueForPlaces = null;
    setLeg(patch);
  };
  const validate = () => {
    if (!r.awaiting) return;
    const nl = { ...leg, validated: r.turns.length };
    speak(nextSpeech(game, nl, runLeg(game.mode, game.settings, nl), byId));
    setLeg({ validated: r.turns.length });
  };

  const lastTurn = r.turns[r.turns.length - 1];
  const shown = r.current || (r.awaiting ? lastTurn : null);
  const thrower = shown ? shown.p : r.cur;
  const tps = r.ps[thrower];
  const tDarts = shown ? shown.darts : [];
  const turnPts = game.mode === 'cricket' ? `${tDarts.reduce((a, d) => a + (d.marks || 0), 0)} marque(s)` : tDarts.reduce((a, d) => a + (d.pts ?? dartScore(d)), 0);

  // info à droite
  let info = null; let hint = null;
  const s = game.settings;
  if (game.mode === 'x01') {
    info = { b: 'Reste', a: tps.rem };
    if (shown?.bust) hint = 'Bust ! Le score revient à celui du début du tour.';
  } else if (game.mode === 'atc' || game.mode === 'train-atc' || game.mode === 'train-doubles') {
    const t = leg.targets[tps.pos];
    info = { b: 'Cible', a: tps.finished ? '✓' : game.mode === 'train-doubles' ? (t === 25 ? 'Bull' : `D${t}`) : targetLabel(t) };
  } else if (game.mode === 'shanghai') {
    const nums = shanghaiNumbers(s);
    const round = shown ? shown.round : Math.floor(r.turns.length / r.ps.length);
    info = { b: `Manche ${Math.min(round + 1, nums.length)}/${nums.length}`, a: nums[Math.min(round, nums.length - 1)] };
    if (!r.awaiting && !r.over) {
      const nd = r.ps.length > 1 ? shanghaiNeed(s, r, thrower) : null;
      if (nd?.kind === 'need') hint = `Pour rester en vie : ${nd.text}${tDarts.length ? ' (avec les fléchettes qui restent)' : ''}`;
      else if (nd?.kind === 'shanghai') hint = 'Seul un Shanghai peut te sauver !';
      else if (nd?.kind === 'dead') hint = 'Plus possible de rattraper le premier';
      else if (nd?.kind === 'lead') hint = `En tête de ${nd.gap} pts`;
      else if (nd?.kind === 'safe') hint = `${nd.gap} pts de retard sur le premier`;
    }
  } else if (game.mode === 'cricket') {
    info = { b: 'Points', a: tps.pts };
  } else if (game.mode === 'train-focus20') {
    info = { b: 'Fléchettes', a: `${tps.darts}/99` };
    hint = `${tps.pts} points`;
  } else if (game.mode === 'train-checkout') {
    const target = leg.targets[Math.min(tps.idx, leg.targets.length - 1)];
    info = { b: `Finish ${Math.min(tps.idx + 1, 20)}/20`, a: shown && r.awaiting ? shown.darts[0].target : tps.rem };
    hint = `${tps.succ} réussi${tps.succ > 1 ? 's' : ''} · objectif ${target}`;
  } else if (game.mode === 'train-free') {
    info = { b: 'Total', a: tps.pts };
  }

  // Finish possible : recalculé après chaque fléchette
  let checkout = null;
  const coMode = game.mode === 'x01' || game.mode === 'train-checkout';
  const coOut = game.mode === 'x01' ? (s.out || 'single') : 'double';
  if (coMode && !r.awaiting && !shown?.bust && (game.mode !== 'x01' || tps.opened) && tps.rem > 0 && tps.rem <= 180) {
    const left = 3 - tDarts.length;
    const route = suggestCheckout(tps.rem, coOut, left);
    if (route) checkout = { route, done: tDarts };
    else if (tDarts.length > 0 && tps.rem <= 170) checkout = { none: `Pas de finish en ${left} fléchette${left > 1 ? 's' : ''}` };
  }

  const markers = tDarts.filter((d) => typeof d.x === 'number');

  // saisie vocale : la fonction est remise à jour à chaque rendu (état courant)
  voiceRef.current = (alts) => {
    const target = typeof info?.a === 'number' ? info.a : (typeof info?.a === 'string' && /^D?(\d+)$/.test(info.a) ? Number(info.a.replace('D', '')) : undefined);
    const parsed = alts.map((t) => ({ t, ...parseSpeech(t, { target }) })).find((x) => x.darts.length || x.cmd);
    if (!parsed) { setHeard(`Pas compris : « ${alts[0]} »`); return; }
    setHeard(`Entendu : « ${parsed.t} »`);
    if (parsed.darts.length) addDarts(parsed.darts);
    else if (parsed.cmd === 'validate') validate();
    else if (parsed.cmd === 'undo') undo();
  };
  const finisher = r.needDecision ? r.ps[r.finishedOrder[0]] : null;

  return (
    <div className="play">
      <TopBar
        title={modeTitle(game)} sub={modeSubtitle(game)} onBack={onExit}
        right={<button className="icon-btn" aria-label="Options" onClick={() => setMenu(true)}><Icon.More /></button>}
      />

      {!training && game.mode !== 'cricket' && (
        <div className="scores">
          {r.ps.map((p, i) => {
            const ci = cardInfo(game, r, p, i);
            return (
              <div key={p.id} className={`score-card ${i === thrower ? 'on' : ''} ${p.finished ? 'done' : ''}`}>
                <div className="n">{byId[p.id]?.name || '?'}</div>
                <div className="v">{ci.v}</div>
                <div className="s">{ci.s}</div>
                {(() => { const lt = lastTurnOf(r, i); return lt ? (
                  <div className="last-turn" aria-label="Tour précédent">
                    {lt.darts.map((d, k) => <b key={k} className={shortDart(game.mode, d) === 'R' ? 'r' : ''}>{shortDart(game.mode, d)}</b>)}
                  </div>
                ) : null; })()}
              </div>
            );
          })}
        </div>
      )}
      {game.mode === 'cricket' && <div className="panel" style={{ padding: 10 }}><CricketGrid r={r} players={byId} thrower={thrower} /></div>}
      {training && <div className="between"><span className="h3">{byId[r.ps[0].id]?.name}</span><span className="small muted">{MODE_LABEL[game.mode]}</span></div>}

      {checkout && <CheckoutBar {...checkout} />}

      {decided && (
        <div className="decided" role="status">
          <div><b>{byId[r.ps[decided.leader].id]?.name}</b> ne peut plus être rattrapé aux points{s.instantWin !== false ? ' (sauf Shanghai)' : ''}.</div>
          <div className="decided-actions">
            <button className="btn btn-primary" onClick={() => setLeg({ stoppedAt: leg.darts.length })}>Terminer la partie</button>
            <button className="btn btn-ghost" onClick={() => { decidedSaid.current = 'hidden'; setHideDecided(r.turns.length); }}>Continuer</button>
          </div>
        </div>
      )}
      {PAD_MODES.includes(game.mode) && (
        <Seg options={[['board', 'Cible'], ['buttons', 'Boutons']]} value={input} onChange={setInput} />
      )}
      {buttons && game.mode === 'shanghai' ? (
        <ShanghaiButtons target={info.a} disabled={blocked} onHit={hit} darts={tDarts} />
      ) : buttons ? (
        <NumberPad disabled={blocked} onHit={hit} darts={tDarts} cricket={game.mode === 'cricket'} />
      ) : (
        <div className="board-slot">
          <Dartboard onHit={hit} disabled={blocked} markers={markers} />
        </div>
      )}

      <div className="turn-strip">
        {[0, 1, 2].map((k) => {
          const d = tDarts[k];
          return (
            <div key={k} className={`dart-box ${d ? 'filled' : ''}`}>
              <div className="a" style={{ color: d ? undefined : 'var(--muted)' }}>{d ? (!d.mult && game.mode === 'shanghai' ? 'Raté' : dartLabel(d)) : '-'}</div>
              <div className="b">{d ? (game.mode === 'cricket' ? (d.marks ? `${d.marks} marque${d.marks > 1 ? 's' : ''}` : '-') : d.hit === false ? (d.mult ? 'raté' : '0') : d.pts ?? dartScore(d)) : `Fléch. ${k + 1}`}</div>
            </div>
          );
        })}
        {info && <div className="info-box"><div className="b">{info.b}</div><div className="a">{info.a}</div></div>}
      </div>
      <div className="small" style={{ minHeight: 16, color: shown?.bust || /Shanghai peut|Plus possible/.test(hint || '') ? 'var(--bad)' : /rester en vie/.test(hint || '') ? 'var(--sky)' : 'var(--text-2)', fontWeight: /rester en vie|Shanghai peut|Plus possible/.test(hint || '') ? 700 : 400, textAlign: 'center' }}>
        {hint || (tDarts.length ? `Tour : ${turnPts}` : `${lastTurn && r.ps.length > 1 ? `${byId[r.ps[lastTurn.p].id]?.name} : ${lastTurn.bust ? 'bust' : game.mode === 'cricket' ? `${lastTurn.darts.reduce((a, d) => a + (d.marks || 0), 0)} marque(s)` : lastTurn.darts.reduce((a, d) => a + (d.pts ?? dartScore(d)), 0)} · ` : ''}À ${byId[tps.id]?.name || '?'} de jouer`)}
      </div>
      {heard && <div className="small heard" aria-live="polite">{heard}</div>}

      <div className="actions">
        {(buttons && !r.awaiting)
          ? <button className="btn grow" style={{ border: '1px solid var(--wire)', fontWeight: 700 }} aria-label="Annuler la dernière fléchette" {...tap(undo)} disabled={!leg.darts.length}><Icon.Undo />Annuler la dernière</button>
          : <button className="icon-btn" style={{ width: 56, height: 56, borderRadius: 14, border: '1px solid var(--wire)' }} aria-label="Annuler la dernière fléchette" {...tap(undo)} disabled={!leg.darts.length}><Icon.Undo /></button>}
        {canListen && (
          <button className={`icon-btn mic ${listening ? 'on' : ''}`} style={{ width: 56, height: 56, borderRadius: 14, border: '1px solid var(--wire)' }}
            aria-label={listening ? 'Arrêter la saisie à la voix' : 'Saisir à la voix'} aria-pressed={listening} onClick={toggleListen}><Icon.Mic /></button>
        )}
        {!buttons && (
          <button className="btn grow" style={{ border: '1px dashed var(--muted)', fontWeight: 700, fontSize: 15 }} disabled={blocked} {...tap(() => hit({ seg: 0, mult: 0 }))}>Hors cible</button>
        )}
        {r.awaiting && <button className="btn btn-primary grow" onClick={validate}>Valider la fin</button>}
      </div>

      {finisher && !r.awaiting && (
        <DecisionSheet game={game} r={r} byId={byId} finisher={finisher}
          onContinue={() => setLeg({ continueForPlaces: true })}
          onStop={() => setLeg({ continueForPlaces: false })} />
      )}

      {menu && (
        <Sheet onClose={() => setMenu(false)} label="Options">
          <div className="h2">Options</div>
          <div className="between">
            <div className="grow"><div style={{ fontWeight: 700 }}>Annonces vocales</div><div className="small muted">Score du tour, reste et finish conseillé</div></div>
            <Switch on={voice} onChange={(v) => { setVoice(v); setVoiceOn(v); }} label="Annonces vocales" />
          </div>
          {training ? (
            <button className="btn btn-primary" onClick={() => { setMenu(false); onEnd(game, { stopTraining: true }); }}>Terminer la session</button>
          ) : (
            <button className="btn btn-ghost" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => { if (confirm('Abandonner cette partie ? Les legs déjà terminés sont gardés.')) { setMenu(false); onEnd(game, { abandon: true }); } }}>Abandonner la partie</button>
          )}
          <button className="btn btn-ghost" onClick={() => setMenu(false)}>Fermer</button>
        </Sheet>
      )}
    </div>
  );
}

function CheckoutBar({ route, done, none }) {
  if (none) {
    return <div className="checkout-bar off"><span className="lbl">Finish</span><span className="small" style={{ color: 'var(--text-2)' }}>{none}</span></div>;
  }
  return (
    <div className="checkout-bar" aria-live="polite">
      <span className="lbl">Finish</span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {done.map((d, i) => <span key={`d${i}`} className="chip done">{dartLabel(d)}</span>)}
        {route.map((d, i) => <span key={`r${i}`} className={`chip ${i === 0 ? 'next' : ''}`}>{dartLabel(d)}</span>)}
      </div>
    </div>
  );
}

// Clavier de saisie : Double / Triple (optionnels) puis le numéro. Bull = 50, 25 = demi-bull.
function NumberPad({ disabled, onHit, darts = [], cricket = false }) {
  const [mod, setMod] = useState(1);
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const press = (d) => {
    onHit(d);
    setMod(1);
    clearTimeout(timer.current);
    setFlash({ id: Date.now(), label: d.mult ? dartLabel(d) : 'Raté', pts: d.mult ? dartScore(d) : 0, miss: !d.mult });
    timer.current = setTimeout(() => setFlash(null), 1000);
  };
  const toggle = (m) => setMod(mod === m ? 1 : m);
  const prefix = mod === 3 ? 'T' : mod === 2 ? 'D' : '';
  return (
    <div className="board-slot" style={{ containerType: 'normal' }}>
      <div className="col np" style={{ position: 'relative' }}>
        <div className="np-mods">
          <button className={`np-mod ${mod === 2 ? 'on' : ''}`} aria-pressed={mod === 2} disabled={disabled} {...tap(() => toggle(2))}>Double</button>
          <button className={`np-mod ${mod === 3 ? 'on t' : ''}`} aria-pressed={mod === 3} disabled={disabled} {...tap(() => toggle(3))}>Triple</button>
          <span className="sh-dots" aria-label={`${darts.length} fléchette(s)`}>{[0, 1, 2].map((k) => <i key={k} className={darts[k] ? (darts[k].mult ? 'hit' : 'miss') : ''} />)}</span>
        </div>
        <div className={`np-grid ${cricket ? 'cricket' : ''}`}>
          {(cricket ? [20, 19, 18, 17, 16, 15] : Array.from({ length: 20 }, (_, i) => i + 1)).map((n) => (
            <button key={n} className="np-key" disabled={disabled} aria-label={`${prefix}${n}`} {...tap(() => press({ seg: n, mult: mod }))}>
              {prefix && <small>{prefix}</small>}{n}
            </button>
          ))}
        </div>
        <div className="np-last">
          <button className="np-key" disabled={disabled || mod === 3} aria-label={mod === 2 ? 'Bull 50' : '25'} {...tap(() => press({ seg: 25, mult: mod === 2 ? 2 : 1 }))}>{mod === 2 ? 'Bull' : '25'}</button>
          <button className="np-key" disabled={disabled} aria-label="Bull 50" {...tap(() => press({ seg: 25, mult: 2 }))}>Bull</button>
          <button className="np-key miss" disabled={disabled} aria-label="Raté" {...tap(() => press({ seg: 0, mult: 0 }))}>Raté</button>
        </div>
        {flash && <div key={flash.id} className={`sh-toast ${flash.miss ? 'miss' : ''}`} role="status">{flash.miss ? 'Raté' : `${flash.label} · ${flash.pts}`}</div>}
      </div>
    </div>
  );
}

function ShanghaiButtons({ target, disabled, onHit, darts = [] }) {
  const btns = [[1, 'Simple'], [2, 'Double'], [3, 'Triple']];
  const [flash, setFlash] = useState(null); // dernier bouton touché, pour le retour visuel
  const timer = useRef(null);
  const press = (d, label) => {
    onHit(d, d.mult === 3 ? 'Triple' : d.mult === 2 ? 'Double' : d.mult === 1 ? 'Simple' : 'Raté');
    clearTimeout(timer.current);
    setFlash({ id: Date.now(), m: d.mult, label, pts: d.seg * d.mult });
    timer.current = setTimeout(() => setFlash(null), 1100);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="board-slot" style={{ containerType: 'normal' }}>
      <div className="col sh-pad" style={{ width: '100%', gap: 10, position: 'relative' }}>
        <div className="between">
          <span className="small muted">Fléchette sur le {target}</span>
          <span className="sh-dots" aria-label={`${darts.length} fléchette(s) lancée(s)`}>
            {[0, 1, 2].map((k) => <i key={k} className={darts[k] ? (darts[k].hit ? 'hit' : 'miss') : ''} />)}
          </span>
        </div>
        <div className="sh-grid">
          {btns.map(([m, l]) => (
            <button key={`${m}-${flash?.m === m ? flash.id : 0}`} aria-label={`${l} ${target}`} disabled={disabled} {...tap(() => press({ seg: target, mult: m }, `${m === 1 ? '' : m === 2 ? 'D' : 'T'}${target}`))}
              className={`sh-btn ${flash?.m === m ? 'flash' : ''}`}>
              <span style={{ fontSize: 30, fontWeight: 800 }}>{m === 1 ? '' : m === 2 ? 'D' : 'T'}{target}</span>
              <span className="small" style={{ color: 'var(--text-2)', fontWeight: 700 }}>{l} · {target * m}</span>
            </button>
          ))}
        </div>
        <button disabled={disabled} {...tap(() => press({ seg: 0, mult: 0 }, 'Raté'))} className={`sh-btn sh-miss ${flash?.m === 0 ? 'flash' : ''}`}>Raté</button>
        {flash && <div key={flash.id} className={`sh-toast ${flash.m ? '' : 'miss'}`} role="status">{flash.m ? `${flash.label} · +${flash.pts}` : 'Raté'}</div>}
      </div>
    </div>
  );
}

function DecisionSheet({ game, r, byId, finisher, onContinue, onStop }) {
  const idx = r.ps.indexOf(finisher);
  const ft = [...r.turns].reverse().find((t) => t.p === idx && t.finished);
  const rest = r.ps.filter((p) => !p.finished);
  const place = r.finishedOrder.length + 1;
  let detail = '';
  if (game.mode === 'x01' && ft) {
    const last = ft.darts[ft.darts.length - 1];
    const a = legAvg(r, idx);
    detail = `Checkout ${ft.darts[0].remBefore}${last.mult >= 2 ? ` sur ${dartLabel(last)}` : ''} · ${dartsOf(r, idx)} fléchettes${a != null ? ` · moy. ${a.toFixed(1)}` : ''}`;
  } else detail = `${dartsOf(r, idx)} fléchettes`;
  return (
    <Sheet label="Un joueur a terminé">
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-bg)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><Icon.Trophy /></span>
        <div className="h2">{byId[finisher.id]?.name} termine !</div>
        <div className="small" style={{ color: 'var(--text-2)' }}>{detail}</div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <div className="label">Encore en jeu</div>
        {rest.map((p) => (
          <div key={p.id} className="between card">
            <span style={{ fontWeight: 700 }}>{byId[p.id]?.name}</span>
            <span className="small" style={{ color: 'var(--text-2)' }}>{game.mode === 'x01' ? <>reste <b style={{ color: 'var(--text)', fontSize: 18 }}>{p.rem}</b></> : `${p.pos} / ${game.data.legs[game.data.legs.length - 1].targets.length}`}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" onClick={onContinue}>Continuer pour la {place}e place</button>
      <button className="btn btn-ghost" onClick={onStop}>Arrêter le leg ici</button>
      <div className="small muted" style={{ textAlign: 'center' }}>Si on arrête, les places se font au score restant</div>
    </Sheet>
  );
}

function legStatLabel(game, r, idx) {
  const p = r.ps[idx];
  switch (game.mode) {
    case 'x01': { const a = legAvg(r, idx); return a != null ? `moy. ${a.toFixed(1)}` : ''; }
    case 'cricket': { const t = r.turns.filter((x) => x.p === idx); const m = t.reduce((a, x) => a + x.darts.reduce((b, d) => b + (d.marks || 0), 0), 0); return t.length ? `${(m / t.length).toFixed(2)} MPR` : ''; }
    case 'atc': return p.finished ? `${dartsOf(r, idx)} fléchettes` : `${p.pos} cases`;
    case 'shanghai': return `${p.pts} pts`;
    default: return '';
  }
}

function Celebrations({ game, byId, history }) {
  const items = useMemo(() => {
    const legs = game.data.legs;
    const leg = legs[legs.length - 1];
    const others = history.filter((g) => g.id !== game.id);
    const before = [...others, { ...game, data: { ...game.data, legs: legs.slice(0, -1) } }];
    const after = [...others, game];
    const out = [];
    // record de fléchettes pour gagner un leg X01
    const winner = leg.ranking?.[0];
    if (game.mode === 'x01' && winner && leg.order.length > 1) {
      const r = runLeg(game.mode, game.settings, leg);
      const idx = leg.order.indexOf(winner);
      const n = r.turns.filter((t) => t.p === idx).reduce((a, t) => a + t.darts.length, 0);
      const st = startOf(game, winner);
      const prev = bestLegDarts(before, winner, st);
      const who = byId[winner]?.name;
      if (prev == null) out.push({ key: 'rec', kind: 'record', title: `Premier ${st} gagné par ${who}`, text: `${n} fléchettes : c'est le record à battre.` });
      else if (n < prev) out.push({ key: 'rec', kind: 'record', title: `Record battu pour ${who} !`, text: `${st} gagné en ${n} fléchettes, l'ancien record était ${prev}.` });
      else if (n === prev) out.push({ key: 'rec', kind: 'record', title: `Record égalé par ${who}`, text: `${st} en ${n} fléchettes, comme son meilleur leg.` });
    }
    for (const id of leg.order) {
      const nu = newlyUnlocked(computeAchievements(before, id), computeAchievements(after, id));
      for (const a of nu) out.push({ key: `${id}-${a.id}`, kind: 'ach', tier: a.tier, title: `${byId[id]?.name} débloque « ${a.name} »`, text: `${a.desc} · ${TIER[a.tier]}` });
    }
    return out;
  }, [game, history, byId]);
  if (!items.length) return null;
  return (
    <div className="col" style={{ gap: 8 }}>
      {items.map((it) => (
        <div key={it.key} className="celebrate" role="status">
          {it.kind === 'ach' ? <Medal tier={it.tier} size={40} /> : <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon.Trophy width="22" height="22" /></span>}
          <div className="grow">
            <div className="t">{it.title}</div>
            <div className="small" style={{ color: 'var(--text-2)' }}>{it.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LegEnd({ game, byId, history, onUpdate, onEnd }) {
  const legs = game.data.legs;
  const leg = legs[legs.length - 1];
  const r = useMemo(() => runLeg(game.mode, game.settings, leg), [game.mode, game.settings, leg]);
  const won = legsWon(game);
  const target = game.data.legsToWin || 1;
  const champion = target > 1 ? game.player_ids.find((id) => won[id] >= target) : null;
  const [how, setHow] = useState('shift');
  const orderFor = (h) => {
    if (h === 'shift') return [...leg.order.slice(1), leg.order[0]];
    if (h === 'loser') return [...leg.ranking].reverse();
    return shuffle(leg.order);
  };
  const [order, setOrder] = useState(() => orderFor('shift'));
  const pickHow = (h) => { setHow(h); setOrder(orderFor(h)); };

  const next = () => {
    const nl = { order, darts: [], validated: 0, continueForPlaces: null };
    if (game.mode === 'atc') nl.targets = game.settings.order === 'random' ? atcTargets(game.settings) : leg.targets;
    onUpdate({ ...game, data: { ...game.data, legs: [...legs, nl] } }, { newLeg: true });
  };

  const winnerId = leg.ranking[0];
  return (
    <div className="screen">
      <div>
        <div className="label">{modeTitle(game)} · Leg {legs.length} terminé</div>
        <div className="h1" style={{ fontSize: 26, marginTop: 2 }}>
          {champion ? `${byId[champion]?.name} gagne la partie` : `${byId[winnerId]?.name} gagne le leg`}
        </div>
      </div>

      <Celebrations game={game} byId={byId} history={history} />

      <div className="col" style={{ gap: 6 }}>
        {leg.ranking.map((id, k) => {
          const idx = leg.order.indexOf(id);
          return (
            <div key={id} className="row card" style={k === 0 ? { background: 'var(--accent-bg)', border: '1px solid var(--accent)' } : {}}>
              <span className="num-badge" style={k === 0 ? {} : { background: 'var(--card-2)', color: 'var(--text)' }}>{k + 1}</span>
              <span className="grow" style={{ fontWeight: 700 }}>{byId[id]?.name}</span>
              <span className="small" style={{ color: 'var(--text-2)' }}>{legStatLabel(game, r, idx)}</span>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {game.player_ids.map((id) => (
          <div key={id} style={{ textAlign: 'center', minWidth: 0 }}>
            <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{byId[id]?.name}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: won[id] === Math.max(...Object.values(won)) && won[id] > 0 ? 'var(--accent)' : 'var(--text)' }}>{won[id]}</div>
          </div>
        ))}
        <div style={{ textAlign: 'center' }}><div className="small muted">Legs</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--muted)' }}>{legs.length}</div></div>
      </div>

      {game.player_ids.length > 1 && (
        <div className="panel">
          <div className="label">Ordre du leg {legs.length + 1}</div>
          <Seg options={[['shift', 'Décalé'], ['loser', 'Perdant 1er'], ['random', 'Aléatoire']]} value={how} onChange={pickHow} />
          <PlayerOrder ids={order} players={Object.values(byId)} onChange={setOrder} removable={false} />
          <div className="small muted">{how === 'shift' ? 'Décalé : celui qui était 2e à lancer commence.' : how === 'loser' ? 'Le dernier du leg commence.' : 'Ordre tiré au sort.'} Tu peux aussi glisser pour changer.</div>
        </div>
      )}

      <div className="col" style={{ gap: 10, marginTop: 'auto' }}>
        {champion ? (<>
          <button className="btn btn-primary" onClick={() => onEnd(game)}>Terminer la partie</button>
          <button className="btn btn-ghost" onClick={next}>Jouer un leg de plus</button>
        </>) : (<>
          <button className="btn btn-primary" onClick={next}>Jouer le leg {legs.length + 1}</button>
          <button className="btn btn-ghost" onClick={() => onEnd(game)}>Terminer la partie</button>
        </>)}
      </div>
    </div>
  );
}

function TrainingEnd({ game, records, onEnd, onReplay }) {
  const res = trainingResult(game);
  const rec = records?.[game.mode];
  const isRecord = res && (!rec || (res.better === 'low' ? res.value < rec.value : res.value > rec.value));
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="label">{MODE_LABEL[game.mode]}</div>
      <div className="h1" style={{ fontSize: 40 }}>{res ? res.label : 'Session terminée'}</div>
      {res && game.mode !== 'train-free' && (
        <div style={{ color: isRecord ? 'var(--accent)' : 'var(--text-2)', fontWeight: 700 }}>
          {isRecord ? 'Nouveau record !' : `Record : ${rec.label}`}
        </div>
      )}
      <div className="col" style={{ gap: 10, marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => onEnd(game, { replay: true })}>Recommencer</button>
        <button className="btn btn-ghost" onClick={() => onEnd(game)}>Terminer</button>
      </div>
    </div>
  );
}
