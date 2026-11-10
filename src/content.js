'use strict';

// ---------------------------------------------------------------------------
//  Réglages d'équilibrage (tout ce qui se règle en playtest est ici)
// ---------------------------------------------------------------------------
const CFG = {
  RAISON: 3, // points de Raison au départ
  MAX_ITEMS: 3, // inventaire maximum
  FATAL_NIGHT: 9, // à partir de cette nuit, tout le monde perd 1 Raison à l'Aube
  MIRROR_FALSE: 0.4, // chance que le Miroir mente quand on a 1 Raison
  MURMUR_TRUE: 0.5, // chance qu'un Murmure de la Chose soit vrai
  RUNE_SHARE: 0.7, // chance que les deux Liés voient la même rune
  HALLU_NOTE: 0.6, // chance de recevoir une fausse voix quand on a 1 Raison
  PACTE_FROM_ACT: 2, // le Pacte (dilemme) est dispo à partir de cet acte
  SECS: {
    roles: 25,
    podium: 9,
    minuit: 30,
    veillee: 90,
    rituel: 20,
    aubeMin: 10,
    aubeMax: 24,
    precipiter: 30, // secondes retirées à la Veillée par la malédiction
    coupure: 15, // durée du noir
    duelAuto: 6,
  },
};

// ---------------------------------------------------------------------------
//  Structure du jeu (les textes sont dans src/lang/*.js)
// ---------------------------------------------------------------------------
const ROLES = {
  solitaire: { icon: '🕯️' },
  lie: { icon: '🩸' },
};

const ITEMS = {
  lanterne: { icon: '🕯️', target: false },
  couteau: { icon: '🔪', target: true },
  sel: { icon: '🧂', target: false },
  miroir: { icon: '🪞', target: true },
};

// Runes (indices discrets pour les Liés) et symboles de mémoire
const RUNES = ['🌙', '🕷️', '🦇', '💀', '🪦', '🔔', '🕯️', '👁️', '🩸', '🦉'];
const GLYPHS = ['🌙', '🕷️', '🦇', '💀', '🪦', '🔔', '👁️', '🩸', '🦉'];

// Événements de la Chose (tirés à chaque Aube pour la nuit suivante)
const EVENTS = { coupure: {}, murmures: {}, brouillard: {}, possession: {}, silence: {} };
const EVENTS_BY_ACT = {
  1: ['coupure', 'murmures'],
  2: ['coupure', 'murmures', 'brouillard', 'possession', 'silence'],
  3: ['coupure', 'murmures', 'brouillard', 'possession', 'silence'],
};

// Malédictions des Hantés (3 tirées au hasard chaque nuit)
const CURSES = { etouffer: {}, precipiter: {}, reveler: {}, chuchoter: {}, tenebres: {} };

// Gestes (Silence) : l'icône et le besoin d'une cible. Les libellés sont dans la langue.
const GESTURES = [
  { icon: '👉', target: true },
  { icon: '🤝' },
  { icon: '❓' },
  { icon: '😱' },
  { icon: '🤫' },
  { icon: '💀' },
];

const ACTS = { 1: {}, 2: {}, 3: {} };

module.exports = { CFG, ROLES, ITEMS, RUNES, GLYPHS, EVENTS, EVENTS_BY_ACT, CURSES, GESTURES, ACTS };
