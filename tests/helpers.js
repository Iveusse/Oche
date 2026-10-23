// Outils communs aux tests : fabriquer des fléchettes et des legs.
// D(20, 3) = triple 20, miss = hors cible, leg(['a','b'], [...fléchettes]) = un leg en cours.
export const D = (seg, mult) => ({ seg, mult });
export const miss = D(0, 0);
export const leg = (order, darts, extra = {}) => ({ order, darts, validated: 0, continueForPlaces: null, ...extra });
