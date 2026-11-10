'use strict';
// Simulation de La Crypte : le solveur ne connaît que les indices de TOUS les joueurs (mise en commun orale).
const { Game } = require('../src/games/crypte');
const P = require('../src/games/crypte/puzzle');
let wins = 0, loses = 0, tries = 0;
for (let n = 3; n <= 5; n++) {
  for (let r = 0; r < 60; r++) {
    let t = 1e6;
    const g = new Game({ now: () => t });
    for (let i = 0; i < n; i++) g.addPlayer('P' + i, 'tok' + i);
    g.setTarget(n); g.start();
    let k = 0;
    while (g.phase !== 'fin' && k++ < 500) {
      if (g.phase === 'intro') g.players.forEach((p) => g.handle(p.id, { t: 'done' }));
      if (g.phase === 'chambre') {
        // personne seul ne trouve ; ensemble : une seule solution
        const all = g.clues.flat();
        const sols = P.ALL.filter((c) => all.every((cl) => P.holds(cl, c)));
        if (sols.length !== 1) throw new Error('solution non unique ' + sols.length);
        g.clues.forEach((set) => { if (P.count(set) <= 1) throw new Error('un joueur seul peut trouver'); });
        const views = g.players.map((p) => g.viewFor(p.id));
        views.forEach((v) => { if (!v.cr.clues.length) throw new Error('joueur sans indice'); });
        const text = views.flatMap((v) => v.cr.clues).join('|');
        if (/undefined|NaN/.test(text)) throw new Error('texte invalide: ' + text);
        // 20 % d'erreur : mauvais essai d'abord
        const guess = Math.random() < 0.2 ? P.ALL[Math.floor(Math.random() * P.ALL.length)] : sols[0];
        tries++;
        g.handle(g.opener().id, { t: 'try', guess });
      }
      t += g.phase === 'ouvert' ? 8000 : 1000;
      g.tick();
      JSON.stringify(g.screenView());
    }
    if (g.phase !== 'fin') throw new Error('bloqué ' + g.phase);
    g.winner === 'win' ? wins++ : loses++;
  }
}
console.log({ wins, loses, tries });
