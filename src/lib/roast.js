// Easter egg « mode vanne » : phrases pas cool quand ça se passe mal, et un clin d'oeil au Guide du voyageur galactique pour un 42.
// Une phrase n'est jamais dite deux fois dans le même leg : quand le stock est épuisé, on se tait.
import { load, save } from './store.js';

export const trashOn = () => load('trash', false);
export const setTrashOn = (v) => save('trash', v);

const used = new Set();
export const resetRoast = () => used.clear();

// tire une phrase pas encore utilisée dans ce leg (null s'il n'en reste plus)
function draw(key, list, name) {
  const free = list.map((x, i) => i).filter((i) => !used.has(`${key}${i}`));
  if (!free.length) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  used.add(`${key}${i}`);
  const x = list[i];
  return typeof x === 'function' ? x(name) : x;
}

const H2G2 = [
  'La réponse à la grande question sur la vie, l\'univers et le reste : quarante-deux.',
  'Quarante-deux. La réponse à la grande question. Reste à retrouver la question.',
  'Quarante-deux. Ne paniquez pas, et n\'oubliez pas votre serviette.',
  'Quarante-deux. Deep Thought a mis sept millions et demi d\'années pour le calculer, toi, trois fléchettes.',
];
// une seule fléchette ratée
const DART = [
  'Dans le mur', 'Même pas près', 'Raté. Encore.', 'Tu vises quoi, là ?', 'Le mur dit merci',
  'Belle trajectoire, dommage pour la cible', 'Aïe. Ça fait mal aux yeux', 'La cible est de l\'autre côté',
  'Raté. Comme d\'habitude', 'Tu as fermé les yeux ?', 'Le plafond est content', 'Plouf',
  'Même ton ombre vise mieux', 'Un peu de sérieux', 'Encore un cadeau pour le mur',
  'Ça, c\'est du talent, du talent pour rater', 'Ouh là, on a eu peur', 'La cible a eu très peur, pour rien',
  'Le plâtre va finir par t\'envoyer une facture', 'C\'est la fléchette qui a glissé, bien sûr', 'Tu lances ou tu jardines ?',
  'Un aveugle ferait pareil', 'Même le chien a rigolé', 'Concentre-toi, on dirait un pigeon', 'La gravité, ça existe pourtant',
  'Ça part dans tous les sens', 'On appelle ça un tir d\'artiste, c\'est-à-dire raté', 'Tu as visé le voisin ?',
  'Le mur n\'avait rien demandé', 'C\'est beau la persévérance', 'Rien du tout. Bravo',
  'Un peu à gauche. Ou à droite. Ou ailleurs', 'La cible te cherche encore', 'Tu me fais de la peine',
  'Sérieusement ?', 'Tu fais exprès ?', 'Même en rêve tu ferais mieux',
];
// deux fléchettes ratées sur trois
const TWO = [
  (n) => `${n}, deux sur trois dans le décor, c'est un choix ?`,
  (n) => `${n}, une seule fléchette utile, ça ne suffit pas`,
  (n) => `${n}, tu joues à cache-cache avec la cible`,
  (n) => `${n}, va falloir régler ce viseur`,
  (n) => `${n}, on t'a prévenu que la cible était devant ?`,
  (n) => `${n}, un tiers de réussite, c'est déjà beau pour toi`,
  (n) => `${n}, deux ratés, je ne dis rien, mais je pense fort`,
  (n) => `${n}, à ce rythme le mur va finir par gagner`,
  (n) => `${n}, tes fléchettes ont dû se tromper d'adresse`,
  (n) => `${n}, de la précision, ça se travaille, tu sais`,
];
// tour à 30 points ou moins au X01
const BAD = [
  (n) => `${n}, c'est tout ? Ma grand-mère fait mieux`,
  (n) => `Aïe ${n}, on dirait que tu lances avec le coude`,
  (n) => `${n}, on va dire que c'est l'échauffement`,
  (n) => `${n}, franchement, c'est triste`,
  (n) => `${n}, tu comptes te rattraper quand ?`,
  (n) => `${n}, un score pareil, c'est presque de l'art`,
  (n) => `${n}, tu as gardé les bonnes fléchettes pour plus tard ?`,
  (n) => `${n}, c'est à ce moment qu'on dit courage`,
  (n) => `${n}, même un débutant fait ça sans effort`,
];
// trois fléchettes ratées
const MISS = [
  (n) => `${n}, le mur est content, tu l'as épargné`,
  (n) => `${n}, même les yeux fermés tu ferais mieux`,
  (n) => `${n}, tu visais le voisin ?`,
  (n) => `Bravo ${n}, trois fois à côté, c'est presque un talent`,
  (n) => `${n}, la cible est juste en face de toi`,
  (n) => `${n}, trois ratés d'affilée, respect`,
  (n) => `${n}, tu veux qu'on éteigne la lumière pour t'aider ?`,
  (n) => `${n}, le mur n'a jamais été aussi bien visé`,
  (n) => `${n}, tu as raté la cible ET le reste, un vrai exploit`,
  (n) => `${n}, on dirait que tu lances des fléchettes pour la première fois`,
  (n) => `${n}, zéro. Comme ta chance`,
  (n) => `${n}, donne-moi les fléchettes, je vais te montrer`,
];
const BUST = [
  (n) => `${n}, tu sais compter ? C'est pas compliqué pourtant`,
  (n) => `Quel talent ${n}, un score de plus et tu sortais du tableau`,
  (n) => `${n}, tu as raté le finish, mais avec style`,
  (n) => `${n}, trop fort, tu as réussi à faire trop bien`,
  (n) => `${n}, les maths et toi, ça fait deux`,
  (n) => `${n}, calcule avant de lancer, c'est le principe`,
  (n) => `${n}, encore un peu et tu explosais aussi le mur`,
];
const LOSS = [
  (n) => `${n}, tu as perdu, mais l'important c'est de participer, paraît-il`,
  (n) => `${n}, défaite. Tu peux rejeter la faute sur les fléchettes`,
  (n) => `${n}, dernier. Ça se travaille, l'humilité`,
  (n) => `Courage ${n}, il y aura d'autres parties pour te faire battre`,
  (n) => `${n}, tu perds. On a l'habitude`,
  (n) => `${n}, la honte, mais on t'aime quand même`,
  (n) => `${n}, tu peux dire que tu t'es laissé faire`,
  (n) => `${n}, perdre, c'est ta spécialité`,
  (n) => `${n}, même les fléchettes ont honte de toi`,
  (n) => `${n}, va falloir s'entraîner, ou changer de sport`,
];

const isMiss = (d) => !d.mult || d.hit === false;

// t : le tour qui vient de finir ; renvoie une phrase ou null
export function roastTurn(mode, t, name, pts) {
  if (!trashOn() || t.darts.length < 3) return null;
  if (pts === 42 && (mode === 'x01' || mode === 'shanghai')) return draw('h', H2G2, name);
  if (t.bust) return draw('b', BUST, name);
  const nMiss = t.darts.filter(isMiss).length;
  if (nMiss === t.darts.length) return draw('m', MISS, name);
  if (nMiss >= 2) return draw('t', TWO, name);
  if ((mode === 'x01' || mode === 'train-checkout') && !t.finished && pts > 0 && pts <= 30) return draw('l', BAD, name);
  if (nMiss === 1 && !t.finished) return draw('d', DART, name);
  return null;
}
export const roastLoss = (name) => (trashOn() && name ? draw('p', LOSS, name) : null);

// une fléchette ratée en cours de tour
export function roastDart(d) {
  if (!trashOn() || !isMiss(d)) return null;
  return draw('d', DART);
}
