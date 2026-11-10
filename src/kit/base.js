'use strict';
// Socle commun des jeux « Parent Game Show » : salon, joueurs, langue, phases chronométrées.
// Un jeu hérite de BaseGame et implémente : begin(), onTick(), onMessage(pid,m), extraScreen(v), extraPhone(v,p).
// L'interface publique (utilisée par server.js) est identique à celle de src/game.js.

const U = require('../util');

const PALETTE = ['#c0392b', '#d4a017', '#3498c8', '#9b59b6', '#2ecc8f'];

class BaseGame {
  /** def : { min, max, packs: { fr, aeb }, defaultLang } */
  constructor(opts, def) {
    this.def = def;
    this.now = opts.now || Date.now;
    this.scale = opts.scale || 1;
    this.onChange = opts.onChange || (() => {});
    this.target = def.max;
    this.lang = opts.lang && def.packs[opts.lang] ? opts.lang : def.defaultLang || 'fr';
    this.players = [];
    this.narr = { id: 0, text: '' };
    this.resetBase();
  }

  get L() { return this.def.packs[this.lang]; }
  get T() { return this.L.T; }
  S(sec) { return Math.round(sec * 1000 * this.scale); }
  changed() { this.onChange(); }
  byId(id) { return this.players.find((p) => p.id === id) || null; }
  alive() { return this.players.filter((p) => p.alive); }
  nameOf(id) { const p = this.byId(id); return p ? p.name : '?'; }

  resetBase() {
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.winner = null;
  }

  // ---- salon -------------------------------------------------------------
  setLang(code) {
    if (this.phase !== 'lobby' || !this.def.packs[code] || code === this.lang) return false;
    this.lang = code;
    this.changed();
    return true;
  }

  cleanName(name) {
    const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
    return n || this.T.guest;
  }

  makePlayer(k) {
    return { id: k.id, name: k.name, token: k.token, color: k.color, connected: k.connected !== false, alive: true, done: false };
  }

  addPlayer(name, token) {
    if (this.phase !== 'lobby' || this.players.length >= this.target) return null;
    let nm = this.cleanName(name);
    const base = nm;
    let k = 2;
    while (this.players.some((p) => p.name.toLowerCase() === nm.toLowerCase())) nm = `${base} ${k++}`;
    const used = new Set(this.players.map((p) => p.color));
    const color = PALETTE.find((c) => !used.has(c)) || PALETTE[0];
    const p = this.makePlayer({ id: U.uid(), name: nm, token, color });
    this.players.push(p);
    this.changed();
    return p;
  }

  removePlayer(id) {
    if (this.phase !== 'lobby') return false;
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.players.splice(i, 1);
    this.changed();
    return true;
  }

  setConnected(id, v) {
    const p = this.byId(id);
    if (p && p.connected !== v) { p.connected = v; this.changed(); }
  }

  setTarget(n) {
    if (this.phase !== 'lobby' || !Number.isInteger(n) || n < this.def.min || n > this.def.max || n < this.players.length) return false;
    this.target = n;
    this.changed();
    return true;
  }

  canStart() {
    return this.phase === 'lobby' && this.players.length === this.target && this.target >= this.def.min;
  }

  start() {
    if (!this.canStart()) return false;
    this.begin();
    return true;
  }

  restart() {
    this.players = this.players.map((p) => this.makePlayer(p));
    this.resetBase();
    this.reset();
    this.changed();
  }

  // ---- phases ------------------------------------------------------------
  startPhase(phase, secs) {
    this.phase = phase;
    this.phaseEndsAt = secs ? this.now() + this.S(secs) : 0;
    for (const p of this.players) p.done = false;
    this.changed();
  }

  say(text) { this.narr = { id: this.narr.id + 1, text }; }

  /** Joueurs à attendre : vivants connectés (ou tous les vivants si personne n'est connecté). */
  watchers() {
    const alive = this.alive();
    const conn = alive.filter((p) => p.connected);
    return conn.length ? conn : alive;
  }
  allDone() { return this.watchers().every((p) => p.done); }
  timeUp() { return this.phaseEndsAt && this.now() >= this.phaseEndsAt; }

  skip() {
    if (this.phase === 'lobby' || this.phase === 'fin') return;
    this.phaseEndsAt = this.now();
    this.tick();
  }

  tick() {
    if (this.phase === 'lobby' || this.phase === 'fin') return;
    this.onTick();
  }

  handle(pid, m) {
    const p = this.byId(pid);
    if (!p || !m || typeof m.t !== 'string') return;
    this.onMessage(p, m);
  }

  // ---- vues --------------------------------------------------------------
  baseScreen() {
    return {
      t: 'screen', now: this.now(), lang: this.lang, phase: this.phase, endsAt: this.phaseEndsAt,
      target: this.target, min: this.def.min, max: this.def.max, canStart: this.canStart(), narr: this.narr,
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, alive: p.alive, connected: p.connected, done: p.done })),
    };
  }

  screenView() {
    const v = this.baseScreen();
    this.extraScreen(v);
    return v;
  }

  viewFor(pid) {
    const p = this.byId(pid);
    if (!p) return null;
    const v = {
      t: 'state', lang: this.lang, phase: this.phase, endsAt: this.phaseEndsAt, target: this.target,
      me: { id: p.id, name: p.name, color: p.color, alive: p.alive, done: p.done },
      players: this.players.map((q) => ({ id: q.id, name: q.name, color: q.color, alive: q.alive })),
    };
    this.extraPhone(v, p);
    return v;
  }

  // ---- à surcharger ------------------------------------------------------
  reset() {}
  begin() { throw new Error('begin() manquant'); }
  onTick() {}
  onMessage() {}
  extraScreen() {}
  extraPhone() {}
}

module.exports = { BaseGame, PALETTE };
