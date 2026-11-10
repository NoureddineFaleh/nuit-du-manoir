'use strict';
// Langues disponibles : fr (français) et aeb (dialecte tunisien, lettres arabes).
const C = require('../content');

const LANGS = { fr: require('./fr'), aeb: require('./aeb') };
const DEFAULT = 'fr';

const pack = (code) => LANGS[code] || LANGS[DEFAULT];

/** Contenu envoyé aux navigateurs : structure + textes de la langue (sans les fonctions serveur). */
function clientContent(code) {
  const L = pack(code);
  const merge = (struct, texts) => Object.fromEntries(Object.keys(struct).map((k) => [k, { ...struct[k], ...(texts[k] || {}) }]));
  return {
    lang: L.code, dir: L.dir, htmlLang: L.htmlLang, speech: L.speech, voice: L.voice !== false,
    roles: merge(C.ROLES, L.ROLES),
    items: merge(C.ITEMS, L.ITEMS),
    curses: merge(C.CURSES, L.CURSES),
    events: merge(C.EVENTS, L.EVENTS),
    acts: merge(C.ACTS, L.ACTS),
    gestures: C.GESTURES.map((g, i) => ({ ...g, ...L.GESTURES[i] })),
    cfg: { raison: C.CFG.RAISON, maxItems: C.CFG.MAX_ITEMS },
  };
}

const CLIENT_CONTENT = Object.fromEntries(Object.keys(LANGS).map((k) => [k, clientContent(k)]));
const LANG_LIST = Object.values(LANGS).map((l) => ({ code: l.code, label: l.label }));

/** Script servi à /ui.js : tous les textes d'interface + sens d'écriture de chaque langue. */
const UI_SCRIPT =
  'window.UI_TEXT=' + JSON.stringify(Object.fromEntries(Object.values(LANGS).map((l) => [l.code, l.UI]))) +
  ';window.UI_META=' + JSON.stringify(Object.fromEntries(Object.values(LANGS).map((l) => [l.code, { dir: l.dir, htmlLang: l.htmlLang, speech: l.speech, voice: l.voice !== false }]))) + ';';

module.exports = { UI_SCRIPT, LANGS, DEFAULT, pack, CLIENT_CONTENT, LANG_LIST };
