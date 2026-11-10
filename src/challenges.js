'use strict';
// Épreuves du Crépuscule. Chaque épreuve est un petit objet d'état + des fonctions pures :
//   create / input / tick / finished / results / label / phoneView / screenView
// Tout est validé côté serveur (le téléphone n'est jamais cru sur parole).

const C = require('./content');
const U = require('./util');

let counter = 0;

const TYPES = ['quiz', 'memoire', 'reflexes', 'bluff'];

/** Types d'épreuves autorisés selon l'acte et le nombre de joueurs vivants. */
function allowedTypes(act, aliveCount) {
  let t = act === 1 ? ['quiz', 'memoire'] : ['quiz', 'memoire', 'reflexes', 'bluff'];
  if (act === 3) t = t.filter((x) => x !== 'bluff');
  if (aliveCount < 3) t = t.filter((x) => x !== 'bluff');
  return t;
}

// ---------------------------------------------------------------------------
const CREATE = {};

CREATE.quiz = (b, ctx) => {
  const n = 3;
  const ok = (q) => (ctx.act === 1 ? q.lvl <= 2 : q.lvl >= 2);
  const QS = ctx.L.QUESTIONS;
  let pool = QS.filter((q) => ok(q) && !ctx.usedQ.has(q.q));
  if (pool.length < n) {
    ctx.usedQ.clear();
    pool = QS.filter(ok);
  }
  const sel = U.shuffle(pool).slice(0, n);
  sel.forEach((q) => ctx.usedQ.add(q.q));
  const qs = sel.map((q) => {
    const opts = U.shuffle([q.a, ...q.w]);
    return { q: q.q, opts, a: opts.indexOf(q.a) };
  });
  const dur = ctx.S(45);
  return { ...b, name: ctx.L.T.ch.names.quiz, qs, ans: {}, doneAt: {}, dur, endsAt: ctx.now + dur };
};

CREATE.memoire = (b, ctx) => {
  const len = ctx.act === 1 ? 4 : ctx.act === 2 ? 5 : 6;
  const glyphs = U.shuffle(C.GLYPHS).slice(0, 9);
  const seq = Array.from({ length: len }, () => U.rnd(9));
  const flashStart = ctx.now + ctx.S(2.5);
  const flashMs = ctx.S(0.9);
  const inputAt = flashStart + len * flashMs + ctx.S(0.4);
  const endsAt = inputAt + ctx.S(18);
  return { ...b, name: ctx.L.T.ch.names.memoire, glyphs, seq, len, flashStart, flashMs, inputAt, endsAt, subs: {}, doneAt: {} };
};

CREATE.reflexes = (b, ctx) => {
  const hard = ctx.act === 3;
  const n = hard ? 30 : 24;
  const total = ctx.S(hard ? 20 : 22);
  const dur = Math.max(1, Math.round(ctx.S(hard ? 0.8 : 0.95)));
  const goStart = ctx.now + ctx.S(4);
  const step = total / n;
  const sched = [];
  let p1 = -1;
  let p2 = -1;
  for (let i = 0; i < n; i++) {
    let cell;
    do cell = U.rnd(9);
    while (cell === p1 || cell === p2);
    p2 = p1;
    p1 = cell;
    sched.push({
      at: Math.round(i * step + U.rnd(Math.max(1, Math.round(step * 0.25)))),
      cell,
      kind: Math.random() < (hard ? 0.55 : 0.65) ? 'eye' : 'fake',
      dur,
    });
  }
  return {
    ...b, name: ctx.L.T.ch.names.reflexes, sched, goStart,
    endsAt: goStart + total + dur + ctx.S(1), taps: {}, strict: ctx.scale >= 1,
  };
};

CREATE.bluff = (b, ctx) => {
  let pool = ctx.L.PROMPTS.filter((p) => !ctx.usedP.has(p.q));
  if (!pool.length) {
    ctx.usedP.clear();
    pool = ctx.L.PROMPTS;
  }
  const prompt = U.pick(pool);
  ctx.usedP.add(prompt.q);
  const writeEnds = ctx.now + ctx.S(45);
  return {
    ...b, name: ctx.L.T.ch.names.bluff, prompt, step: 'write', texts: {}, picks: {}, opts: null,
    bonus: {}, endsAt: writeEnds, pickDur: ctx.S(28), over: false,
  };
};

function create(type, ctx) {
  const base = { id: ++counter, type, startsAt: ctx.now, L: ctx.L };
  return CREATE[type](base, ctx);
}

