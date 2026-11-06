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
//  Rôles
// ---------------------------------------------------------------------------
const ROLES = {
  solitaire: {
    name: 'Solitaire',
    icon: '🕯️',
    text: "Tu joues pour toi seul. Reste sain d'esprit et sois le dernier survivant.",
  },
  lie: {
    name: 'Lié',
    icon: '🩸',
    text:
      "Un autre invité est lié à toi par le sang, mais tu ne sais pas qui. Retrouvez-vous sans vous trahir : vous gagnez ensemble si tous les Solitaires sont éliminés.",
  },
};

// ---------------------------------------------------------------------------
//  Objets
// ---------------------------------------------------------------------------
const ITEMS = {
  lanterne: {
    name: 'Lanterne',
    icon: '🕯️',
    target: false,
    desc: "Annule la prochaine perte de Raison que tu subis cette nuit.",
  },
  couteau: {
    name: 'Couteau rouillé',
    icon: '🔪',
    target: true,
    desc: 'Inflige −1 Raison à une cible, en secret.',
  },
  sel: {
    name: 'Sel',
    icon: '🧂',
    target: false,
    desc: "Toute attaque de la nuit contre toi est renvoyée à son auteur.",
  },
  miroir: {
    name: 'Miroir',
    icon: '🪞',
    target: true,
    desc: "Montre si la cible est un Lié ou un Solitaire. Peut mentir si tu n'as plus qu'1 Raison.",
  },
};

// ---------------------------------------------------------------------------
//  Runes (indices discrets pour les Liés) et symboles de mémoire
// ---------------------------------------------------------------------------
const RUNES = ['🌙', '🕷️', '🦇', '💀', '🪦', '🔔', '🕯️', '👁️', '🩸', '🦉'];
const GLYPHS = ['🌙', '🕷️', '🦇', '💀', '🪦', '🔔', '👁️', '🩸', '🦉'];

// ---------------------------------------------------------------------------
//  Événements de la Chose (tirés à chaque Aube pour la nuit suivante)
// ---------------------------------------------------------------------------
const EVENTS = {
  coupure: {
    name: 'Coupure',
    text: "La lumière s'éteint. L'écran restera noir un moment, mais le manoir, lui, continue de parler.",
  },
  murmures: {
    name: 'Murmures',
    text: "Les murs chuchotent. Chacun recevra une phrase sur son téléphone. Elle est peut-être vraie. Peut-être pas.",
  },
  brouillard: {
    name: 'Brouillard',
    text: "Un brouillard épais tombe. Au Rituel, personne ne saura qui a voté pour qui.",
  },
  possession: {
    name: 'Possession',
    text: "Quelque chose s'est glissé dans l'un de vous. Il votera ce que la Chose lui ordonne.",
  },
  silence: {
    name: 'Silence',
    text: "Plus un mot. Pendant la veillée, seuls les gestes sont permis.",
  },
};
const EVENTS_BY_ACT = {
  1: ['coupure', 'murmures'],
  2: ['coupure', 'murmures', 'brouillard', 'possession', 'silence'],
  3: ['coupure', 'murmures', 'brouillard', 'possession', 'silence'],
};

// ---------------------------------------------------------------------------
//  Malédictions des Hantés (3 tirées au hasard chaque nuit)
// ---------------------------------------------------------------------------
const CURSES = {
  etouffer: {
    name: 'Étouffer',
    desc: "Un objet utilisé cette nuit s'éteint sans effet.",
    pub: "Un objet a été étouffé cette nuit. Quelqu'un a perdu son pouvoir.",
  },
  precipiter: {
    name: 'Précipiter',
    desc: 'La veillée est raccourcie de 30 secondes.',
    pub: 'Le temps se précipite : la veillée sera plus courte.',
  },
  reveler: {
    name: 'Révéler',
    desc: "Une rune est dévoilée à tous sur l'écran.",
    pub: "Une rune s'embrase sur le mur. Elle brûle pour tous les yeux.",
  },
  chuchoter: {
    name: 'Chuchoter',
    desc: 'Un vivant tiré au sort reçoit une fausse voix.',
    pub: "Les Hantés ont soufflé à l'oreille de quelqu'un… mais que lui ont-ils dit ?",
  },
  tenebres: {
    name: 'Ténèbres',
    desc: 'Le vote de ce soir se fera dans le noir : aucun détail ne sera révélé.',
    pub: 'Les ténèbres couvrent le Rituel : on ne saura pas qui a voté pour qui.',
  },
};

// ---------------------------------------------------------------------------
//  Gestes (Silence)
// ---------------------------------------------------------------------------
const GESTURES = [
  { icon: '👉', label: 'Accuser', target: true },
  { icon: '🤝', label: 'Allié ?' },
  { icon: '❓', label: 'Pourquoi ?' },
  { icon: '😱', label: 'Peur' },
  { icon: '🤫', label: 'Chut' },
  { icon: '💀', label: 'Danger' },
];

