'use strict';
// « Le Village maudit » : déduction sociale (loup-garou), 3 à 5 joueurs.
const { BaseGame } = require('../../kit/base');
const U = require('../../util');
const { packs } = require('./lang');

const SECS = { roles: 16, nuit: 45, aube: 9, debat: 100, vote: 40, verdict: 10 };
const ROLE_SETS = {
  3: ['bete', 'voyant', 'guerisseur'],
  4: ['bete', 'voyant', 'guerisseur', 'villageois'],
  5: ['bete', 'voyant', 'guerisseur', 'villageois', 'villageois'],
};
const DEF = { min: 3, max: 5, packs, defaultLang: 'fr' };

class Village extends BaseGame {
  constructor(opts = {}) {
    super(opts, DEF);
    this.reset();
  }

  reset() {
    this.night = 0;
    this.omen = null;
    this.acts = {};
    this.lastHeal = null;
    this.votes = {};
    this.aube = null;
    this.verdict = null;
    this.logs = {};
    this.revealed = {};
    for (const p of this.players) p.role = null;
  }

  makePlayer(k) {
    return { ...super.makePlayer(k), role: null };
  }

  role(p) { return p.role; }
  bestias() { return this.alive().filter((p) => p.role === 'bete'); }
  note(pid, text) {
    (this.logs[pid] = this.logs[pid] || []).push({ n: this.night, text });
  }

  // ---- déroulé -----------------------------------------------------------
  begin() {
    const roles = U.shuffle(ROLE_SETS[this.players.length]);
    this.players.forEach((p, i) => { p.role = roles[i]; p.alive = true; });
    this.reset2();
    this.say(this.T.nightFalls);
    this.startPhase('roles', SECS.roles);
  }

  reset2() {
    this.night = 0; this.logs = {}; this.revealed = {}; this.lastHeal = null; this.acts = {}; this.votes = {};
  }

  beginNight() {
    this.night += 1;
    this.acts = {};
    this.omen = this.night >= 2 && Math.random() < 0.45 ? U.pick(['brume', 'lune']) : null;
    this.say(this.night === 1 ? this.T.firstNight : this.T.nightFalls);
    this.startPhase('nuit', SECS.nuit);
  }

  resolveNight() {
    let died = null;
    if (this.night > 1) {
      const picks = this.bestias().map((b) => this.acts[b.id] && this.acts[b.id].target).filter(Boolean);
      const valid = picks.filter((id) => this.byId(id) && this.byId(id).alive && this.byId(id).role !== 'bete');
      let victim = valid.length ? U.pick(valid) : null;
      if (!victim) victim = U.pick(this.alive().filter((p) => p.role !== 'bete')).id;
      const healer = this.alive().find((p) => p.role === 'guerisseur');
      const healed = healer && this.acts[healer.id] ? this.acts[healer.id].target : null;
      if (!(healed === victim && this.omen !== 'lune')) died = victim;
    }
    if (healerAct(this)) this.lastHeal = healerAct(this);
    else this.lastHeal = null;
    // Guetteur
    const seer = this.alive().find((p) => p.role === 'voyant');
    if (seer && this.acts[seer.id] && this.acts[seer.id].target) {
      const t = this.byId(this.acts[seer.id].target);
      let isBete = t.role === 'bete';
      if (this.omen === 'brume' && Math.random() < 0.5) isBete = !isBete;
      this.note(seer.id, isBete ? this.T.seerBete(t.name) : this.T.seerInnocent(t.name));
    }
    if (died) {
      const p = this.byId(died);
      p.alive = false;
      this.revealed[died] = true;
    }
    this.aube = { died: died ? { id: died, name: this.nameOf(died), role: this.byId(died).role } : null, omen: this.omen };
    this.say(died ? this.T.dawnDead(this.nameOf(died)) : this.T.dawnNone);
    this.startPhase('aube', SECS.aube);
  }

