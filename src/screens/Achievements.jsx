import React, { useMemo, useState } from 'react';
import { ACHIEVEMENTS, TIER, computeAchievements } from '../engine/achievements.js';

const TIER_COLOR = { 1: '#d08b52', 2: '#c3cbd6', 3: '#f2c14e', 4: '#8fe3ff' };

export function Medal({ tier, locked, size = 44 }) {
  const c = TIER_COLOR[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" style={{ flexShrink: 0, opacity: locked ? 0.35 : 1, filter: locked ? 'grayscale(1)' : 'none' }}>
      <path d="M14 2h6l3 10h-6z M24 2h6l-3 10h-6z" fill={c} opacity="0.7" />
      <circle cx="22" cy="27" r="14" fill={c} />
      <circle cx="22" cy="27" r="10" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2" />
      {Array.from({ length: tier }).map((_, i) => (
        <circle key={i} cx={22 + (i - (tier - 1) / 2) * 5} cy="27" r="1.8" fill="rgba(0,0,0,.45)" />
      ))}
    </svg>
  );
}

export function Achievements({ games, pid, name }) {
  const [filter, setFilter] = useState('all');
  const res = useMemo(() => computeAchievements(games, pid), [games, pid]);
  const done = ACHIEVEMENTS.filter((a) => res[a.id].unlocked);
  const pct = done.length / ACHIEVEMENTS.length;
  const list = ACHIEVEMENTS
    .filter((a) => filter === 'all' || (filter === 'done' ? res[a.id].unlocked : !res[a.id].unlocked))
    .sort((a, b) => {
      if (filter === 'done') return new Date(res[b.id].unlocked) - new Date(res[a.id].unlocked);
      const pa = res[a.id].cur / res[a.id].max; const pb = res[b.id].cur / res[b.id].max;
      return a.tier - b.tier || (res[b.id].unlocked ? 1 : 0) - (res[a.id].unlocked ? 1 : 0) || pb - pa;
    });
  const last = [...done].sort((a, b) => new Date(res[b.id].unlocked) - new Date(res[a.id].unlocked))[0];

  return (<>
    <div className="hero">
      <div className="between">
        <div>
          <div className="label">Succès de {name}</div>
          <div className="hero-v">{done.length}<span className="hero-u"> / {ACHIEVEMENTS.length}</span></div>
          {last && <div className="small" style={{ color: 'var(--text-2)' }}>Dernier : <b>{last.name}</b>, {new Date(res[last.id].unlocked).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>}
        </div>
        <div className="row" style={{ gap: 4 }}>
          {[1, 2, 3, 4].map((t) => {
            const n = ACHIEVEMENTS.filter((a) => a.tier === t);
            const d = n.filter((a) => res[a.id].unlocked).length;
            return (
              <div key={t} className="col" style={{ alignItems: 'center', gap: 2 }}>
                <Medal tier={t} locked={!d} size={30} />
                <span className="small" style={{ fontWeight: 700 }}>{d}/{n.length}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="progress"><span style={{ width: `${pct * 100}%` }} /></div>
    </div>

    <div className="chips-scroll">
      {[['all', 'Tous'], ['todo', 'À débloquer'], ['done', 'Débloqués']].map(([k, l]) => (
        <button key={k} className={`chip-pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</button>
      ))}
    </div>

    <div className="col" style={{ gap: 8 }}>
      {list.map((a) => {
        const r = res[a.id];
        const locked = !r.unlocked;
        return (
          <div key={a.id} className={`ach ${locked ? 'locked' : ''}`} style={{ '--tier': TIER_COLOR[a.tier] }}>
            <Medal tier={a.tier} locked={locked} />
            <div className="grow">
              <div className="between">
                <span className="t">{a.name}</span>
                <span className="tier">{TIER[a.tier]}</span>
              </div>
              <div className="d">{a.desc}</div>
              {locked ? (<>
                {r.max > 1 && (
                  <div className="row" style={{ gap: 8, marginTop: 6 }}>
                    <div className="progress grow"><span style={{ width: `${(r.cur / r.max) * 100}%` }} /></div>
                    <span className="small" style={{ fontWeight: 700 }}>{r.cur.toLocaleString('fr-FR')} / {r.max.toLocaleString('fr-FR')}</span>
                  </div>
                )}
                {r.hint && <div className="small muted" style={{ marginTop: 4 }}>{r.hint}</div>}
              </>) : (
                <div className="small" style={{ color: 'var(--good)', marginTop: 4, fontWeight: 600 }}>Débloqué le {new Date(r.unlocked).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </>);
}