// ---------------------------------------------------------------------------
//  Voix de la Chose / hallucinations
// ---------------------------------------------------------------------------
const HALLU = [
  (x) => `Une voix souffle : « ${x} est l'un des Liés. »`,
  (x) => `Une voix souffle : « ${x} a prévu de voter contre toi. »`,
  (x) => `Tu as l'impression que ${x} t'observe depuis le début de la nuit…`,
  (x) => `Dans ton dos, quelqu'un chuchote le nom de ${x}. Puis le silence.`,
  () => `Une main glacée glisse un objet dans ta poche. Tu regardes : rien. Tu l'as imaginé… non ?`,
];

// ---------------------------------------------------------------------------
//  Narrateur (écran)
// ---------------------------------------------------------------------------
const NARR = {
  roles: [
    "Le portail se referme derrière vous. Le manoir vous a choisis. Regardez vos téléphones… et gardez votre secret.",
  ],
  crepuscule: [
    "Le soleil s'éteint. Le manoir vous met à l'épreuve.",
    "Le crépuscule tombe. Montrez-moi de quoi votre esprit est fait.",
    "Les ombres s'allongent. Une épreuve vous attend.",
  ],
  podium: [
    "La Chose a jugé vos efforts. Elle récompense les meilleurs.",
    "Certains ont brillé dans la pénombre. Les autres s'en souviendront.",
  ],
  minuit: [
    "Minuit. Les murs écoutent. Agissez dans l'ombre.",
    "Minuit sonne. Chacun a ses petits secrets à mettre en œuvre.",
    "Il est minuit. Ce qui est fait dans le noir reste dans le noir.",
  ],
  veillee: [
    "La veillée commence. Parlez. Accusez. Mentez. Quelqu'un ici n'est pas ce qu'il prétend.",
    "Rassemblez-vous près de la cheminée. La vérité ne survivra pas à cette nuit.",
    "Les bougies vacillent. Écoutez bien ce que chacun ne dit pas.",
  ],
  rituel: [
    "Le Rituel. Désignez celui que la Chose doit toucher.",
    "L'heure du Rituel est venue. Choisissez. Et vivez avec ce choix.",
  ],
  aube: [
    "L'aube se lève, mais elle n'apporte aucune paix.",
    "Les cloches sonnent. Comptons ce qui reste de vous.",
    "Le jour pointe. Regardez qui manque à l'appel.",
  ],
  fin: ["Le manoir se tait. La nuit est finie."],
};

const ACTS = {
  1: { roman: 'I', name: "L'Arrivée" },
  2: { roman: 'II', name: 'La Descente' },
  3: { roman: 'III', name: 'Le Dernier Cercle' },
};

