'use strict';
// Logique complète d'une partie de « La Nuit du Manoir ».
// Aucune dépendance réseau : le serveur appelle handle() / tick() et lit screenView() / viewFor().

const C = require('./content');
const U = require('./util');
const CH = require('./challenges');
const { pack, DEFAULT, LANGS } = require('./lang');

const { CFG } = C;
const PALETTE = ['#c0392b', '#d4a017', '#3498c8', '#9b59b6', '#2ecc8f'];

class Game {
  constructor(opts = {}) {
    this.now = opts.now || Date.now;
    this.scale = opts.scale || 1;
    this.onChange = opts.onChange || (() => {});
    this.target = 5;
    this.lang = opts.lang && LANGS[opts.lang] ? opts.lang : DEFAULT;
    this.players = [];
    this.resetState();
  }

  get L() {
    return pack(this.lang);
  }

  /** Langue de la partie (modifiable uniquement au salon). */
  setLang(code) {
    if (this.phase !== 'lobby' || !LANGS[code] || code === this.lang) return false;
    this.lang = code;
    this.narr = { id: (this.narr ? this.narr.id : 0) + 1, text: '' };
    this.changed();
    return true;
  }

  // -------------------------------------------------------------------------
  //  Utilitaires
  // -------------------------------------------------------------------------
  S(sec) {
    return Math.round(sec * 1000 * this.scale);
  }
  changed() {
    this.onChange();
  }
  byId(id) {
    return this.players.find((p) => p.id === id) || null;
  }
  alive() {
    return this.players.filter((p) => p.alive);
  }
  alivePids() {
    return this.alive().map((p) => p.id);
  }
  /** Vivants connectés (ou tous les vivants si personne n'est connecté : on attend alors les minuteurs). */
  watchers() {
    const alive = this.alive();
    const conn = alive.filter((p) => p.connected);
    return (conn.length ? conn : alive).map((p) => p.id);
  }
  say(key) {
    this.sayText(U.pick(this.L.NARR[key]));
  }
  sayText(text) {
    this.narr = { id: (this.narr ? this.narr.id : 0) + 1, text };
  }
  note(pid, kind, text) {
    if (!this.logs[pid]) this.logs[pid] = [];
    this.logs[pid].push({ night: this.night, kind, text });
  }
  blank(k) {
    return {
      id: k.id, name: k.name, token: k.token, color: k.color, connected: k.connected !== false,
      role: null, raison: CFG.RAISON, alive: true, items: [], done: false, usedMurmur: false,
    };
  }

  resetState() {
    this.phase = 'lobby';
    this.phaseEndsAt = 0;
    this.night = 0;
    this.act = 1;
    this.lastAct = 0;
    this.banner = false;
    this.narr = this.narr || { id: 0, text: '' };
    this.marker = null;
    this.challenge = null;
    this.chResult = null;
    this.usedQ = new Set();
    this.usedP = new Set();
    this.lastType = null;
    this.event = null;
    this.nextEvent = null;
    this.possessed = null;
    this.possessTarget = null;
    this.runes = {};
    this.pairRune = null;
    this.runeShared = false;
    this.revealedRune = null;
    this.actions = {};
    this.votes = {};
    this.curseOptions = [];
    this.curseVotes = {};
    this.curse = null;
    this.pendingDamage = [];
    this.shield = {};
    this.trap = new Set();
    this.usedTonight = new Set();
    this.attackedTonight = new Set();
    this.hallu = new Set();
    this.ranking = [];
    this.gained = {};
    this.labels = {};
    this.eligible = [];
    this.auto = false;
    this.allVotedAt = 0;
    this.designated = null;
    this.tieNote = '';
    this.voteDetail = null;
    this.voteHidden = false;
    this.aube = null;
    this.gestures = {};
    this.veilleeStart = 0;
    this.logs = {};
    this.winner = null;
  }

