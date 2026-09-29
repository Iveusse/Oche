import React, { useMemo, useState } from 'react';
import { ACHIEVEMENTS, EXPLOIT_LIST, SERIES, TIER, computeAchievements } from '../engine/achievements.js';

const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const TIER_COLOR = { 1: '#d08b52', 2: '#c3cbd6', 3: '#f2c14e', 4: '#8fe3ff' };
const fmtDate = (d, long) => new Date(d).toLocaleDateString('fr-FR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });

export function Medal({ tier, locked, size = 44, label }) {
  const c = TIER_COLOR[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" style={{ flexShrink: 0, opacity: locked ? 0.35 : 1, filter: locked ? 'grayscale(1)' : 'none' }}>
      <path d="M14 2h6l3 10h-6z M24 2h6l-3 10h-6z" fill={c} opacity="0.7" />
      <circle cx="22" cy="27" r="14" fill={c} />
      <circle cx="22" cy="27" r="10" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2" />
      {label ? (
        <text x="22" y="27" textAnchor="middle" dominantBaseline="central" fontSize={label.length > 2 ? 8 : 11} fontWeight="800" fill="rgba(0,0,0,.6)">{label}</text>
      ) : Array.from({ length: tier }).map((_, i) => (
        <circle key={i} cx={22 + (i - (tier - 1) / 2) * 5} cy="27" r="1.8" fill="rgba(0,0,0,.45)" />
      ))}
    </svg>
  );
}

function SeriesCard({ s, res }) {
  const [open, setOpen] = useState(false);
  const levels = s.steps.map((n, i) => ({ n, i, r: res[`${s.key}-${n}`] }));
  const doneN = levels.filter((l) => l.r.unlocked).length;
  const next = levels.find((l) => !l.r.unlocked);
  const cur = res[`${s.key}-${s.steps[s.steps.length - 1]}`].cur; // compteur réel (borné au dernier palier)
  const value = next ? next.r.cur : cur;
  const prevStep = doneN ? s.steps[doneN - 1] : 0;
  const pct = next ? Math.max(0, Math.min(1, (value - prevStep) / (next.n - prevStep))) : 1;
  const tier = doneN ? s.tiers[doneN - 1] : s.tiers[0];
  const short = (n) => (n >= 1000 ? `${n / 1000}k` : String(n));
  return (
    <div className={`ach ${doneN ? '' : 'locked'}`} style={{ '--tier': TIER_COLOR[tier] }}>
      <Medal tier={tier} locked={!doneN} label={doneN ? short(s.steps[doneN - 1]) : ''} />
      <div className="grow" style={{ minWidth: 0 }}>
        <button className="between" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="t">{s.name}</span>
          <span className="tier">Niv. {doneN}/{s.steps.length}</span>
        </button>
        <div className="pips" aria-hidden="true">
          {levels.map((l) => <span key={l.n} className={l.r.unlocked ? 'on' : ''} style={l.r.unlocked ? { background: TIER_COLOR[s.tiers[l.i]] } : {}} />)}
        </div>
        {next ? (
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <div className="progress grow"><span style={{ width: `${pct * 100}%` }} /></div>
            <span className="small" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{value.toLocaleString('fr-FR')} / {next.n.toLocaleString('fr-FR')}</span>
          </div>
        ) : <div className="small" style={{ color: 'var(--good)', marginTop: 6, fontWeight: 700 }}>Série terminée !</div>}
        {next && <div className="small muted" style={{ marginTop: 2 }}>Prochain palier : {next.n.toLocaleString('fr-FR')} {s.unit} · {TIER[s.tiers[next.i]]}</div>}
        {next && ACH_BY_ID[`${s.key}-${next.n}`]?.rarity && <div className="rarity">{ACH_BY_ID[`${s.key}-${next.n}`].rarity}</div>}
        {open && (
          <div className="col" style={{ gap: 4, marginTop: 8 }}>
            {levels.map((l) => (
              <div key={l.n} className="between small">
                <span className="row" style={{ gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: TIER_COLOR[s.tiers[l.i]], opacity: l.r.unlocked ? 1 : 0.3 }} />
                  {l.n.toLocaleString('fr-FR')} {s.unit}
                </span>
                <span style={{ color: l.r.unlocked ? 'var(--good)' : 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>{l.r.unlocked ? fmtDate(l.r.unlocked) : TIER[s.tiers[l.i]]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExploitCard({ a, r }) {
  const locked = !r.unlocked;
  return (
    <div className={`ach ${locked ? 'locked' : ''}`} style={{ '--tier': TIER_COLOR[a.tier] }}>
      <Medal tier={a.tier} locked={locked} />
      <div className="grow">
        <div className="between"><span className="t">{a.hidden && locked ? '???' : a.name}</span><span className="tier">{a.hidden && locked ? 'Caché' : TIER[a.tier]}</span></div>
        <div className="d">{a.hidden && locked ? 'Succès caché : il faudra le trouver tout seul' : a.desc}</div>
        {a.rarity && <div className="rarity">{a.rarity}</div>}
        {locked ? (<>
          {r.max > 1 && (
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <div className="progress grow"><span style={{ width: `${(r.cur / r.max) * 100}%` }} /></div>
              <span className="small" style={{ fontWeight: 700 }}>{r.cur} / {r.max}</span>
            </div>
          )}
          {r.hint && <div className="small muted" style={{ marginTop: 4 }}>{r.hint}</div>}
        </>) : <div className="small" style={{ color: 'var(--good)', marginTop: 4, fontWeight: 600 }}>Débloqué le {fmtDate(r.unlocked, true)}</div>}
      </div>
    </div>
  );
}

export function Achievements({ games, pid, name }) {
  const [tab, setTab] = useState('exploits');
  const [filter, setFilter] = useState('all');
  const res = useMemo(() => computeAchievements(games, pid), [games, pid]);
  const done = ACHIEVEMENTS.filter((a) => res[a.id].unlocked);
  const last = [...done].sort((a, b) => new Date(res[b.id].unlocked) - new Date(res[a.id].unlocked)).slice(0, 3);

  const exploits = EXPLOIT_LIST
    .filter((a) => filter === 'all' || (filter === 'done' ? res[a.id].unlocked : !res[a.id].unlocked))
    .sort((a, b) => a.tier - b.tier || (res[b.id].unlocked ? 1 : 0) - (res[a.id].unlocked ? 1 : 0) || (res[b.id].cur / res[b.id].max) - (res[a.id].cur / res[a.id].max));

  // séries : les plus proches du prochain palier en premier
  const series = [...SERIES].sort((a, b) => {
    const prog = (s) => { const nx = s.steps.find((n) => !res[`${s.key}-${n}`].unlocked); return nx ? res[`${s.key}-${nx}`].cur / nx : -1; };
    return prog(b) - prog(a);
  });

  return (<>
    <div className="hero">
      <div className="between">
        <div>
          <div className="label">Succès de {name}</div>
          <div className="hero-v" style={{ whiteSpace: 'nowrap', fontSize: 44 }}>{done.length}<span className="hero-u"> / {ACHIEVEMENTS.length}</span></div>
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
      <div className="progress"><span style={{ width: `${(done.length / ACHIEVEMENTS.length) * 100}%` }} /></div>
      {last.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="label">Derniers débloqués</span>
          {last.map((a) => (
            <div key={a.id} className="row small" style={{ gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: TIER_COLOR[a.tier], flexShrink: 0 }} />
              <b className="grow">{a.name}</b>
              <span className="muted">{fmtDate(res[a.id].unlocked)}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="mode-tabs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
      <button className={tab === 'exploits' ? 'on' : ''} onClick={() => setTab('exploits')}>Exploits ({EXPLOIT_LIST.filter((a) => res[a.id].unlocked).length}/{EXPLOIT_LIST.length})</button>
      <button className={tab === 'series' ? 'on' : ''} onClick={() => setTab('series')}>Paliers ({SERIES.length} séries)</button>
    </div>

    {tab === 'exploits' ? (<>
      <div className="chips-scroll">
        {[['all', 'Tous'], ['todo', 'À débloquer'], ['done', 'Débloqués']].map(([k, l]) => (
          <button key={k} className={`chip-pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</button>
        ))}
      </div>
      <div className="col" style={{ gap: 8 }}>
        {exploits.map((a) => <ExploitCard key={a.id} a={a} r={res[a.id]} />)}
      </div>
    </>) : (
      <div className="col" style={{ gap: 8 }}>
        <div className="small muted">Touche une série pour voir tous ses paliers et leurs dates.</div>
        {series.map((s) => <SeriesCard key={s.key} s={s} res={res} />)}
      </div>
    )}
  </>);
}