// ---------------------------------------------------------------------------
//  Quiz glauque : lvl 1 = facile, 2 = moyen, 3 = difficile
// ---------------------------------------------------------------------------
const QUESTIONS = [
  { lvl: 1, q: "Qui a écrit « Dracula » (1897) ?", a: 'Bram Stoker', w: ['Mary Shelley', 'Edgar Allan Poe', 'H.P. Lovecraft'] },
  { lvl: 1, q: "Quelle autrice a publié « Frankenstein » en 1818 ?", a: 'Mary Shelley', w: ['Emily Brontë', 'Jane Austen', 'Agatha Christie'] },
  { lvl: 1, q: "Qui a réalisé « Psychose » (1960) ?", a: 'Alfred Hitchcock', w: ['Stanley Kubrick', 'John Carpenter', 'Wes Craven'] },
  { lvl: 1, q: "Qui a réalisé « Shining » (1980) ?", a: 'Stanley Kubrick', w: ['Alfred Hitchcock', 'Brian De Palma', 'Tobe Hooper'] },
  { lvl: 1, q: "Quel romancier a écrit « Ça » (1986) ?", a: 'Stephen King', w: ['Dean Koontz', 'Clive Barker', 'Anne Rice'] },
  { lvl: 1, q: "Quel écrivain a imaginé la créature Cthulhu ?", a: 'H.P. Lovecraft', w: ['Edgar Allan Poe', 'Stephen King', 'Bram Stoker'] },
  { lvl: 1, q: "Comment appelle-t-on la peur des araignées ?", a: 'Arachnophobie', w: ['Ophidiophobie', 'Acrophobie', 'Claustrophobie'] },
  { lvl: 1, q: "Comment appelle-t-on la peur des clowns ?", a: 'Coulrophobie', w: ['Xénophobie', 'Aérophobie', 'Hémophobie'] },
  { lvl: 1, q: "Comment appelle-t-on la peur du noir ?", a: 'Nyctophobie', w: ['Hydrophobie', 'Agoraphobie', 'Thanatophobie'] },
  { lvl: 1, q: "Quel poète américain a écrit « Le Corbeau » ?", a: 'Edgar Allan Poe', w: ['Walt Whitman', 'Robert Frost', 'Ernest Hemingway'] },
  { lvl: 1, q: "Quelle ville a été ensevelie par l'éruption du Vésuve en l'an 79 ?", a: 'Pompéi', w: ['Carthage', 'Troie', 'Babylone'] },
  { lvl: 1, q: "Comment s'appelle le chien à trois têtes gardien des Enfers ?", a: 'Cerbère', w: ['Argos', 'Fenrir', 'Anubis'] },
  { lvl: 1, q: "Dans quelle région de Roumanie se situe le château associé à Dracula, selon la légende ?", a: 'La Transylvanie', w: ['La Moldavie', 'La Dobroudja', 'La Valachie du Sud'] },
  { lvl: 1, q: "Quel animal est le plus souvent associé aux vampires ?", a: 'La chauve-souris', w: ['Le corbeau', 'Le hibou', 'Le serpent'] },
  { lvl: 1, q: "À quelle date tombe Halloween ?", a: 'Le 31 octobre', w: ['Le 1er novembre', 'Le 13 octobre', 'Le 21 décembre'] },
  { lvl: 1, q: "Combien d'os compte le squelette d'un adulte ?", a: '206', w: ['106', '306', '412'] },
  { lvl: 1, q: "Quelle créature se transforme en loup les nuits de pleine lune ?", a: 'Le loup-garou', w: ['Le vampire', 'Le golem', 'La goule'] },
  { lvl: 2, q: "Quel film de 1973 met en scène une jeune fille possédée par un démon ?", a: "L'Exorciste", w: ['Les Dents de la mer', 'Carrie', 'Poltergeist'] },
  { lvl: 2, q: "Quel personnage masqué poursuit Laurie Strode dans « Halloween » (1978) ?", a: 'Michael Myers', w: ['Jason Voorhees', 'Freddy Krueger', 'Leatherface'] },
  { lvl: 2, q: "Quel fleuve les morts traversent-ils sur la barque de Charon ?", a: 'Le Styx', w: ['Le Nil', 'La Seine', 'Le Rhin'] },
  { lvl: 2, q: "Quel cimetière parisien abrite les tombes de Jim Morrison et d'Oscar Wilde ?", a: 'Le Père-Lachaise', w: ['Montparnasse', 'Montmartre', 'Passy'] },
  { lvl: 2, q: "Quel docteur imaginé par Robert Louis Stevenson se transforme en double monstrueux ?", a: 'Le docteur Jekyll', w: ['Le docteur Moreau', 'Le docteur Caligari', 'Le docteur Faust'] },
  { lvl: 2, q: "Quelle plante toxique porte un nom qui signifie « belle dame » en italien ?", a: 'La belladone', w: ['La digitale', 'La ciguë', 'Le laurier-rose'] },
  { lvl: 2, q: "Quel peintre a réalisé « Le Cri » ?", a: 'Edvard Munch', w: ['Francisco Goya', 'Salvador Dalí', 'Vincent van Gogh'] },
  { lvl: 2, q: "Quel écrivain a écrit « Le Fantôme de l'Opéra » ?", a: 'Gaston Leroux', w: ['Alexandre Dumas', 'Maurice Leblanc', 'Jules Verne'] },
  { lvl: 2, q: "Je parle sans bouche et j'entends sans oreilles. Que suis-je ?", a: 'Un écho', w: ['Un fantôme', 'Le vent', 'Une ombre'] },
  { lvl: 2, q: "Plus on m'enlève, plus je deviens grand. Que suis-je ?", a: 'Un trou', w: ['Un fantôme', "L'ombre", 'La nuit'] },
  { lvl: 2, q: "Je suis toujours devant toi, mais tu ne peux jamais me voir. Que suis-je ?", a: "L'avenir", w: ['Ton ombre', 'Le brouillard', 'Le vide'] },
  { lvl: 2, q: "Je suis légère comme une plume, pourtant personne ne peut me retenir plus de quelques minutes. Que suis-je ?", a: 'Le souffle', w: ['La fumée', 'Une ombre', 'Un rêve'] },
  { lvl: 3, q: "Quel peintre espagnol a réalisé « Saturne dévorant un de ses fils » ?", a: 'Francisco Goya', w: ['Diego Velázquez', 'Pablo Picasso', 'El Greco'] },
  { lvl: 3, q: "Dans le roman de Shirley Jackson (1959), quelle demeure est hantée ?", a: 'Hill House', w: ['Bly Manor', 'Hollow Hall', 'Thornfield'] },
  { lvl: 3, q: "Quel auteur a écrit « Le Tour d'écrou », célèbre histoire de fantômes (1898) ?", a: 'Henry James', w: ['Oscar Wilde', 'Charles Dickens', 'Henry Miller'] },
  { lvl: 3, q: "En quelle année le Titanic a-t-il coulé ?", a: '1912', w: ['1905', '1921', '1898'] },
];

