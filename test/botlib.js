'use strict';
// Écran et téléphones « bots » (WebSocket) partagés par les tests et par `npm run bots`.
// Les bots n'utilisent que ce que leur vue leur montre : pas de triche.

const assert = require('assert');
const crypto = require('crypto');
const WebSocket = require('ws');

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let HOST = '127.0.0.1:3000';
const setHost = (h) => (HOST = h);
const url = (q) => `ws://${HOST}/ws?${q}`;

class Screen {
  constructor(code, game) {
    this.phases = [];
    this.game = game || 'manoir';
    this.ws = new WebSocket(url('role=screen' + (game ? '&game=' + game : '') + (code ? '&room=' + code : '')));
    this.ready = new Promise((res) => (this.onHello = res));
    this.ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.t === 'hello') {
        Object.assign(this, { code: m.code, qr: m.qr, joinUrl: m.joinUrl });
        this.onHello();
      }
      if (m.t === 'screen') {
        this.S = m;
        if (this.phases[this.phases.length - 1] !== m.phase) this.phases.push(m.phase);
        if (this.game === 'manoir') assert(!/"role"/.test(JSON.stringify(m)) || m.phase === 'fin', 'fuite de rôle dans la vue écran');
      }
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async until(pred, ms = 120000) {
    const t0 = Date.now();
    while (!(this.S && pred(this.S))) {
      if (Date.now() - t0 > ms) throw new Error('timeout, phase=' + (this.S && this.S.phase));
      await sleep(25);
    }
    return this.S;
  }
}

class Bot {
  /** `smart` : le bot joue « bien » (réponses justes quand il peut les connaître). */
  constructor(code, name, { speed = 1 } = {}) {
    this.code = code;
    this.name = name;
    this.speed = speed; // multiplie les délais de réaction (1 = rapide, utile pour les tests accélérés)
    this.token = crypto.randomBytes(12).toString('hex');
    this.acted = new Set();
    this.stats = { states: 0, notes: 0, role: null, errors: [] };
    this.connect();
  }
  connect() {
    this.ws = new WebSocket(url(`role=player&room=${this.code}`));
    this.joined = new Promise((res) => (this.onJoined = res));
    this.ws.on('open', () => this.send({ t: 'join', name: this.name, token: this.token }));
    this.ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.t === 'joined') {
        this.pid = m.pid;
        this.content = m.content.fr; // la structure (cibles des objets…) est identique dans toutes les langues
        this.onJoined(m);
      } else if (m.t === 'error') this.stats.errors.push(m);
      else if (m.t === 'state') {
        this.S = m;
        this.stats.states++;
        assert(m.players.every((p) => !('role' in p)), 'fuite de rôle dans la liste des joueurs');
        if (m.me.role) this.stats.role = m.me.role;
        this.stats.notes = Math.max(this.stats.notes, m.log.length);
        this.react(m);
      }
    });
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  drop() { this.ws.close(); }

  react(S) {
    if (!S.me) return;
    const key = `${S.night}.${S.phase}.${S.ch ? S.ch.id + (S.ch.step || '') : ''}`;
    if (this.acted.has(key)) return;
    this.acted.add(key);
    const me = S.me;
    const others = S.players.filter((p) => p.alive && p.id !== me.id);
    const delay = (ms, fn) => setTimeout(fn, ms * this.speed);
    switch (S.phase) {
      case 'roles':
        delay(rnd(100), () => this.send({ t: 'done' }));
        break;
      case 'crepuscule': {
        if (!me.alive) break;
        const c = S.ch;
        if (c.type === 'quiz') c.qs.forEach((q, i) => delay(300 * (i + 1) + rnd(400), () => this.send({ t: 'ch', i, c: rnd(q.opts.length) })));
        if (c.type === 'memoire') setTimeout(() => this.send({ t: 'ch', seq: c.seq }), Math.max(0, c.inputAt - Date.now()) + rnd(1500) * this.speed);
        if (c.type === 'reflexes') {
          c.sched.forEach((ev, i) => {
            if (ev.kind === 'eye' && Math.random() < 0.7) setTimeout(() => this.send({ t: 'ch', tap: i }), Math.max(0, c.goStart + ev.at - Date.now()) + 150);
          });
        }
        if (c.type === 'bluff' && c.step === 'write') delay(1500 + rnd(2000), () => this.send({ t: 'ch', text: `Invention de ${this.name}` }));
        if (c.type === 'bluff' && c.step === 'pick') {
          const i = pick(c.options.map((o, k) => [o, k]).filter(([o]) => !o.mine))[1];
          delay(1000 + rnd(2000), () => this.send({ t: 'ch', pick: i }));
        }
        break;
      }
      case 'minuit': {
        if (!me.alive) {
          const o = S.minuit.curseOptions;
          if (o.length) this.send({ t: 'act', kind: 'curse', id: pick(o) });
        } else {
          if (me.items.length && Math.random() < 0.7) {
            const id = pick(me.items);
            this.send({ t: 'act', kind: 'item', item: id, target: this.content.items[id].target ? pick(others).id : undefined });
          }
          if (me.marker && Math.random() < 0.8) this.send({ t: 'act', kind: 'mark', target: pick(others).id });
          if (me.role === 'lie' && !me.usedMurmur && Math.random() < 0.6) this.send({ t: 'act', kind: 'murmur', target: pick(others).id });
          if (S.minuit.canPacte && Math.random() < 0.3) this.send({ t: 'act', kind: 'pacte', on: true });
        }
        delay(1500 + rnd(3000), () => this.send({ t: 'done' }));
        break;
      }
      case 'veillee':
        if (me.alive && S.veillee.silence) this.send({ t: 'gesture', g: 0, target: pick(others).id });
        delay(4000 + rnd(8000), () => this.send({ t: 'done' }));
        break;
      case 'rituel':
        if (me.alive && !S.rituel.auto && !S.rituel.isPossessed) {
          const c = S.rituel.eligible.filter((id) => id !== me.id);
          if (c.length) delay(1500 + rnd(4000), () => this.send({ t: 'vote', target: pick(c) }));
        }
        break;
      default:
    }
  }
}

module.exports = { Screen, Bot, setHost, sleep, rnd, pick };