  // -------------------------------------------------------------------------
  //  Salon
  // -------------------------------------------------------------------------
  cleanName(name) {
    const n = String(name || '')
      .replace(/[\u0000-\u001f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 14);
    return n || this.L.T.guest;
  }

  addPlayer(name, token) {
    if (this.phase !== 'lobby' || this.players.length >= this.target) return null;
    let nm = this.cleanName(name);
    const base = nm;
    let k = 2;
    while (this.players.some((p) => p.name.toLowerCase() === nm.toLowerCase())) nm = `${base} ${k++}`;
    const used = new Set(this.players.map((p) => p.color));
    const color = PALETTE.find((c) => !used.has(c)) || PALETTE[0];
    const p = this.blank({ id: U.uid(), name: nm, token, color, connected: true });
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
    if (p && p.connected !== v) {
      p.connected = v;
      this.changed();
    }
  }

  setTarget(n) {
    if (this.phase !== 'lobby' || ![4, 5].includes(n) || n < this.players.length) return false;
    this.target = n;
    this.changed();
    return true;
  }

  canStart() {
    return this.phase === 'lobby' && this.players.length === this.target && this.target >= 4;
  }

  start() {
    if (!this.canStart()) return false;
    const roles = U.shuffle(['lie', 'lie', ...Array(this.players.length - 2).fill('solitaire')]);
    this.players.forEach((p, i) => {
      p.role = roles[i];
      p.raison = CFG.RAISON;
      p.alive = true;
      p.items = [U.pick(Object.keys(C.ITEMS))];
      p.usedMurmur = false;
    });
    this.logs = {};
    this.startPhase('roles', CFG.SECS.roles, 'roles');
    return true;
  }

  /** Retour au salon avec les mêmes joueurs. */
  restart() {
    const keep = this.players.map((p) => this.blank({ id: p.id, name: p.name, token: p.token, color: p.color, connected: p.connected }));
    this.players = keep;
    this.resetState();
    this.changed();
  }

  // -------------------------------------------------------------------------
  //  Phases
  // -------------------------------------------------------------------------
  startPhase(phase, secs, narrKey) {
    this.phase = phase;
    this.phaseEndsAt = this.now() + this.S(secs);
    for (const p of this.players) p.done = false;
    if (narrKey) this.say(narrKey);
    this.changed();
  }

  /** Passer à la phase suivante tout de suite (bouton « Passer » de l'hôte). */
  skip() {
    this.phaseEndsAt = this.now();
    if (this.phase === 'crepuscule' && this.challenge) this.challenge.endsAt = this.now();
    this.tick();
  }

  actFor(night, aliveCount) {
    if (aliveCount <= 2) return 3;
    if (night <= 2) return 1;
    return aliveCount <= 3 ? 3 : 2;
  }

  tick() {
    const t = this.now();
    switch (this.phase) {
      case 'roles':
        if (t >= this.phaseEndsAt || this.allDone(false)) this.beginNight();
        break;
      case 'crepuscule': {
        const ch = this.challenge;
        const w = this.watchers();
        if (CH.tick(ch, t, w)) this.changed();
        this.phaseEndsAt = ch.endsAt;
        if (CH.finished(ch, t, w)) this.endCrepuscule();
        break;
      }
      case 'podium':
        if (t >= this.phaseEndsAt) this.beginMinuit();
        break;
      case 'minuit':
        if (t >= this.phaseEndsAt || this.minuitReady()) this.resolveMinuit();
        break;
      case 'veillee':
        if (t >= this.phaseEndsAt || this.allDone(false)) this.beginRituel();
        break;
      case 'rituel': {
        if (t >= this.phaseEndsAt) return this.resolveRituel();
        if (!this.auto && this.allVoted()) {
          if (!this.allVotedAt) this.allVotedAt = t;
          if (t - this.allVotedAt >= this.S(3)) this.resolveRituel();
        }
        break;
      }
      case 'aube':
        if (t >= this.phaseEndsAt) this.afterAube();
        break;
      default:
    }
  }

  allDone(includeDead) {
    const list = this.players.filter((p) => p.connected && (includeDead || p.alive));
    return list.length > 0 && list.every((p) => p.done);
  }

  minuitReady() {
    const live = this.players.filter((p) => p.connected && p.alive);
    if (!live.length || !live.every((p) => p.done)) return false;
    return this.players.filter((p) => p.connected && !p.alive).every((p) => p.done || this.curseVotes[p.id]);
  }

  voters() {
    return this.players.filter((p) => p.alive && p.connected && p.id !== this.possessed);
  }
  allVoted() {
    const v = this.voters();
    return v.length > 0 && v.every((p) => Object.prototype.hasOwnProperty.call(this.votes, p.id));
  }

  // -------------------------------------------------------------------------
  //  Nuit : Crépuscule
  // -------------------------------------------------------------------------
  assignRunes() {
    const pool = U.shuffle(C.RUNES);
    const alive = this.alive();
    const lies = alive.filter((p) => p.role === 'lie');
    this.runeShared = lies.length === 2 && Math.random() < CFG.RUNE_SHARE;
    this.pairRune = pool[0];
    let idx = 1;
    this.runes = {};
    for (const p of alive) {
      this.runes[p.id] = p.role === 'lie' && this.runeShared ? this.pairRune : pool[idx++];
    }
    for (const id of this.hallu) this.runes[id] = U.pick(C.RUNES); // les hallucinés voient n'importe quoi
  }

  beginNight() {
    this.night++;
    const alive = this.alive();
    this.act = this.actFor(this.night, alive.length);
    this.banner = this.act !== this.lastAct;
    this.lastAct = this.act;

    const ev = this.night > 1 ? this.nextEvent : null;
    this.event = ev ? { id: ev, ...this.L.EVENTS[ev] } : null;
    this.nextEvent = null;

    this.actions = {};
    this.votes = {};
    this.curse = null;
    this.curseVotes = {};
    this.curseOptions = [];
    this.pendingDamage = [];
    this.shield = {};
    this.trap = new Set();
    this.usedTonight = new Set();
    this.attackedTonight = new Set();
    this.designated = null;
    this.tieNote = '';
    this.voteDetail = null;
    this.voteHidden = false;
    this.eligible = [];
    this.auto = false;
    this.allVotedAt = 0;
    this.aube = null;
    this.gestures = {};
    this.ranking = [];
    this.gained = {};
    this.labels = {};
    this.marker = null;
    this.chResult = null;
    this.revealedRune = null;
    this.possessed = null;
    this.possessTarget = null;
    this.hallu = new Set(alive.filter((p) => p.raison === 1).map((p) => p.id));
    this.assignRunes();

    let type;
    if (this.night === 1) type = 'quiz';
    else {
      const all = CH.allowedTypes(this.act, alive.length);
      const opts = all.filter((x) => x !== this.lastType);
      type = U.pick(opts.length ? opts : all);
    }
    this.lastType = type;
    this.challenge = CH.create(type, {
      now: this.now(), act: this.act, scale: this.scale, S: (s) => this.S(s),
      usedQ: this.usedQ, usedP: this.usedP, L: this.L,
    });
    this.startPhase('crepuscule', 0, 'crepuscule');
    this.phaseEndsAt = this.challenge.endsAt;
  }

  handleChallenge(p, msg) {
    if (this.phase !== 'crepuscule' || !p.alive) return;
    if (CH.input(this.challenge, p.id, msg, this.now())) this.changed();
  }

  endCrepuscule() {
    const ch = this.challenge;
    const alive = this.alive();
    const res = CH.results(ch, alive.map((p) => p.id));
    const order = U.shuffle(alive).sort((a, b) => res[b.id] - res[a.id]); // tri stable : égalités départagées au hasard
    this.ranking = order.map((p) => p.id);
    this.marker = order[0].id;
    this.gained = {};
    this.labels = {};
    for (const p of order) this.labels[p.id] = CH.label(ch, p.id);
    for (const p of order.slice(0, 2)) {
      if (p.items.length < CFG.MAX_ITEMS) {
        const it = U.pick(Object.keys(C.ITEMS));
        p.items.push(it);
        this.gained[p.id] = it;
      }
    }
    this.chResult = CH.summary(ch);
    this.startPhase('podium', CFG.SECS.podium, 'podium');
  }

  // -------------------------------------------------------------------------
  //  Nuit : Minuit
  // -------------------------------------------------------------------------
  beginMinuit() {
    this.actions = {};
    this.curseVotes = {};
    const hasDead = this.players.some((p) => !p.alive);
    this.curseOptions = hasDead ? U.shuffle(Object.keys(C.CURSES)).slice(0, 3) : [];
    this.startPhase('minuit', CFG.SECS.minuit, 'minuit');
  }

  handleAct(p, m) {
    if (this.phase !== 'minuit') return;
    const a = (this.actions[p.id] = this.actions[p.id] || {});
    const target = (id) => {
      const t = this.byId(id);
      return t && t.alive && t.id !== p.id ? t : null;
    };
    switch (m.kind) {
      case 'item': {
        if (!p.alive) return;
        if (m.item === null) {
          delete a.item;
          break;
        }
        const def = C.ITEMS[m.item];
        if (!def || !p.items.includes(m.item)) return;
        if (def.target) {
          const t = target(m.target);
          if (!t) return;
          a.item = { item: m.item, target: t.id };
        } else a.item = { item: m.item };
        break;
      }
      case 'mark': {
        if (!p.alive || p.id !== this.marker) return;
        if (m.target === null) delete a.mark;
        else {
          const t = target(m.target);
          if (!t) return;
          a.mark = t.id;
        }
        break;
      }
      case 'murmur': {
        if (!p.alive || p.role !== 'lie' || p.usedMurmur) return;
        if (m.target === null) delete a.murmur;
        else {
          const t = target(m.target);
          if (!t) return;
          a.murmur = t.id;
        }
        break;
      }
      case 'pacte': {
        if (!p.alive) return;
        if (!m.on) {
          delete a.pacte;
          break;
        }
        if (!this.canPacte(p)) return;
        a.pacte = true;
        break;
      }
      case 'curse': {
        if (p.alive || !this.curseOptions.includes(m.id)) return;
        this.curseVotes[p.id] = m.id;
        break;
      }
      default:
        return;
    }
    this.changed();
  }

  canPacte(p) {
    return p.alive && this.act >= CFG.PACTE_FROM_ACT && p.raison >= 2 && p.items.length < CFG.MAX_ITEMS;
  }

  resolveMurmurs() {
    const done = new Set();
    for (const p of this.alive()) {
      const a = this.actions[p.id];
      if (!a || !a.murmur || p.role !== 'lie' || p.usedMurmur) continue;
      p.usedMurmur = true;
      const t = this.byId(a.murmur);
      if (!t || !t.alive) continue;
      if (t.role === 'lie') {
        const key = [p.id, t.id].sort().join('|');
        if (done.has(key)) continue;
        done.add(key);
        this.note(p.id, 'echo', this.L.T.echo(t.name));
        this.note(t.id, 'echo', this.L.T.echo(p.name));
      } else {
        this.note(p.id, 'murmure', this.L.T.noEcho);
        this.note(t.id, 'murmure', this.L.T.coldVoice);
      }
    }
  }

  resolveMinuit() {
    const alive = this.alive();

    // Malédiction collective des Hantés
    const tally = {};
    for (const id of Object.values(this.curseVotes)) tally[id] = (tally[id] || 0) + 1;
    const best = Math.max(0, ...Object.values(tally));
    if (best > 0) this.curse = U.pick(Object.keys(tally).filter((k) => tally[k] === best));

    // Objets utilisés (un seul par joueur et par nuit)
    let uses = [];
    for (const p of alive) {
      const a = this.actions[p.id];
      if (a && a.item && p.items.includes(a.item.item)) uses.push({ pid: p.id, ...a.item });
    }
    for (const u of uses) {
      this.usedTonight.add(u.pid);
      const p = this.byId(u.pid);
      p.items.splice(p.items.indexOf(u.item), 1);
    }
    if (this.curse === 'etouffer' && uses.length) {
      const [u] = uses.splice(U.rnd(uses.length), 1);
      this.note(u.pid, 'objet', this.L.T.stifled(this.L.ITEMS[u.item].name));
    }

    this.resolveMurmurs();

    const attacks = [];
    for (const u of uses) {
      if (u.item === 'lanterne') {
        this.shield[u.pid] = (this.shield[u.pid] || 0) + 1;
        this.note(u.pid, 'objet', this.L.T.lantern);
      } else if (u.item === 'sel') {
        this.trap.add(u.pid);
        this.note(u.pid, 'objet', this.L.T.salt);
      } else if (u.item === 'couteau') {
        attacks.push({ from: u.pid, to: u.target });
      } else if (u.item === 'miroir') {
        const t = this.byId(u.target);
        let shown = t.role === 'lie';
        if (this.hallu.has(u.pid) && Math.random() < CFG.MIRROR_FALSE) shown = !shown;
        this.note(u.pid, 'miroir', this.L.T.mirror(t.name, shown));
      }
    }
    const mk = this.marker && this.byId(this.marker);
    const ma = mk && mk.alive && this.actions[this.marker];
    if (ma && ma.mark) attacks.push({ from: this.marker, to: ma.mark });

    for (const atk of attacks) {
      this.attackedTonight.add(atk.to);
      if (this.trap.has(atk.to)) {
        this.pendingDamage.push({ pid: atk.from });
        this.note(atk.to, 'objet', this.L.T.saltHit);
        this.note(atk.from, 'objet', this.L.T.saltBack);
      } else {
        this.pendingDamage.push({ pid: atk.to });
      }
    }

    // Pactes (dilemme) : −1 Raison à l'aube, mais un objet tout de suite
    for (const p of alive) {
      const a = this.actions[p.id];
      if (a && a.pacte && this.canPacte(p)) {
        const it = U.pick(Object.keys(C.ITEMS));
        p.items.push(it);
        this.pendingDamage.push({ pid: p.id, unblockable: true });
        this.note(p.id, 'objet', this.L.T.pacte(C.ITEMS[it].icon, this.L.ITEMS[it].name));
      }
    }

    this.beginVeillee();
  }

  // -------------------------------------------------------------------------
  //  Nuit : Veillée
  // -------------------------------------------------------------------------
  fakeVoice(pid) {
    const others = this.alive().filter((p) => p.id !== pid);
    const x = others.length ? U.pick(others).name : this.L.T.someone;
    return U.pick(this.L.HALLU)(x);
  }

  deliverMurmurs() {
    const alive = this.alive();
    const M = this.L.T.murmurs;
    const TPL = [
      (x) => ({ ...M[0](x.name), truth: x.role === 'lie' }),
      (x) => ({ ...M[1](x.name), truth: x.items.length > 0 }),
      (x) => ({ ...M[2](x.name), truth: this.usedTonight.has(x.id) }),
      (x) => ({ ...M[3](x.name), truth: this.attackedTonight.has(x.id) }),
    ];
    const weights = [0, 1, 1, 2, 2, 3, 3];
    for (const p of alive) {
      const others = alive.filter((o) => o.id !== p.id);
      if (!others.length) continue;
      const tpl = TPL[U.pick(weights)](U.pick(others));
      const honest = Math.random() < CFG.MURMUR_TRUE;
      const claim = honest ? tpl.truth : !tpl.truth;
      this.note(p.id, 'voix', this.L.T.murmurWrap(claim ? tpl.pos : tpl.neg));
    }
  }

  beginVeillee() {
    let secs = CFG.SECS.veillee;
    if (this.curse === 'precipiter') secs -= CFG.SECS.precipiter;
    const alive = this.alive();

    if (this.event && this.event.id === 'murmures') this.deliverMurmurs();

    if (this.curse === 'chuchoter' && alive.length) {
      const v = U.pick(alive);
      this.note(v.id, 'voix', this.fakeVoice(v.id));
    }
    for (const id of this.hallu) {
      const p = this.byId(id);
      if (p && p.alive && Math.random() < CFG.HALLU_NOTE) this.note(id, 'voix', this.fakeVoice(id));
    }
    if (this.curse === 'reveler' && alive.length) {
      const clean = alive.filter((p) => !this.hallu.has(p.id));
      this.revealedRune = this.runeShared ? this.pairRune : this.runes[U.pick(clean.length ? clean : alive).id];
    }

    this.veilleeStart = this.now();
    this.startPhase('veillee', secs, 'veillee');
  }

  handleGesture(p, m) {
    if (this.phase !== 'veillee' || !p.alive || !this.event || this.event.id !== 'silence') return;
    const g = C.GESTURES[m.g];
    if (!g) return;
    const prev = this.gestures[p.id];
    if (prev && this.now() - prev.at < this.S(1.2)) return;
    let target = null;
    if (g.target) {
      const t = this.byId(m.target);
      if (!t || !t.alive || t.id === p.id) return;
      target = t.id;
    }
    this.gestures[p.id] = { g: m.g, target, at: this.now() };
    this.changed();
  }

  // -------------------------------------------------------------------------
  //  Nuit : Rituel
  // -------------------------------------------------------------------------
  beginRituel() {
    const alive = this.alive();
    const marker = this.marker && this.byId(this.marker);
    const immune = this.act === 3 && marker && marker.alive;
    this.eligible = alive.filter((p) => !(immune && p.id === marker.id)).map((p) => p.id);
    this.votes = {};
    this.allVotedAt = 0;
    this.auto = this.eligible.length <= 1;

    if (this.event && this.event.id === 'possession' && alive.length >= 2) {
      this.possessed = U.pick(alive).id;
      const cands = this.eligible.filter((id) => id !== this.possessed);
      this.possessTarget = cands.length ? U.pick(cands) : null;
      if (this.possessTarget) this.votes[this.possessed] = this.possessTarget;
    }
    if (this.auto) {
      this.startPhase('rituel', CFG.SECS.duelAuto, null);
      this.sayText(this.L.T.duel);
    } else {
      this.startPhase('rituel', CFG.SECS.rituel, 'rituel');
    }
  }

  handleVote(p, m) {
    if (this.phase !== 'rituel' || !p.alive || this.auto || p.id === this.possessed) return;
    if (m.target === null) this.votes[p.id] = null;
    else {
      if (typeof m.target !== 'string' || !this.eligible.includes(m.target) || m.target === p.id) return;
      this.votes[p.id] = m.target;
    }
    this.changed();
  }

  resolveRituel() {
    const tally = {};
    for (const tgt of Object.values(this.votes)) {
      if (tgt && this.eligible.includes(tgt)) tally[tgt] = (tally[tgt] || 0) + 1;
    }
    const max = Math.max(0, ...Object.values(tally));
    let designated;
    this.tieNote = '';
    if (this.eligible.length === 1) designated = this.eligible[0];
    else if (max > 0) {
      const top = Object.keys(tally).filter((k) => tally[k] === max);
      designated = U.pick(top);
      if (top.length > 1) this.tieNote = this.L.T.tie;
    } else {
      designated = U.pick(this.eligible);
      this.tieNote = this.L.T.noVote;
    }
    this.voteHidden = !!((this.event && this.event.id === 'brouillard') || this.curse === 'tenebres');
    this.voteDetail = this.voteHidden
      ? null
      : Object.entries(this.votes).map(([v, t]) => ({ from: this.byId(v).name, to: t ? this.byId(t).name : null }));
    this.designated = designated;
    this.pendingDamage.push({ pid: designated, lethal: this.act === 3 });
    this.beginAube();
  }

  // -------------------------------------------------------------------------
  //  Aube
  // -------------------------------------------------------------------------
  checkWinner() {
    const alive = this.alive();
    if (!alive.length) return { type: 'chose' };
    const lies = alive.filter((p) => p.role === 'lie');
    const sols = alive.filter((p) => p.role === 'solitaire');
    if (!sols.length) return { type: 'lies' };
    if (!lies.length && sols.length === 1) return { type: 'solitaire', pid: sols[0].id };
    return null;
  }

  beginAube() {
    const lines = [];
    const loss = {};
    const lethal = new Set();
    const died = [];
    let blocked = 0;

    const d0 = this.byId(this.designated);
    lines.push({
      kind: 'rituel',
      text: this.L.T.ritual(d0.name, this.tieNote),
    });

    const hit = (p, d) => {
      if (!p.alive) return;
      if (!d.unblockable && (this.shield[p.id] || 0) > 0) {
        this.shield[p.id]--;
        blocked++;
        return;
      }
      const amount = d.lethal ? p.raison : 1;
      p.raison = Math.max(0, p.raison - amount);
      loss[p.id] = (loss[p.id] || 0) + amount;
      if (d.lethal) lethal.add(p.id);
      if (p.raison === 0) {
        p.alive = false;
        died.push(p.id);
      }
    };
    for (const d of this.pendingDamage) hit(this.byId(d.pid), d);

    const fatal = this.night >= CFG.FATAL_NIGHT;
    if (fatal) for (const p of this.alive()) hit(p, { unblockable: true });

    if (blocked) {
      lines.push({
        kind: 'lantern',
        text: blocked === 1 ? this.L.T.lantern1 : this.L.T.lanternN,
      });
    }
    for (const p of this.players) {
      if (!loss[p.id]) continue;
      lines.push({
        kind: 'loss', pid: p.id,
        text: lethal.has(p.id) ? this.L.T.lossLethal(p.name) : this.L.T.loss(p.name, loss[p.id]),
      });
    }
    for (const id of died) {
      const p = this.byId(id);
      lines.push({ kind: 'death', pid: id, text: this.L.T.death(p.name) });
    }
    if (fatal) lines.push({ kind: 'fatal', text: this.L.T.fatal });
    if (!Object.keys(loss).length && !blocked) lines.push({ kind: 'calm', text: this.L.T.calm });

    this.winner = this.checkWinner();
    if (!this.winner) {
      const nextAct = this.actFor(this.night + 1, this.alive().length);
      const ev = U.pick(C.EVENTS_BY_ACT[nextAct]);
      this.nextEvent = ev;
      lines.push({ kind: 'event', text: this.L.T.nextEvent(this.L.EVENTS[ev].name, this.L.EVENTS[ev].text) });
    }

    const cue = died.length ? 'death' : Object.keys(loss).length ? 'hit' : 'bell';
    this.aube = { lines, cue };
    const secs = U.clamp(6 + lines.length * 1.8, CFG.SECS.aubeMin, CFG.SECS.aubeMax);
    this.startPhase('aube', secs, 'aube');
  }

  afterAube() {
    if (this.winner) {
      this.phase = 'fin';
      this.say('fin');
      this.changed();
    } else this.beginNight();
  }

  // -------------------------------------------------------------------------
  //  Messages entrants
  // -------------------------------------------------------------------------
  handle(pid, msg) {
    const p = this.byId(pid);
    if (!p || !msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'ch':
        this.handleChallenge(p, msg);
        break;
      case 'act':
        this.handleAct(p, msg);
        break;
      case 'done':
        if (['roles', 'minuit', 'veillee'].includes(this.phase)) {
          p.done = msg.v !== false;
          this.changed();
        }
        break;
      case 'vote':
        this.handleVote(p, msg);
        break;
      case 'gesture':
        this.handleGesture(p, msg);
        break;
      default:
    }
  }

  // -------------------------------------------------------------------------
  //  Vues
  // -------------------------------------------------------------------------
  actInfo() {
    return { act: this.act, actName: this.L.ACTS[this.act].name, actRoman: this.L.ACTS[this.act].roman };
  }

  publicPlayers() {
    return this.players.map((p) => ({
      id: p.id, name: p.name, color: p.color, raison: p.raison, alive: p.alive, connected: p.connected,
    }));
  }

  endView() {
    const w = this.winner;
    const names = (list) => list.map((p) => p.name);
    let title;
    let names_ = [];
    if (w.type === 'lies') {
      names_ = names(this.players.filter((p) => p.role === 'lie'));
      title = this.L.T.endLies;
    } else if (w.type === 'solitaire') {
      names_ = [this.byId(w.pid).name];
      title = this.L.T.endSolo(names_[0]);
    } else title = this.L.T.endChose;
    return {
      type: w.type, title, winners: names_, winnerIds: w.type === 'lies' ? this.players.filter((p) => p.role === 'lie').map((p) => p.id) : w.pid ? [w.pid] : [],
      roles: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, role: p.role, alive: p.alive, raison: p.raison })),
    };
  }

  eventPub() {
    return this.event ? { id: this.event.id, name: this.event.name, text: this.event.text } : null;
  }

  screenView() {
    const t = this.now();
    const players = this.players.map((p) => ({
      id: p.id, name: p.name, color: p.color, raison: p.raison, alive: p.alive,
      connected: p.connected, done: p.done, crown: p.id === this.marker,
    }));
    const v = {
      t: 'screen', now: t, lang: this.lang, phase: this.phase, night: this.night, ...this.actInfo(),
      endsAt: this.phaseEndsAt, target: this.target, players, narr: this.narr,
      banner: this.banner, event: this.eventPub(), canStart: this.canStart(),
    };
    const nameOf = (id) => (this.byId(id) ? this.byId(id).name : '?');
    switch (this.phase) {
      case 'roles':
        v.ready = { done: this.players.filter((p) => p.done).length, total: this.players.length };
        break;
      case 'crepuscule':
        v.ch = CH.screenView(this.challenge, this.watchers());
        break;
      case 'podium':
        v.podium = {
          rows: this.ranking.map((id, i) => ({ id, name: nameOf(id), label: this.labels[id], marker: i === 0, gained: !!this.gained[id] })),
          reveal: this.chResult && {
            real: this.chResult.real,
            opts: this.chResult.opts.map((o) => ({ text: o.text, real: o.real, author: o.owner ? nameOf(o.owner) : null })),
          },
          immune: this.act === 3 ? nameOf(this.marker) : null,
        };
        break;
      case 'minuit': {
        const dead = this.players.filter((p) => !p.alive);
        v.minuit = {
          marker: nameOf(this.marker),
          ready: { done: this.players.filter((p) => p.alive && p.done).length, total: this.players.filter((p) => p.alive).length },
          ghosts: dead.length,
        };
        break;
      }
      case 'veillee': {
        const silence = !!(this.event && this.event.id === 'silence');
        v.veillee = {
          silence,
          coupure: !!(this.event && this.event.id === 'coupure'),
          startedAt: this.veilleeStart,
          coupureMs: this.S(CFG.SECS.coupure),
          curse: this.curse ? { id: this.curse, name: this.L.CURSES[this.curse].name, text: this.L.CURSES[this.curse].pub } : null,
          rune: this.revealedRune,
          ready: { done: this.players.filter((p) => p.alive && p.done).length, total: this.players.filter((p) => p.alive).length },
          gestures: silence
            ? Object.entries(this.gestures).map(([id, g]) => ({
                id, name: nameOf(id), icon: C.GESTURES[g.g].icon, label: this.L.GESTURES[g.g].label,
                target: g.target ? nameOf(g.target) : null, at: g.at,
              }))
            : [],
        };
        break;
      }
      case 'rituel':
        v.rituel = {
          eligible: this.eligible, auto: this.auto,
          voted: this.voters().filter((p) => Object.prototype.hasOwnProperty.call(this.votes, p.id)).length,
          total: this.voters().length,
          immune: this.act === 3 && this.marker ? nameOf(this.marker) : null,
          hidden: !!((this.event && this.event.id === 'brouillard')),
        };
        break;
      case 'aube':
        v.aube = {
          lines: this.aube.lines, cue: this.aube.cue, designated: this.designated,
          detail: this.voteDetail, hidden: this.voteHidden,
        };
        break;
      case 'fin':
        v.end = this.endView();
        break;
      default:
    }
    return v;
  }

  viewFor(pid) {
    const p = this.byId(pid);
    if (!p) return null;
    const me = {
      id: p.id, name: p.name, color: p.color, role: p.role, raison: p.raison, alive: p.alive,
      items: p.items, marker: p.id === this.marker, usedMurmur: p.usedMurmur, done: p.done,
      hallu: p.alive && this.phase !== 'lobby' && p.raison === 1,
    };
    const v = {
      t: 'state', lang: this.lang, phase: this.phase, night: this.night, ...this.actInfo(), endsAt: this.phaseEndsAt,
      target: this.target, me, players: this.publicPlayers(),
      event: this.eventPub(), log: this.logs[pid] || [],
    };
    switch (this.phase) {
      case 'crepuscule':
        v.ch = CH.phoneView(this.challenge, pid);
        v.rune = null;
        break;
      case 'podium': {
        const rank = this.ranking.indexOf(pid);
        v.podium = {
          rank: rank < 0 ? null : rank + 1, total: this.ranking.length, label: this.labels[pid] || '',
          gained: this.gained[pid] || null, marker: this.marker ? this.byId(this.marker).name : '',
          immune: this.act === 3 && pid === this.marker,
        };
        break;
      }
      case 'minuit': {
        const a = this.actions[pid] || {};
        v.minuit = {
          marker: this.marker ? this.byId(this.marker).name : '',
          act: a, canPacte: this.canPacte(p), pacteFromAct: CFG.PACTE_FROM_ACT,
          curseOptions: p.alive ? [] : this.curseOptions,
          curseVote: this.curseVotes[pid] || null,
        };
        break;
      }
      case 'veillee': {
        v.veillee = {
          silence: !!(this.event && this.event.id === 'silence'),
          rune: p.alive ? this.runes[pid] || null : null,
          curse: this.curse ? { id: this.curse, name: this.L.CURSES[this.curse].name } : null,
        };
        break;
      }
      case 'rituel': {
        const voted = Object.prototype.hasOwnProperty.call(this.votes, pid);
        v.rituel = {
          eligible: this.eligible, auto: this.auto, voted, myVote: voted ? this.votes[pid] : null,
          possessed: pid === this.possessed ? this.possessTarget : undefined,
          isPossessed: pid === this.possessed,
          immune: this.act === 3 && pid === this.marker,
        };
        break;
      }
      case 'aube':
        v.aube = { lines: this.aube.lines, designated: this.designated ? this.byId(this.designated).name : null };
        break;
      case 'fin':
        v.end = this.endView();
        break;
      default:
    }
    return v;
  }
}

module.exports = { Game };
