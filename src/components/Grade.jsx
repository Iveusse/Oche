import React, { useState } from 'react';
import { GRADE_LABEL } from '../engine/grades.js';

// Pastille de note : lettre sur fond coloré (le texte reste sombre, lisible sur tous les thèmes)
export function GradeBadge({ grade, size = 40, title }) {
  if (!grade) return <span className="grade grade-none" style={{ width: size, height: size, fontSize: size * 0.5 }} title={title}>-</span>;
  return <span className={`grade g-${grade}`} style={{ width: size, height: size, fontSize: size * 0.55 }} title={title || GRADE_LABEL[grade]} aria-label={`Note ${grade}, ${GRADE_LABEL[grade]}`}>{grade}</span>;
}

// Tableau des critères : une ligne par lettre, la tienne en surbrillance
export function CriteriaTable({ rows, current, note }) {
  return (
    <div className="crit">
      {rows.map((r) => (
        <div key={r.grade} className={`crit-row ${current === r.grade ? 'on' : ''}`}>
          <GradeBadge grade={r.grade} size={28} />
          <span className="crit-l">{r.label}</span>
          <span className="crit-t">{r.text}</span>
        </div>
      ))}
      {note && <div className="small muted" style={{ lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

// Bouton « Voir les critères » qui déplie le tableau
export function CriteriaToggle({ rows, current, what, note, label = 'Voir les critères de notation' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="col" style={{ gap: 8 }}>
      <button className="small" onClick={() => setOpen(!open)} aria-expanded={open} style={{ color: 'var(--accent)', fontWeight: 700, textAlign: 'left', minHeight: 36 }}>
        {open ? 'Masquer les critères' : label}
      </button>
      {open && (<>
        {what && <div className="small" style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>{what}</div>}
        <CriteriaTable rows={rows} current={current} note={note} />
      </>)}
    </div>
  );
}
