import React, { useMemo } from 'react';
import { GradeBadge } from './Grade.jsx';
import { weeklyPlan, levelHistory } from '../engine/plan.js';

export function GoalLine({ goal }) {
  if (!goal) return null;
  if (goal.reached) return <div className="small" style={{ color: 'var(--text-2)' }}>Niveau S atteint, il reste à le garder.</div>;
  return (
    <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.45 }}>
      Objectif : passer de <b>{goal.from}</b> à <b>{goal.to}</b> ({goal.label}), il manque environ {Math.max(1, Math.ceil(goal.need))} point{goal.need > 1 ? 's' : ''} sur 100.
      {goal.lever ? ` Le plus rentable : ${goal.lever.label} (${Math.round(goal.lever.score)}/100).` : ''}
    </div>
  );
}

export function PlanCard({ games, me, onStart }) {
  const plan = useMemo(() => (me ? weeklyPlan(games, me.id) : null), [games, me]);
  if (!plan) return null;
  const pct = plan.total ? Math.round((plan.finished / plan.total) * 100) : 0;
  return (
    <div className="card col" style={{ padding: 16, gap: 12, border: '1px solid var(--card-2)' }}>
      <div className="between">
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Programme de la semaine</div>
          <div className="small muted">{plan.finished} / {plan.total} séances faites</div>
        </div>
        {plan.level.grade && <GradeBadge grade={plan.level.grade} size={40} title="Ton niveau global" />}
      </div>
      <div className="lvl-bar"><i style={{ width: `${pct}%` }} /></div>
      <GoalLine goal={plan.goal} />
      <div className="col" style={{ gap: 8 }}>
        {plan.items.map((it) => {
          const ok = it.done >= it.times;
          return (
            <button key={it.id} className="list-item" onClick={() => onStart(it.id)} style={{ opacity: ok ? 0.65 : 1 }}>
              <span aria-hidden="true" style={{ width: 24, fontWeight: 800, color: ok ? 'var(--good)' : 'var(--muted)' }}>{ok ? '✓' : `${it.done}/${it.times}`}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{it.name} <span className="small muted">× {it.times}</span></div>
                <div className="small muted" style={{ marginTop: 2 }}>{it.why}</div>
                {it.goal && <div className="small" style={{ color: 'var(--text-2)', marginTop: 2 }}>{it.goal}</div>}
              </div>
              {it.grade && <GradeBadge grade={it.grade} size={32} />}
            </button>
          );
        })}
        {plan.game && (
          <div className="list-item" style={{ cursor: 'default' }}>
            <span aria-hidden="true" style={{ width: 24 }}>🎯</span>
            <div className="grow"><div style={{ fontSize: 15, fontWeight: 700 }}>1 partie de {plan.game.name}</div><div className="small muted" style={{ marginTop: 2 }}>{plan.game.why}</div></div>
            <GradeBadge grade={plan.game.grade} size={32} />
          </div>
        )}
      </div>
      <div className="small muted">Les exercices viennent de tes notes récentes : les plus faibles d'abord. La semaine repart le lundi.</div>
    </div>
  );
}

// courbe du niveau global, une valeur par semaine
export function LevelCurve({ games, pid }) {
  const pts = useMemo(() => levelHistory(games, pid), [games, pid]);
  if (pts.length < 2) return <div className="small muted">La courbe apparaît dès que ton niveau est calculable sur 2 semaines différentes.</div>;
  const W = 320; const H = 120; const px = 28; const py = 12;
  const lo = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.score)) / 5) * 5 - 5);
  const hi = Math.min(100, Math.ceil(Math.max(...pts.map((p) => p.score)) / 5) * 5 + 5);
  const X = (i) => px + (i / (pts.length - 1)) * (W - px - 8);
  const Y = (v) => H - py - ((v - lo) / (hi - lo || 1)) * (H - py * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.score).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]; const first = pts[0];
  const diff = last.score - first.score;
  return (
    <div className="col" style={{ gap: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Courbe du niveau global par semaine">
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}><line x1={px} x2={W - 8} y1={Y(v)} y2={Y(v)} stroke="var(--card-2)" strokeWidth="1" /><text x={px - 6} y={Y(v) + 4} fontSize="10" textAnchor="end" fill="var(--muted)">{Math.round(v)}</text></g>
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.score)} r={i === pts.length - 1 ? 4.5 : 2.5} fill="var(--accent)" />)}
      </svg>
      <div className="small muted">
        {new Date(first.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : {Math.round(first.score)} → aujourd'hui : {Math.round(last.score)}
        {Math.abs(diff) >= 0.5 ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)} pt${Math.abs(diff) >= 2 ? 's' : ''})` : ' (stable)'}
      </div>
    </div>
  );
}
