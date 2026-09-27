import React, { useMemo, useState } from 'react';
import { Avatar, Icon, Seg } from '../components/ui.jsx';
import { Heatmap } from '../components/Dartboard.jsx';
import { LineChart, MultiLineChart } from '../components/LineChart.jsx';
import { playerStats, filterByPeriod, headToHead, trainingResult } from '../engine/stats.js';
import { MODE_LABEL, isTraining } from '../engine/modes.js';
import { gameWinner, legsWon } from '../engine/runner.js';
import { fmt1, pct, shortDate } from '../lib/store.js';
import { modeSubtitle, modeTitle } from './Play.jsx';

const realGames = (games) => games.filter((g) => !isTraining(g.mode));

function gameLine(g, byId) {
  const names = g.player_ids.map((id) => byId[id]?.name || '?');
  const who = names.length <= 3 ? names.join(', ') : `${names.length} joueurs`;
  return `${MODE_LABEL[g.mode] === 'X01' ? g.settings.start : MODE_LABEL[g.mode]} · ${who}`;
}
function gameResult(g, byId) {
  const w = gameWinner(g);
  const legs = g.data.legs.filter((l) => l.done).length;
  if (!legs) return 'abandonnée';
  if (g.player_ids.length === 2 && legs > 1) {
    const lw = legsWon(g);
    const [a, b] = g.player_ids;
    return `${byId[w]?.name || 'égalité'} ${w ? 'gagne ' : ''}${Math.max(lw[a], lw[b])}–${Math.min(lw[a], lw[b])}`;
  }
  return w ? `${byId[w]?.name} gagne` : 'égalité';
}

