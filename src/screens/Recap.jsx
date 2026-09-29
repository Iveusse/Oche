import React, { useEffect, useMemo, useState } from 'react';
import { Icon, Sheet } from '../components/ui.jsx';
import { computeRecap, drawRecap } from '../lib/recap.js';
import { computeWeekly, weekStartOf } from '../lib/weekly.js';
import { Seg } from '../components/ui.jsx';

export function RecapSheet({ games, players, onClose, weekly = false }) {
  // le lundi, la semaine qui vient de commencer est vide : on ouvre directement la précédente
  const [wk, setWk] = useState(() => (weekly && new Date().getDay() === 1 ? 'prev' : 'cur'));
  const title = weekly ? 'Palmarès de la semaine' : 'Récap de la soirée';
  const recap = useMemo(() => {
    if (!weekly) return computeRecap(games, players);
    const s = weekStartOf(); if (wk === 'prev') s.setDate(s.getDate() - 7);
    return computeWeekly(games, players, s);
  }, [games, players, weekly, wk]);
  const [img, setImg] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!recap) return undefined;
    let url = null;
    drawRecap(recap).toBlob((b) => { url = URL.createObjectURL(b); setImg({ url, blob: b }); }, 'image/png');
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [recap]);

  const share = async () => {
    if (!img) return;
    const file = new File([img.blob], `oche-${weekly ? 'semaine' : 'soiree'}-${recap.date.toISOString().slice(0, 10)}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = img.url; a.download = file.name; a.click();
    setMsg('Image téléchargée.');
  };

  return (
    <Sheet onClose={onClose} label={title}>
      <div className="between">
        <span className="h2">{title}</span>
        <button style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 44 }} onClick={onClose}>OK</button>
      </div>
      {weekly && <Seg options={[['cur', 'Cette semaine'], ['prev', 'La précédente']]} value={wk} onChange={setWk} />}
      {!recap ? <div className="muted">{weekly ? 'Aucune partie terminée sur cette semaine.' : 'Pas encore de partie terminée.'}</div> : (<>
        {img ? <img src={img.url} alt={title} className="recap-img" /> : <div className="muted small">Préparation de l'image…</div>}
        <button className="btn btn-primary" onClick={share} disabled={!img}><Icon.Share />Partager sur le groupe</button>
        {msg && <div className="small muted" style={{ textAlign: 'center' }}>{msg}</div>}
      </>)}
    </Sheet>
  );
}
