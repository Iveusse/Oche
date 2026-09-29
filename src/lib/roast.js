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

// Clins d'oeil sur un tour à 42, 31, 44 ou 29 (avec les annonces vocales, indépendants du mode vanne)
const H2G2 = [
  'La réponse à la grande question sur la vie, l\'univers et le reste : quarante-deux.',
  'Quarante-deux. La réponse à la grande question. Reste à retrouver la question.',
  'Quarante-deux. Ne paniquez pas, et n\'oubliez pas votre serviette.',
  'Quarante-deux. Deep Thought a mis sept millions et demi d\'années pour le calculer, toi, trois fléchettes.',
];
const TOULOUSE = [
  'Trente et un ! Allez le Stade Toulousain, rouge et noir jusqu\'au bout !',
  'Trente et un, comme la Haute-Garonne. Ernest-Wallon est debout !',
  'Trente et un. Un essai transformé pour le Stade Toulousain !',
  'Trente et un ! Les rouge et noir sont en marche',
];
const NANTES = [
  'Quarante-quatre, comme la Loire-Atlantique. Salut Nantes !',
  'Quarante-quatre ! Allez les Canaris, la Beaujoire est en feu',
  'Quarante-quatre. Nantes, ses Machines de l\'île et son grand éléphant',
  'Quarante-quatre. Un petit tour au château des ducs de Bretagne ?',
];
const DIRINON = [
  'Vingt-neuf ! Le Finistère, et un grand bonjour à Dirinon',
  'Vingt-neuf. À Dirinon, on dit Sèl pétra ri : réfléchis avant d\'agir. Trop tard pour cette volée',
  'Vingt-neuf, comme le Finistère. Dirinon, le pays des chênes de sainte Nonne',
];
const COMBRAY = [
  'Vingt-huit, comme l\'Eure-et-Loir. Illiers-Combray, le village de Marcel Proust',
  'Vingt-huit ! À Illiers-Combray, même le festival s\'appelle Marcel Festoche, en clin d\'oeil à Proust',
  'Vingt-huit. Une madeleine, et tout Combray ressurgit',
  'Vingt-huit. Longtemps, je me suis couché de bonne heure. Toi, tu lances des fléchettes',
];
const QUIPS = { 28: ['e', COMBRAY], 42: ['h', H2G2], 31: ['c', TOULOUSE], 44: ['n', NANTES], 29: ['f', DIRINON] };
export function numberQuip(mode, t, pts) {
  if (t.bust || (mode !== 'x01' && mode !== 'shanghai')) return null;
  const q = QUIPS[pts];
  return q ? draw(q[0], q[1]) : null;
}

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
  'Ton bras a une excuse ?', 'Le mur t\'a vu venir', 'Un tir digne d\'un lundi matin',
  'Même en visant à côté tu ne ferais pas mieux', 'La fléchette est partie en vacances', 'C\'est du sabotage ou du talent ?',
  'On a vu mieux chez les enfants', 'La cible a décliné ton invitation', 'Wow. Juste wow',
  'Tu as confondu avec du lancer de javelot ?', 'Tu tiens la fléchette du bon côté ?', 'Ça te réussit de rater comme ça',
  'La physique t\'en veut personnellement', 'Le mur va demander une augmentation', 'Tu es allergique aux points ?',
  'Bravo, une décoration de plus dans le plâtre', 'On dirait un lancer de dés', 'Respire. Et vise. Surtout vise',
  'Ce n\'est pas la cible qui bouge', 'C\'est pas la faute de la fléchette, tu sais',
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
  (n) => `${n}, ta cible se sent seule, tu sais`,
  (n) => `${n}, ce tour ressemble à ta dernière séance de sport`,
  (n) => `${n}, deux fois à côté, on croirait que tu le fais exprès`,
  (n) => `${n}, tu lances ou tu distribues des cadeaux au mur ?`,
  (n) => `${n}, presque bien. Presque`,
  (n) => `${n}, c'est un tour pour oublier vite`,
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
  (n) => `${n}, on t'a vu faire mieux. Il y a longtemps`,
  (n) => `${n}, garde ça pour le prochain tour, c'est un brouillon`,
  (n) => `${n}, tu économises tes forces, je comprends`,
  (n) => `${n}, c'est pas grave, personne n'a vu. Sauf nous`,
  (n) => `${n}, tu lances avec la main gauche par hasard ?`,
  (n) => `${n}, les fléchettes ne mordent pas, tu peux y aller`,
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
  (n) => `${n}, un vrai désastre, avec un peu de panache quand même`,
  (n) => `${n}, tu as juste échauffé le plâtre`,
  (n) => `${n}, le bar du coin te déconseille ce genre de tour`,
  (n) => `${n}, trois fois rien, c'est toi tout craché`,
  (n) => `${n}, même le hasard aurait touché quelque chose`,
  (n) => `${n}, on va faire comme si ça n'était pas arrivé`,
];
const BUST = [
  (n) => `${n}, tu sais compter ? C'est pas compliqué pourtant`,
  (n) => `Quel talent ${n}, un score de plus et tu sortais du tableau`,
  (n) => `${n}, tu as raté le finish, mais avec style`,
  (n) => `${n}, trop fort, tu as réussi à faire trop bien`,
  (n) => `${n}, les maths et toi, ça fait deux`,
  (n) => `${n}, calcule avant de lancer, c'est le principe`,
  (n) => `${n}, encore un peu et tu explosais aussi le mur`,
  (n) => `${n}, tu as dépassé, mais pas les attentes`,
  (n) => `${n}, ça, c'est ce qu'on appelle viser trop haut`,
  (n) => `${n}, le tableau te remercie de l'avoir fait rire`,
  (n) => `${n}, trop généreux, ça va te coûter cher`,
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
  (n) => `${n}, le classement, c'est comme la vie, il y a des derniers`,
  (n) => `${n}, tu as perdu avec beaucoup de classe. Enfin, beaucoup`,
  (n) => `${n}, au moins tu as bien porté la lanterne rouge`,
  (n) => `${n}, on garde ton nom pour la rubrique des perdants`,
  (n) => `${n}, tu perds, mais tu le fais bien`,
  (n) => `${n}, la prochaine fois, essaie de viser la cible`,
];

const SINGLE = new Set(['shanghai', 'baseball', 'killer', 'atc', 'train-atc', 'train-doubles', 'train-focus20']);
const isMiss = (d) => !d.mult || d.hit === false;

// t : le tour qui vient de finir ; renvoie une phrase ou null
export function roastTurn(mode, t, name, pts) {
  if (!trashOn() || t.darts.length < 3) return null;
  if (t.bust) return draw('b', BUST, name);
  const nMiss = t.darts.filter(isMiss).length;
  if (nMiss === t.darts.length) return draw('m', MISS, name);
  // un seul numéro à viser (Shanghai, ATC, entraînements) : rater 1 ou 2 fléchettes est normal, on ne charrie que les 3 ratées
  if (SINGLE.has(mode)) return null;
  if (nMiss >= 2) return draw('t', TWO, name);
  if ((mode === 'x01' || mode === 'train-checkout') && !t.finished && pts > 0 && pts <= 30) return draw('l', BAD, name);
  if (nMiss === 1 && !t.finished) return draw('d', DART, name);
  return null;
}
export const roastLoss = (name) => (trashOn() && name ? draw('p', LOSS, name) : null);
