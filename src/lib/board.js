// Géométrie de la cible. Unité : 1 = bord extérieur de l'anneau double (170 mm).
// y vers le bas (repère SVG), 0,0 = centre.

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const R = {
  innerBull: 6.35 / 170,
  outerBull: 15.9 / 170,
  trebleIn: 99 / 170,
  trebleOut: 107 / 170,
  doubleIn: 162 / 170,
  doubleOut: 1,
  miss: 1.3, // zone "hors cible" dessinée autour
};

export const MISS = { seg: 0, mult: 0 };

export function hitTest(x, y) {
  const r = Math.hypot(x, y);
  if (r > R.doubleOut) return { ...MISS };
  if (r <= R.innerBull) return { seg: 25, mult: 2 };
  if (r <= R.outerBull) return { seg: 25, mult: 1 };
  let a = (Math.atan2(x, -y) * 180) / Math.PI; // 0 = haut, sens horaire
  a = (a + 360 + 9) % 360;
  const seg = ORDER[Math.floor(a / 18)];
  let mult = 1;
  if (r >= R.trebleIn && r <= R.trebleOut) mult = 3;
  else if (r >= R.doubleIn) mult = 2;
  return { seg, mult };
}

export function dartScore(d) {
  if (!d || !d.mult) return 0;
  return d.seg * d.mult;
}

export function dartLabel(d) {
  if (!d) return '';
  if (!d.mult) return 'Hors';
  if (d.seg === 25) return d.mult === 2 ? 'Bull' : '25';
  return (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : '') + d.seg;
}

// Position du centre d'une zone (utile pour les tests et les marqueurs)
export function zoneCenter(seg, mult) {
  if (seg === 0) return { x: 0, y: -1.15 };
  if (seg === 25) return { x: 0, y: mult === 2 ? 0 : -(R.innerBull + R.outerBull) / 2 };
  const idx = ORDER.indexOf(seg);
  const ang = (idx * 18 * Math.PI) / 180;
  const r = mult === 3 ? (R.trebleIn + R.trebleOut) / 2
    : mult === 2 ? (R.doubleIn + R.doubleOut) / 2
    : (R.outerBull + R.trebleIn) / 2;
  return { x: Math.sin(ang) * r, y: -Math.cos(ang) * r };
}

// Toutes les fléchettes possibles (pour les suggestions de finish)
const ALL = [];
for (let n = 20; n >= 1; n--) ALL.push({ seg: n, mult: 3 });
ALL.push({ seg: 25, mult: 2 });
ALL.push({ seg: 25, mult: 1 });
for (let n = 20; n >= 1; n--) ALL.push({ seg: n, mult: 1 });
for (let n = 20; n >= 1; n--) ALL.push({ seg: n, mult: 2 });

export function isOutDart(d, out) {
  if (out === 'double') return d.mult === 2;
  if (out === 'master') return d.mult >= 2;
  return d.mult >= 1;
}

export function oneDartFinish(rem, out) {
  return ALL.some((d) => dartScore(d) === rem && isOutDart(d, out));
}

const checkoutCache = {};
// Suggestion de finish en 1 à `darts` fléchettes, ou null.
export function suggestCheckout(rem, out = 'double', darts = 3) {
  const key = `${rem}|${out}|${darts}`;
  if (key in checkoutCache) return checkoutCache[key];
  let res = null;
  const finishers = ALL.filter((d) => isOutDart(d, out));
  // tri : on préfère finir sur D20, D16, D8... puis bull
  const pref = [40, 32, 16, 8, 24, 36, 20, 12, 4, 28, 38, 34, 30, 26, 22, 18, 14, 10, 6, 2, 50];
  finishers.sort((a, b) => {
    const ia = pref.indexOf(dartScore(a)); const ib = pref.indexOf(dartScore(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const setup = ALL.filter((d) => d.seg !== 25 || d.mult === 2 || true);
  outer: for (let n = 1; n <= darts; n++) {
    if (n === 1) {
      for (const f of finishers) if (dartScore(f) === rem) { res = [f]; break outer; }
    } else if (n === 2) {
      for (const f of finishers) for (const a of setup) {
        if (dartScore(a) + dartScore(f) === rem) { res = [a, f]; break outer; }
      }
    } else {
      for (const f of finishers) for (const a of setup) for (const b of setup) {
        if (dartScore(a) + dartScore(b) + dartScore(f) === rem) { res = [a, b, f]; break outer; }
      }
    }
  }
  checkoutCache[key] = res;
  return res;
}
