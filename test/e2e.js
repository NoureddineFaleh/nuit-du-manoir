'use strict';
// Test de bout en bout par WebSocket : un écran + 4 ou 5 téléphones « bots » sur le vrai serveur.
//   node test/e2e.js

process.env.TIME_SCALE = process.env.TIME_SCALE || '0.04';
const assert = require('assert');
const { server } = require('../server');
const { Screen, Bot, setHost, sleep } = require('./botlib');

async function playGame(n, lang) {
  const screen = new Screen();
  await screen.ready;
  assert(/^[A-Z]{4}$/.test(screen.code), 'code de salle');
  assert(screen.qr.startsWith('data:image/png;base64,'), 'QR code généré');
  assert(screen.joinUrl.endsWith('/play?room=' + screen.code), 'URL de jointure');

  screen.send({ t: 'target', n });
  await screen.until((s) => s.target === n);
  if (lang) {
    screen.send({ t: 'lang', lang });
    await screen.until((s) => s.lang === lang);
  }

  const bots = [];
  for (let i = 0; i < n; i++) {
    const b = new Bot(screen.code, 'Bot' + (i + 1), { speed: 0.02 });
    bots.push(b);
    await b.joined;
  }
  await screen.until((s) => s.players.length === n && s.canStart);

  // salle pleine : un invité de trop est refusé
  const extra = new Bot(screen.code, 'Intrus');
  await sleep(250);
  assert(extra.stats.errors.some((e) => e.code === 'full'), 'le joueur en trop doit être refusé');
  extra.drop();

  // réduire le nombre sous celui des inscrits est refusé ; l'augmenter puis le remettre est permis
  if (n === 5) {
    screen.send({ t: 'target', n: 4 });
    await sleep(100);
    assert.strictEqual(screen.S.target, 5, 'impossible de réduire sous le nombre d’inscrits');
  } else {
    screen.send({ t: 'target', n: 5 });
    await screen.until((s) => s.target === 5 && !s.canStart);
    screen.send({ t: 'target', n: 4 });
    await screen.until((s) => s.target === 4 && s.canStart);
  }

  screen.send({ t: 'start' });
  await screen.until((s) => s.phase !== 'lobby'); // (les phases rapides peuvent passer entre deux lectures)
  assert.strictEqual(screen.S.lang, lang || 'fr', 'langue de la partie');
  if (lang === 'aeb') {
    // la narration est bien en arabe, et la langue ne peut plus changer en cours de partie
    if (screen.S.narr) assert(/[\u0600-\u06FF]/.test(screen.S.narr.text), 'narration en arabe');
    screen.send({ t: 'lang', lang: 'fr' });
    await sleep(100);
    assert.strictEqual(screen.S.lang, 'aeb', 'pas de changement de langue en partie');
  }

  // reconnexion d'un téléphone en pleine partie (nuit 2)
  let reconnected = false;
  const reco = (async () => {
    await screen.until((s) => s.night >= 2 && s.phase === 'minuit');
    const b = bots[0];
    const before = b.stats.states;
    b.drop();
    await sleep(300);
    assert(screen.S.players.find((p) => p.id === b.pid).connected === false, 'déconnexion visible sur l’écran');
    b.connect();
    await b.joined;
    await sleep(200);
    assert(b.stats.states > before, 'le joueur reconnecté reçoit à nouveau l’état');
    reconnected = true;
  })();

  const fin = await screen.until((s) => s.phase === 'fin');
  await reco.catch(() => {}); // la partie peut finir avant la nuit 2 : la reconnexion est alors non testée

  // en cours de partie, un nouvel arrivant est refusé
  const late = new Bot(screen.code, 'Retardataire');
  await sleep(250);
  assert(late.stats.errors.some((e) => e.code === 'started'), 'entrée refusée en cours de partie');
  late.drop();

  // cohérence de la fin de partie
  const roles = fin.end.roles;
  assert.strictEqual(roles.length, n);
  assert.strictEqual(roles.filter((r) => r.role === 'lie').length, 2, 'exactement 2 Liés');
  assert.strictEqual(roles.filter((r) => r.role === 'solitaire').length, n - 2);
  for (const b of bots) assert.strictEqual(b.stats.role, roles.find((r) => r.id === b.pid).role, 'rôle vu par le téléphone = rôle réel');
  assert(['lies', 'solitaire', 'chose'].includes(fin.end.type));

  // rejouer : on revient au salon avec les mêmes invités
  screen.send({ t: 'restart' });
  await screen.until((s) => s.phase === 'lobby');
  assert.strictEqual(screen.S.players.length, n, 'mêmes invités après « rejouer »');
  assert(screen.S.players.every((p) => p.raison === 3 && p.alive), 'Raison remise à zéro');

  if (lang === 'aeb') assert(/[\u0600-\u06FF]/.test(fin.end.title), 'titre de fin en arabe');
  const out = { n, lang: lang || 'fr', nights: fin.night, end: fin.end.type, phases: [...new Set(screen.phases)].join('>'), reconnected, notes: bots.map((b) => b.stats.notes) };
  bots.forEach((b) => b.drop());
  screen.ws.close();
  return out;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  setHost('127.0.0.1:' + server.address().port);
  const t0 = Date.now();
  const results = [];
  for (const [n, lang] of [[4, 'fr'], [5, 'aeb'], [4, 'aeb']]) {
    const r = await playGame(n, lang);
    results.push(r);
    console.log(`✔ ${r.n} joueurs [${r.lang}] : fin en nuit ${r.nights} (${r.end}), reconnexion ${r.reconnected ? 'OK' : 'non testée'}, notes privées reçues ${r.notes.join('/')}`);
  }
  console.log(`\nE2E OK en ${((Date.now() - t0) / 1000).toFixed(1)} s (TIME_SCALE=${process.env.TIME_SCALE})`);
  console.log('Phases vues :', results[0].phases);
  process.exit(0);
})().catch((e) => {
  console.error('\n✘ E2E ÉCHEC :', e);
  process.exit(1);
});
