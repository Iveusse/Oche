import React from 'react';

// Petite courbe : points [{label, value}] dans l'ordre chronologique
export function LineChart({ points, height = 150, unit = '', ariaLabel }) {
  const W = 330; const H = height; const L = 30; const B = 22; const T = 12;
  if (points.length < 2) {
    return <div className="small muted" style={{ padding: '20px 0', textAlign: 'center' }}>Pas encore assez de parties pour tracer une courbe.</div>;
  }
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals); let hi = Math.max(...vals);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = (i) => L + ((W - L - 6) * i) / (points.length - 1);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [hi - pad, (hi + lo) / 2, lo + pad];
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={ariaLabel}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#233049" />
          <text x="0" y={y(t) + 4} fill="#8a97ad" fontSize="11">{Math.round(t)}</text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--accent)" />
      <text x={L} y={H - 4} fill="#8a97ad" fontSize="11">{points[0].label}</text>
      <text x={W} y={H - 4} fill="#8a97ad" fontSize="11" textAnchor="end">{last.label}</text>
      <text x={x(points.length - 1) - 6} y={y(last.value) - 10} fill="var(--text)" fontSize="12" fontWeight="700" textAnchor="end">{last.value.toFixed(1)}{unit}</text>
    </svg>
  );
}

// Plusieurs courbes sur un axe de temps commun. series: [{ name, color, points: [{ t, value }] }]
export function MultiLineChart({ series, height = 170, ariaLabel }) {
  const W = 330; const H = height; const L = 30; const B = 22; const T = 12;
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return <div className="small muted" style={{ padding: '20px 0', textAlign: 'center' }}>Pas encore assez de parties pour tracer une courbe.</div>;
  }
  const ts = all.map((p) => p.t); const vs = all.map((p) => p.value);
  let t0 = Math.min(...ts); let t1 = Math.max(...ts); if (t1 === t0) t1 = t0 + 1;
  let lo = Math.min(...vs); let hi = Math.max(...vs); if (hi - lo < 1) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = (t) => L + ((W - L - 6) * (t - t0)) / (t1 - t0);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [hi - pad, (hi + lo) / 2, lo + pad];
  const d = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={ariaLabel}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#233049" />
          <text x="0" y={y(t) + 4} fill="#8a97ad" fontSize="11">{Math.round(t)}</text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          {s.points.length > 1 && <polyline points={s.points.map((p) => `${x(p.t)},${y(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {s.points.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.value)} r={i === s.points.length - 1 ? 4 : 2.5} fill={s.color} />)}
        </g>
      ))}
      <text x={L} y={H - 4} fill="#8a97ad" fontSize="11">{d(t0)}</text>
      <text x={W} y={H - 4} fill="#8a97ad" fontSize="11" textAnchor="end">{d(t1)}</text>
    </svg>
  );
}