// ---------------------------------------------------------------------------
//  Entrées des joueurs
// ---------------------------------------------------------------------------
function input(st, pid, msg, now) {
  switch (st.type) {
    case 'quiz': {
      if (now >= st.endsAt) return false;
      const { i, c } = msg;
      if (!Number.isInteger(i) || !Number.isInteger(c)) return false;
      const q = st.qs[i];
      if (!q || c < 0 || c >= q.opts.length) return false;
      const a = (st.ans[pid] = st.ans[pid] || []);
      if (a[i] !== undefined) return false;
      a[i] = c;
      if (st.qs.every((_, k) => a[k] !== undefined)) st.doneAt[pid] = now;
      return true;
    }
    case 'memoire': {
      if (now < st.inputAt - 200 || now >= st.endsAt || st.subs[pid]) return false;
      const s = msg.seq;
      if (!Array.isArray(s) || s.length !== st.len) return false;
      if (s.some((x) => !Number.isInteger(x) || x < 0 || x > 8)) return false;
      st.subs[pid] = s.slice();
      st.doneAt[pid] = now;
      return true;
    }
    case 'reflexes': {
      const i = msg.tap;
      const ev = Number.isInteger(i) ? st.sched[i] : null;
      if (!ev) return false;
      const t0 = st.goStart + ev.at;
      if (st.strict && (now < t0 - 150 || now > t0 + ev.dur + 450)) return false;
      const set = (st.taps[pid] = st.taps[pid] || new Set());
      if (set.has(i)) return false;
      set.add(i);
      return true;
    }
    case 'bluff': {
      if (now >= st.endsAt) return false;
      if (st.step === 'write') {
        if (st.texts[pid] !== undefined) return false;
        const t = String(msg.text || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        if (!t) return false;
        st.texts[pid] = t;
        return true;
      }
      if (st.step === 'pick') {
        if (st.picks[pid] !== undefined) return false;
        const o = Number.isInteger(msg.pick) ? st.opts[msg.pick] : null;
        if (!o || o.owner === pid) return false;
        st.picks[pid] = msg.pick;
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
//  Avancement (étapes internes du bluff). Retourne true si quelque chose a changé.
// ---------------------------------------------------------------------------
function toPick(st, now, alive) {
  const real = st.prompt.real;
  const decoys = U.shuffle(st.prompt.decoys);
  const opts = [{ text: real, owner: null, real: true }];
  for (const pid of alive) {
    let t = st.texts[pid];
    if (!t || U.norm(t) === U.norm(real)) {
      if (t) st.bonus[pid] = 2000; // il a deviné la vérité : bonus, mais son texte est remplacé
      t = decoys.shift() || st.L.T.fallbackDecoy;
    }
    opts.push({ text: t, owner: pid });
  }
  st.opts = U.shuffle(opts);
  st.step = 'pick';
  st.endsAt = now + st.pickDur;
}

function tick(st, now, alive) {
  if (st.type !== 'bluff' || st.over) return false;
  if (st.step === 'write' && (now >= st.endsAt || alive.every((p) => st.texts[p] !== undefined))) {
    toPick(st, now, alive);
    return true;
  }
  if (st.step === 'pick' && (now >= st.endsAt || alive.every((p) => st.picks[p] !== undefined))) {
    st.over = true;
    st.endsAt = Math.min(st.endsAt, now);
    return true;
  }
  return false;
}

function finished(st, now, alive) {
  if (st.type === 'bluff') return st.over;
  if (now >= st.endsAt) return true;
  if (st.type === 'quiz' || st.type === 'memoire') return alive.every((p) => st.doneAt[p] !== undefined);
  return false;
}

// ---------------------------------------------------------------------------
//  Scores
// ---------------------------------------------------------------------------
function correct(st, pid) {
  const a = st.ans[pid] || [];
  return st.qs.reduce((n, q, i) => n + (a[i] === q.a ? 1 : 0), 0);
}
function matches(st, pid) {
  const s = st.subs[pid];
  return s ? s.reduce((n, g, i) => n + (g === st.seq[i] ? 1 : 0), 0) : 0;
}
function eyes(st, pid) {
  let e = 0;
  let f = 0;
  for (const i of st.taps[pid] || []) st.sched[i].kind === 'eye' ? e++ : f++;
  return { e, f };
}
function bluffStats(st, pid) {
  const pi = st.picks[pid];
  const foundReal = pi !== undefined && st.opts[pi].real === true;
  let fooled = 0;
  for (const [p, i] of Object.entries(st.picks)) {
    if (p !== pid && st.opts[i].owner === pid) fooled++;
  }
  return { foundReal, fooled };
}

function results(st, alive) {
  const r = {};
  for (const pid of alive) {
    switch (st.type) {
      case 'quiz': {
        const bonus = st.doneAt[pid] !== undefined ? Math.floor((500 * Math.max(0, st.endsAt - st.doneAt[pid])) / st.dur) : 0;
        r[pid] = correct(st, pid) * 1000 + bonus;
        break;
      }
      case 'memoire': {
        const m = matches(st, pid);
        const span = Math.max(1, st.endsAt - st.inputAt);
        const bonus = m === st.len && st.doneAt[pid] !== undefined ? Math.floor((500 * Math.max(0, st.endsAt - st.doneAt[pid])) / span) : 0;
        r[pid] = m * 1000 + bonus;
        break;
      }
      case 'reflexes': {
        const { e, f } = eyes(st, pid);
        r[pid] = (e - f) * 1000;
        break;
      }
      case 'bluff': {
        const { foundReal, fooled } = bluffStats(st, pid);
        r[pid] = (foundReal ? 3000 : 0) + fooled * 1000 + (st.bonus[pid] || 0);
        break;
      }
      default:
        r[pid] = 0;
    }
  }
  return r;
}

/** Petit libellé de résultat pour le podium. */
function label(st, pid) {
  switch (st.type) {
    case 'quiz':
      return st.L.T.ch.label.quiz(correct(st, pid), st.qs.length);
    case 'memoire':
      return st.L.T.ch.label.memoire(matches(st, pid), st.len);
    case 'reflexes': {
      const { e, f } = eyes(st, pid);
      return st.L.T.ch.label.reflexes(e, f);
    }
    case 'bluff': {
      const { foundReal, fooled } = bluffStats(st, pid);
      return st.L.T.ch.label.bluff(foundReal, fooled);
    }
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
//  Vues
// ---------------------------------------------------------------------------
function phoneView(st, pid) {
  const base = { id: st.id, type: st.type, name: st.name, endsAt: st.endsAt };
  switch (st.type) {
    case 'quiz':
      return {
        ...base,
        qs: st.qs.map((q) => ({ q: q.q, opts: q.opts })),
        mine: st.ans[pid] || [],
        done: st.doneAt[pid] !== undefined,
      };
    case 'memoire':
      return {
        ...base, glyphs: st.glyphs, len: st.len, seq: st.seq,
        flashStart: st.flashStart, flashMs: st.flashMs, inputAt: st.inputAt,
        done: !!st.subs[pid],
      };
    case 'reflexes':
      return { ...base, sched: st.sched, goStart: st.goStart };
    case 'bluff':
      if (st.step === 'write') {
        return { ...base, step: 'write', prompt: st.prompt.q, submitted: st.texts[pid] !== undefined };
      }
      return {
        ...base, step: 'pick', prompt: st.prompt.q,
        options: st.opts.map((o) => ({ text: o.text, mine: o.owner === pid })),
        picked: st.picks[pid] === undefined ? null : st.picks[pid],
        over: st.over,
      };
    default:
      return base;
  }
}

function screenView(st, alive) {
  const total = alive.length;
  const count = (obj) => alive.filter((p) => obj[p] !== undefined).length;
  const base = { id: st.id, type: st.type, name: st.name, endsAt: st.endsAt };
  switch (st.type) {
    case 'quiz':
      return { ...base, sub: st.L.T.ch.sub.quiz, progress: { done: count(st.doneAt), total } };
    case 'memoire':
      return { ...base, sub: st.L.T.ch.sub.memoire, progress: { done: count(st.doneAt), total } };
    case 'reflexes':
      return { ...base, sub: st.L.T.ch.sub.reflexes, progress: null };
    case 'bluff':
      if (st.step === 'write') {
        return { ...base, step: 'write', prompt: st.prompt.q, sub: st.L.T.ch.sub.bluffWrite, progress: { done: count(st.texts), total } };
      }
      return {
        ...base, step: 'pick', prompt: st.prompt.q, sub: st.L.T.ch.sub.bluffPick,
        options: st.opts.map((o) => o.text), progress: { done: count(st.picks), total },
      };
    default:
      return base;
  }
}

/** Détails à afficher après l'épreuve (révélation du bluff). */
function summary(st) {
  if (st.type !== 'bluff' || !st.opts) return null;
  return {
    real: st.prompt.real,
    opts: st.opts.map((o) => ({ text: o.text, owner: o.owner, real: !!o.real })),
  };
}

module.exports = { TYPES, allowedTypes, create, input, tick, finished, results, label, phoneView, screenView, summary };
