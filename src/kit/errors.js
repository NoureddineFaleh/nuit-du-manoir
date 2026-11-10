'use strict';
// Messages d'erreur génériques (salon) pour les jeux du Parent Game Show.
const ERR = {
  fr: { kicked: 'Tu as été renvoyé de la table.', noroom: 'Salle introuvable. Scanne de nouveau le QR code de l’écran.', started: 'La partie a déjà commencé.', full: 'La table est pleine.', token: 'Identifiant invalide.' },
  aeb: { kicked: 'تطردت من الطاولة.', noroom: 'ما لقيناش القاعة. عاود امسح الكود اللي في الشاشة.', started: 'اللعبة بدات من قبل.', full: 'الطاولة عامرة.', token: 'معرّف غير صالح.' },
};
const errText = (code) => Object.values(ERR).map((e) => e[code]).join('  /  ');
module.exports = { errText };
