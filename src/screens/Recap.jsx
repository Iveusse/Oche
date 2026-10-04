import React, { useEffect, useMemo, useState } from 'react';
import { Icon, Sheet } from '../components/ui.jsx';
import { computeRecap, drawRecap, mainGroup, recapDays, sessionOfDay } from '../lib/recap.js';
import { computePersonalWeekly, computeWeekly, weekStartOf } from '../lib/weekly.js';
import { Seg } from '../components/ui.jsx';

export function RecapSheet({ games, players, onClose, weekly = false, meId }) {
  const [view, setView] = useState('global'); // semaine : global ou perso
  const [who, setWho] = useState(() => (players.some((p) => p.id === meId) ? meId : players[0]?.id));
  // le lundi, la semaine qui vient de commencer est vide : on ouvre directement la précédente
  const [wk, setWk] = useState(() => (weekly && new Date().getDay() === 1 ? 'prev' : 'cur'));
  const title = weekly ? (view === 'perso' ? 'Ma semaine' : 'Palmarès de la semaine') : 'Récap de la soirée';
  const days = useMemo(() => (weekly ? [] : recapDays(games)), [games, weekly]);
  const [day, setDay] = useState(() => days[0]?.key || '');
  const [off, setOff] = useState(() => { const d = days[0]; if (!d) return []; const g = mainGroup(d.games); return [...d.pids].filter((id) => !g.includes(id)); }); // joueurs décochés
  const dayInfo = days.find((d) => d.key === day);
  const dayPlayers = dayInfo ? players.filter((p) => dayInfo.pids.has(p.id)) : [];
  const pids = useMemo(() => new Set(dayPlayers.map((p) => p.id).filter((id) => !off.includes(id))), [dayInfo, off, players]); // eslint-disable-line react-hooks/exhaustive-deps
  const recap = useMemo(() => {
    if (!weekly) return day ? computeRecap(games, players, sessionOfDay(games, day, pids), pids) : null;
    const s = weekStartOf(); if (wk === 'prev') s.setDate(s.getDate() - 7);
    return view === 'perso' ? computePersonalWeekly(games, players, who, s) : computeWeekly(games, players, s);
  }, [games, players, weekly, wk, day, pids, view, who]);
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
    const file = new File([img.blob], `oche-${weekly ? (view === 'perso' ? 'perso' : 'semaine') : 'soiree'}-${recap.date.toISOString().slice(0, 10)}.png`, { type: 'image/png' });
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
      {weekly && <Seg options={[['global', 'Global'], ['perso', 'Perso']]} value={view} onChange={setView} />}
      {weekly && view === 'perso' && (
        <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Joueur du bilan perso">
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {!weekly && days.length > 0 && (<>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Jour</span>
          <select className="input" value={day} onChange={(e) => { const d = days.find((x) => x.key === e.target.value); setDay(e.target.value); const g = mainGroup(d.games); setOff([...d.pids].filter((id) => !g.includes(id))); }} aria-label="Jour de la soirée">
            {days.map((d) => <option key={d.key} value={d.key}>{d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {d.games.length} partie{d.games.length > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Joueurs</span>
          <div className="chips-scroll" style={{ flexWrap: 'wrap' }}>
            {dayPlayers.map((p) => {
              const on = !off.includes(p.id);
              return <button key={p.id} className={`chip-pill ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setOff(on ? [...off, p.id] : off.filter((x) => x !== p.id))}>{p.name}</button>;
            })}
          </div>
        </div>
        {recap && <div className="small muted">{recap.games} partie{recap.games > 1 ? 's' : ''} {pids && pids.size === 1 ? 'jouée' + (recap.games > 1 ? 's' : '') + ' par ce joueur (victoires contre tous ses adversaires)' : 'où tous ces joueurs ont joué'}</div>}
      </>)}
      {!recap ? <div className="muted">{weekly ? (view === 'perso' ? 'Aucune partie terminée par ce joueur sur cette semaine.' : 'Aucune partie terminée sur cette semaine.') : days.length ? 'Aucune partie où tous ces joueurs ont joué ce jour-là.' : 'Pas encore de partie terminée.'}</div> : (<>
        {img ? <img src={img.url} alt={title} className="recap-img" /> : <div className="muted small">Préparation de l'image…</div>}
        <button className="btn btn-primary" onClick={share} disabled={!img}><Icon.Share />Partager sur le groupe</button>
        {msg && <div className="small muted" style={{ textAlign: 'center' }}>{msg}</div>}
      </>)}
    </Sheet>
  );
}
