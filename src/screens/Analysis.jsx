import React, { useMemo, useState } from 'react';
import { Seg } from '../components/ui.jsx';
import { Delta, HBars, HeatStrip, Ring, Sparkline, StackBar, VBars } from '../components/Charts.jsx';
import { ALT_BUCKETS, TURN_BUCKETS, atcAdvanced, cricketAdvanced, shanghaiAdvanced, x01Advanced } from '../engine/advanced.js';
import { playerStats } from '../engine/stats.js';
import { CRICKET_NUMS } from '../engine/modes.js';

const DAY = 86400000;
const PERIODS = [['7', '7 j'], ['30', '30 j'], ['90', '3 mois'], ['365', '1 an'], ['all', 'Tout']];

function window(games, period) {
  if (period === 'all') return { cur: games, prev: null };
  const d = Number(period) * DAY; const now = Date.now();
  const t = (g) => new Date(g.created_at).getTime();
  return { cur: games.filter((g) => t(g) >= now - d), prev: games.filter((g) => t(g) >= now - 2 * d && t(g) < now - d) };
}

const f1 = (v) => (v == null ? '-' : v.toFixed(1));
const f0 = (v) => (v == null ? '-' : Math.round(v).toString());
const pc = (v) => (v == null ? '-' : `${Math.round(v * 100)} %`);
const dur = (ms) => { if (!ms) return '-'; const h = Math.floor(ms / 3600000); const m = Math.round((ms % 3600000) / 60000); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
const diff = (a, b) => (a == null || b == null ? null : a - b);

function Hero({ label, value, unit, delta, deltaSuffix, invert, spark, children }) {
  return (
    <div className="hero">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="label">{label}</div>
          <div className="hero-v">{value}<span className="hero-u">{unit}</span></div>
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} invert={invert} />}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      {children && <div className="hero-sub">{children}</div>}
    </div>
  );
}

function Mini({ k, v, s }) {
  return <div className="mini"><div className="v">{v}</div><div className="k">{k}</div>{s && <div className="s">{s}</div>}</div>;
}

function Card({ title, sub, children }) {
  return (
    <div className="panel">
      <div className="between"><span className="h3">{title}</span>{sub && <span className="small muted">{sub}</span>}</div>
      {children}
    </div>
  );
}

function Empty({ what }) {
  return <div className="panel" style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}><div className="h3">Pas encore de {what} sur cette période</div><div className="small muted">Élargis la période ou joue une partie !</div></div>;
}

const n0 = (v) => (v == null ? '-' : v.toLocaleString('fr-FR'));
const frac = (h, a) => (a ? `${h}/${a}` : '-');
const cnt = (n, tot) => (tot ? <span className="two"><b>{Math.round((n / tot) * 100)} %</b><small>{n.toLocaleString('fr-FR')}</small></span> : '-');

