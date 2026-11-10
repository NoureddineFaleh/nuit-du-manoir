'use strict';
// Remplit une salle de bots pour tester seul(e) avec ton propre téléphone.
//   1. npm start, ouvre l'écran, choisis 4 ou 5 invités
//   2. node test/bots.js CODE 3        (ex. : CODE affiché sous le QR code, 3 bots + toi = 4 joueurs)
// Options : PORT=3000 HOST=127.0.0.1 node test/bots.js CODE 3

const { Bot, setHost } = require('./botlib');

const [code, nStr] = process.argv.slice(2);
if (!code || !/^[A-Za-z]{4}$/.test(code)) {
  console.error('Usage : node test/bots.js CODE [nombre_de_bots]\n  CODE = les 4 lettres affichées sous le QR code');
  process.exit(1);
}
setHost(`${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`);
const names = ['Mina', 'Jules', 'Camille', 'Noé'];
const n = Math.max(1, Math.min(4, parseInt(nStr || '3', 10)));
const bots = [];
for (let i = 0; i < n; i++) {
  const b = new Bot(code.toUpperCase(), names[i], { speed: 1 });
  bots.push(b);
  b.joined.then(() => console.log(`🕯️  ${names[i]} s'est assis(e) à la table`));
}
setTimeout(() => {
  bots.forEach((b) => b.stats.errors.forEach((e) => console.error(`${b.name} : ${e.text}`)));
}, 3000);
console.log(`${n} bot(s) rejoignent la salle ${code.toUpperCase()}… Ctrl+C pour les renvoyer.`);
