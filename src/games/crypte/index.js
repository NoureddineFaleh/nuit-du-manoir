'use strict';
// « La Crypte » : énigme coopérative, 3 à 5 joueurs. Chacun détient des indices différents.
const { BaseGame } = require('../../kit/base');
const P = require('./puzzle');
const { packs } = require('./lang');

const SECS = { intro: 18, chambre: 150, extra: 45, ouvert: 7 };
const CHAMBERS = 4;
const TORCHES = 5;
const DEF = { min: 3, max: 5, packs, defaultLang: 'fr' };

class Crypte extends BaseGame {
  constructor(opts = {}) {
    super(opts, DEF);
    this.reset();
  }

  reset() {
    this.chamber = 0;
    this.torches = TORCHES;
    this.code = null;
    this.clues = [];
    this.attempts = [];
    this.hints = [null, null, null, null];
    this.lastCode = null;
  }

  begin() {
    this.reset();
    this.say(this.T.intro);
    this.startPhase('intro', SECS.intro);
  }

  nextChamber() {
    this.chamber += 1;
    const g = P.generate(this.players.length);
    this.code = g.code;
    this.clues = g.clues;
    this.attempts = [];
    this.hints = [null, null, null, null];
    this.say(this.T.chamber(this.chamber, CHAMBERS));
    this.startPhase('chambre', SECS.chambre);
  }

  opener() {
    return this.players[(this.chamber - 1) % this.players.length];
  }

  lose() {
    this.winner = 'lose';
    this.lastCode = this.code;
    this.say(this.T.lose);
    this.startPhase('fin', 0);
  }

  hint() {
    const free = [0, 1, 2, 3].filter((i) => this.hints[i] === null);
    if (free.length) { const i = free[Math.floor(Math.random() * free.length)]; this.hints[i] = this.code[i]; }
  }

  onTick() {
    switch (this.phase) {
      case 'intro':
        if (this.timeUp() || this.allDone()) this.nextChamber();
        break;
      case 'chambre':
        if (this.timeUp()) {
          this.torches -= 1;
          if (this.torches <= 0) return this.lose();
          this.hint();
          this.say(this.T.timeUp);
          this.phaseEndsAt = this.now() + this.S(SECS.extra);
          this.changed();
        }
        break;
      case 'ouvert':
        if (this.timeUp()) {
          if (this.chamber >= CHAMBERS) {
            this.winner = 'win';
            this.say(this.T.win);
            this.startPhase('fin', 0);
          } else this.nextChamber();
        }
        break;
      default:
    }
  }

  onMessage(p, m) {
    if (m.t === 'done' && this.phase === 'intro') {
      p.done = true;
      this.changed();
      this.tick();
    } else if (m.t === 'try' && this.phase === 'chambre' && this.opener().id === p.id) {
      const g = m.guess;
      if (!Array.isArray(g) || g.length !== P.LEN || !g.every((x) => Number.isInteger(x) && x >= 0 && x < P.NG) || new Set(g).size !== P.LEN) return;
      const fb = P.feedback(this.code, g);
      if (fb.exact === P.LEN) {
        this.lastCode = this.code;
        this.attempts.push({ guess: g, ...fb });
        this.say(this.T.open);
        this.startPhase('ouvert', SECS.ouvert);
        return;
      }
      this.attempts.push({ guess: g, ...fb });
      this.torches -= 1;
      if (this.torches <= 0) return this.lose();
      this.say(this.T.wrong(fb.exact, fb.near));
      this.changed();
    }
  }

  glyphs() { return this.L.GLYPHS.map((g, i) => ({ id: i, icon: g.icon, name: g.name })); }

  clueText(cl) {
    const G = (i) => this.L.GLYPHS[i].name;
    const C = this.L.CLUE;
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    switch (cl.k) {
      case 'at': return cap(C.at(G(cl.g), cl.p + 1));
      case 'notAt': return cap(C.notAt(G(cl.g), cl.p + 1));
      case 'present': return cap(C.present(G(cl.g)));
      case 'absent': return cap(C.absent(G(cl.g)));
      case 'before': return cap(C.before(G(cl.a), G(cl.b)));
      case 'adjacent': return cap(C.adjacent(G(cl.a), G(cl.b)));
      case 'parity': return cap(C.parity(G(cl.g), cl.odd));
      default: return '';
    }
  }

  shared() {
    const op = this.chamber ? this.opener() : null;
    return {
      chamber: this.chamber, chambers: CHAMBERS, torches: this.torches, maxTorches: TORCHES,
      opener: op ? { id: op.id, name: op.name } : null, attempts: this.attempts.slice(-6),
      hints: this.hints, glyphs: this.glyphs(),
    };
  }

  extraScreen(v) {
    v.cr = this.shared();
    if (this.phase === 'intro') v.cr.ready = { done: this.players.filter((p) => p.done).length, total: this.players.length };
    if (this.phase === 'ouvert' || this.phase === 'fin') v.cr.code = this.lastCode;
    if (this.phase === 'fin') v.cr.winner = this.winner;
  }

  extraPhone(v, p) {
    if (this.phase === 'lobby') return;
    v.cr = this.shared();
    v.cr.clues = this.chamber && this.clues[this.players.indexOf(p)] ? this.clues[this.players.indexOf(p)].map((c) => this.clueText(c)) : [];
    v.cr.isOpener = !!(this.chamber && this.opener().id === p.id);
    if (this.phase === 'ouvert' || this.phase === 'fin') v.cr.code = this.lastCode;
    if (this.phase === 'fin') v.cr.winner = this.winner;
  }
}

module.exports = { Game: Crypte, packs, DEF };
