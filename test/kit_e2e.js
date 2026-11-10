'use strict';
// Parties complètes par WebSocket pour Le Village maudit et La Crypte (3, 4 et 5 joueurs, fr et tunisien).
//   node test/kit_e2e.js
process.env.TIME_SCALE = process.env.TIME_SCALE || '0.04';
const assert = require('assert');
const crypto = require('crypto');
const WebSocket = require('ws');
const { server } = require('../server');
const { Screen, setHost, sleep } = require('./botlib');
const P = require('../src/games/crypte/puzzle');

const pick = (a) => a[Math.floor(Math.random() * a.length)];

class KitBot {
  constructor(code, name, game, shared) {
    this.name = name; this.game = game; this.shared = shared; this.S = null; this.sent = new Set();
    this.token = crypto.randomBytes(8).toString('hex');
    this.ws = new WebSocket(`ws://${global.HOST}/ws?role=player&room=${code}`);
    this.joined = new Promise((res) => { this.onJoined = res; });
    this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'join', name, token: this.token })));
    this.ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.t === 'joined') { this.pid = m.pid; this.onJoined(); }
      if (m.t === 'state') { this.S = m; this.react(); }
    });
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  once(key, o) { if (this.sent.has(key)) return; this.sent.add(key); setTimeout(() => this.send(o), 5 + Math.random() * 30); }
  react() {
    const S = this.S;
    if (S.phase === 'lobby' || S.phase === 'fin') return;
    if (this.game === 'village') return this.village(S);
    return this.crypte(S);
  }
  village(S) {
    const v = S.vil; const me = S.me;
    if (!me.alive) return;
    const k = `${S.phase}:${v.night}`;
    if (S.phase === 'roles' || S.phase === 'debat') this.once(k, { t: 'done' });
    if (S.phase === 'nuit') this.once(k, v.need ? { t: 'act', target: pick(v.targets).id } : { t: 'done' });
    if (S.phase === 'vote') this.once(k, { t: 'vote', target: Math.random() < 0.1 ? null : pick(v.targets).id });
  }
  crypte(S) {
    const c = S.cr;
    if (S.phase === 'intro') return this.once('intro', { t: 'done' });
    if (S.phase !== 'chambre') return;
    // mise en commun des indices (partagés via l'objet shared, comme une discussion orale)
    this.shared.clues[c.chamber] = this.shared.clues[c.chamber] || {};
    this.shared.clues[c.chamber][this.pid] = c.clues;
    if (c.isOpener) {
      const got = Object.keys(this.shared.clues[c.chamber]).length;
      if (got < this.shared.n) return;
      const texts = Object.values(this.shared.clues[c.chamber]).flat();
      const k = `${c.chamber}:${c.attempts.length}`;
      // le solveur retrouve les indices structurés via le texte : on cherche la seule combinaison compatible côté serveur
      this.once(k, { t: 'try', guess: this.shared.solve(texts) });
    }
  }
}

async function playGame(game, n, lang) {
  const screen = new Screen(null, game);
  await screen.ready;
  assert(screen.joinUrl.includes(`/g/${game}/play?room=${screen.code}`), 'URL de jointure ' + screen.joinUrl);
  screen.send({ t: 'target', n });
  await screen.until((s) => s.target === n);
  if (lang) { screen.send({ t: 'lang', lang }); await screen.until((s) => s.lang === lang); }
  const shared = { n, clues: {}, solve: null };
  const bots = [];
  for (let i = 0; i < n; i++) { const b = new KitBot(screen.code, 'Bot' + (i + 1), game, shared); bots.push(b); await b.joined; }
  await screen.until((s) => s.players.length === n && s.canStart);
  const extra = new KitBot(screen.code, 'Intrus', game, shared);
  await sleep(250);
  extra.ws.close();
  screen.send({ t: 'start' });
  // solveur de la Crypte : on lit la vraie solution côté serveur de test (les textes ne sont pas parsés)
  if (game === 'crypte') {
    const { rooms } = require('../server');
    const room = rooms.get(screen.code);
    shared.solve = () => {
      const all = room.game.clues.flat();
      return P.ALL.find((c) => all.every((cl) => P.holds(cl, c)));
    };
  }
  await screen.until((s) => s.phase !== 'lobby');
  const end = await screen.until((s) => s.phase === 'fin', 120000);
  // la vue écran ne doit pas fuiter de rôle avant la fin (Village)
  if (game === 'village') assert(end.vil.roles && end.vil.roles.length === n, 'rôles révélés à la fin');
  screen.send({ t: 'restart' });
  await screen.until((s) => s.phase === 'lobby');
  assert.strictEqual(screen.S.players.length, n, 'mêmes joueurs après « rejouer »');
  bots.forEach((b) => b.ws.close());
  screen.ws.close();
  return { game, n, lang: lang || 'fr', phases: [...new Set(screen.phases)].join('>'), result: end.vil ? end.vil.winner : end.cr.winner };
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  global.HOST = '127.0.0.1:' + server.address().port;
  setHost(global.HOST);
  const t0 = Date.now();
  for (const [game, n, lang] of [['village', 3, 'fr'], ['village', 4, 'aeb'], ['village', 5, 'fr'], ['crypte', 3, 'fr'], ['crypte', 4, 'aeb'], ['crypte', 5, 'fr']]) {
    const r = await playGame(game, n, lang);
    console.log(`✔ ${r.game} ${r.n} joueurs [${r.lang}] → ${r.result}  (${r.phases})`);
  }
  console.log(`\nKIT E2E OK en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(0);
})().catch((e) => { console.error('\n✘ ÉCHEC :', e); process.exit(1); });