// Tableau complet : sections de lignes, une colonne par jeu de données
function FullTable({ sections, cols }) {
  const [open, setOpen] = useState(false);
  const total = sections.reduce((a, [, rows]) => a + rows.length, 0);
  return (
    <div className="panel">
      <button className="between" onClick={() => setOpen(!open)} aria-expanded={open} style={{ minHeight: 40, textAlign: 'left' }}>
        <span className="h3">Tableau complet</span>
        <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{open ? 'Replier' : `Voir les ${total} stats`}</span>
      </button>
      {open && (
        <div className="ftable" style={{ '--cols': cols.length }}>
          <div className="frow fhead"><span />{cols.map((c) => <span key={c.label}>{c.label}</span>)}</div>
          {sections.map(([title, rows]) => (
            <React.Fragment key={title}>
              <div className="fsec">{title}</div>
              {rows.map(([label, fn]) => (
                <div className="frow" key={title + label}>
                  <span className="fl">{label}</span>
                  {cols.map((c) => <span key={c.label}>{c.data ? fn(c.data) : '-'}</span>)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function colsFor(cur, prev, all, period) {
  const lbl = PERIODS.find((p) => p[0] === period)[1];
  if (period === 'all') return [{ label: 'Tout', data: all }];
  return [{ label: lbl, data: cur }, { label: 'Avant', data: prev }, { label: 'Tout', data: all }];
}

const X01_SECTIONS = [
  ['Général', [
    ['Legs', (a) => a.legs], ['Legs gagnés', (a) => a.won], ['% de victoire', (a) => pc(a.winRate)], ['Fléchettes', (a) => n0(a.darts)],
    ['Fléch. / leg gagné', (a) => f1(a.dartsPerLeg)], ['Temps de jeu', (a) => dur(a.duration.total)], ['Temps / partie', (a) => dur(a.duration.avg)], ['Temps / leg', (a) => dur(a.duration.perLeg)],
  ]],
  ['Moyenne 3 fléchettes', [
    ['Toutes', (a) => f1(a.avgAll)], ['Sortie simple', (a) => f1(a.avgOut.single)], ['Sortie double', (a) => f1(a.avgOut.double)], ['Sortie master', (a) => f1(a.avgOut.master)],
    ['9 premières', (a) => f1(a.avgFirst[9])], ['12 premières', (a) => f1(a.avgFirst[12])], ['15 premières', (a) => f1(a.avgFirst[15])],
    ['Tant que > 170', (a) => f1(a.avgUntil[170])], ['Tant que > 100', (a) => f1(a.avgUntil[100])],
  ]],
  ['Checkout', [
    ['Checkout moyen', (a) => f0(a.coAvg)], ['Meilleur checkout', (a) => a.coHigh ?? '-'], ['Réussis / tentés', (a) => frac(a.coHit, a.coAtt)], ['Taux', (a) => pc(a.coRate)],
    ['Doubles réussis / tentés', (a) => frac(a.dblHit, a.dblAtt)], ['Taux sur double', (a) => pc(a.dblRate)],
  ]],
  ['Records', [
    ['Leg le plus court', (a) => a.bestLeg ?? '-'], ['Meilleure moyenne de leg', (a) => f1(a.bestLegAvg)], ['Meilleur tour', (a) => a.high || '-'],
  ]],
  ['Tours par tranche', TURN_BUCKETS.map(([l], i) => [l, (a) => cnt(a.buckets[i], a.turns)])],
  ['Tranches alternatives', ALT_BUCKETS.map(([l], i) => [l, (a) => cnt(a.alt[i], a.turns)])],
  ['Moyenne par tour du leg', Array.from({ length: 10 }, (_, i) => [`Tour ${i + 1}`, (a) => f1(a.roundAvg[i])])],
  ['Reste moyen après', [3, 6, 9, 12, 15].map((k) => [`${k} fléchettes`, (a) => f0(a.remAfterAvg[k])])],
];

const CRICKET_SECTIONS = [
  ['Général', [['Legs', (a) => a.legs], ['Legs gagnés', (a) => a.won], ['% de victoire', (a) => pc(a.winRate)], ['Temps de jeu', (a) => dur(a.duration.total)], ['MPR', (a) => (a.mpr == null ? '-' : a.mpr.toFixed(2))]]],
  ['Précision', [['Touches', (a) => pc(a.pct.hit)], ['Triples', (a) => pc(a.pct.t)], ['Doubles', (a) => pc(a.pct.d)], ['Simples', (a) => pc(a.pct.s)], ['Hors numéros', (a) => pc(a.pct.miss)]]],
  ['Fléchettes', [['Lancées', (a) => n0(a.darts)], ['Touches', (a) => n0(a.darts - a.miss)], ['Triples', (a) => a.t], ['Doubles', (a) => a.d], ['Simples', (a) => a.sgl], ['Hors numéros', (a) => a.miss]]],
  ['Points', [['Moyenne / leg', (a) => f0(a.ptsAvg)], ['Max points', (a) => a.maxPts], ['Max triples / leg', (a) => a.maxT], ['Max doubles / leg', (a) => a.maxD], ['Max simples / leg', (a) => a.maxS]]],
  ['Gros tours', [['9 marques', (a) => a.m9], ['7-8 marques', (a) => a.m7], ['5-6 marques', (a) => a.m5]]],
  ['Marques / leg par numéro', CRICKET_NUMS.map((n) => [n === 25 ? 'Bull' : String(n), (a) => f1(a.perNumAvg[n])])],
  ['Touches par numéro', CRICKET_NUMS.map((n) => [n === 25 ? 'Bull' : String(n), (a) => a.hitsNum[n]])],
];

const SH_NUMS = Array.from({ length: 20 }, (_, i) => i + 1);
const SHANGHAI_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], ['% de victoire', (a) => pc(a.winRate)], ['Shanghais', (a) => a.shanghais], ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Points', [['Moyenne / partie', (a) => f0(a.ptsAvg)], ['Meilleur 1 à 7', (a) => a.best7 ?? '-'], ['Meilleur 1 à 20', (a) => a.best20 ?? '-']]],
  ['Fléchettes', [['Tentatives', (a) => n0(a.darts)], ['Triples', (a) => a.t], ['Doubles', (a) => a.d], ['Simples', (a) => a.sgl], ['Ratées', (a) => a.miss]]],
  ['Précision', [['Touches', (a) => pc(a.pct.hit)], ['Triples', (a) => pc(a.pct.t)], ['Doubles', (a) => pc(a.pct.d)], ['Simples', (a) => pc(a.pct.s)], ['Ratées', (a) => pc(a.pct.miss)]]],
  ['Précision par numéro', SH_NUMS.map((n) => [String(n), (a) => pc(a.numAcc[n])])],
  ['Points moyens par numéro', SH_NUMS.map((n) => [String(n), (a) => f1(a.numPts[n])])],
  ['Shanghais par numéro', SH_NUMS.map((n) => [String(n), (a) => a.num[n].sh])],
];

const ATC_NUMS = [...SH_NUMS, 25];
const ATC_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], ['% de victoire', (a) => pc(a.winRate)], ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Fléchettes', [['Lancées', (a) => n0(a.darts)], ['Touches', (a) => n0(a.hits)], ['Précision', (a) => pc(a.acc)], ['Moy. pour finir', (a) => f0(a.finAvg)], ['Record', (a) => a.best ?? '-']]],
  ['Précision par numéro', ATC_NUMS.map((n) => [n === 25 ? 'Bull' : String(n), (a) => pc(a.numAcc[n])])],
];

function X01View({ games, prevGames, allGames, period, pid }) {
  const [start, setStart] = useState('all');
  const a = useMemo(() => x01Advanced(games, pid, start), [games, pid, start]);
  const b = useMemo(() => (prevGames ? x01Advanced(prevGames, pid, start) : null), [prevGames, pid, start]);
  const all = useMemo(() => x01Advanced(allGames, pid, start), [allGames, pid, start]);
  const series = useMemo(() => playerStats(games.filter((g) => g.mode === 'x01' && (start === 'all' || String(g.settings?.start) === start)), pid).series.slice(-20).map((p) => p.avg), [games, pid, start]);
  return (<>
    <Seg options={[['all', 'Tous'], ['301', '301'], ['501', '501'], ['701', '701']]} value={start} onChange={setStart} />
    {!a.legs ? <Empty what="leg de X01" /> : (<>
      <Hero label="Moyenne 3 fléchettes" value={f1(a.avgAll)} delta={b ? diff(a.avgAll, b.avgAll) : undefined} spark={series}>
        <Mini k="9 premières" v={f1(a.avgFirst[9])} />
        <Mini k="Legs gagnés" v={pc(a.winRate)} s={`${a.won} / ${a.legs}`} />
        <Mini k="Fléch. / leg gagné" v={f1(a.dartsPerLeg)} />
      </Hero>

      <Card title="Profil de scoring" sub={`${a.turns} tours`}>
        <HBars rows={TURN_BUCKETS.map(([label], i) => ({ label, value: a.turns ? a.buckets[i] / a.turns : 0, sub: `${a.buckets[i]} · ${a.turns ? Math.round((a.buckets[i] / a.turns) * 100) : 0} %` }))} />
      </Card>

      <Card title="Ta courbe dans le leg" sub={`pointillés = ta moyenne (${f1(a.avgAll)})`}>
        <VBars data={a.roundAvg.map((v, i) => ({ label: `T${i + 1}`, value: v }))} refValue={a.avgAll} refLabel={`moy. ${f1(a.avgAll)}`} />
        <div className="small muted">Touche une colonne pour voir sa valeur. Si ça baisse à la fin, c'est la pression du finish.</div>
      </Card>

      <Card title="Course vers le zéro" sub="reste moyen">
        <VBars data={[3, 6, 9, 12, 15].map((k) => ({ label: `${k} fl.`, value: a.remAfterAvg[k] }))} fmt={(v) => v.toFixed(0)} />
        <div className="grid2">
          <Mini k="Moy. tant que > 170" v={f1(a.avgUntil[170])} />
          <Mini k="Moy. tant que > 100" v={f1(a.avgUntil[100])} />
        </div>
      </Card>

      <Card title="Checkout">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={a.coRate} label="Taux de checkout" />
          <div className="grid2 grow">
            <Mini k="Checkout moyen" v={f0(a.coAvg)} />
            <Mini k="Meilleur" v={a.coHigh ?? '-'} />
            <Mini k="Tentatives" v={`${a.coHit}/${a.coAtt}`} />
            <Mini k="Sur double" v={pc(a.dblRate)} s={`${a.dblHit}/${a.dblAtt}`} />
          </div>
        </div>
        {b && <div className="small"><span className="muted">vs période d'avant : </span><Delta value={diff(a.coRate, b.coRate) == null ? null : diff(a.coRate, b.coRate) * 100} digits={0} suffix=" pts" /></div>}
      </Card>

      <Card title="Records">
        <div className="records">
          <Mini k="Leg le plus court" v={a.bestLeg ?? '-'} s="fléchettes" />
          <Mini k="Meilleur leg" v={f1(a.bestLegAvg)} s="de moyenne" />
          <Mini k="Meilleur tour" v={a.high || '-'} />
          <Mini k="Temps de jeu" v={dur(a.duration.total)} s={a.duration.perLeg ? `${dur(a.duration.perLeg)} / leg` : ''} />
        </div>
      </Card>

      <Card title="Moyenne par sortie">
        <HBars rows={[['Simple', 'single'], ['Double', 'double'], ['Master', 'master']].map(([l, k]) => ({ label: l, value: a.avgOut[k] || 0, sub: f1(a.avgOut[k]) }))} />
      </Card>
      <FullTable sections={X01_SECTIONS} cols={colsFor(a, b, all, period)} />
    </>)}
  </>);
}

function CricketView({ games, prevGames, allGames, period, pid }) {
  const all = useMemo(() => cricketAdvanced(allGames, pid), [allGames, pid]);
  const a = useMemo(() => cricketAdvanced(games, pid), [games, pid]);
  const b = useMemo(() => (prevGames ? cricketAdvanced(prevGames, pid) : null), [prevGames, pid]);
  if (!a.legs) return <Empty what="partie de Cricket" />;
  return (<>
    <Hero label="Marques par tour (MPR)" value={a.mpr == null ? '-' : a.mpr.toFixed(2)} delta={b ? diff(a.mpr, b.mpr) : undefined}>
      <Mini k="Legs gagnés" v={pc(a.winRate)} s={`${a.won} / ${a.legs}`} />
      <Mini k="Points / leg" v={f0(a.ptsAvg)} />
      <Mini k="Max points" v={a.maxPts} />
    </Hero>
    <Card title="Où vont tes fléchettes" sub={`${a.darts} fléchettes`}>
      <StackBar parts={[
        { label: 'Triples', value: a.t, color: 'var(--accent)' },
        { label: 'Doubles', value: a.d, color: 'var(--sky)' },
        { label: 'Simples', value: a.sgl, color: 'var(--text-2)' },
        { label: 'Hors numéros', value: a.miss, color: 'var(--wire)' },
      ]} />
    </Card>
    <Card title="Marques par numéro" sub="moyenne par leg">
      <VBars data={CRICKET_NUMS.map((n) => ({ label: n === 25 ? 'B' : String(n), value: a.perNumAvg[n] }))} fmt={(v) => v.toFixed(1)} />
    </Card>
    <Card title="Gros tours">
      <div className="records">
        <Mini k="9 marques" v={a.m9} />
        <Mini k="7-8 marques" v={a.m7} />
        <Mini k="5-6 marques" v={a.m5} />
        <Mini k="Temps de jeu" v={dur(a.duration.total)} />
      </div>
    </Card>
    <FullTable sections={CRICKET_SECTIONS} cols={colsFor(a, b, all, period)} />
  </>);
}

function ShanghaiView({ games, prevGames, allGames, period, pid }) {
  const all = useMemo(() => shanghaiAdvanced(allGames, pid), [allGames, pid]);
  const a = useMemo(() => shanghaiAdvanced(games, pid), [games, pid]);
  const b = useMemo(() => (prevGames ? shanghaiAdvanced(prevGames, pid) : null), [prevGames, pid]);
  if (!a.legs) return <Empty what="partie de Shanghai" />;
  const played = Object.entries(a.num).filter(([, c]) => c.darts > 0).map(([k]) => Number(k));
  const maxN = Math.max(7, ...played);
  return (<>
    <Hero label="Précision sur la cible" value={a.pct.hit == null ? '-' : Math.round(a.pct.hit * 100)} unit=" %" delta={b && b.pct.hit != null && a.pct.hit != null ? (a.pct.hit - b.pct.hit) * 100 : undefined} deltaSuffix=" pts">
      <Mini k="Points / partie" v={f0(a.ptsAvg)} />
      <Mini k="Victoires" v={pc(a.winRate)} s={`${a.won} / ${a.legs}`} />
      <Mini k="Shanghais" v={a.shanghais} />
    </Hero>
    <Card title="Précision par numéro" sub="% de fléchettes dans le numéro">
      <HeatStrip cells={Array.from({ length: maxN }, (_, i) => i + 1).map((n) => ({
        label: String(n), value: a.numAcc[n],
        detail: a.num[n].darts ? `${n} : ${a.num[n].hits} touches sur ${a.num[n].darts} fléchettes, ${f1(a.numPts[n])} pts par manche en moyenne` : null,
      }))} />
    </Card>
    <Card title="Qualité des touches">
      <StackBar parts={[
        { label: 'Triples', value: a.t, color: 'var(--accent)' },
        { label: 'Doubles', value: a.d, color: 'var(--sky)' },
        { label: 'Simples', value: a.sgl, color: 'var(--text-2)' },
        { label: 'Ratées', value: a.miss, color: 'var(--wire)' },
      ]} />
    </Card>
    <Card title="Records">
      <div className="records">
        <Mini k="Meilleur 1 à 7" v={a.best7 ?? '-'} s="points" />
        <Mini k="Meilleur 1 à 20" v={a.best20 ?? '-'} s="points" />
        <Mini k="Fléchettes" v={a.darts} />
        <Mini k="Temps de jeu" v={dur(a.duration.total)} />
      </div>
    </Card>
    <FullTable sections={SHANGHAI_SECTIONS} cols={colsFor(a, b, all, period)} />
  </>);
}

function AtcView({ games, prevGames, allGames, period, pid }) {
  const all = useMemo(() => atcAdvanced(allGames, pid), [allGames, pid]);
  const a = useMemo(() => atcAdvanced(games, pid), [games, pid]);
  const b = useMemo(() => (prevGames ? atcAdvanced(prevGames, pid) : null), [prevGames, pid]);
  if (!a.legs) return <Empty what="partie d'Around the Clock" />;
  return (<>
    <Hero label="Fléchettes pour finir" value={f0(a.finAvg)} delta={b ? diff(a.finAvg, b.finAvg) : undefined} invert>
      <Mini k="Précision" v={pc(a.acc)} />
      <Mini k="Record" v={a.best ?? '-'} s="fléchettes" />
      <Mini k="Victoires" v={pc(a.winRate)} s={`${a.won} / ${a.legs}`} />
    </Hero>
    <Card title="Précision par numéro" sub="% de fléchettes qui valident">
      <HeatStrip cells={[...Array.from({ length: 20 }, (_, i) => i + 1), 25].map((n) => ({
        label: n === 25 ? 'B' : String(n), value: a.numAcc[n],
        detail: a.num[n].darts ? `${n === 25 ? 'Bull' : n} : ${a.num[n].hits} sur ${a.num[n].darts} fléchettes` : null,
      }))} />
      <div className="small muted">Les numéros les plus pâles sont ceux qui te coûtent le plus de fléchettes.</div>
    </Card>
    <FullTable sections={ATC_SECTIONS} cols={colsFor(a, b, all, period)} />
  </>);
}

export function Analysis({ games, pid }) {
  const [period, setPeriod] = useState('90');
  const [mode, setMode] = useState('x01');
  const { cur, prev } = useMemo(() => window(games, period), [games, period]);
  const View = { x01: X01View, cricket: CricketView, shanghai: ShanghaiView, atc: AtcView }[mode];
  return (<>
    <div className="chips-scroll">
      {PERIODS.map(([k, l]) => <button key={k} className={`chip-pill ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)} aria-pressed={period === k}>{l}</button>)}
    </div>
    <div className="mode-tabs">
      {[['x01', 'X01'], ['cricket', 'Cricket'], ['shanghai', 'Shanghai'], ['atc', 'ATC']].map(([k, l]) => (
        <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)} aria-pressed={mode === k}>{l}</button>
      ))}
    </div>
    {prev && <div className="small muted" style={{ marginTop: -6 }}>Les flèches comparent avec les {PERIODS.find((p) => p[0] === period)[1]} d'avant.</div>}
    <View games={cur} prevGames={prev} allGames={games} period={period} pid={pid} />
  </>);
}