// ---------------------------------------------------------------------------
//  Bluff : vraies anecdotes + leurres de secours
// ---------------------------------------------------------------------------
const PROMPTS = [
  {
    q: "En 1518, à Strasbourg, des centaines d'habitants ont été pris d'une étrange frénésie. Laquelle ?",
    real: "Ils se sont mis à danser pendant des jours sans pouvoir s'arrêter",
    decoys: [
      'Ils se sont mis à enterrer leurs vêtements au pied des arbres',
      'Ils ont cessé de parler pendant plusieurs semaines',
      'Ils ont refusé de sortir de chez eux après la tombée de la nuit',
    ],
  },
  {
    q: 'Que faisaient les « mangeurs de péchés » dans certaines régions de Grande-Bretagne ?',
    real: 'Ils mangeaient un repas posé sur un défunt, censé les charger de ses péchés',
    decoys: [
      'Ils goûtaient la nourriture des rois pour la protéger du poison',
      'Ils jeûnaient trente jours pour racheter les fautes du village',
      'Ils brûlaient les repas des défunts pour apaiser les esprits',
    ],
  },
  {
    q: 'Au Moyen Âge, que pouvait-il arriver à un cochon accusé d’avoir tué un enfant ?',
    real: 'Il pouvait être jugé devant un tribunal, puis condamné',
    decoys: [
      'Il était exilé hors de la ville avec une clochette au cou',
      'Il était offert à la famille de la victime en dédommagement',
      'Il était enfermé à vie dans la crypte de l’église',
    ],
  },
  {
    q: "À l'époque victorienne, quelle étrange habitude avaient certaines familles avec leurs défunts ?",
    real: 'Elles les faisaient photographier, parfois assis comme s’ils étaient vivants',
    decoys: [
      'Elles les gardaient une semaine dans le salon avant l’enterrement, un masque de cire sur le visage',
      'Elles faisaient sonner une cloche chaque nuit à leur place dans la maison',
      'Elles plaçaient leur portrait peint face au mur pendant un an',
    ],
  },
  {
    q: 'Au XIXe siècle, pourquoi certains cercueils étaient-ils équipés d’une cloche ?',
    real: 'Pour qu’une personne enterrée vivante par erreur puisse donner l’alerte',
    decoys: [
      'Pour annoncer l’arrivée du cortège funéraire au cimetière',
      'Pour chasser les mauvais esprits pendant le transport',
      'Pour signaler aux fossoyeurs que le cercueil était bien fermé',
    ],
  },
  {
    q: 'Pendant des siècles en Europe, à quoi servait la « mummia », une poudre issue de momies ?',
    real: 'À fabriquer des remèdes que l’on faisait avaler aux malades',
    decoys: [
      'À fabriquer une encre noire utilisée par les moines copistes',
      'À protéger les récoltes contre les corbeaux',
      'À sceller les cercueils des nobles pour empêcher les maladies de sortir',
    ],
  },
  {
    q: 'Que provoque le syndrome de Cotard, un trouble très rare ?',
    real: 'La personne est convaincue d’être morte ou de ne plus exister',
    decoys: [
      'La personne ne reconnaît plus son propre reflet dans les miroirs',
      'La personne entend en permanence une voix qui répète son nom',
      'La personne ne peut plus dormir pendant des mois',
    ],
  },
  {
    q: "Dans l'Europe du XVIIIe siècle, que faisait-on parfois d'un cadavre soupçonné d'être un vampire ?",
    real: 'On le déterrait pour lui planter un pieu dans le cœur ou lui couper la tête',
    decoys: [
      'On l’enterrait à nouveau avec une pierre dans la bouche et de l’ail dans les mains',
      'On l’exposait trois jours sur la place du village',
      'On l’arrosait d’eau bénite à minuit pendant sept nuits',
    ],
  },
  {
    q: 'Que montrait la « danse macabre », thème fréquent de l’art médiéval ?',
    real: 'La Mort entraînant dans sa danse des gens de tous les rangs sociaux',
    decoys: [
      'Des squelettes dansant seuls dans un cimetière à la pleine lune',
      'Un bal où les vivants dansaient masqués pour tromper la Mort',
      'Des villageois dansant autour d’un bûcher pour chasser la peste',
    ],
  },
];

module.exports = {
  CFG, ROLES, ITEMS, RUNES, GLYPHS, EVENTS, EVENTS_BY_ACT, CURSES, GESTURES,
  HALLU, NARR, ACTS, QUESTIONS, PROMPTS,
};
