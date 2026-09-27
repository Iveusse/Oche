import React, { useMemo, useState } from 'react';
import { Seg } from '../components/ui.jsx';
import { Delta, HBars, HeatStrip, Ring, Sparkline, StackBar, VBars } from '../components/Charts.jsx';
import { TURN_BUCKETS, atcAdvanced, cricketAdvanced, shanghaiAdvanced, x01Advanced } from '../engine/advanced.js';
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

function X01View({ games, prevGames, pid }) {
  const [start, setStart] = useState('all');
  const a = useMemo(() => x01Advanced(games, pid, start), [games, pid, start]);
  const b = useMemo(() => (prevGames ? x01Advanced(prevGames, pid, start) : null), [prevGames, pid, start]);
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
          <Mini k="Temps de jeu" v={dur(a.duration.total)} s={a.duration.avg ? `${dur(a.duration.avg)} / partie` : ''} />
        </div>
      </Card>

      <Card title="Moyenne par sortie">
        <HBars rows={[['Simple', 'single'], ['Double', 'double'], ['Master', 'master']].map(([l, k]) => ({ label: l, value: a.avgOut[k] || 0, sub: f1(a.avgOut[k]) }))} />
      </Card>
    </>)}
  </>);
}

function CricketView({ games, prevGames, pid }) {
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
  </>);
}

function ShanghaiView({ games, prevGames, pid }) {
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
  </>);
}

function AtcView({ games, prevGames, pid }) {
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
    <View games={cur} prevGames={prev} pid={pid} />
  </>);
}
