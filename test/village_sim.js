'use strict';
// Simulation logique du Village maudit (horloge simulée), 3 à 5 joueurs, 300 parties.
const { Game } = require('../src/games/village');
const out = {};
for (let n = 3; n <= 5; n++) {
  for (let r = 0; r < 100; r++) {
    let t = 1e6;
    const g = new Game({ now: () => t });
    for (let i = 0; i < n; i++) g.addPlayer('P' + i, 'tok' + i);
    g.setTarget(n);
    if (!g.start()) throw new Error('start');
    let k = 0;
    while (g.phase !== 'fin' && k++ < 2000) {
      for (const p of g.alive()) {
        if (!p.alive || g.phase === 'fin') continue;
        const ph = g.phase;
        const v = g.viewFor(p.id);
        if (ph === 'nuit') {
          if (g.needsTarget(p)) g.handle(p.id, { t: 'act', target: v.vil.targets[Math.floor(Math.random() * v.vil.targets.length)].id });
          else g.handle(p.id, { t: 'done' });
        }
        if (ph === 'roles' || ph === 'debat') g.handle(p.id, { t: 'done' });
        if (ph === 'vote') {
          // le village croit le Guetteur (80 %) ; la Bête vote au hasard
          const seer = g.players.find((q) => q.role === 'voyant');
          let tgt = v.vil.targets[Math.floor(Math.random() * v.vil.targets.length)].id;
          if (seer && p.role !== 'bete') {
            const hit = (g.logs[seer.id] || []).map((l) => l.text).find((x) => / est une Bête\.$/.test(x));
            const cand = hit && v.vil.targets.find((q) => hit === g.T.seerBete(q.name));
            if (cand && Math.random() < 0.8) tgt = cand.id;
          }
          g.handle(p.id, { t: 'vote', target: tgt });
        }
      }
      t += Math.random() < 0.3 ? 20000 : 1500;
      g.tick();
      JSON.stringify(g.screenView());
      g.players.forEach((p) => JSON.stringify(g.viewFor(p.id)));
    }
    if (g.phase !== 'fin') throw new Error(`bloqué n=${n} phase=${g.phase}`);
    const key = `${n} joueurs : ${g.winner}`;
    out[key] = (out[key] || 0) + 1;
  }
}
console.log(out);