  checkWin() {
    const bs = this.alive().filter((p) => p.role === 'bete').length;
    const others = this.alive().length - bs;
    if (bs === 0) return 'village';
    if (bs >= others) return 'bete';
    return null;
  }

  endGame(w) {
    this.winner = w;
    this.say(w === 'village' ? this.T.winVillage : this.T.winBete);
    this.startPhase('fin', 0);
  }

  resolveVote() {
    const tally = {};
    for (const t of Object.values(this.votes)) if (t) tally[t] = (tally[t] || 0) + 1;
    const max = Math.max(0, ...Object.values(tally));
    let out = null;
    let msg;
    if (!max) msg = this.T.exileSkip;
    else {
      const top = Object.keys(tally).filter((k) => tally[k] === max);
      if (top.length > 1) msg = this.T.exileNone;
      else {
        out = top[0];
        this.byId(out).alive = false;
        this.revealed[out] = true;
        msg = this.T.exile(this.nameOf(out));
      }
    }
    this.verdict = {
      out: out ? { id: out, name: this.nameOf(out), role: this.byId(out).role } : null,
      tally: Object.entries(tally).map(([id, n]) => ({ name: this.nameOf(id), n })).sort((a, b) => b.n - a.n),
      voters: Object.entries(this.votes).map(([v, t]) => ({ from: this.nameOf(v), to: t ? this.nameOf(t) : null })),
    };
    this.say(msg);
    this.startPhase('verdict', SECS.verdict);
  }

  onTick() {
    switch (this.phase) {
      case 'roles':
        if (this.timeUp() || this.allDone()) this.beginNight();
        break;
      case 'nuit':
        if (this.timeUp() || this.allDone()) this.resolveNight();
        break;
      case 'aube': {
        if (!this.timeUp()) break;
        const w = this.checkWin();
        if (w) return this.endGame(w);
        this.say(this.T.discuss);
        this.startPhase('debat', SECS.debat);
        break;
      }
      case 'debat':
        if (this.timeUp() || this.allDone()) {
          this.votes = {};
          this.say(this.T.vote);
          this.startPhase('vote', SECS.vote);
        }
        break;
      case 'vote':
        if (this.timeUp() || this.watchers().every((p) => p.id in this.votes)) this.resolveVote();
        break;
      case 'verdict': {
        if (!this.timeUp()) break;
        const w = this.checkWin();
        if (w) return this.endGame(w);
        this.beginNight();
        break;
      }
      default:
    }
  }

  // ---- messages ----------------------------------------------------------
  onMessage(p, m) {
    if (!p.alive) return;
    if (m.t === 'done') {
      if (['roles', 'debat'].includes(this.phase) || (this.phase === 'nuit' && !this.needsTarget(p))) {
        p.done = true;
        this.changed();
        this.tick();
      }
    } else if (m.t === 'act' && this.phase === 'nuit' && this.needsTarget(p)) {
      const t = this.byId(m.target);
      if (!t || !t.alive) return;
      if (p.role === 'bete' && t.role === 'bete') return;
      if (p.role === 'voyant' && t.id === p.id) return;
      if (p.role === 'guerisseur' && t.id === this.lastHeal) return;
      this.acts[p.id] = { target: t.id };
      p.done = true;
      this.note(p.id, p.role === 'bete' ? this.T.youBite(t.name) : p.role === 'guerisseur' ? this.T.healed(t.name) : null);
      if (this.logs[p.id] && this.logs[p.id][this.logs[p.id].length - 1].text === null) this.logs[p.id].pop();
      this.changed();
      this.tick();
    } else if (m.t === 'vote' && this.phase === 'vote') {
      if (m.target === null) this.votes[p.id] = null;
      else {
        const t = this.byId(m.target);
        if (!t || !t.alive || t.id === p.id) return;
        this.votes[p.id] = t.id;
      }
      p.done = true;
      this.changed();
      this.tick();
    }
  }

