/* Téléphone du joueur : rôle secret, épreuves, actions de minuit, vote, journal privé. */
(() => {
  'use strict';
  const { esc, candles } = window.UI;
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
      content = m.content;
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
      render();
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
    main.innerHTML = `<section class="stack" style="padding-top:8vh">
      <h1 class="h2" style="font-size:2.7rem">La Nuit<br>du Manoir</h1>
      <p class="lead muted">Entre ton prénom pour t’asseoir à la table.</p>
      ${room ? '' : '<input class="input code" id="code" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" aria-label="Code de la partie">'}
      <input class="input" id="name" maxlength="14" placeholder="Ton prénom" autocomplete="off" aria-label="Ton prénom" value="${esc(localStorage.getItem('manoir.name') || '')}">
      <button class="btn primary" id="enter">Entrer dans le manoir</button>
      <p class="err" id="err" role="alert">${esc(err || '')}</p></section>`;
    $('#enter').onclick = submitJoin;
    $('#name').addEventListener('keydown', (e) => e.key === 'Enter' && submitJoin());
  }

  function submitJoin() {
    const err = $('#err');
    const nm = $('#name').value.trim();
    if (!nm) {
      err.textContent = 'Écris ton prénom pour entrer.';
      return;
    }
    if (!room) {
      const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (c.length !== 4) {
        err.textContent = 'Saisis le code à 4 lettres affiché sur l’écran.';
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
  const noteHTML = (n) => `<div class="note ${esc(n.kind)}"><small>Nuit ${n.night}</small>${esc(n.text)}</div>`;
  const pl = (id) => S.players.find((p) => p.id === id);
  const others = () => S.players.filter((p) => p.alive && p.id !== S.me.id);
  const chips = (list, sel) =>
    `<div class="chips">${list.map((p) => `<button class="chip ${sel === p.id ? 'sel' : ''}" style="--c:${p.color}" data-do="target" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>`;
  const journalPreview = (n) => {
    const l = S.log.slice(-n);
    if (!l.length) return '';
    return `<div class="stack"><h3 class="h3">Dernières informations</h3>${l.slice().reverse().map(noteHTML).join('')}<button class="btn quiet" data-do="openSheet">Ouvrir le journal</button></div>`;
  };
  const waiting = (t, s) => `<div class="stack center" style="padding-top:8vh"><h2 class="h2">${esc(t)}</h2><p class="lead muted">${esc(s)}</p></div>`;

  // ------------------------------------------------------------------ vues
  const VIEW = {};

  VIEW.lobby = () => `<div class="stack center" style="padding-top:5vh">
    <h2 class="h2">Tu es à la table</h2>
    <p class="lead muted">Le manoir attend les autres invités.</p>
    <p class="lead">${S.players.length} sur ${S.target}</p>
    <div class="stack" style="width:100%">${S.players
      .map((p) => `<div class="row" style="grid-template-columns:1fr"><span class="t" style="border-left:5px solid ${p.color};padding-left:10px;text-align:left">${esc(p.name)}</span></div>`)
      .join('')}</div></div>`;

  VIEW.roles = () => {
    const me = S.me;
    const r = content.roles[me.role];
    const it = me.items[0] && content.items[me.items[0]];
    return `<div class="stack">
      <div class="role-card center"><div class="ic">${r.icon}</div><h2 class="h2">Tu es un ${esc(r.name)}</h2><p class="lead" style="margin-top:8px">${esc(r.text)}</p></div>
      ${it ? `<div class="row"><div class="ic">${it.icon}</div><div><div class="t">${esc(it.name)}</div><div class="d">Ton objet de départ. ${esc(it.desc)}</div></div></div>` : ''}
      <p class="small">Cache ton écran : personne d’autre ne doit connaître ton rôle. Touche ton prénom en haut pour le revoir plus tard.</p></div>`;
  };

  VIEW.podium = () => {
    const p = S.podium;
    const ord = p.rank === 1 ? '1er' : p.rank + 'e';
    const g = p.gained && content.items[p.gained];
    return `<div class="stack center" style="padding-top:3vh">
      <p class="small">Résultat de l’épreuve</p>
      <h2 class="h2">${p.rank ? `Tu finis ${ord} sur ${p.total}` : 'Tu observes'}</h2>
      <p class="lead muted">${esc(p.label)}</p>
      ${S.me.marker ? '<p class="lead" style="color:var(--flame)">♛ Tu es le Marqueur. À minuit, tu peux viser une cible.</p>' : `<p class="lead muted">${esc(p.marker)} est le Marqueur.</p>`}
      ${p.immune ? '<p class="lead">Dernier Cercle : tu es protégé du Rituel ce soir.</p>' : ''}
      ${g ? `<div class="row" style="width:100%;text-align:left"><div class="ic">${g.icon}</div><div><div class="t">Tu reçois : ${esc(g.name)}</div><div class="d">${esc(g.desc)}</div></div></div>` : p.rank && p.rank <= 2 ? '<p class="small">Ton inventaire est plein : pas de nouvel objet.</p>' : ''}
    </div>`;
  };

  function ghostMinuit() {
    const m = S.minuit;
    if (!m.curseOptions.length) return waiting('Tu es un Hanté', 'Tu observes la nuit depuis l’autre côté.');
    return `<div class="stack"><h2 class="h3">Choisis une malédiction</h2>
      <p class="small">Les Hantés votent ensemble. La plus choisie frappe les vivants.</p>
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
      const title = ch.kind === 'mark' ? 'Qui doit perdre 1 Raison ?' : ch.kind === 'murmur' ? 'À qui murmurer ?' : `${content.items[ch.item].name} : sur qui ?`;
      return `<div class="stack"><h2 class="h3">${esc(title)}</h2>${chips(others())}<button class="btn quiet" data-do="cancelChoose">Annuler</button></div>`;
    }
    let h = '<div class="stack"><p class="small">Minuit. Ce que tu décides ici reste secret. Un seul objet par nuit.</p>';
    let any = false;
    if (me.marker) {
      any = true;
      const tg = a.mark && pl(a.mark);
      h += `<div class="row"><div class="ic">♛</div><div><div class="t">Marqueur</div><div class="d">Vise un invité : il perd 1 Raison, sauf protection.</div>${tg ? `<div class="d" style="color:var(--flame)">Cible prévue : ${esc(tg.name)}</div>` : ''}</div>
        <div class="go"><button class="btn ${tg ? 'on' : ''}" data-do="choose" data-kind="mark">${tg ? 'Changer de cible' : 'Choisir une cible'}</button>${tg ? '<button class="btn quiet" data-do="clear" data-kind="mark">Retirer</button>' : ''}</div></div>`;
    }
    const plannedIdx = a.item ? me.items.indexOf(a.item.item) : -1;
    me.items.forEach((id, i) => {
      any = true;
      const it = content.items[id];
      const planned = i === plannedIdx;
      const tg = planned && a.item.target && pl(a.item.target);
      h += `<div class="row"><div class="ic">${it.icon}</div><div><div class="t">${esc(it.name)}</div><div class="d">${esc(it.desc)}</div>${planned ? `<div class="d" style="color:var(--flame)">Prévu cette nuit${tg ? ' sur ' + esc(tg.name) : ''}</div>` : ''}</div>
        <div class="go">${planned ? '<button class="btn quiet" data-do="clearItem">Annuler</button>' : `<button class="btn" data-do="useItem" data-item="${id}">Utiliser</button>`}</div></div>`;
    });
    if (me.role === 'lie' && !me.usedMurmur) {
      any = true;
      const tg = a.murmur && pl(a.murmur);
      h += `<div class="row"><div class="ic">🩸</div><div><div class="t">Murmurer</div><div class="d">Une seule fois dans la partie. Si ta cible est ton Lié, vous vous reconnaîtrez. Sinon, elle saura que quelqu’un l’a sondée.</div>${tg ? `<div class="d" style="color:var(--flame)">Cible prévue : ${esc(tg.name)}</div>` : ''}</div>
        <div class="go"><button class="btn ${tg ? 'on' : ''}" data-do="choose" data-kind="murmur">${tg ? 'Changer de cible' : 'Murmurer à…'}</button>${tg ? '<button class="btn quiet" data-do="clear" data-kind="murmur">Retirer</button>' : ''}</div></div>`;
    }
    if (m.canPacte) {
      any = true;
      const on = !!a.pacte;
      h += `<div class="row"><div class="ic">🕯️</div><div><div class="t">Pacte avec la Chose</div><div class="d">Tu perds 1 Raison à l’aube, mais tu reçois un objet tout de suite.</div></div>
        <div class="go"><button class="btn ${on ? 'on' : ''}" data-do="pacte" data-on="${on ? 0 : 1}">${on ? 'Pacte accepté. Annuler' : 'Offrir 1 Raison'}</button></div></div>`;
    }
    if (!any) h += '<p class="lead muted">Tu n’as rien à faire cette nuit. Reste discret.</p>';
    return h + '</div>';
  };

  VIEW.veillee = () => {
    const me = S.me;
    const v = S.veillee;
    if (!me.alive) {
      return `<div class="stack center"><h2 class="h2">Tu es un Hanté</h2><p class="lead muted">Tu observes la veillée. Les vivants ne peuvent ni t’entendre, ni te voir.</p>
        ${v.curse ? `<p class="lead">Malédiction de la nuit : ${esc(v.curse.name)}</p>` : ''}</div>`;
    }
    let h = '<div class="stack">';
    if (me.hallu) h += '<p class="small" style="color:var(--wax-hi)">Ta raison vacille : ce que tu vois ou apprends peut être faux.</p>';
    if (v.rune) h += `<div><p class="small center">Ta rune de la nuit</p><div class="rune">${v.rune}</div></div>`;
    if (v.silence) {
      if (ui.choose && ui.choose.kind === 'gesture') {
        h += `<h2 class="h3">Qui accuses-tu ?</h2>${chips(others())}<button class="btn quiet" data-do="cancelChoose">Annuler</button>`;
      } else {
        h += `<p class="lead center" style="color:var(--wax-hi)">Silence. Seuls les gestes sont permis.</p>
          <div class="gest-grid">${content.gestures.map((g, i) => `<button class="btn" data-do="gesture" data-g="${i}">${g.icon}<small>${esc(g.label)}</small></button>`).join('')}</div>`;
      }
    } else {
      h += '<p class="lead muted center">Parle à voix haute avec les autres. Ne montre pas ton écran.</p>';
    }
    return h + journalPreview(1) + '</div>';
  };

  VIEW.rituel = () => {
    const me = S.me;
    const r = S.rituel;
    if (!me.alive) return waiting('Les vivants votent', 'Tu ne peux que regarder.');
    if (r.auto) return waiting('Le duel est décisif', 'Il ne reste qu’une proie pour la Chose.');
    if (r.isPossessed) {
      const t = r.possessed && pl(r.possessed);
      return `<div class="stack center" style="padding-top:5vh"><h2 class="h2">Quelque chose parle à travers toi</h2>
        <p class="lead">Ton vote est déjà donné${t ? ' : <b>' + esc(t.name) + '</b>' : ''}.</p><p class="small">Tu n’as pas ton mot à dire. Les autres l’ignorent.</p></div>`;
    }
    const cands = r.eligible.filter((id) => id !== me.id).map(pl);
    return `<div class="stack"><h2 class="h3">Qui la Chose doit-elle toucher ?</h2>
      ${r.immune ? '<p class="small">Tu es protégé ce soir : on ne peut pas te désigner.</p>' : ''}
      ${chips(cands.map((p) => ({ ...p })), '')
        .replace(/data-do="target"/g, 'data-do="vote"')
        .replace(new RegExp(`class="chip " (style="[^"]*") data-do="vote" data-id="${r.myVote}"`), 'class="chip sel" $1 data-do="vote" data-id="' + r.myVote + '"')}
      <button class="btn quiet" data-do="vote" data-id="">${r.voted && r.myVote === null ? 'Abstention enregistrée' : 'S’abstenir'}</button>
      <p class="small">${r.voted ? 'Vote enregistré. Tu peux encore le changer.' : 'Le vote se termine quand tout le monde a voté, ou quand le temps est écoulé.'}</p></div>`;
  };

  VIEW.aube = () => waiting('L’aube se lève', 'Regarde l’écran pour savoir ce que la nuit a laissé.');

  VIEW.fin = () => {
    const e = S.end;
    const won = e.winnerIds.includes(S.me.id);
    const roleName = { lie: 'Lié', solitaire: 'Solitaire' };
    return `<div class="stack center" style="padding-top:3vh"><p class="small">Fin de la nuit</p><h2 class="h2">${won ? 'Victoire' : 'Défaite'}</h2><p class="lead">${esc(e.title)}</p></div>
      <div class="stack">${e.roles
        .map((r) => `<div class="row" style="grid-template-columns:1fr"><span class="t" style="border-left:5px solid ${r.color};padding-left:10px">${esc(r.name)} <span class="muted">${roleName[r.role]}${r.alive ? '' : ', Hanté'}</span></span></div>`)
        .join('')}</div>
      <p class="small center">L’écran propose de rejouer avec les mêmes invités.</p>`;
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
        this.root.innerHTML = waiting('Réponses envoyées', 'Attends les autres invités…');
        return;
      }
      const q = qs[this.i];
      this.root.innerHTML = `<p class="small">Question ${this.i + 1} sur ${qs.length}</p><h2 class="q">${esc(q.q)}</h2>
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
      this.root.innerHTML = waiting('Séquence envoyée', 'Attends les autres invités…');
    }
    run() {
      if (this.state === 'done') return this.drawDone();
      const ch = this.ch;
      const t = now();
      this.root.innerHTML = '<p class="small center" id="mt">Regarde bien…</p><div class="glyphbox" id="gb"></div><div id="inp"></div>';
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
      $('#mt', this.root).textContent = 'À toi : retape la séquence dans l’ordre.';
      const dots = () => Array.from({ length: ch.len }, (_, i) => `<i class="${i < this.taps.length ? 'on' : ''}"></i>`).join('');
      $('#inp', this.root).innerHTML = `<div class="dots" id="dts">${dots()}</div>
        <div class="grid3" style="margin-top:14px">${ch.glyphs.map((g, k) => `<button class="cell" data-k="${k}" aria-label="symbole ${k + 1}">${g}</button>`).join('')}</div>`;
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
      root.innerHTML = `<p class="score" id="sc">Prépare-toi…</p>
        <div class="grid3">${Array.from({ length: 9 }, () => '<div class="cell"></div>').join('')}</div>
        <p class="small center">Touche les yeux qui s’ouvrent. Évite les araignées.</p>`;
      this.cells = [...root.querySelectorAll('.cell')];
      root.addEventListener('pointerdown', (this.onTap = (e) => {
        const b = e.target.closest('.eye');
        if (b) this.tap(b);
      }));
      const t = now();
      this.later(ch.goStart - t, () => { $('#sc', root).textContent = 'Score : 0'; });
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
      this.cells[ev.cell].innerHTML = `<button class="eye ${ev.kind === 'eye' ? 'eye-r' : ''}" data-i="${i}" aria-label="${ev.kind === 'eye' ? 'œil' : 'araignée'}">${ev.kind === 'eye' ? '👁️' : '🕷️'}</button>`;
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
      $('#sc', this.root).textContent = 'Score : ' + this.score;
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
          this.root.innerHTML = waiting('Réponse cachée', 'Elle se mêle aux autres. Attends les autres invités…');
          return;
        }
        this.root.innerHTML = `<p class="small">Invente une réponse crédible. Une seule des réponses affichées sera la vraie.</p>
          <h2 class="q">${esc(ch.prompt)}</h2>
          <textarea class="textarea" id="tx" maxlength="90" placeholder="Écris ta réponse…" aria-label="Ta réponse inventée"></textarea>
          <button class="btn primary" id="sendtx">Envoyer ma réponse</button>`;
        $('#sendtx', this.root).onclick = () => {
          const text = $('#tx', this.root).value.trim();
          if (!text) return;
          send({ t: 'ch', text });
          this.sig = 'sent';
          this.root.innerHTML = waiting('Réponse cachée', 'Elle se mêle aux autres. Attends les autres invités…');
        };
        return;
      }
      if (ch.picked !== null && ch.picked !== undefined) {
        this.root.innerHTML = waiting('Choix envoyé', 'Le verdict tombera sur l’écran.');
        return;
      }
      this.root.innerHTML = `<p class="small">Laquelle de ces réponses est la vraie ?</p><h2 class="q">${esc(ch.prompt)}</h2>
        <div class="opts">${ch.options.map((o, i) => `<button class="opt ${o.mine ? 'mine' : ''}" data-i="${i}" ${o.mine ? 'disabled' : ''}>${esc(o.text)}${o.mine ? ' <span class="small">(ta réponse)</span>' : ''}</button>`).join('')}</div>`;
      this.root.onclick = (e) => {
        const b = e.target.closest('.opt');
        if (!b || b.disabled) return;
        this.root.onclick = null;
        send({ t: 'ch', pick: +b.dataset.i });
        this.sig = 'sent';
        this.root.innerHTML = waiting('Choix envoyé', 'Le verdict tombera sur l’écran.');
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
      setMain(waiting('Tu es un Hanté', 'Tu observes l’épreuve. Tes malédictions viendront à minuit.'));
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
    hdr.innerHTML = `<button class="who" id="whoBtn"><b>${esc(me.name)}</b><small>${lobby ? 'À la table' : `${me.alive ? '' : 'Hanté. '}Acte ${esc(S.actRoman)}${S.night > 0 ? ", nuit " + S.night : ""}. Touche pour voir ton rôle`}</small></button>${lobby ? '' : candles(me.raison, content.cfg.raison)}`;
    $('#whoBtn').onclick = showRole;
  }

  function showRole() {
    if (!S || !S.me.role) return;
    const r = content.roles[S.me.role];
    peek.innerHTML = `<div class="ic">${r.icon}</div><h2 class="h2">${esc(r.name)}</h2><p class="lead">${esc(r.text)}</p><p class="small">Touche pour fermer.</p>`;
    peek.hidden = false;
    clearTimeout(ui.peekT);
    ui.peekT = setTimeout(() => { peek.hidden = true; }, 5000);
  }
  peek.onclick = () => { peek.hidden = true; };

  function renderBar() {
    const me = S.me;
    let h = '';
    if (S.phase === 'roles') {
      h = me.done ? '<button class="btn" disabled>En attente des autres…</button>' : '<button class="btn primary" data-do="done">J’ai compris mon rôle</button>';
    } else if (S.phase === 'minuit' && !ui.choose) {
      h = me.done ? '<button class="btn on" data-do="undone">Je suis prêt. Modifier</button>' : '<button class="btn primary" data-do="done">J’ai fini</button>';
    } else if (S.phase === 'veillee' && me.alive && !ui.choose) {
      h = me.done ? '<button class="btn on" data-do="undone">Prêt à voter. Annuler</button>' : '<button class="btn primary" data-do="done">Prêt à voter</button>';
    }
    bar.hidden = !h;
    barIn.innerHTML = h;
    document.body.classList.toggle('has-bar', !!h);
  }

  function renderSheetBtn() {
    const n = S.log.length;
    sheetBtn.hidden = !n || S.phase === 'crepuscule' || S.phase === 'lobby';
    sheetBtn.textContent = `Journal (${n})`;
  }

  function renderSheet() {
    const nights = {};
    S.log.forEach((n) => (nights[n.night] = nights[n.night] || []).push(n));
    const keys = Object.keys(nights).map(Number).sort((a, b) => b - a);
    sheet.innerHTML = `<div class="in"><div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Journal</h2><button class="btn quiet" data-do="closeSheet" style="width:auto">Fermer</button></div>
      ${keys.map((k) => `<h3 class="h3">Nuit ${k}</h3>${nights[k].slice().reverse().map(noteHTML).join('')}`).join('') || '<p class="muted">Rien pour le moment.</p>'}
      <p class="small">Seuls toi et le manoir lisent ces lignes. Quand ta Raison tombe à 1, certaines peuvent mentir.</p></div>`;
  }

  function feedback() {
    const p = ui.prev;
    const me = S.me;
    if (p) {
      if (me.raison < p.raison) vib([250, 80, 250]);
      if (S.log.length > p.logN) {
        flash('Une nouvelle information est arrivée dans ton journal.');
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
    main.innerHTML = '<div class="stack center" style="padding-top:12vh"><p class="lead muted">Retour dans le manoir…</p></div>';
    connect();
  } else showJoin('');
})();
