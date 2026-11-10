/* Téléphone du joueur : rôle secret, épreuves, actions de minuit, vote, journal privé. */
(() => {
  'use strict';
  const { esc, candles } = window.UI;
  const tr = (k, v) => window.I18N.t(k, v);
  const both = (k) => window.I18N.both(k);
  const $ = (s, r = document) => r.querySelector(s);
  const main = $('#main');
  const hdr = $('#hdr');
  const bar = $('#bar');
  const barIn = $('#bar .in');
  const sheet = $('#sheet');
  const peek = $('#peek');
  const toast = $('#toast');
  const sheetBtn = $('#sheetBtn');
  const conn = $('#conn');
  const tbar = $('#timerbar i');

  const params = new URLSearchParams(location.search);
  let room = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  let ws = null;
  let S = null;
  let content = null;
  let allContent = null;
  let offset = 0;
  let joined = false;
  let wantJoin = false;
  let joinName = '';
  const ui = { choose: null, chUI: null, chId: null, total: 1, endsSeen: 0, prev: null, sheet: false, mainHTML: null, phase: '' };
  const now = () => Date.now() + offset;
  const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
  const vib = (p) => {
    try {
      if (navigator.vibrate) navigator.vibrate(p);
    } catch (e) { /* rien */ }
  };

  function token() {
    const k = 'manoir.token.' + room;
    let t = localStorage.getItem(k);
    if (!t) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(k, t);
    }
    return t;
  }

  // ------------------------------------------------------------------ connexion
  function connect() {
    if (ws && ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?role=player&room=${room}`);
    ws.onopen = () => {
      conn.hidden = true;
      if (wantJoin) send({ t: 'join', name: joinName, token: token() });
    };
    ws.onmessage = (e) => onMsg(JSON.parse(e.data));
    ws.onclose = () => {
      if (joined) {
        conn.hidden = false;
        setTimeout(connect, 1500);
      }
    };
  }

  function onMsg(m) {
    if (m.t === 'joined') {
      joined = true;
      allContent = m.content;
      keepAwake();
    } else if (m.t === 'error') {
      if (m.code === 'kicked') {
        joined = false;
        wantJoin = false;
        localStorage.removeItem('manoir.token.' + room);
        showJoin(m.text);
      } else if (!joined) {
        wantJoin = false;
        if (m.code === 'noroom') {
          localStorage.removeItem('manoir.token.' + room);
          room = '';
        }
        showJoin(m.text);
      }
    } else if (m.t === 'state') {
      offset = m.now - Date.now();
      S = m;
      useLang(m.lang);
      render();
    }
  }

  function useLang(code) {
    const c = allContent && (allContent[code] || allContent.fr);
    if (!c) return;
    window.I18N.set(c.lang);
    document.title = tr('pageTitle');
    conn.textContent = tr('connLost');
    if (c !== content) {
      content = c;
      ui.mainHTML = null;
      ui.sig = null;
    }
  }

  async function keepAwake() {
    try {
      if (navigator.wakeLock) await navigator.wakeLock.request('screen');
    } catch (e) { /* rien */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (joined) {
      keepAwake();
      connect();
    }
  });

  // ------------------------------------------------------------------ entrée
  function showJoin(err) {
    hdr.hidden = true;
    bar.hidden = true;
    sheetBtn.hidden = true;
    unmountChallenge();
    ui.mainHTML = null;
    document.body.classList.remove('halluc', 'ghost');
    const F = (k) => window.I18N.in('fr', k);
    const A = (k) => window.I18N.in('aeb', k);
    main.innerHTML = `<section class="stack" style="padding-top:8vh">
      <h1 class="h2" style="font-size:2.7rem">La Nuit<br>du Manoir</h1>
      <p class="h2 arsub" dir="rtl" lang="ar-TN">ليلة القصر</p>
      <p class="lead muted">${esc(F('joinIntro'))}<br><span dir="rtl" lang="ar-TN">${esc(A('joinIntro'))}</span></p>
      ${room ? '' : `<input class="input code" id="code" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" aria-label="${esc(F('joinCode'))} / ${esc(A('joinCode'))}">`}
      <input class="input" id="name" maxlength="14" placeholder="${esc(F('joinName'))} / ${esc(A('joinName'))}" autocomplete="off" aria-label="${esc(F('joinName'))} / ${esc(A('joinName'))}" value="${esc(localStorage.getItem('manoir.name') || '')}">
      <button class="btn primary" id="enter">${esc(F('joinEnter'))} / ${esc(A('joinEnter'))}</button>
      <p class="err" id="err" role="alert">${esc(err || '')}</p></section>`;
    $('#enter').onclick = submitJoin;
    $('#name').addEventListener('keydown', (e) => e.key === 'Enter' && submitJoin());
  }

  function submitJoin() {
    const err = $('#err');
    const nm = $('#name').value.trim();
    if (!nm) {
      err.textContent = both('joinNeedName');
      return;
    }
    if (!room) {
      const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (c.length !== 4) {
        err.textContent = both('joinNeedCode');
        return;
      }
      room = c;
    }
    localStorage.setItem('manoir.name', nm);
    joinName = nm;
    wantJoin = true;
    $('#enter').disabled = true;
    err.textContent = '';
    connect();
  }

  // ------------------------------------------------------------------ aides
  const flash = (t) => {
    toast.textContent = t;
    toast.classList.add('on');
    clearTimeout(ui.tt);
    ui.tt = setTimeout(() => toast.classList.remove('on'), 3200);
  };
  const noteHTML = (n) => `<div class="note ${esc(n.kind)}"><small>${esc(tr('nightHdr', { n: n.night }))}</small>${esc(n.text)}</div>`;
  const pl = (id) => S.players.find((p) => p.id === id);
  const others = () => S.players.filter((p) => p.alive && p.id !== S.me.id);
  const chips = (list, sel) =>
    `<div class="chips">${list.map((p) => `<button class="chip ${sel === p.id ? 'sel' : ''}" style="--c:${p.color}" data-do="target" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  const journalPreview = (n) => {
    const l = S.log.slice(-n);
    if (!l.length) return '';
    return `<div class="stack"><h3 class="h3">${esc(tr('lastInfo'))}</h3>${l.slice().reverse().map(noteHTML).join('')}<button class="btn quiet" data-do="openSheet">${esc(tr('openJournal'))}</button></div>`;
  };
  const waiting = (t, s) => `<div class="stack center" style="padding-top:8vh"><h2 class="h2">${esc(t)}</h2><p class="lead muted">${esc(s)}</p></div>`;

  // ------------------------------------------------------------------ vues
  const VIEW = {};

  VIEW.lobby = () => `<div class="stack center" style="padding-top:5vh">
    <h2 class="h2">${esc(tr('youAtTable'))}</h2>
    <p class="lead muted">${esc(tr('waitOthers'))}</p>
    <p class="lead">${esc(tr('countOf', { n: S.players.length, t: S.target }))}</p>
    <div class="stack" style="width:100%">${S.players
      .map((p) => `<div class="row" style="grid-template-columns:1fr"><span class="t" style="border-inline-start:5px solid ${p.color};padding-inline-start:10px;text-align:start">${esc(p.name)}</span></div>`)
      .join('')}</div></div>`;

  VIEW.roles = () => {
    const me = S.me;
    const r = content.roles[me.role];
    const it = me.items[0] && content.items[me.items[0]];
    return `<div class="stack">
      <div class="role-card center"><div class="ic">${r.icon}</div><h2 class="h2">${esc(tr('youAre', { x: r.name }))}</h2><p class="lead" style="margin-top:8px">${esc(r.text)}</p></div>
      ${it ? `<div class="row"><div class="ic">${it.icon}</div><div><div class="t">${esc(it.name)}</div><div class="d">${esc(tr('startItem', { x: it.desc }))}</div></div></div>` : ''}
      <p class="small">${esc(tr('hideScreen'))}</p></div>`;
  };

  VIEW.podium = () => {
    const p = S.podium;
    const g = p.gained && content.items[p.gained];
    return `<div class="stack center" style="padding-top:3vh">
      <p class="small">${esc(tr('challengeResult'))}</p>
      <h2 class="h2">${esc(p.rank ? (p.rank === 1 ? tr('rank1', { t: p.total }) : tr('rankN', { r: p.rank, t: p.total })) : tr('youWatch'))}</h2>
      <p class="lead muted">${esc(p.label)}</p>
      ${S.me.marker ? `<p class="lead" style="color:var(--flame)">${esc(tr('youAreMarker'))}</p>` : `<p class="lead muted">${esc(tr('otherIsMarker', { x: p.marker }))}</p>`}
      ${p.immune ? `<p class="lead">${esc(tr('youProtected'))}</p>` : ''}
      ${g ? `<div class="row" style="width:100%;text-align:start"><div class="ic">${g.icon}</div><div><div class="t">${esc(tr('youReceive', { x: g.name }))}</div><div class="d">${esc(g.desc)}</div></div></div>` : p.rank && p.rank <= 2 ? `<p class="small">${esc(tr('invFull'))}</p>` : ''}
    </div>`;
  };

  function ghostMinuit() {
    const m = S.minuit;
    if (!m.curseOptions.length) return waiting(tr('youHaunted'), tr('hauntedWatch'));
    return `<div class="stack"><h2 class="h3">${esc(tr('chooseCurse'))}</h2>
      <p class="small">${esc(tr('cursesVote'))}</p>
      ${m.curseOptions
        .map((id) => {
          const c = content.curses[id];
          return `<button class="opt ${m.curseVote === id ? 'picked' : ''}" data-do="curse" data-id="${id}"><b>${esc(c.name)}</b><br><span class="small">${esc(c.desc)}</span></button>`;
        })
        .join('')}</div>`;
  }

  VIEW.minuit = () => {
    const me = S.me;
    const m = S.minuit;
    const a = m.act || {};
    if (!me.alive) return ghostMinuit();
    const ch = ui.choose;
    if (ch) {
      const title = ch.kind === 'mark' ? tr('whoLosesOne') : ch.kind === 'murmur' ? tr('whoWhisper') : tr('itemOnWhom', { x: content.items[ch.item].name });
      return `<div class="stack"><h2 class="h3">${esc(title)}</h2>${chips(others())}<button class="btn quiet" data-do="cancelChoose">${esc(tr('cancel'))}</button></div>`;
    }
    let h = `<div class="stack"><p class="small">${esc(tr('midnightHelp'))}</p>`;
    let any = false;
    if (me.marker) {
      any = true;
      const tg = a.mark && pl(a.mark);
      h += `<div class="row"><div class="ic">♛</div><div><div class="t">${esc(tr('markerTitle'))}</div><div class="d">${esc(tr('markerDesc'))}</div>${tg ? `<div class="d" style="color:var(--flame)">${esc(tr('plannedTarget', { x: tg.name }))}</div>` : ''}</div>
        <div class="go"><button class="btn ${tg ? 'on' : ''}" data-do="choose" data-kind="mark">${esc(tg ? tr('changeTarget') : tr('chooseTarget'))}</button>${tg ? `<button class="btn quiet" data-do="clear" data-kind="mark">${esc(tr('remove'))}</button>` : ''}</div></div>`;
    }
    const plannedIdx = a.item ? me.items.indexOf(a.item.item) : -1;
    me.items.forEach((id, i) => {
      any = true;
      const it = content.items[id];
      const planned = i === plannedIdx;
      const tg = planned && a.item.target && pl(a.item.target);
      h += `<div class="row"><div class="ic">${it.icon}</div><div><div class="t">${esc(it.name)}</div><div class="d">${esc(it.desc)}</div>${planned ? `<div class="d" style="color:var(--flame)">${esc(tr('plannedTonight'))}${tg ? esc(tr('plannedOn', { x: tg.name })) : ''}</div>` : ''}</div>
        <div class="go">${planned ? `<button class="btn quiet" data-do="clearItem">${esc(tr('cancel'))}</button>` : `<button class="btn" data-do="useItem" data-item="${id}">${esc(tr('use'))}</button>`}</div></div>`;
    });
    if (me.role === 'lie' && !me.usedMurmur) {
      any = true;
      const tg = a.murmur && pl(a.murmur);
      h += `<div class="row"><div class="ic">🩸</div><div><div class="t">${esc(tr('murmurTitle'))}</div><div class="d">${esc(tr('murmurDesc'))}</div>${tg ? `<div class="d" style="color:var(--flame)">${esc(tr('plannedTarget', { x: tg.name }))}</div>` : ''}</div>
        <div class="go"><button class="btn ${tg ? 'on' : ''}" data-do="choose" data-kind="murmur">${esc(tg ? tr('changeTarget') : tr('murmurTo'))}</button>${tg ? `<button class="btn quiet" data-do="clear" data-kind="murmur">${esc(tr('remove'))}</button>` : ''}</div></div>`;
    }
    if (m.canPacte) {
      any = true;
      const on = !!a.pacte;
      h += `<div class="row"><div class="ic">🕯️</div><div><div class="t">${esc(tr('pacteTitle'))}</div><div class="d">${esc(tr('pacteDesc'))}</div></div>
        <div class="go"><button class="btn ${on ? 'on' : ''}" data-do="pacte" data-on="${on ? 0 : 1}">${esc(on ? tr('pacteOn') : tr('pacteOffer'))}</button></div></div>`;
    }
    if (!any) h += `<p class="lead muted">${esc(tr('nothingToDo'))}</p>`;
    return h + '</div>';
  };

  VIEW.veillee = () => {
    const me = S.me;
    const v = S.veillee;
    if (!me.alive) {
      return `<div class="stack center"><h2 class="h2">${esc(tr('youHaunted'))}</h2><p class="lead muted">${esc(tr('hauntedVigil'))}</p>
        ${v.curse ? `<p class="lead">${esc(tr('curseTonight', { x: v.curse.name }))}</p>` : ''}</div>`;
    }
    let h = '<div class="stack">';
    if (me.hallu) h += `<p class="small" style="color:var(--wax-hi)">${esc(tr('halluWarn'))}</p>`;
    if (v.rune) h += `<div><p class="small center">${esc(tr('yourRune'))}</p><div class="rune">${v.rune}</div></div>`;
    if (v.silence) {
      if (ui.choose && ui.choose.kind === 'gesture') {
        h += `<h2 class="h3">${esc(tr('whoAccuse'))}</h2>${chips(others())}<button class="btn quiet" data-do="cancelChoose">${esc(tr('cancel'))}</button>`;
      } else {
        h += `<p class="lead center" style="color:var(--wax-hi)">${esc(tr('silenceLead'))}</p>
          <div class="gest-grid">${content.gestures.map((g, i) => `<button class="btn" data-do="gesture" data-g="${i}">${g.icon}<small>${esc(g.label)}</small></button>`).join('')}</div>`;
      }
    } else {
      h += `<p class="lead muted center">${esc(tr('talkAloud'))}</p>`;
    }
    return h + journalPreview(1) + '</div>';
  };

  VIEW.rituel = () => {
    const me = S.me;
    const r = S.rituel;
    if (!me.alive) return waiting(tr('livingVote'), tr('onlyWatch'));
    if (r.auto) return waiting(tr('duelTitle'), tr('duelSub'));
    if (r.isPossessed) {
      const t = r.possessed && pl(r.possessed);
      return `<div class="stack center" style="padding-top:5vh"><h2 class="h2">${esc(tr('possessedTitle'))}</h2>
        <p class="lead">${esc(tr('voteGiven'))}${t ? ' : <b>' + esc(t.name) + '</b>' : ''}.</p><p class="small">${esc(tr('noSay'))}</p></div>`;
    }
    const cands = r.eligible.filter((id) => id !== me.id).map(pl);
    return `<div class="stack"><h2 class="h3">${esc(tr('whoToTouch'))}</h2>
      ${r.immune ? `<p class="small">${esc(tr('youProtectedNow'))}</p>` : ''}
      ${chips(cands.map((p) => ({ ...p })), '')
        .replace(/data-do="target"/g, 'data-do="vote"')
        .replace(new RegExp(`class="chip " (style="[^"]*") data-do="vote" data-id="${r.myVote}"`), 'class="chip sel" $1 data-do="vote" data-id="' + r.myVote + '"')}
      <button class="btn quiet" data-do="vote" data-id="">${esc(r.voted && r.myVote === null ? tr('abstainDone') : tr('abstain'))}</button>
      <p class="small">${esc(r.voted ? tr('voteSaved') : tr('voteHelp'))}</p></div>`;
  };

  VIEW.aube = () => waiting(tr('dawnRises'), tr('dawnLook'));

  VIEW.fin = () => {
    const e = S.end;
    const won = e.winnerIds.includes(S.me.id);
    const roleName = { lie: content.roles.lie.name, solitaire: content.roles.solitaire.name };
    return `<div class="stack center" style="padding-top:3vh"><p class="small">${esc(tr('endNight'))}</p><h2 class="h2">${esc(won ? tr('victory') : tr('defeat'))}</h2><p class="lead">${esc(e.title)}</p></div>
      <div class="stack">${e.roles
        .map((r) => `<div class="row" style="grid-template-columns:1fr"><span class="t" style="border-inline-start:5px solid ${r.color};padding-inline-start:10px">${esc(r.name)} <span class="muted">${esc(roleName[r.role])}${r.alive ? '' : esc(tr('hauntedComma'))}</span></span></div>`)
        .join('')}</div>
      <p class="small center">${esc(tr('replayHint'))}</p>`;
  };

  // ------------------------------------------------------------------ épreuves
  class Quiz {
    constructor(root, ch) {
      this.root = root;
      this.ch = ch;
      this.i = (ch.mine || []).length;
      this.draw();
    }
    update(ch) {
      this.ch = ch;
      if (ch.done && this.i < ch.qs.length) {
        this.i = ch.qs.length;
        this.draw();
      }
    }
    draw() {
      const { qs } = this.ch;
      if (this.i >= qs.length) {
        this.root.innerHTML = waiting(tr('answersSent'), tr('waitOthersDots'));
        return;
      }
      const q = qs[this.i];
      this.root.innerHTML = `<p class="small">${esc(tr('questionN', { i: this.i + 1, n: qs.length }))}</p><h2 class="q">${esc(q.q)}</h2>
        <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>`;
      this.root.onclick = (e) => {
        const b = e.target.closest('.opt');
        if (!b) return;
        this.root.onclick = null;
        send({ t: 'ch', i: this.i, c: +b.dataset.k });
        this.i++;
        this.draw();
      };
    }
    destroy() {
      this.root.onclick = null;
    }
  }

  class Memoire {
    constructor(root, ch) {
      this.root = root;
      this.ch = ch;
      this.timers = [];
      this.taps = [];
      this.state = ch.done ? 'done' : 'show';
      this.run();
    }
    later(ms, fn) {
      this.timers.push(setTimeout(fn, Math.max(0, ms)));
    }
    update(ch) {
      this.ch = ch;
      if (ch.done && this.state !== 'done') {
        this.state = 'done';
        this.timers.forEach(clearTimeout);
        this.drawDone();
      }
    }
    drawDone() {
      this.root.innerHTML = waiting(tr('seqSent'), tr('waitOthersDots'));
    }
    run() {
      if (this.state === 'done') return this.drawDone();
      const ch = this.ch;
      const t = now();
      this.root.innerHTML = `<p class="small center" id="mt">${esc(tr('watchWell'))}</p><div class="glyphbox" id="gb"></div><div id="inp"></div>`;
      const gb = $('#gb', this.root);
      for (let i = 0; i < ch.len; i++) {
        const on = ch.flashStart + i * ch.flashMs - t;
        const off = on + ch.flashMs * 0.72;
        if (off < 0) continue;
        this.later(on, () => { gb.textContent = ch.glyphs[ch.seq[i]]; });
        this.later(off, () => { gb.textContent = ''; });
      }
      this.later(ch.inputAt - t, () => this.input());
    }
    input() {
      if (this.state !== 'show') return;
      this.state = 'input';
      const ch = this.ch;
      $('#gb', this.root).textContent = '';
      $('#mt', this.root).textContent = tr('yourTurnSeq');
      const dots = () => Array.from({ length: ch.len }, (_, i) => `<i class="${i < this.taps.length ? 'on' : ''}"></i>`).join('');
      $('#inp', this.root).innerHTML = `<div class="dots" id="dts">${dots()}</div>
        <div class="grid3" style="margin-top:14px">${ch.glyphs.map((g, k) => `<button class="cell" data-k="${k}" aria-label="${esc(tr('symbolN', { n: k + 1 }))}">${g}</button>`).join('')}</div>`;
      $('#inp', this.root).onclick = (e) => {
        const b = e.target.closest('.cell');
        if (!b || this.state !== 'input') return;
        vib(15);
        this.taps.push(+b.dataset.k);
        $('#dts', this.root).innerHTML = dots();
        if (this.taps.length === ch.len) {
          this.state = 'done';
          send({ t: 'ch', seq: this.taps });
          this.drawDone();
        }
      };
    }
    destroy() {
      this.timers.forEach(clearTimeout);
    }
  }

  class Reflexes {
    constructor(root, ch) {
      this.root = root;
      this.ch = ch;
      this.timers = [];
      this.hit = new Set();
      this.score = 0;
      root.innerHTML = `<p class="score" id="sc">${esc(tr('getReady'))}</p>
        <div class="grid3">${Array.from({ length: 9 }, () => '<div class="cell"></div>').join('')}</div>
        <p class="small center">${esc(tr('tapEyes'))}</p>`;
      this.cells = [...root.querySelectorAll('.cell')];
      root.addEventListener('pointerdown', (this.onTap = (e) => {
        const b = e.target.closest('.eye');
        if (b) this.tap(b);
      }));
      const t = now();
      this.later(ch.goStart - t, () => { $('#sc', root).textContent = tr('scoreN', { n: 0 }); });
      ch.sched.forEach((ev, i) => {
        const at = ch.goStart + ev.at - t;
        if (at + ev.dur < 0) return;
        this.later(at, () => this.show(i));
        this.later(at + ev.dur, () => this.hide(i));
      });
    }
    later(ms, fn) {
      this.timers.push(setTimeout(fn, Math.max(0, ms)));
    }
    update() { /* l'état local fait foi */ }
    show(i) {
      const ev = this.ch.sched[i];
      this.cells[ev.cell].innerHTML = `<button class="eye ${ev.kind === 'eye' ? 'eye-r' : ''}" data-i="${i}" aria-label="${esc(ev.kind === 'eye' ? tr('eye') : tr('spider'))}">${ev.kind === 'eye' ? '👁️' : '🕷️'}</button>`;
    }
    hide(i) {
      const ev = this.ch.sched[i];
      const b = this.cells[ev.cell].querySelector(`[data-i="${i}"]`);
      if (b) b.remove();
    }
    tap(b) {
      const i = +b.dataset.i;
      if (this.hit.has(i)) return;
      this.hit.add(i);
      const ev = this.ch.sched[i];
      send({ t: 'ch', tap: i });
      this.score += ev.kind === 'eye' ? 1 : -1;
      $('#sc', this.root).textContent = tr('scoreN', { n: this.score });
      if (ev.kind !== 'eye') {
        b.classList.add('bad');
        vib(70);
      }
      b.style.pointerEvents = 'none';
      setTimeout(() => b.remove(), 140);
    }
    destroy() {
      this.timers.forEach(clearTimeout);
      this.root.removeEventListener('pointerdown', this.onTap);
    }
  }

  class Bluff {
    constructor(root, ch) {
      this.root = root;
      this.ch = ch;
      this.sig = '';
      this.draw();
    }
    update(ch) {
      this.ch = ch;
      this.draw();
    }
    draw() {
      const ch = this.ch;
      const sig = ch.step + (ch.submitted ? 's' : '') + (ch.picked === null || ch.picked === undefined ? '' : 'p' + ch.picked);
      if (sig === this.sig) return;
      this.sig = sig;
      if (ch.step === 'write') {
        if (ch.submitted) {
          this.root.innerHTML = waiting(tr('answerHidden'), tr('answerMixed'));
          return;
        }
        this.root.innerHTML = `<p class="small">${esc(tr('inventPlausible'))}</p>
          <h2 class="q">${esc(ch.prompt)}</h2>
          <textarea class="textarea" id="tx" maxlength="90" placeholder="${esc(tr('writeAnswer'))}" aria-label="${esc(tr('yourInvented'))}"></textarea>
          <button class="btn primary" id="sendtx">${esc(tr('sendAnswer'))}</button>`;
        $('#sendtx', this.root).onclick = () => {
          const text = $('#tx', this.root).value.trim();
          if (!text) return;
          send({ t: 'ch', text });
          this.sig = 'sent';
          this.root.innerHTML = waiting(tr('answerHidden'), tr('answerMixed'));
        };
        return;
      }
      if (ch.picked !== null && ch.picked !== undefined) {
        this.root.innerHTML = waiting(tr('choiceSent'), tr('verdictScreen'));
        return;
      }
      this.root.innerHTML = `<p class="small">${esc(tr('whichIsReal'))}</p><h2 class="q">${esc(ch.prompt)}</h2>
        <div class="opts">${ch.options.map((o, i) => `<button class="opt ${o.mine ? 'mine' : ''}" data-i="${i}" ${o.mine ? 'disabled' : ''}>${esc(o.text)}${o.mine ? ` <span class="small">${esc(tr('yourAnswer'))}</span>` : ''}</button>`).join('')}</div>`;
      this.root.onclick = (e) => {
        const b = e.target.closest('.opt');
        if (!b || b.disabled) return;
        this.root.onclick = null;
        send({ t: 'ch', pick: +b.dataset.i });
        this.sig = 'sent';
        this.root.innerHTML = waiting(tr('choiceSent'), tr('verdictScreen'));
      };
    }
    destroy() {
      this.root.onclick = null;
    }
  }

  const CHALLENGES = { quiz: Quiz, memoire: Memoire, reflexes: Reflexes, bluff: Bluff };

  function mountChallenge() {
    const ch = S.ch;
    if (!S.me.alive) {
      unmountChallenge();
      setMain(waiting(tr('youHaunted'), tr('ghostChallenge')));
      return;
    }
    if (!ui.chUI || ui.chId !== ch.id) {
      unmountChallenge();
      main.innerHTML = '<div id="ch" class="stack"></div>';
      ui.mainHTML = null;
      ui.chId = ch.id;
      ui.chUI = new CHALLENGES[ch.type]($('#ch'), ch);
    } else ui.chUI.update(ch);
  }
  function unmountChallenge() {
    if (ui.chUI) {
      ui.chUI.destroy();
      ui.chUI = null;
      ui.chId = null;
    }
  }

  // ------------------------------------------------------------------ rendu
  function setMain(html) {
    if (html === ui.mainHTML) return;
    const y = window.scrollY;
    main.innerHTML = html;
    ui.mainHTML = html;
    window.scrollTo(0, y);
  }

  function renderHeader() {
    const me = S.me;
    const lobby = S.phase === 'lobby';
    hdr.hidden = false;
    hdr.innerHTML = `<button class="who" id="whoBtn"><b>${esc(me.name)}</b><small>${esc(lobby ? tr('atTable') : `${me.alive ? '' : tr('hauntedPrefix')}${tr('actLabel', { r: S.actRoman })}${S.night > 0 ? tr('nightN', { n: S.night }) : ''}. ${tr('touchRole')}`)}</small></button>${lobby ? '' : candles(me.raison, content.cfg.raison)}`;
    $('#whoBtn').onclick = showRole;
  }

  function showRole() {
    if (!S || !S.me.role) return;
    const r = content.roles[S.me.role];
    peek.innerHTML = `<div class="ic">${r.icon}</div><h2 class="h2">${esc(r.name)}</h2><p class="lead">${esc(r.text)}</p><p class="small">${esc(tr('touchClose'))}</p>`;
    peek.hidden = false;
    clearTimeout(ui.peekT);
    ui.peekT = setTimeout(() => { peek.hidden = true; }, 5000);
  }
  peek.onclick = () => { peek.hidden = true; };

  function renderBar() {
    const me = S.me;
    let h = '';
    if (S.phase === 'roles') {
      h = me.done ? `<button class="btn" disabled>${esc(tr('waitingOthers'))}</button>` : `<button class="btn primary" data-do="done">${esc(tr('understood'))}</button>`;
    } else if (S.phase === 'minuit' && !ui.choose) {
      h = me.done ? `<button class="btn on" data-do="undone">${esc(tr('ready'))}</button>` : `<button class="btn primary" data-do="done">${esc(tr('done'))}</button>`;
    } else if (S.phase === 'veillee' && me.alive && !ui.choose) {
      h = me.done ? `<button class="btn on" data-do="undone">${esc(tr('readyVoteOn'))}</button>` : `<button class="btn primary" data-do="done">${esc(tr('readyVote'))}</button>`;
    }
    bar.hidden = !h;
    barIn.innerHTML = h;
    document.body.classList.toggle('has-bar', !!h);
  }

  function renderSheetBtn() {
    const n = S.log.length;
    sheetBtn.hidden = !n || S.phase === 'crepuscule' || S.phase === 'lobby';
    sheetBtn.textContent = tr('journalN', { n });
  }

  function renderSheet() {
    const nights = {};
    S.log.forEach((n) => (nights[n.night] = nights[n.night] || []).push(n));
    const keys = Object.keys(nights).map(Number).sort((a, b) => b - a);
    sheet.innerHTML = `<div class="in"><div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">${esc(tr('journal'))}</h2><button class="btn quiet" data-do="closeSheet" style="width:auto">${esc(tr('close'))}</button></div>
      ${keys.map((k) => `<h3 class="h3">${esc(tr('nightHdr', { n: k }))}</h3>${nights[k].slice().reverse().map(noteHTML).join('')}`).join('') || `<p class="muted">${esc(tr('nothingYet'))}</p>`}
      <p class="small">${esc(tr('journalNote'))}</p></div>`;
  }

  function feedback() {
    const p = ui.prev;
    const me = S.me;
    if (p) {
      if (me.raison < p.raison) vib([250, 80, 250]);
      if (S.log.length > p.logN) {
        flash(tr('newInfo'));
        vib(120);
      }
      if (S.phase !== p.phase) vib(60);
    }
    ui.prev = { raison: me.raison, logN: S.log.length, phase: S.phase };
  }

  function render() {
    if (!S || !joined) return;
    if (S.phase !== ui.phase) {
      ui.phase = S.phase;
      ui.choose = null;
    }
    document.body.classList.toggle('halluc', !!S.me.hallu);
    document.body.classList.toggle('ghost', !S.me.alive && S.phase !== 'lobby');
    renderHeader();
    feedback();
    if (S.endsAt !== ui.endsSeen) {
      ui.endsSeen = S.endsAt;
      ui.total = Math.max(1000, S.endsAt - now());
    }
    if (S.phase === 'crepuscule') mountChallenge();
    else {
      unmountChallenge();
      setMain((VIEW[S.phase] || (() => ''))());
    }
    renderBar();
    renderSheetBtn();
    if (ui.sheet) renderSheet();
  }

  // ------------------------------------------------------------------ actions
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (!b || !S) return;
    const d = b.dataset;
    switch (d.do) {
      case 'done': send({ t: 'done' }); break;
      case 'undone': send({ t: 'done', v: false }); break;
      case 'choose': ui.choose = { kind: d.kind }; render(); break;
      case 'useItem':
        if (content.items[d.item].target) {
          ui.choose = { kind: 'item', item: d.item };
          render();
        } else send({ t: 'act', kind: 'item', item: d.item });
        break;
      case 'clearItem': send({ t: 'act', kind: 'item', item: null }); break;
      case 'clear': send({ t: 'act', kind: d.kind, target: null }); break;
      case 'target': {
        const c = ui.choose;
        ui.choose = null;
        if (!c) break;
        if (c.kind === 'item') send({ t: 'act', kind: 'item', item: c.item, target: d.id });
        else if (c.kind === 'gesture') send({ t: 'gesture', g: c.g, target: d.id });
        else send({ t: 'act', kind: c.kind, target: d.id });
        render();
        break;
      }
      case 'cancelChoose': ui.choose = null; render(); break;
      case 'pacte': send({ t: 'act', kind: 'pacte', on: d.on === '1' }); break;
      case 'curse': send({ t: 'act', kind: 'curse', id: d.id }); break;
      case 'gesture': {
        const g = content.gestures[+d.g];
        if (g.target) {
          ui.choose = { kind: 'gesture', g: +d.g };
          render();
        } else {
          vib(20);
          send({ t: 'gesture', g: +d.g });
        }
        break;
      }
      case 'vote': send({ t: 'vote', target: d.id || null }); break;
      case 'openSheet': ui.sheet = true; renderSheet(); sheet.hidden = false; break;
      case 'closeSheet': ui.sheet = false; sheet.hidden = true; break;
      default:
    }
  });

  // ------------------------------------------------------------------ barre de temps
  function loop() {
    if (S && joined) {
      const left = S.endsAt - now();
      const hidden = ['lobby', 'fin', 'aube'].includes(S.phase);
      tbar.style.width = hidden ? '0%' : Math.max(0, Math.min(1, left / ui.total)) * 100 + '%';
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ------------------------------------------------------------------ démarrage
  const savedName = localStorage.getItem('manoir.name');
  if (room && savedName && localStorage.getItem('manoir.token.' + room)) {
    // retour dans la partie après un rechargement de page
    joinName = savedName;
    wantJoin = true;
    main.innerHTML = `<div class="stack center" style="padding-top:12vh"><p class="lead muted">${esc(both('back'))}</p></div>`;
    connect();
  } else showJoin('');
})();