export function Home({ me, players, games, current, onNew, onResume, onProfile, goRanking }) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const recent = realGames(games).filter((g) => g.status === 'finished').slice(-4).reverse();
  const st = useMemo(() => (me ? playerStats(filterByPeriod(games, '30j'), me.id) : null), [games, me]);
  return (
    <div className="screen with-tabs">
      <div className="between">
        <div className="h1" style={{ fontSize: 32 }}>Oche</div>
        <button onClick={onProfile} className="row" aria-label="Changer de profil"
          style={{ height: 44, padding: '0 12px 0 6px', borderRadius: 22, background: 'var(--card)', border: '1px solid var(--wire)', fontWeight: 700, gap: 8 }}>
          {me ? <Avatar player={me} /> : <span className="avatar" style={{ background: 'var(--wire)' }}>?</span>}
          {me ? me.name : 'Qui es-tu ?'}<Icon.Chevron />
        </button>
      </div>

      <button onClick={onNew} className="between" style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderRadius: 18, padding: 20, textAlign: 'left' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Nouvelle partie</div>
          <div style={{ fontSize: 13, marginTop: 2 }}>X01, Cricket, Around the Clock, Shanghai</div>
        </div>
        <Icon.Plus width="28" height="28" />
      </button>

      {current && (
        <button onClick={onResume} className="card col" style={{ border: '1px solid var(--card-2)', textAlign: 'left', padding: 16 }}>
          <div className="between">
            <span className="label">{isTraining(current.mode) ? 'Entraînement en cours' : 'Partie en cours'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Reprendre →</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{gameLine(current, byId)}</div>
          <div className="small muted">{modeSubtitle(current)}</div>
        </button>
      )}

      {me && st && (
        <div className="row" style={{ gap: 10 }}>
          <div className="kpi grow">
            <div className="k">Ta moyenne (30 j)</div>
            <div className="v">{fmt1(st.avg)}</div>
            <div className="s">{st.x01Darts} fléchettes en X01</div>
          </div>
          <div className="kpi grow">
            <div className="k">Checkout (30 j)</div>
            <div className="v">{pct(st.checkout)}</div>
            <div className="s">{st.coHits} sur {st.coAttempts} tentatives</div>
          </div>
        </div>
      )}

      <div className="col">
        <div className="between">
          <span className="h3" style={{ fontSize: 16 }}>Dernières parties</span>
          {recent.length > 0 && <button style={{ color: 'var(--accent)', fontSize: 13, minHeight: 32 }} onClick={goRanking}>Tout voir</button>}
        </div>
        {recent.length === 0 && <div className="muted small">Aucune partie pour l'instant. Lance la première !</div>}
        {recent.map((g) => {
          const place = me && g.player_ids.includes(me.id) ? rankOf(g, me.id) : null;
          return (
            <div key={g.id} className="list-item">
              <div className="grow">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{gameLine(g, byId)}</div>
                <div className="small muted">{shortDate(g.created_at)} · {gameResult(g, byId)}</div>
              </div>
              {place && <span style={{ fontSize: 12, fontWeight: 700, color: place === 1 ? 'var(--accent)' : 'var(--muted)' }}>{place === 1 ? '1er' : `${place}e`}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rankOf(g, id) {
  const w = legsWon(g);
  const sorted = [...g.player_ids].sort((a, b) => w[b] - w[a]);
  if (!g.data.legs.some((l) => l.done)) return null;
  if (g.data.legs.filter((l) => l.done).length === 1) {
    const leg = g.data.legs.find((l) => l.done);
    return leg.ranking.indexOf(id) + 1;
  }
  return sorted.indexOf(id) + 1;
}

// ---------------- Stats ----------------

export function Stats({ me, players, games }) {
  const [pid, setPid] = useState(me?.id || players[0]?.id);
  const [period, setPeriod] = useState('30j');
  const [heatMode, setHeatMode] = useState('all');
  const [pickOpen, setPickOpen] = useState(false);
  const [pid2, setPid2] = useState('');
  const player = players.find((p) => p.id === pid);
  const scoped = useMemo(() => filterByPeriod(games, period), [games, period]);
  const s = useMemo(() => (pid ? playerStats(scoped, pid) : null), [scoped, pid]);

  if (!player || !s) return <div className="screen with-tabs"><div className="h1">Stats</div><div className="muted">Pas encore de joueurs.</div></div>;

  const heat = s.heat.filter((h) => heatMode === 'all' || (heatMode === 'train' ? isTraining(h.mode) : h.mode === heatMode));
  const doubles = Object.entries(s.doubles).filter(([, v]) => v.att >= 1).sort((a, b) => b[1].att - a[1].att).slice(0, 6);
  const series = s.series.map((p) => ({ label: new Date(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), value: p.avg }));

  return (
    <div className="screen with-tabs">
      <div className="between">
        <div className="h1">Stats</div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPickOpen(!pickOpen)} className="row" style={{ height: 40, padding: '0 14px', borderRadius: 20, border: '1px solid var(--wire)', background: 'var(--card)', fontWeight: 700, gap: 6 }} aria-haspopup="listbox">
            {player.name}<Icon.Chevron />
          </button>
          {pickOpen && (
            <div role="listbox" style={{ position: 'absolute', right: 0, top: 46, zIndex: 5, background: 'var(--card-2)', borderRadius: 12, padding: 6, minWidth: 160, maxHeight: 320, overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
              {players.map((p) => (
                <button key={p.id} role="option" aria-selected={p.id === pid} onClick={() => { setPid(p.id); setPickOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, fontWeight: p.id === pid ? 800 : 500, color: p.id === pid ? 'var(--accent)' : 'var(--text)' }}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <label className="row" style={{ gap: 10 }}>
        <span className="small" style={{ color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>Comparer avec</span>
        <select className="input grow" style={{ height: 40, fontSize: 15 }} value={pid2} onChange={(e) => setPid2(e.target.value)} aria-label="Comparer avec">
          <option value="">Personne</option>
          {players.filter((p) => p.id !== pid).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <Seg options={[['7j', '7 j'], ['30j', '30 j'], ['1an', '1 an'], ['all', 'Tout']]} value={period} onChange={setPeriod} />

      {pid2 && pid2 !== pid ? <StatsCompare a={player} b={players.find((p) => p.id === pid2)} games={scoped} /> : (<>
      <div className="grid2">
        <div className="kpi"><div className="k">Moyenne (3 fléch.)</div><div className="v">{fmt1(s.avg)}</div><div className="s">X01 · {s.x01Darts} fléchettes</div></div>
        <div className="kpi"><div className="k">Moy. 9 premières</div><div className="v">{fmt1(s.first9)}</div><div className="s">début de leg</div></div>
        <div className="kpi"><div className="k">Checkout</div><div className="v">{pct(s.checkout)}</div><div className="s">{s.coHits} / {s.coAttempts}</div></div>
        <div className="kpi"><div className="k">Meilleur finish</div><div className="v">{s.bestFinish || '-'}</div><div className="s">en X01</div></div>
        <div className="kpi"><div className="k">Gros tours</div><div className="v">{s.c180} × 180</div><div className="s">{s.c140} × 140+ · {s.c100} × 100+</div></div>
        <div className="kpi"><div className="k">Legs gagnés</div><div className="v">{pct(s.winRate)}</div><div className="s">{s.legsWon} sur {s.legsPlayed}</div></div>
        <div className="kpi"><div className="k">Cricket</div><div className="v">{s.mpr == null ? '-' : s.mpr.toFixed(2)}</div><div className="s">marques par tour (MPR)</div></div>
        <div className="kpi"><div className="k">Hors cible</div><div className="v">{pct(s.missRate)}</div><div className="s">{s.totalDarts} fléchettes en tout</div></div>
      </div>

      <div className="panel">
        <div className="between"><span className="h3">Évolution de la moyenne</span><span className="small muted">par partie X01</span></div>
        <LineChart points={series} ariaLabel="Moyenne par partie X01" />
      </div>

      <div className="panel">
        <div className="between"><span className="h3">Heatmap</span><span className="small muted">{heat.length} fléchettes</span></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'Tout'], ['x01', 'X01'], ['cricket', 'Cricket'], ['atc', 'ATC'], ['shanghai', 'Shanghai'], ['train', 'Entraînement']].map(([k, l]) => (
            <button key={k} onClick={() => setHeatMode(k)} aria-pressed={heatMode === k}
              style={{ height: 32, padding: '0 12px', borderRadius: 16, fontSize: 13, fontWeight: 700, background: heatMode === k ? 'var(--accent)' : 'transparent', color: heatMode === k ? 'var(--on-accent)' : 'var(--text-2)', border: heatMode === k ? 'none' : '1px solid var(--wire)' }}>{l}</button>
          ))}
        </div>
        {heat.length ? <Heatmap points={heat} /> : <div className="small muted" style={{ textAlign: 'center', padding: 20 }}>Pas de fléchettes sur cette période.</div>}
      </div>

      <div className="panel">
        <span className="h3">Réussite sur les doubles</span>
        {doubles.length === 0 && <div className="small muted">Apparaît dès que tu joues en sortie double.</div>}
        {doubles.map(([k, v]) => (
          <div key={k} className="row" style={{ fontSize: 13 }}>
            <span style={{ width: 38, fontWeight: 700 }}>{k}</span>
            <div className="grow" style={{ height: 10, background: 'var(--bg)', borderRadius: 5 }}>
              <div style={{ width: `${Math.round((v.hit / v.att) * 100)}%`, height: 10, background: 'var(--accent)', borderRadius: 5 }} />
            </div>
            <span style={{ width: 70, textAlign: 'right' }}>{Math.round((v.hit / v.att) * 100)} % <span className="muted">({v.hit}/{v.att})</span></span>
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}

const CMP_ROWS = [
  ['Moyenne (3 fléch.)', (s) => s.avg, 'high', fmt1],
  ['Moy. 9 premières', (s) => s.first9, 'high', fmt1],
  ['Checkout', (s) => s.checkout, 'high', pct],
  ['Meilleur finish', (s) => s.bestFinish || null, 'high', (v) => v ?? '-'],
  ['180', (s) => s.c180, 'high', (v) => v],
  ['140+', (s) => s.c140, 'high', (v) => v],
  ['100+', (s) => s.c100, 'high', (v) => v],
  ['Legs gagnés', (s) => s.winRate, 'high', pct],
  ['Cricket (MPR)', (s) => s.mpr, 'high', (v) => (v == null ? '-' : v.toFixed(2))],
  ['Hors cible', (s) => s.missRate, 'low', pct],
  ['Parties', (s) => s.gamesPlayed, null, (v) => v],
  ['Fléchettes', (s) => s.totalDarts, null, (v) => v],
];

function StatsCompare({ a, b, games }) {
  const sa = useMemo(() => playerStats(games, a.id), [games, a.id]);
  const sb = useMemo(() => playerStats(games, b.id), [games, b.id]);
  const h2h = useMemo(() => headToHead(realGames(games), a.id, b.id), [games, a.id, b.id]);
  const CA = 'var(--accent)'; const CB = 'var(--sky)';
  const series = [
    { name: a.name, color: '#c8f031', points: sa.series.map((p) => ({ t: new Date(p.date).getTime(), value: p.avg })) },
    { name: b.name, color: '#5fc8ff', points: sb.series.map((p) => ({ t: new Date(p.date).getTime(), value: p.avg })) },
  ];
  return (<>
    <div className="panel">
      <div className="between">
        <span style={{ fontWeight: 800, color: CA }}>{a.name}</span>
        <span className="small muted">face à face</span>
        <span style={{ fontWeight: 800, color: CB }}>{b.name}</span>
      </div>
      {h2h.legs > 0 ? (<>
        <div className="between" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 36, fontWeight: 800 }}>{h2h.a}</span>
          <span className="small muted">legs gagnés l'un contre l'autre</span>
          <span style={{ fontSize: 36, fontWeight: 800 }}>{h2h.b}</span>
        </div>
        <div className="row" style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 0 }}>
          <div style={{ width: `${(h2h.a / h2h.legs) * 100}%`, height: 10, background: CA }} />
          <div style={{ flex: 1, height: 10, background: CB }} />
        </div>
      </>) : <div className="small muted">Pas encore de leg joué l'un contre l'autre sur cette période.</div>}
    </div>

    <div className="panel" style={{ gap: 0, padding: '6px 14px' }}>
      {CMP_ROWS.map(([label, get, better, f]) => {
        const va = get(sa); const vb = get(sb);
        let win = null;
        if (better && va != null && vb != null && va !== vb) win = (better === 'high' ? va > vb : va < vb) ? 'a' : 'b';
        return (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: win === 'a' ? CA : 'var(--text)' }}>{f(va)}</span>
            <span className="small muted" style={{ textAlign: 'center' }}>{label}</span>
            <span style={{ fontSize: 17, fontWeight: 800, textAlign: 'right', color: win === 'b' ? CB : 'var(--text)' }}>{f(vb)}</span>
          </div>
        );
      })}
      <div className="small muted" style={{ padding: '8px 0' }}>En couleur : le meilleur des deux. Stats sur toutes leurs parties de la période, pas seulement l'un contre l'autre.</div>
    </div>

    <div className="panel">
      <div className="between"><span className="h3">Évolution de la moyenne</span>
        <span className="row small" style={{ gap: 10 }}>
          <span className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: CA }} />{a.name}</span>
          <span className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: CB }} />{b.name}</span>
        </span>
      </div>
      <MultiLineChart series={series} ariaLabel={`Moyenne X01 de ${a.name} et ${b.name}`} />
    </div>

    <div className="panel">
      <span className="h3">Heatmaps</span>
      <div className="grid2">
        {[[a, sa, CA], [b, sb, CB]].map(([p, st, c]) => (
          <div key={p.id} className="col" style={{ alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 800, color: c }}>{p.name}</span>
            {st.heat.length ? <Heatmap points={st.heat} /> : <span className="small muted" style={{ padding: 20 }}>Aucune fléchette</span>}
            <span className="small muted">{st.heat.length} fléchettes</span>
          </div>
        ))}
      </div>
    </div>
  </>);
}

// ---------------- Classement ----------------

export function Ranking({ players, games, me }) {
  const [sortBy, setSortBy] = useState('avg');
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const real = realGames(games);
  const rows = useMemo(() => players.map((p) => ({ p, s: playerStats(real, p.id) })).filter((x) => x.s.legsPlayed > 0), [players, games]); // eslint-disable-line
  const key = { avg: (s) => s.avg ?? -1, win: (s) => s.winRate ?? -1, co: (s) => s.checkout ?? -1, mpr: (s) => s.mpr ?? -1 }[sortBy];
  const sorted = [...rows].sort((a, b) => key(b.s) - key(a.s));
  const val = (s) => ({ avg: fmt1(s.avg), win: pct(s.winRate), co: pct(s.checkout), mpr: s.mpr == null ? '-' : s.mpr.toFixed(2) }[sortBy]);

  const [a, setA] = useState(me?.id || sorted[0]?.p.id);
  const [b, setB] = useState(sorted.find((x) => x.p.id !== (me?.id || sorted[0]?.p.id))?.p.id);
  const h2h = useMemo(() => (a && b && a !== b ? headToHead(real, a, b) : null), [a, b, games]); // eslint-disable-line
  const history = [...real].filter((g) => g.data.legs.some((l) => l.done)).reverse().slice(0, 30);

  return (
    <div className="screen with-tabs">
      <div className="h1">Classement</div>
      <Seg options={[['avg', 'Moyenne'], ['win', 'Victoires'], ['co', 'Checkout'], ['mpr', 'Cricket']]} value={sortBy} onChange={setSortBy} />
      <div className="col" style={{ gap: 8 }}>
        {sorted.length === 0 && <div className="muted small">Le classement apparaît après les premières parties.</div>}
        {sorted.map(({ p, s }, i) => (
          <div key={p.id} className="row card" style={i === 0 ? { background: 'var(--accent-bg)', border: '1px solid var(--accent)', padding: '12px 14px' } : { padding: '12px 14px' }}>
            <span className="num-badge" style={{ width: 30, height: 30, ...(i === 0 ? {} : { background: 'var(--card-2)', color: 'var(--text)' }) }}>{i + 1}</span>
            <div className="grow">
              <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
              <div className="small muted">{s.gamesPlayed} parties · {pct(s.winRate)} legs gagnés</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{val(s)}</div>
          </div>
        ))}
      </div>

      {rows.length >= 2 && (
        <div className="panel">
          <span className="h3">Face à face</span>
          <div className="row" style={{ gap: 8 }}>
            <select className="input grow" style={{ height: 40 }} value={a} onChange={(e) => setA(e.target.value)} aria-label="Joueur 1">
              {rows.map(({ p }) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="muted">vs</span>
            <select className="input grow" style={{ height: 40 }} value={b} onChange={(e) => setB(e.target.value)} aria-label="Joueur 2">
              {rows.map(({ p }) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {h2h && h2h.legs > 0 ? (<>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <span style={{ fontSize: 36, fontWeight: 800 }}>{h2h.a}</span>
              <span className="small muted">legs gagnés l'un contre l'autre</span>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-2)' }}>{h2h.b}</span>
            </div>
            <div className="row" style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 0 }}>
              <div style={{ width: `${(h2h.a / h2h.legs) * 100}%`, height: 10, background: 'var(--accent)' }} />
              <div style={{ flex: 1, height: 10, background: '#4a5872' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, fontSize: 13 }}>
              <b>{fmt1(h2h.statsA.avg)}</b><span className="muted" style={{ textAlign: 'center' }}>Moyenne</span><b style={{ textAlign: 'right' }}>{fmt1(h2h.statsB.avg)}</b>
              <b>{pct(h2h.statsA.checkout)}</b><span className="muted" style={{ textAlign: 'center' }}>Checkout</span><b style={{ textAlign: 'right' }}>{pct(h2h.statsB.checkout)}</b>
              <b>{h2h.statsA.bestFinish || '-'}</b><span className="muted" style={{ textAlign: 'center' }}>Best finish</span><b style={{ textAlign: 'right' }}>{h2h.statsB.bestFinish || '-'}</b>
            </div>
          </>) : <div className="small muted">{a === b ? 'Choisis deux joueurs différents.' : 'Ils ne se sont pas encore affrontés.'}</div>}
        </div>
      )}

      <div className="col">
        <span className="h3">Historique</span>
        {history.map((g) => (
          <div key={g.id} className="list-item">
            <div className="grow">
              <div style={{ fontSize: 14, fontWeight: 600 }}>{gameLine(g, byId)}</div>
              <div className="small muted">{shortDate(g.created_at)} · {gameResult(g, byId)}{g.data.legs.filter((l) => l.done).length > 1 ? ` · ${g.data.legs.filter((l) => l.done).length} legs` : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Entraînement ----------------

const DRILLS = [
  ['train-doubles', 'Tour des doubles', 'D1 à D20 puis bull, le moins de fléchettes possible'],
  ['train-focus20', 'Focus 20', '99 fléchettes sur le 20, points marqués'],
  ['train-checkout', 'Checkouts 41-100', '20 finishs au hasard, 3 fléchettes chacun, sortie double'],
];

export function trainingRecords(games, pid) {
  const rec = {};
  for (const g of games) {
    if (!isTraining(g.mode) || !g.player_ids.includes(pid)) continue;
    const r = trainingResult(g);
    if (!r || g.mode === 'train-free') continue;
    const cur = rec[g.mode];
    if (!cur || (r.better === 'low' ? r.value < cur.value : r.value > cur.value)) rec[g.mode] = r;
  }
  return rec;
}

export function Training({ me, games, onStart, onAtc, onProfile }) {
  const [chart, setChart] = useState('train-doubles');
  const rec = useMemo(() => (me ? trainingRecords(games, me.id) : {}), [games, me]);
  const series = useMemo(() => {
    if (!me) return [];
    return games.filter((g) => g.mode === chart && g.player_ids.includes(me.id))
      .map((g) => ({ g, r: trainingResult(g) })).filter((x) => x.r)
      .map(({ g, r }) => ({ label: new Date(g.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), value: r.value }));
  }, [games, me, chart]);

  if (!me) {
    return (
      <div className="screen with-tabs">
        <div className="h1">Entraînement</div>
        <div className="muted">Choisis d'abord qui tu es pour enregistrer tes sessions.</div>
        <button className="btn btn-primary" onClick={onProfile}>Choisir mon profil</button>
      </div>
    );
  }
  return (
    <div className="screen with-tabs">
      <div>
        <div className="h1">Entraînement</div>
        <div className="small muted">Tes sessions solo, comptées dans tes stats</div>
      </div>
      <div className="card col" style={{ padding: 16, gap: 12, border: '1px solid var(--card-2)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Session libre</div>
          <div className="small" style={{ color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>Tu lances où tu veux, l'appli enregistre chaque fléchette pour ta heatmap.</div>
        </div>
        <button className="btn btn-primary" style={{ height: 50 }} onClick={() => onStart('train-free')}>Démarrer</button>
      </div>
      <div className="col">
        <span className="h3">Exercices</span>
        {DRILLS.map(([k, t, d]) => (
          <button key={k} className="list-item" onClick={() => onStart(k)}>
            <div className="grow">
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t}</div>
              <div className="small muted" style={{ marginTop: 2 }}>{d}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">Record</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{rec[k]?.label || '-'}</div>
            </div>
          </button>
        ))}
        <button className="list-item" onClick={onAtc}>
          <div className="grow">
            <div style={{ fontSize: 15, fontWeight: 700 }}>Around the Clock solo</div>
            <div className="small muted" style={{ marginTop: 2 }}>Avec tes réglages ATC habituels</div>
          </div>
          <Icon.Right style={{ color: 'var(--muted)' }} />
        </button>
      </div>
      <div className="panel">
        <span className="h3">Ta progression</span>
        <Seg options={[['train-doubles', 'Doubles'], ['train-focus20', 'Focus 20'], ['train-checkout', 'Checkouts']]} value={chart} onChange={setChart} />
        <LineChart points={series} height={120} ariaLabel="Progression" />
        {chart === 'train-doubles' && series.length > 1 && <div className="small muted">Moins de fléchettes = mieux</div>}
      </div>
    </div>
  );
}
