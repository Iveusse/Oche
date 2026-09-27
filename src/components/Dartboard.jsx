import React, { memo, useRef, useState } from 'react';
import { ORDER, R, hitTest, dartLabel, dartScore } from '../lib/board.js';

const pt = (r, a) => {
  const t = (a * Math.PI) / 180;
  return [r * Math.sin(t), -r * Math.cos(t)];
};

function sector(r0, r1, a0, a1) {
  const [x0, y0] = pt(r1, a0); const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1); const [x3, y3] = pt(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

const PALETTE = {
  color: { dark: 'var(--board-dark)', light: 'var(--board-light)', red: 'var(--red)', green: 'var(--green)', bullO: 'var(--green)', bullI: 'var(--red)' },
  grey: { dark: '#1b2436', light: '#222d42', red: '#2f3b52', green: '#253047', bullO: '#2f3b52', bullI: '#3a4760' },
};

export const BoardShapes = memo(function BoardShapes({ variant = 'color', numbers = true }) {
  const c = PALETTE[variant];
  const wire = '#34435f';
  const segs = ORDER.map((n, i) => {
    const a0 = i * 18 - 9; const a1 = a0 + 18;
    const even = i % 2 === 0;
    const single = even ? c.dark : c.light;
    const ring = even ? c.red : c.green;
    return (
      <g key={n}>
        <path d={sector(R.trebleOut, R.doubleIn, a0, a1)} fill={single} stroke={wire} strokeWidth="0.004" />
        <path d={sector(R.outerBull, R.trebleIn, a0, a1)} fill={single} stroke={wire} strokeWidth="0.004" />
        <path d={sector(R.trebleIn, R.trebleOut, a0, a1)} fill={ring} stroke={wire} strokeWidth="0.004" />
        <path d={sector(R.doubleIn, R.doubleOut, a0, a1)} fill={ring} stroke={wire} strokeWidth="0.004" />
      </g>
    );
  });
  return (
    <g>
      <circle r={R.miss - 0.006} fill="#111827" stroke={wire} strokeWidth="0.012" strokeDasharray="0.035 0.03" />
      {segs}
      <circle r={R.outerBull} fill={c.bullO} stroke={wire} strokeWidth="0.004" />
      <circle r={R.innerBull} fill={c.bullI} stroke={wire} strokeWidth="0.004" />
      {numbers && ORDER.map((n, i) => {
        const [x, y] = pt(1.14, i * 18);
        return <text key={n} x={x} y={y} fill={variant === 'color' ? 'var(--text)' : 'var(--muted)'} fontSize="0.12" fontWeight="700" textAnchor="middle" dominantBaseline="central">{n}</text>;
      })}
      {numbers && <text x="0" y={-1.235} fill="var(--muted)" fontSize="0.055" textAnchor="middle" letterSpacing="0.01">HORS CIBLE</text>}
    </g>
  );
});

const VB = `${-R.miss} ${-R.miss} ${R.miss * 2} ${R.miss * 2}`;

export function Dartboard({ onHit, disabled, markers = [] }) {
  const wrap = useRef(null);
  const [touch, setTouch] = useState(null); // {fx, fy, bx, by, w}

  const locate = (e) => {
    const rect = wrap.current.getBoundingClientRect();
    const fx = e.clientX - rect.left; const fy = e.clientY - rect.top;
    const k = (R.miss * 2) / rect.width;
    return { fx, fy, bx: fx * k - R.miss, by: fy * k - R.miss, w: rect.width };
  };

  const down = (e) => {
    if (disabled) return;
    e.preventDefault();
    wrap.current.setPointerCapture?.(e.pointerId);
    setTouch(locate(e));
  };
  const move = (e) => { if (touch) setTouch(locate(e)); };
  const up = (e) => {
    if (!touch) return;
    const t = locate(e);
    setTouch(null);
    const r = Math.hypot(t.bx, t.by);
    const h = hitTest(t.bx, t.by);
    // coordonnées gardées pour la heatmap (bornées à la zone dessinée)
    const k = r > R.miss ? R.miss / r : 1;
    onHit({ ...h, x: +(t.bx * k).toFixed(4), y: +(t.by * k).toFixed(4) });
  };
  const cancel = () => setTouch(null);

  const hit = touch ? hitTest(touch.bx, touch.by) : null;
  const LS = 150;
  const span = 0.36;
  let lx = 0; let ly = 0;
  if (touch) {
    lx = Math.min(Math.max(touch.fx, LS / 2 - 20), touch.w - LS / 2 + 20);
    ly = touch.fy - 120;
  }

  return (
    <div
      className="board-wrap" ref={wrap}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <svg viewBox={VB} aria-label="Cible : pose le doigt où la fléchette a touché">
        <BoardShapes />
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r="0.035" fill="var(--accent)" stroke="#0d1320" strokeWidth="0.015" />
          </g>
        ))}
        {touch && <circle cx={touch.bx} cy={touch.by} r="0.09" fill="rgba(238,242,248,.2)" stroke="rgba(238,242,248,.7)" strokeWidth="0.01" />}
      </svg>
      {touch && (
        <>
          <div className="loupe" style={{ left: lx - LS / 2, top: ly - LS / 2 }}>
            <svg viewBox={`${touch.bx - span / 2} ${touch.by - span / 2} ${span} ${span}`} width={LS - 8} height={LS - 8}>
              <BoardShapes numbers={false} />
              <circle cx={touch.bx} cy={touch.by} r="0.012" fill="none" stroke="var(--accent)" strokeWidth="0.005" />
              <line x1={touch.bx} y1={touch.by - span} x2={touch.bx} y2={touch.by - 0.015} stroke="rgba(200,240,49,.6)" strokeWidth="0.002" />
              <line x1={touch.bx} y1={touch.by + 0.015} x2={touch.bx} y2={touch.by + span} stroke="rgba(200,240,49,.6)" strokeWidth="0.002" />
              <line x1={touch.bx - span} y1={touch.by} x2={touch.bx - 0.015} y2={touch.by} stroke="rgba(200,240,49,.6)" strokeWidth="0.002" />
              <line x1={touch.bx + 0.015} y1={touch.by} x2={touch.bx + span} y2={touch.by} stroke="rgba(200,240,49,.6)" strokeWidth="0.002" />
            </svg>
          </div>
          <div className="loupe-label" style={{ left: lx, top: ly + LS / 2 + 6 }}>
            {dartLabel(hit)}{hit.mult ? ` · ${dartScore(hit)}` : ''}
          </div>
        </>
      )}
    </div>
  );
}

export function Heatmap({ points }) {
  return (
    <svg viewBox={VB} style={{ width: '100%', maxWidth: 300, alignSelf: 'center', display: 'block' }} aria-label="Heatmap des fléchettes">
      <BoardShapes variant="grey" numbers={false} />
      <g style={{ mixBlendMode: 'screen' }}>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="0.045" fill="rgb(200,240,49)" opacity={Math.max(0.08, Math.min(0.5, 12 / Math.max(points.length, 1)))} />
        ))}
      </g>
    </svg>
  );
}