  /** Pouvoirs qui demandent une cible cette nuit. */
  needsTarget(p) {
    if (p.role === 'villageois') return false;
    if (p.role === 'bete') return this.night > 1;
    return true;
  }

  // ---- vues --------------------------------------------------------------
  extraScreen(v) {
    const total = this.watchers().length;
    v.vil = { night: this.night, omen: this.omen ? { id: this.omen, ...this.L.OMENS[this.omen] } : null, total };
    if (this.phase === 'roles' || this.phase === 'nuit' || this.phase === 'debat') {
      v.vil.done = this.watchers().filter((p) => p.done).length;
    }
    if (this.phase === 'vote') v.vil.done = Object.keys(this.votes).length;
    if (this.phase === 'aube') v.vil.aube = this.aube && { ...this.aube, roleName: this.aube.died ? this.L.ROLES[this.aube.died.role].name : null };
    if (this.phase === 'verdict') v.vil.verdict = this.verdict && { ...this.verdict, roleName: this.verdict.out ? this.L.ROLES[this.verdict.out.role].name : null };
    if (this.phase === 'fin') {
      v.vil.winner = this.winner;
      v.vil.roles = this.players.map((p) => ({ name: p.name, color: p.color, alive: p.alive, role: p.role, roleName: this.L.ROLES[p.role].name, icon: this.L.ROLES[p.role].icon }));
    }
    for (const sp of v.players) sp.revealed = !!this.revealed[sp.id];
  }

  extraPhone(v, p) {
    const R = this.L.ROLES;
    const playing = !['lobby'].includes(this.phase);
    v.me.role = playing ? p.role : null;
    if (!playing) return;
    v.me.roleInfo = { ...R[p.role], key: p.role };
    v.vil = { night: this.night, omen: this.omen ? { id: this.omen, ...this.L.OMENS[this.omen] } : null };
    v.notes = (this.logs[p.id] || []).map((l) => `${l.n ? this.L.ui.nightMine.replace('{n}', l.n) + ' : ' : ''}${l.text}`);
    if (p.role === 'bete') v.vil.mates = this.players.filter((q) => q.role === 'bete' && q.id !== p.id).map((q) => q.name);
    const alive = this.alive();
    if (this.phase === 'nuit' && p.alive) {
      const need = this.needsTarget(p);
      v.vil.need = need;
      v.vil.acted = !!this.acts[p.id] || (!need && p.done);
      if (need) {
        v.vil.targets = alive
          .filter((q) => (p.role === 'bete' ? q.role !== 'bete' : p.role === 'voyant' ? q.id !== p.id : q.id !== this.lastHeal))
          .map((q) => ({ id: q.id, name: q.name, color: q.color }));
        v.vil.picked = this.acts[p.id] ? this.acts[p.id].target : null;
      }
    }
    if (this.phase === 'vote' && p.alive) {
      v.vil.targets = alive.filter((q) => q.id !== p.id).map((q) => ({ id: q.id, name: q.name, color: q.color }));
      v.vil.voted = p.id in this.votes;
      v.vil.picked = this.votes[p.id] || null;
    }
    if (this.phase === 'aube') v.vil.aube = this.aube && { ...this.aube, roleName: this.aube.died ? R[this.aube.died.role].name : null };
    if (this.phase === 'verdict') v.vil.verdict = this.verdict && { out: this.verdict.out, roleName: this.verdict.out ? R[this.verdict.out.role].name : null };
    if (this.phase === 'fin') {
      v.vil.winner = this.winner;
      v.vil.win = (this.winner === 'bete') === (p.role === 'bete');
      v.vil.roles = this.players.map((q) => ({ name: q.name, color: q.color, alive: q.alive, roleName: R[q.role].name, icon: R[q.role].icon }));
    }
  }
}

function healerAct(g) {
  const h = g.alive().find((p) => p.role === 'guerisseur');
  return h && g.acts[h.id] ? g.acts[h.id].target : null;
}

module.exports = { Game: Village, packs, DEF };
