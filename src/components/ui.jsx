import React from 'react';

const S = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const Icon = {
  Back: (p) => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><path d="M15 18l-6-6 6-6" /></svg>,
  Chevron: (p) => <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.4" {...S} {...p}><path d="M6 9l6 6 6-6" /></svg>,
  Right: (p) => <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.4" {...S} {...p}><path d="M9 6l6 6-6 6" /></svg>,
  Plus: (p) => <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.4" {...S} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  X: (p) => <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  Grip: (p) => <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><path d="M5 9h14M5 15h14" /></svg>,
  Shuffle: (p) => <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>,
  Undo: (p) => <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
  Check: (p) => <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="3" {...S} {...p}><path d="M5 12l5 5 9-10" /></svg>,
  More: (p) => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.6" {...S} {...p}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>,
  Search: (p) => <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2.2" {...S} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  Gear: (p) => <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" {...S} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  Target: (p) => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...S} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>,
  Pulse: (p) => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...S} {...p}><polyline points="3 12 7 12 10 5 14 19 17 12 21 12" /></svg>,
  Bars: (p) => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...S} {...p}><path d="M5 20V11M12 20V4M19 20v-6" /></svg>,
  Trophy: (p) => <svg width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" {...S} {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>,
};

export function TabBar({ tab, onTab }) {
  const items = [
    ['home', 'Jouer', Icon.Target], ['training', 'Entraînement', Icon.Pulse],
    ['stats', 'Stats', Icon.Bars], ['ranking', 'Classement', Icon.Trophy],
  ];
  return (
    <nav className="tabbar">
      {items.map(([k, label, I]) => (
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)} aria-current={tab === k}>
          <I />{label}
        </button>
      ))}
    </nav>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Stepper({ value, onChange, min = 1, max = 99, format = (v) => v, label }) {
  return (
    <div className="stepper">
      <button aria-label={`Moins ${label || ''}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>&minus;</button>
      <span>{format(value)}</span>
      <button aria-label={`Plus ${label || ''}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  );
}

export function Sheet({ onClose, children, label }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="sheet" role="dialog" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export function Avatar({ player, size = 32 }) {
  if (!player) return null;
  return (
    <span className="avatar" style={{ width: size, height: size, background: player.color, fontSize: size * 0.42 }}>
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function TopBar({ title, sub, onBack, right }) {
  return (
    <div className="between" style={{ minHeight: 44 }}>
      {onBack ? <button className="icon-btn" aria-label="Retour" onClick={onBack}><Icon.Back /></button> : <span style={{ width: 44 }} />}
      <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      {right || <span style={{ width: 44 }} />}
    </div>
  );
}
