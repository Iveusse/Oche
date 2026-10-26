// Cibles d'affichage (pas de saisie) : une mini-cible par joueur au Shanghai, une cible partagée au Cricket.
import React from 'react';
import { ORDER } from '../lib/board.js';
import { shanghaiNumbers, CRICKET_NUMS } from '../engine/modes.js';

export const PLAYER_COLORS = ['#c8f031', '#5fc8ff', '#ff9f5a', '#f07bd0', '#7be0b0', '#b49cff'];
export const colorOf = (players, id, i) => players?.[id]?.color || PLAYER_COLORS[i % PLAYER_COLORS.length];

const DIM = 'var(--card-2)';
const BASE = 0.2; // rayon du centre
const STEP = Math.PI / 10; // 18° par numéro
const pt = (r, a) => [Math.sin(a) * r, -Math.cos(a) * r];
function wedge(r1, r2, i, gap = 0.012) {
  const a0 = (i - 0.5) * STEP + gap; const a1 = (i + 0.5) * STEP - gap;
  const [x1, y1] = pt(r2, a0); const [x2, y2] = pt(r2, a1); const [x3, y3] = pt(r1, a1); const [x4, y4] = pt(r1, a0);
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}
function Label({ n, i, size, fill, weight }) {
  const [x, y] = pt(1.17, i * STEP);
  return <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor="middle" dominantBaseline="central">{n}</text>;
}

// ---------- Shanghai ----------
const OPACITY = { 1: 0.4, 2: 0.7, 3: 1 };

// Fléchettes de chaque numéro jouées par le joueur idx : { 4: [1, 2, 3] } (mult touchée, 0 si raté), tour en cours compris
export function shanghaiHits(r, idx, settings) {
  const nums = shanghaiNumbers(settings);
  const out = {};
  const add = (t) => {
    const n = nums[t.round];
    if (n == null) return;
    out[n] = t.darts.map((d) => (d.hit && d.mult ? d.mult : 0));
  };
  r.turns.filter((t) => t.p === idx).forEach(add);
  if (r.current && r.current.p === idx) add(r.current);
  return out;
}

export function ShanghaiTarget({ hits, current, color, size, from, to }) {
  const w = (1 - BASE) / 3;
  return (
    <svg viewBox="-1.32 -1.32 2.64 2.64" width={size} height={size} role="img" aria-label="Cible Shanghai">
      {ORDER.map((n, i) => {
        const inR = n >= from && n <= to;
        const h = hits[n] || [];
        const shang = [1, 2, 3].every((m) => h.includes(m));
        return (
          <g key={n}>
            {[0, 1, 2].map((k) => {
              const r1 = BASE + k * w;
              const m = h[k];
              return <path key={k} d={wedge(r1, r1 + w - 0.02, i)} fill={inR && m ? color : DIM} opacity={inR ? (m ? OPACITY[m] : 1) : 0.35} />;
            })}
            {current === n && <path d={wedge(BASE, 1, i, 0.004)} fill="none" stroke="var(--text)" strokeWidth="0.035" />}
            <Label n={n} i={i} size={inR ? 0.22 : 0.15} fill={shang ? '#ffd34d' : inR ? 'var(--text)' : 'var(--muted)'} weight={inR ? 800 : 400} />
          </g>
        );
      })}
      <circle r={BASE} fill={DIM} />
    </svg>
  );
}

// Rangée de cibles : une par joueur, avec nom et points
export function ShanghaiTargets({ r, game, players, thrower, currentNum = null, size = 88 }) {
  const s = game.settings;
  const nums = shanghaiNumbers(s);
  return (
    <div className="scores sh-targets">
      {r.ps.map((p, i) => {
        return (
          <div key={p.id} className={`score-card sh-card ${i === thrower && currentNum != null ? 'on' : ''}`}>
            <ShanghaiTarget hits={shanghaiHits(r, i, s)} current={i === thrower ? currentNum : null} color={colorOf(players, p.id, i)} size={size} from={nums[0]} to={nums[nums.length - 1]} />
            <div className="sh-name"><span className="n" style={{ color: colorOf(players, p.id, i) }}>{players[p.id]?.name || '?'}</span><b>{p.pts}</b></div>
          </div>
        );
      })}
    </div>
  );
}

// Stats du joueur qui lance sur le numéro en cours : ce qu'il fait d'habitude sur ce numéro
export function shanghaiLine(num, hist) {
  const m = hist?.numMix?.[num];
  if (num == null) return null;
  if (!m || m.darts < 9) return { num, text: 'pas encore assez de parties sur ce numéro' };
  const pc = (v) => `${Math.round((v || 0) * 100)}%`;
  return { num, s: pc(m.s), d: pc(m.d), t: pc(m.t), miss: pc(m.miss), sh: m.sh, darts: m.darts };
}

// ---------- Cricket ----------
// Une bande par joueur dans chaque numéro. 1 marque pâle, 2 marques soutenu, 3 marques (il marque) plein et cerclé.
// Numéro fermé par tous : gris teinté.
export function CricketTarget({ r, colors, size }) {
  const n = r.ps.length;
  const w = (1 - BASE - 0.12) / n;
  const nums = CRICKET_NUMS.filter((k) => k !== 25);
  return (
    <svg viewBox="-1.32 -1.32 2.64 2.64" width={size} height={size} role="img" aria-label="Cible Cricket">
      {ORDER.map((num, i) => {
        const act = nums.includes(num);
        const dead = act && r.ps.every((p) => p.marks[num] >= 3);
        return (
          <g key={num}>
            {!act ? <path d={wedge(BASE, 1, i)} fill="var(--card)" opacity="0.5" /> : r.ps.map((p, k) => {
              const m = Math.min(3, p.marks[num]);
              const r1 = BASE + k * w;
              const d = wedge(r1, r1 + w - 0.02, i);
              if (dead) return <path key={k} d={d} fill={colors[k]} opacity="0.28" />;
              if (m === 0) return <path key={k} d={d} fill={DIM} />;
              return <path key={k} d={d} fill={colors[k]} opacity={m === 3 ? 1 : m === 2 ? 0.62 : 0.3} stroke={m === 3 ? 'var(--text)' : 'none'} strokeWidth="0.018" />;
            })}
            <Label n={num} i={i} size={act ? 0.24 : 0.14} fill={dead ? 'var(--muted)' : act ? 'var(--text)' : 'var(--muted)'} weight={act ? 800 : 400} />
          </g>
        );
      })}
      {r.ps.map((p, k) => {
        const m = Math.min(3, p.marks[25]);
        const dead = r.ps.every((o) => o.marks[25] >= 3);
        const rr = BASE - (k * (BASE - 0.03)) / n;
        return <circle key={k} r={rr} fill={dead ? colors[k] : m === 0 ? DIM : colors[k]} opacity={dead ? 0.28 : m === 0 ? 1 : m === 3 ? 1 : m === 2 ? 0.62 : 0.3} stroke={m === 3 && !dead ? 'var(--text)' : 'var(--bg)'} strokeWidth="0.014" />;
      })}
    </svg>
  );
}
