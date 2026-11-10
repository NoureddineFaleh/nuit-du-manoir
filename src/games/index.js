'use strict';
// Catalogue des jeux du « Parent Game Show ». Chaque jeu expose la même interface (voir README, « Ajouter un jeu »):
//   new Game({scale,onChange}) avec setTarget, setLang, start, restart, skip, tick, addPlayer,
//   removePlayer, setConnected, byId, handle(pid,msg), screenView(), viewFor(pid), players, phase.
const { Game: Manoir } = require('../game');
const { CLIENT_CONTENT, LANG_LIST } = require('../lang');
const village = require('./village');
const crypte = require('./crypte');

/** Contenu envoyé aux navigateurs pour un jeu du socle commun : { fr: {lang,dir,…,ui,ROLES…}, aeb: {…} } */
function kitContent(mod) {
  const out = {};
  for (const [code, p] of Object.entries(mod.packs)) {
    const { T, CLUE, ...pub } = p; // eslint-disable-line no-unused-vars
    out[code] = { ...pub, lang: p.code };
  }
  return out;
}

const GAMES = {
  manoir: {
    id: 'manoir', Game: Manoir, content: CLIENT_CONTENT, langs: LANG_LIST, min: 4, max: 5, minutes: '45–60', kind: 'manoir',
    title: { fr: 'La Nuit du Manoir', aeb: 'ليلة القصر' },
    tagline: {
      fr: 'Déduction sociale. Deux alliés secrets, des défis, un vote, et la Raison qui s’éteint bougie après bougie.',
      aeb: 'خدعة وتخمين. زوز متحالفين في السر، تحديات، تصويت، والعقل يطفى شمعة بشمعة.',
    },
    accent: '#f0b35a',
  },
  village: {
    id: 'village', Game: village.Game, content: kitContent(village), langs: LANG_LIST, min: 3, max: 5, minutes: '20–30', kind: 'kit',
    title: { fr: 'Le Village maudit', aeb: 'القرية المسخوطة' },
    tagline: {
      fr: 'Loup-garou version horreur. Une Bête se cache au village : la nuit elle dévore, le jour vous votez.',
      aeb: 'لعبة الوحش في القرية. وحش مستخبّي بيناتكم: في الليل ياكل، وفي النهار تصوّتو.',
    },
    accent: '#c2354a',
  },
  crypte: {
    id: 'crypte', Game: crypte.Game, content: kitContent(crypte), langs: LANG_LIST, min: 3, max: 5, minutes: '15–25', kind: 'kit',
    title: { fr: 'La Crypte', aeb: 'الجبّانة' },
    tagline: {
      fr: 'Coopération sous pression. Chacun détient des indices différents : parlez avant que les torches ne s’éteignent.',
      aeb: 'تعاون تحت الضغط. كل واحد عندو أدلة مختلفة: احكيو قبل ما المشاعل تطفى.',
    },
    accent: '#6fc2b4',
  },
};
const DEFAULT_GAME = 'manoir';

/** Description publique (sans les classes) pour la page d'accueil. */
const catalogue = () =>
  Object.values(GAMES).map(({ id, min, max, minutes, title, tagline, accent }) => ({ id, min, max, minutes, title, tagline, accent }));

module.exports = { GAMES, DEFAULT_GAME, catalogue };
