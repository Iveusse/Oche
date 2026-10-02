import React, { useMemo, useState } from 'react';
import { Seg } from '../components/ui.jsx';
import { Delta, HBars, HeatStrip, Ring, Sparkline, StackBar, VBars } from '../components/Charts.jsx';
import { ALT_BUCKETS, TURN_BUCKETS, atcAdvanced, baseballAdvanced, cricketAdvanced, killerAdvanced, shanghaiAdvanced, x01Advanced } from '../engine/advanced.js';
import { playerStats } from '../engine/stats.js';
import { CRICKET_NUMS, startOf } from '../engine/modes.js';

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
// Sens d'une stat : up = plus c'est haut mieux c'est, dn = l'inverse. Sans sens : neutre (volumes, temps).
const up = (label, get, fmt) => [label, (a) => fmt(get(a)), 1, get];
const dn = (label, get, fmt) => [label, (a) => fmt(get(a)), -1, get];
const rec = (v) => (v == null || v === 0 ? '-' : v);
const share = (a, n) => (a.turns ? n / a.turns : null);

// progrès (vert) / régression (rouge) de la période choisie par rapport à celle d'avant
// renvoie { t: +1 mieux / -1 moins bien / 0, dir: sens de la valeur (+1 monte, -1 baisse) }
function trend(dir, get, fn, cur, prev) {
  if (!dir || !cur || !prev) return { t: 0 };
  const x = get(cur); const y = get(prev);
  if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) return { t: 0 };
  if (Math.abs(x - y) <= Math.abs(y) * 0.02 + 1e-9) return { t: 0 }; // moins de 2 % d'écart : stable
  const a = fn(cur); const b = fn(prev);
  if (typeof a === 'string' && a === b) return { t: 0 }; // identique à l'affichage
  if (Math.abs(y) <= 1 && Math.abs(x) <= 1 && Math.abs(x - y) < 0.005) return { t: 0 }; // pourcentages : moins d'un demi-point
  return { t: Math.sign(x - y) * dir, up: x > y };
}

