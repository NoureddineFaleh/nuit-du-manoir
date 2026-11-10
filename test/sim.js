'use strict';
// Simulation sans réseau : N parties complètes jouées par des bots (horloge simulée).
// Vérifie que chaque partie se termine, que les invariants tiennent, et sort des statistiques d'équilibrage.
//   node test/sim.js [nbParties]

const assert = require('assert');
const { Game } = require('../src/game');
const C = require('../src/content');
const U = require('../src/util');

const GAMES = parseInt(process.argv[2] || '300', 10);
const STEP = 250;

function playGame(nPlayers, opts = {}) {
  let t = 1_000_000;
  const g = new Game({ now: () => t, scale: 1, onChange: () => {} });
  g.setTarget(nPlayers);
  const ps = [];
  for (let i = 0; i < nPlayers; i++) ps.push(g.addPlayer('Bot' + i, 'tok' + i));
  assert(g.start(), 'start');

  const acted = {};
  const once = (pid, key) => (acted[pid + key] ? false : (acted[pid + key] = true));
  const stats = { nights: 0, acts: new Set(), events: new Set(), chTypes: new Set(), curses: new Set(), items: {} };

  const bot = (p) => {
    const key = `${g.night}.${g.phase}.${g.challenge && g.challenge.step ? g.challenge.step : ''}`;
    const others = g.alive().filter((o) => o.id !== p.id);
    const send = (m) => g.handle(p.id, m);
    switch (g.phase) {
      case 'roles':
        if (once(p.id, key)) send({ t: 'done' });
        break;
      case 'crepuscule': {
        const ch = g.challenge;
        if (!p.alive || !once(p.id, key)) break;
        if (ch.type === 'quiz') ch.qs.forEach((q, i) => send({ t: 'ch', i, c: Math.random() < 0.6 ? q.a : U.rnd(q.opts.length) }));
        if (ch.type === 'memoire') {
          t = Math.max(t, ch.inputAt);
          send({ t: 'ch', seq: ch.seq.map((s) => (Math.random() < 0.75 ? s : U.rnd(9))) });
        }
        if (ch.type === 'reflexes') {
          ch.sched.forEach((ev, i) => {
            if ((ev.kind === 'eye' && Math.random() < 0.7) || (ev.kind === 'fake' && Math.random() < 0.15)) {
              t = Math.max(t, ch.goStart + ev.at); // simule un tap dans la fenêtre
              send({ t: 'ch', tap: i });
            }
          });
        }
        if (ch.type === 'bluff' && ch.step === 'write') send({ t: 'ch', text: 'Une réponse inventée par ' + p.name });
        if (ch.type === 'bluff' && ch.step === 'pick') {
          const cands = ch.opts.map((o, i) => [o, i]).filter(([o]) => o.owner !== p.id);
          send({ t: 'ch', pick: U.pick(cands)[1] });
        }
        break;
      }
      case 'minuit': {
        if (!once(p.id, key)) break;
        if (p.alive) {
          if (p.items.length && Math.random() < 0.7) {
            const it = U.pick(p.items);
            send({ t: 'act', kind: 'item', item: it, target: C.ITEMS[it].target ? U.pick(others).id : undefined });
          }
          if (p.id === g.marker && Math.random() < 0.8) send({ t: 'act', kind: 'mark', target: U.pick(others).id });
          if (p.role === 'lie' && !p.usedMurmur && Math.random() < 0.5) send({ t: 'act', kind: 'murmur', target: U.pick(others).id });
          if (Math.random() < 0.3) send({ t: 'act', kind: 'pacte', on: true });
        } else if (g.curseOptions.length) {
          send({ t: 'act', kind: 'curse', id: U.pick(g.curseOptions) });
        }
        send({ t: 'done' });
        break;
      }
      case 'veillee':
        if (once(p.id, key)) {
          if (p.alive && g.event && g.event.id === 'silence') send({ t: 'gesture', g: 0, target: U.pick(others).id });
          send({ t: 'done' });
        }
        break;
      case 'rituel':
        if (p.alive && once(p.id, key)) {
          const cands = g.eligible.filter((id) => id !== p.id);
          if (cands.length) send({ t: 'vote', target: Math.random() < 0.9 ? U.pick(cands) : null });
        }
        break;
      default:
    }
  };

  let guard = 0;
  let lastNight = 0;
  while (g.phase !== 'fin') {
    if (++guard > 200000) throw new Error(`partie bloquée en phase ${g.phase} nuit ${g.night}`);
    for (const p of g.players) bot(p);
    t += STEP;
    g.tick();

    // Invariants
    for (const p of g.players) {
      assert(p.raison >= 0 && p.raison <= C.CFG.RAISON, 'raison hors bornes');
      assert(p.alive === (p.raison > 0), 'alive incohérent avec raison');
      assert(p.items.length <= C.CFG.MAX_ITEMS, 'inventaire trop plein');
    }
    if (g.night !== lastNight) {
      lastNight = g.night;
      stats.nights = g.night;
      stats.acts.add(g.act);
      if (g.event) stats.events.add(g.event.id);
      if (g.challenge) stats.chTypes.add(g.challenge.type);
    }
    if (g.curse) stats.curses.add(g.curse);
    // Les vues ne doivent jamais planter ni fuiter de secrets
    const sv = JSON.stringify(g.screenView());
    for (const p of g.players) {
      JSON.stringify(g.viewFor(p.id));
      if (p.role && g.phase !== 'fin') assert(!sv.includes('"role"'), 'fuite de rôle sur la vue écran');
    }
  }
  const end = g.endView();
  return { g, end, stats };
}

// ---------------------------------------------------------------------------
const agg = { 4: { n: 0, lies: 0, sol: 0, chose: 0, nights: 0, maxNights: 0 }, 5: { n: 0, lies: 0, sol: 0, chose: 0, nights: 0, maxNights: 0 } };
const seen = { acts: new Set(), events: new Set(), chTypes: new Set(), curses: new Set() };
const t0 = Date.now();
for (let i = 0; i < GAMES; i++) {
  const n = i % 2 ? 5 : 4;
  const { end, stats } = playGame(n);
  const a = agg[n];
  a.n++;
  a.nights += stats.nights;
  a.maxNights = Math.max(a.maxNights, stats.nights);
  if (end.type === 'lies') a.lies++;
  else if (end.type === 'solitaire') a.sol++;
  else a.chose++;
  stats.acts.forEach((x) => seen.acts.add(x));
  stats.events.forEach((x) => seen.events.add(x));
  stats.chTypes.forEach((x) => seen.chTypes.add(x));
  stats.curses.forEach((x) => seen.curses.add(x));
}
console.log(`\n${GAMES} parties simulées en ${Date.now() - t0} ms — aucune partie bloquée, invariants OK\n`);
for (const n of [4, 5]) {
  const a = agg[n];
  const pct = (x) => ((100 * x) / a.n).toFixed(0) + '%';
  console.log(`${n} joueurs : ${a.n} parties · durée moyenne ${(a.nights / a.n).toFixed(1)} nuits (max ${a.maxNights}) · Liés ${pct(a.lies)} · Solitaire ${pct(a.sol)} · la Chose ${pct(a.chose)}`);
}
console.log('\nActes vus      :', [...seen.acts].sort().join(', '));
console.log('Épreuves vues  :', [...seen.chTypes].sort().join(', '));
console.log('Événements vus :', [...seen.events].sort().join(', '));
console.log('Malédictions   :', [...seen.curses].sort().join(', '));
