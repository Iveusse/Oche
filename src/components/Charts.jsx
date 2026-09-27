import React, { useState } from 'react';

// Petites visualisations maison, aux couleurs du thème (SVG / HTML).

export function Sparkline({ values, width = 120, height = 36 }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values); const hi = Math.max(...values); const span = hi - lo || 1;
  const x = (i) => (i / (values.length - 1)) * (width - 6) + 3;
  const y = (v) => height - 4 - ((v - lo) / span) * (height - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${d} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill="var(--accent)" opacity="0.14" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3.5" fill="var(--accent)" />
    </svg>
  );
}

export function Delta({ value, digits = 1, suffix = '', invert = false }) {
  if (value == null || !isFinite(value) || Math.abs(value) < 10 ** -digits / 2) return <span className="delta flat">= stable</span>;
  const good = invert ? value < 0 : value > 0;
  return <span className={`delta ${good ? 'up' : 'down'}`}>{value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(digits)}{suffix}</span>;
}

// Barres horizontales : [{ label, value, sub }] ; value en fraction 0..1 pour la longueur
export function HBars({ rows, format = (r) => r.sub }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  const [sel, setSel] = useState(null);
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <button key={r.label} className={`hbar ${sel === i ? 'sel' : ''}`} onClick={() => setSel(sel === i ? null : i)} aria-label={`${r.label} : ${format(r)}`}>
          <span className="l">{r.label}</span>
          <span className="track"><span className="fill" style={{ width: `${(r.value / max) * 100}%`, opacity: r.value ? 1 : 0 }} /></span>
          <span className="v">{format(r)}</span>
        </button>
      ))}
    </div>
  );
}

// Colonnes verticales avec ligne de référence optionnelle
export function VBars({ data, height = 140, refValue, refLabel, fmt = (v) => v.toFixed(0) }) {
  const vals = data.map((d) => d.value ?? 0);
  const max = Math.max(...vals, refValue ?? 0, 1) * 1.12;
  const [sel, setSel] = useState(null);
  const W = 330; const H = height; const B = 20; const gap = 6;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const y = (v) => H - B - (v / max) * (H - B - 18);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={data.map((d) => `${d.label} ${d.value == null ? '-' : fmt(d.value)}`).join(', ')}>
      {data.map((d, i) => {
        const v = d.value ?? 0; const x = i * (bw + gap);
        const top = y(v); const h = H - B - top;
        const on = sel === i;
        return (
          <g key={d.label} onClick={() => setSel(on ? null : i)} style={{ cursor: 'pointer' }}>
            <rect x={x} y={0} width={bw} height={H - B} fill="transparent" />
            {v > 0 && <path d={`M${x},${H - B} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - B} Z`} fill="var(--accent)" opacity={sel == null || on ? 1 : 0.45} />}
            <text x={x + bw / 2} y={H - 5} fill="var(--muted)" fontSize="11" textAnchor="middle">{d.label}</text>
            {(on || (sel == null && (i === vals.indexOf(Math.max(...vals)) || i === vals.indexOf(Math.min(...vals.filter((z) => z > 0)))))) && v > 0 && (
              <text x={x + bw / 2} y={top - 5} fill="var(--text)" fontSize="11" fontWeight="700" textAnchor="middle">{fmt(v)}</text>
            )}
          </g>
        );
      })}
      {refValue != null && (
        <g>
          <line x1="0" x2={W} y1={y(refValue)} y2={y(refValue)} stroke="var(--text-2)" strokeDasharray="4 4" strokeWidth="1" />
          
        </g>
      )}
    </svg>
  );
}

// Anneau de pourcentage
export function Ring({ value, size = 96, label }) {
  const r = size / 2 - 7; const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth="9" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--text)" fontSize={size * 0.22} fontWeight="800">
        {value == null ? '-' : `${Math.round(value * 100)}%`}
      </text>
    </svg>
  );
}

// Barre empilée : [{ label, value, color }]
export function StackBar({ parts }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="stackbar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)} %`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} style={{ flexGrow: p.value, background: p.color }} />)}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.label} className="row" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
            <span className="small" style={{ color: 'var(--text-2)' }}>{p.label}</span>
            <b className="small">{Math.round((p.value / total) * 100)} %</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Bande de cases par numéro, intensité = valeur 0..1
export function HeatStrip({ cells, fmt = (v) => `${Math.round(v * 100)}` }) {
  const [sel, setSel] = useState(null);
  // intensité relative au meilleur et au pire numéro, pour bien voir les écarts
  const vals = cells.map((c) => c.value).filter((v) => v != null);
  const lo = Math.min(...vals); const hi = Math.max(...vals);
  const norm = (v) => (hi > lo ? (v - lo) / (hi - lo) : 1);
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="heatstrip">
        {cells.map((c, i) => (
          <button key={c.label} onClick={() => setSel(sel === i ? null : i)} className={`cell ${sel === i ? 'sel' : ''}`}
            aria-label={`${c.label} : ${c.value == null ? 'pas de données' : fmt(c.value)}`}>
            <span className="bg" style={{ opacity: c.value == null ? 0 : 0.1 + 0.9 * norm(c.value) }} />
            <span className="n" style={{ color: c.value != null && norm(c.value) > 0.6 ? 'var(--on-accent)' : 'var(--text)' }}>{c.label}</span>
            <span className="p" style={{ color: c.value != null && norm(c.value) > 0.6 ? 'var(--on-accent)' : 'var(--text-2)' }}>{c.value == null ? '·' : fmt(c.value)}</span>
          </button>
        ))}
      </div>
      <div className="row small muted" style={{ gap: 8 }}>
        <span>ton pire</span>
        <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--accent))' }} />
        <span>ton meilleur</span>
      </div>
      {sel != null && cells[sel].detail && <div className="small" style={{ color: 'var(--text-2)' }}>{cells[sel].detail}</div>}
    </div>
  );
}