function FullTable({ sections, cols }) {
  const [open, setOpen] = useState(false);
  const total = sections.reduce((a, [, rows]) => a + rows.length, 0);
  const cmp = cols.length > 1;
  return (
    <div className="panel">
      <button className="between" onClick={() => setOpen(!open)} aria-expanded={open} style={{ minHeight: 40, textAlign: 'left' }}>
        <span className="h3">Tableau complet</span>
        <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{open ? 'Replier' : `Voir les ${total} stats`}</span>
      </button>
      {open && (<>
        <div className="small muted" style={{ marginTop: 4 }}>
          {cmp
            ? <>Comparé à la période d'avant : <span className="tr-up">vert = tu progresses</span> · <span className="tr-down">rouge = tu régresses</span>. La flèche dit si le chiffre monte ou baisse (moins de « Aucun point », c'est vert). Blanc = stable ou juste du volume.</>
            : 'Choisis une période (7 j, 30 j…) pour voir en couleur ce qui progresse ou régresse.'}
        </div>
        <div className="ftable" style={{ '--cols': cols.length }}>
          <div className="frow fhead"><span />{cols.map((c) => <span key={c.label}>{c.label}</span>)}</div>
          {sections.map(([title, rows]) => (
            <React.Fragment key={title}>
              <div className="fsec">{title}</div>
              {rows.map(([label, fn, dir, get]) => {
                const { t, up: rise } = cmp ? trend(dir, get, fn, cols[0].data, cols[1].data) : { t: 0 };
                return (
                  <div className={`frow ${t > 0 ? 'good' : t < 0 ? 'bad' : ''}`} key={title + label}>
                    <span className="fl">{label}</span>
                    {cols.map((c, i) => (
                      <span key={c.label} className={i === 0 && t ? (t > 0 ? 'tr-up' : 'tr-down') : ''}>
                        {i === 0 && t ? <i className="tr-arrow" aria-label={t > 0 ? 'en progrès' : 'en recul'}>{rise ? '▲' : '▼'}</i> : null}
                        {c.data ? fn(c.data) : '-'}
                      </span>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </>)}
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
    ['Legs', (a) => a.legs], ['Legs gagnés', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), ['Fléchettes', (a) => n0(a.darts)],
    dn('Fléch. / leg gagné', (a) => a.dartsPerLeg, f1), ['Temps de jeu', (a) => dur(a.duration.total)], ['Temps / partie', (a) => dur(a.duration.avg)], ['Temps / leg', (a) => dur(a.duration.perLeg)],
  ]],
  ['Moyenne 3 fléchettes', [
    up('Toutes', (a) => a.avgAll, f1), up('Sortie simple', (a) => a.avgOut.single, f1), up('Sortie double', (a) => a.avgOut.double, f1), up('Sortie master', (a) => a.avgOut.master, f1),
    up('9 premières', (a) => a.avgFirst[9], f1), up('12 premières', (a) => a.avgFirst[12], f1), up('15 premières', (a) => a.avgFirst[15], f1),
    up('Tant que > 170', (a) => a.avgUntil[170], f1), up('Tant que > 100', (a) => a.avgUntil[100], f1),
  ]],
  ['Checkout', [
    up('Checkout moyen', (a) => a.coAvg, f0), up('Meilleur checkout', (a) => a.coHigh, rec), ['Réussis / tentés', (a) => frac(a.coHit, a.coAtt)], up('Taux', (a) => a.coRate, pc),
    ['Doubles réussis / tentés', (a) => frac(a.dblHit, a.dblAtt)], up('Taux sur double', (a) => a.dblRate, pc),
  ]],
  ['Records', [
    dn('Leg le plus court', (a) => a.bestLeg, rec), up('Meilleure moyenne de leg', (a) => a.bestLegAvg, f1), up('Meilleur tour', (a) => a.high, rec),
  ]],
  ['Tours par tranche', TURN_BUCKETS.map(([l], i) => [l, (a) => cnt(a.buckets[i], a.turns), i < 2 ? -1 : i >= 3 ? 1 : 0, (a) => share(a, a.buckets[i])])],
  ['Tranches alternatives', ALT_BUCKETS.map(([l], i) => [l, (a) => cnt(a.alt[i], a.turns), i < 2 ? -1 : i >= 3 ? 1 : 0, (a) => share(a, a.alt[i])])],
  ['Moyenne par tour du leg', Array.from({ length: 10 }, (_, i) => up(`Tour ${i + 1}`, (a) => a.roundAvg[i], f1))],
  ['Reste moyen après', [3, 6, 9, 12, 15].map((k) => dn(`${k} fléchettes`, (a) => a.remAfterAvg[k], f0))],
];

const CRICKET_SECTIONS = [
  ['Général', [['Legs', (a) => a.legs], ['Legs gagnés', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), ['Temps de jeu', (a) => dur(a.duration.total)], up('MPR', (a) => a.mpr, (v) => (v == null ? '-' : v.toFixed(2)))]],
  ['Précision', [up('Touches', (a) => a.pct.hit, pc), up('Triples', (a) => a.pct.t, pc), up('Doubles', (a) => a.pct.d, pc), ['Simples', (a) => pc(a.pct.s)], dn('Hors numéros', (a) => a.pct.miss, pc)]],
  ['Fléchettes', [['Lancées', (a) => n0(a.darts)], ['Touches', (a) => n0(a.darts - a.miss)], ['Triples', (a) => a.t], ['Doubles', (a) => a.d], ['Simples', (a) => a.sgl], ['Hors numéros', (a) => a.miss]]],
  ['Points', [up('Moyenne / leg', (a) => a.ptsAvg, f0), up('Max points', (a) => a.maxPts, rec), up('Max triples / leg', (a) => a.maxT, rec), up('Max doubles / leg', (a) => a.maxD, rec), ['Max simples / leg', (a) => a.maxS]]],
  ['Gros tours', [['9 marques', (a) => a.m9], ['7-8 marques', (a) => a.m7], ['5-6 marques', (a) => a.m5]]],
  ['Marques / leg par numéro', CRICKET_NUMS.map((n) => up(n === 25 ? 'Bull' : String(n), (a) => a.perNumAvg[n], f1))],
  ['Touches par numéro', CRICKET_NUMS.map((n) => [n === 25 ? 'Bull' : String(n), (a) => a.hitsNum[n]])],
];

const SH_NUMS = Array.from({ length: 20 }, (_, i) => i + 1);
const SHANGHAI_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), ['Shanghais', (a) => a.shanghais], ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Points', [up('Moyenne / partie', (a) => a.ptsAvg, f0), up('Meilleur 1 à 7', (a) => a.best7, rec), up('Meilleur 1 à 20', (a) => a.best20, rec)]],
  ['Fléchettes', [['Tentatives', (a) => n0(a.darts)], ['Triples', (a) => a.t], ['Doubles', (a) => a.d], ['Simples', (a) => a.sgl], ['Ratées', (a) => a.miss]]],
  ['Précision', [up('Touches', (a) => a.pct.hit, pc), up('Triples', (a) => a.pct.t, pc), up('Doubles', (a) => a.pct.d, pc), ['Simples', (a) => pc(a.pct.s)], dn('Ratées', (a) => a.pct.miss, pc)]],
  ['Précision par numéro', SH_NUMS.map((n) => up(String(n), (a) => a.numAcc[n], pc))],
  ['Points moyens par numéro', SH_NUMS.map((n) => up(String(n), (a) => a.numPts[n], f1))],
  ['Shanghais par numéro', SH_NUMS.map((n) => [String(n), (a) => a.num[n].sh])],
];

const ATC_NUMS = [...SH_NUMS, 25];
const ATC_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Fléchettes', [['Lancées', (a) => n0(a.darts)], ['Touches', (a) => n0(a.hits)], up('Précision', (a) => a.acc, pc), dn('Moy. pour finir', (a) => a.finAvg, f0), dn('Record', (a) => a.best, rec)]],
  ['Précision par numéro', ATC_NUMS.map((n) => up(n === 25 ? 'Bull' : String(n), (a) => a.numAcc[n], pc))],
];

const BASEBALL_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Points', [up('Moyenne / partie', (a) => a.ptsAvg, f1), up('Meilleure partie', (a) => a.best, rec), ['Sans faute', (a) => a.clean], ['Coups de circuit', (a) => a.homeruns]]],
  ['Fléchettes', [['Tentatives', (a) => n0(a.darts)], ['Triples', (a) => a.t], ['Doubles', (a) => a.d], ['Simples', (a) => a.sgl], ['Ratées', (a) => a.miss]]],
  ['Précision', [up('Touches', (a) => a.pct.hit, pc), up('Triples', (a) => a.pct.t, pc), up('Doubles', (a) => a.pct.d, pc), ['Simples', (a) => pc(a.pct.s)], dn('Ratées', (a) => a.pct.miss, pc)]],
  ['Précision par manche', Array.from({ length: 9 }, (_, i) => i + 1).map((n) => up(`Manche ${n}`, (a) => a.numAcc[n], pc))],
  ['Points moyens par manche', Array.from({ length: 9 }, (_, i) => i + 1).map((n) => up(`Manche ${n}`, (a) => a.numPts[n], f1))],
];
const KILLER_SECTIONS = [
  ['Général', [['Parties', (a) => a.legs], ['Victoires', (a) => a.won], up('% de victoire', (a) => a.winRate, pc), dn('Place moyenne', (a) => a.avgPlace, f1), ['Temps de jeu', (a) => dur(a.duration.total)]]],
  ['Attaque', [['Éliminations', (a) => a.kills], up('Éliminations / leg', (a) => a.killsPerLeg, f1), up('Doubles qui touchent un adversaire', (a) => a.victimRate, pc)]],
  ['Défense', [['Vies perdues', (a) => a.lostLives], dn('Vies perdues / leg', (a) => a.lostPerLeg, f1), ['Legs gagnés sans perdre une vie', (a) => a.flawless]]],
  ['Devenir killer', [up('Legs où tu deviens killer', (a) => a.becameRate, pc), dn('Fléchettes pour devenir killer', (a) => a.dartsToKillerAvg, f1), up('Précision sur ton double', (a) => a.doubleAcc, pc), ['Killer express', (a) => a.express]]],
];

function BaseballView({ games, prevGames, allGames, period, pid }) {
  const all = useMemo(() => baseballAdvanced(allGames, pid), [allGames, pid]);
  const a = useMemo(() => baseballAdvanced(games, pid), [games, pid]);
  const b = useMemo(() => (prevGames ? baseballAdvanced(prevGames, pid) : null), [prevGames, pid]);
  if (!a.legs) return <Empty what="partie de Baseball" />;
  return (<>
    <Hero label="Points par partie" value={f1(a.ptsAvg)} delta={b ? diff(a.ptsAvg, b.ptsAvg) : undefined}>
      <Mini k="Précision" v={pc(a.pct.hit)} />
      <Mini k="Record" v={a.best ?? '-'} s="points" />
      <Mini k="Victoires" v={pc(a.winRate)} s={`${a.won} / ${a.legs}`} />
    </Hero>
    <Card title="Précision par manche" sub="% de fléchettes sur le numéro de la manche">
      <HeatStrip cells={Array.from({ length: 9 }, (_, i) => i + 1).map((n) => ({
        label: String(n), value: a.numAcc[n],
        detail: a.num[n].darts ? `Manche ${n} : ${a.num[n].hits} touches sur ${a.num[n].darts} fléchettes, ${f1(a.numPts[n])} pts par manche` : null,
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
    <FullTable sections={BASEBALL_SECTIONS} cols={colsFor(a, b, all, period)} />
  </>);
}

function KillerView({ games, prevGames, allGames, period, pid }) {
  const all = useMemo(() => killerAdvanced(allGames, pid), [allGames, pid]);
  const a = useMemo(() => killerAdvanced(games, pid), [games, pid]);
  const b = useMemo(() => (prevGames ? killerAdvanced(prevGames, pid) : null), [prevGames, pid]);
  if (!a.legs) return <Empty what="partie de Killer" />;
  return (<>
    <Hero label="Victoires" value={a.winRate == null ? '-' : Math.round(a.winRate * 100)} unit=" %" delta={b && b.winRate != null && a.winRate != null ? (a.winRate - b.winRate) * 100 : undefined} deltaSuffix=" pts">
      <Mini k="Éliminations" v={a.kills} s={`${f1(a.killsPerLeg)} / leg`} />
      <Mini k="Vies perdues" v={a.lostLives} s={`${f1(a.lostPerLeg)} / leg`} />
      <Mini k="Place moyenne" v={f1(a.avgPlace)} />
    </Hero>
    <Card title="Devenir killer" sub="ton double de départ">
      <div className="records">
        <Mini k="Précision" v={pc(a.doubleAcc)} />
        <Mini k="Fléchettes pour y arriver" v={f1(a.dartsToKillerAvg)} />
        <Mini k="Killer express" v={a.express} />
        <Mini k="Sans perdre de vie" v={a.flawless} s="legs gagnés" />
      </div>
    </Card>
    <FullTable sections={KILLER_SECTIONS} cols={colsFor(a, b, all, period)} />
  </>);
}

function X01View({ games, prevGames, allGames, period, pid }) {
  const [start, setStart] = useState('all');
  const a = useMemo(() => x01Advanced(games, pid, start), [games, pid, start]);
  const b = useMemo(() => (prevGames ? x01Advanced(prevGames, pid, start) : null), [prevGames, pid, start]);
  const all = useMemo(() => x01Advanced(allGames, pid, start), [allGames, pid, start]);
  const series = useMemo(() => playerStats(games.filter((g) => g.mode === 'x01' && (start === 'all' || String(startOf(g, pid)) === start)), pid).series.slice(-20).map((p) => p.avg), [games, pid, start]);
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

// volume de jeu du mode : parties, legs joués, fléchettes lancées et fléchettes ratées (le raté n'a pas le même poids selon le jeu)
function VolumeCard({ games, pid, mode }) {
  const v = useMemo(() => playerStats(games, pid).byMode[mode], [games, pid, mode]);
  if (!v) return null;
  const rate = v.darts ? Math.round((v.miss / v.darts) * 100) : null;
  return (
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      <Mini k="Parties" v={v.games} />
      <Mini k="Legs joués" v={v.legs} />
      <Mini k="Fléchettes" v={v.darts} />
      <Mini k="Ratés" v={rate == null ? '-' : `${rate} %`} s={`${v.miss}`} />
    </div>
  );
}

export function Analysis({ games, pid }) {
  const [period, setPeriod] = useState('90');
  const [mode, setMode] = useState('x01');
  const { cur, prev } = useMemo(() => window(games, period), [games, period]);
  const View = { x01: X01View, cricket: CricketView, shanghai: ShanghaiView, atc: AtcView, baseball: BaseballView, killer: KillerView }[mode];
  return (<>
    <div className="chips-scroll">
      {PERIODS.map(([k, l]) => <button key={k} className={`chip-pill ${period === k ? 'on' : ''}`} onClick={() => setPeriod(k)} aria-pressed={period === k}>{l}</button>)}
    </div>
    <div className="mode-tabs" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
      {[['x01', 'X01'], ['cricket', 'Cricket'], ['shanghai', 'Shanghai'], ['atc', 'ATC'], ['baseball', 'Baseball'], ['killer', 'Killer']].map(([k, l]) => (
        <button key={k} className={mode === k ? 'on' : ''} style={{ fontSize: 12 }} onClick={() => setMode(k)} aria-pressed={mode === k}>{l}</button>
      ))}
    </div>
    {prev && <div className="small muted" style={{ marginTop: -6 }}>Les flèches comparent avec les {PERIODS.find((p) => p[0] === period)[1]} d'avant.</div>}
    <VolumeCard games={cur} pid={pid} mode={mode} />
    <View games={cur} prevGames={prev} allGames={games} period={period} pid={pid} />
  </>);
}
