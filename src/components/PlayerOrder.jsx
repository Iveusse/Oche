import React, { useRef, useState } from 'react';
import { Icon } from './ui.jsx';

const ROW = 58; // hauteur de ligne + espace

// Liste ordonnée des joueurs, réordonnable en glissant la poignée.
export function PlayerOrder({ ids, players, meId, onChange, removable = true, badge }) {
  const [drag, setDrag] = useState(null); // {id, startY, dy}
  const listRef = useRef(null);
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));

  const start = (e, id) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id, startY: e.clientY, dy: 0 });
  };
  const move = (e) => {
    if (!drag) return;
    setDrag({ ...drag, dy: e.clientY - drag.startY });
  };
  const end = () => {
    if (!drag) return;
    const from = ids.indexOf(drag.id);
    const to = Math.max(0, Math.min(ids.length - 1, from + Math.round(drag.dy / ROW)));
    if (to !== from) {
      const next = ids.filter((x) => x !== drag.id);
      next.splice(to, 0, drag.id);
      onChange(next);
    }
    setDrag(null);
  };

  // position visuelle pendant le glisser
  let preview = ids;
  if (drag) {
    const from = ids.indexOf(drag.id);
    const to = Math.max(0, Math.min(ids.length - 1, from + Math.round(drag.dy / ROW)));
    preview = ids.filter((x) => x !== drag.id);
    preview.splice(to, 0, drag.id);
  }

  return (
    <div className="col" style={{ gap: 6, position: 'relative' }} ref={listRef}>
      {ids.map((id) => {
        const p = byId[id];
        if (!p) return null;
        const isDrag = drag?.id === id;
        const offset = isDrag ? drag.dy : (preview.indexOf(id) - ids.indexOf(id)) * ROW;
        return (
          <div
            key={id}
            className={`player-row ${isDrag ? 'dragging' : ''}`}
            style={{ transform: `translateY(${offset}px)`, transition: isDrag ? 'none' : 'transform .15s' }}
          >
            <span className="num-badge">{(badge ? badge(id) : preview.indexOf(id) + 1)}</span>
            <span className="grow" style={{ fontSize: 15, fontWeight: 700 }}>
              {p.name}{id === meId && <span className="tag-me">toi</span>}
            </span>
            {removable && (
              <button className="icon-btn" style={{ background: 'transparent', color: 'var(--muted)' }} aria-label={`Retirer ${p.name}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
                <Icon.X />
              </button>
            )}
            <span
              className="handle" aria-label={`Déplacer ${p.name}`} role="button"
              onPointerDown={(e) => start(e, id)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
            >
              <Icon.Grip />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
