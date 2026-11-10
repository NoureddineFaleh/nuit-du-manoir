/* Socle client des jeux « Parent Game Show » : écran partagé et téléphone.
   Un jeu s'enregistre avec Kit.register(id, { screen: {...}, phone: {...} }) (voir public/kit/games/*.js). */
(function (g) {
  'use strict';
  const { esc, candles, mmss } = g.UI;
  const $ = (s, r = document) => r.querySelector(s);
  const gameId = (location.pathname.match(/^\/g\/([a-z0-9_-]+)/) || [])[1] || '';
  const plugins = {};
  let waiters = [];

  const KT = {
    fr: {
      guestsAtTable: 'Joueurs à la table', langLabel: 'Langue', allHere: 'Tout le monde est là.',
      missing1: '{n} sur {t} installés. Il manque {m} joueur.', missingN: '{n} sur {t} installés. Il manque {m} joueurs.',
      qrAlt: 'QR code pour rejoindre la partie', waitingSeat: 'en attente…', tagReady: '✓ prêt', tagOff: 'déconnecté',
      kick: 'Renvoyer {x}', skip: 'Passer la phase', hub: 'Tous les jeux', outOf: '{a} sur {b}',
      joinIntro: 'Entre ton prénom pour t’asseoir à la table.', joinCode: 'Code de la partie', joinName: 'Ton prénom',
      joinEnter: 'Entrer', joinNeedName: 'Écris ton prénom pour entrer.', joinNeedCode: 'Saisis le code à 4 lettres affiché sur l’écran.',
      connLost: 'Connexion perdue. Reconnexion…', lobbyWait: 'Tu es à la table.', lobbyWaitSub: 'On attend les autres joueurs…',
      soundBtn: 'Activer le son', players: 'Joueurs',
    },
    aeb: {
      guestsAtTable: 'اللاعبين على الطاولة', langLabel: 'اللغة', allHere: 'الكل حاضر.',
      missing1: '{n} من {t} حضرو. ناقص لاعب واحد.', missingN: '{n} من {t} حضرو. ناقصين {m} لاعبين.',
      qrAlt: 'كود QR للدخول للعبة', waitingSeat: 'في الانتظار…', tagReady: '✓ جاهز', tagOff: 'مقطوع',
      kick: 'اطرد {x}', skip: 'عدّي للمرحلة الجاية', hub: 'كل الألعاب', outOf: '{a} من {b}',
      joinIntro: 'اكتب إسمك باش تقعد على الطاولة.', joinCode: 'كود اللعبة', joinName: 'إسمك',
      joinEnter: 'ادخل', joinNeedName: 'اكتب إسمك باش تدخل.', joinNeedCode: 'اكتب الكود المتاع 4 حروف اللي في الشاشة.',
      connLost: 'تقطّع الاتصال. نعاودو نتّصلو…', lobbyWait: 'إنت على الطاولة.', lobbyWaitSub: 'نستناو في الباقي…',
      soundBtn: 'شغّل الصوت', players: 'اللاعبين',
    },
  };
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : ''));
  const bothKT = (k) => fill(KT.fr[k]) + '  /  ' + fill(KT.aeb[k]);

  function makeTr(getLang, getContent) {
    return (k, v) => {
      const L = getLang();
      const c = getContent();
      const ui = (c && c[L] && c[L].ui) || {};
      const fr = (c && c.fr && c.fr.ui) || {};
      const val = ui[k] != null ? ui[k] : KT[L] && KT[L][k] != null ? KT[L][k] : fr[k] != null ? fr[k] : KT.fr[k] != null ? KT.fr[k] : k;
      return fill(val, v);
    };
  }

  const pips = (K, done, total) =>
    `<div class="progress">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < done ? 'on' : ''}"></span>`).join('')}<span>${esc(K.tr('outOf', { a: done, b: total }))}</span></div>`;

  function loadPlugin(cb) {
    if (plugins[gameId]) return cb(plugins[gameId]);
    waiters.push(cb);
    const s = document.createElement('script');
    s.src = `/kit/games/${gameId}.js`;
    s.onerror = () => { location.href = '/'; };
    document.head.appendChild(s);
  }
  function register(id, plugin) {
    plugins[id] = plugin;
    const w = waiters; waiters = [];
    w.forEach((cb) => cb(plugin));
  }

  // =====================================================================================
  //  ÉCRAN
  // =====================================================================================
  function screen(P) {
    const stage = $('#stage'); const seatsEl = $('#seats'); const clock = $('#clock'); const actmark = $('#actmark');
    const skipBtn = $('#skipBtn'); const soundBtn = $('#soundBtn'); const hubLink = $('#hubLink');
    let ws = null; let hello = null; let S = null; let offset = 0; let curLang = null; let lastHTML = ''; let lastSeats = '';
    let phaseId = ''; let swapTimer = null; let pending = null;
    const now = () => Date.now() + offset;
    const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
    const K = {
      tr: makeTr(() => (S && S.lang) || 'fr', () => hello && hello.content),
      esc, candles, mmss, FX: g.FX, send, now, hello: () => hello,
      pips: (d, t) => pips(K, d, t),
      narr: () => (S.narr && S.narr.text ? `<p class="narr">${esc(S.narr.text)}</p>` : ''),
      restartBtn: () => `<div class="actions"><button class="btn primary" data-do="restart">${esc(K.tr('replay'))}</button></div>`,
    };

    function connect() {
      const room = sessionStorage.getItem('pgs.room.' + gameId) || '';
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?role=screen&game=${gameId}${room ? '&room=' + room : ''}`);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'hello') { hello = m; sessionStorage.setItem('pgs.room.' + gameId, m.code); if (S) render(); }
        else if (m.t === 'screen') { offset = m.now - Date.now(); S = m; useLang(); render(); }
      };
      ws.onclose = () => setTimeout(connect, 1500);
    }

    function useLang() {
      if (!S || S.lang === curLang) return;
      curLang = S.lang;
      g.I18N.set(S.lang);
      document.title = K.tr('pageTitle');
      skipBtn.textContent = K.tr('skip');
      hubLink.textContent = K.tr('hub');
      soundBtn.textContent = K.tr('soundBtn');
      lastHTML = ''; lastSeats = '';
    }

    function lobby() {
      const n = S.players.length;
      const targets = []; for (let k = S.min; k <= S.max; k++) targets.push(k);
      return `<section class="lobby">
        <div>
          <h1 class="title">${K.tr('title')}</h1>
          <p class="lede">${esc(K.tr('lede'))}</p>
          <div class="count"><span>${esc(K.tr('guestsAtTable'))}</span>
            ${targets.map((k) => `<button class="btn ${S.target === k ? 'on' : ''}" data-do="target" data-n="${k}" ${n > k ? 'disabled' : ''}>${k}</button>`).join('')}
          </div>
          <div class="count langs" role="group" aria-label="${esc(K.tr('langLabel'))}"><span>${esc(K.tr('langLabel'))}</span>
            ${((hello && hello.langs) || []).map((l) => `<button class="btn ${S.lang === l.code ? 'on' : ''}" data-do="lang" data-lang="${l.code}">${esc(l.label)}</button>`).join('')}
          </div>
          <div class="actions">
            <button class="btn primary" data-do="start" ${S.canStart ? '' : 'disabled'}>${esc(K.tr('startBtn'))}</button>
            <span class="muted sans">${esc(S.canStart ? K.tr('allHere') : K.tr(S.target - n > 1 ? 'missingN' : 'missing1', { n, t: S.target, m: S.target - n }))}</span>
          </div>
          <p class="howto sans muted">${esc(K.tr('howto'))}</p>
        </div>
        <div>${hello ? `<div class="qr"><img src="${hello.qr}" alt="${esc(K.tr('qrAlt'))}"><div class="code">${esc(hello.code)}</div><div class="how">${esc(hello.joinUrl)}</div></div>` : ''}</div>
      </section>`;
    }

    function seatsHTML() {
      const inLobby = S.phase === 'lobby';
      const n = inLobby ? S.target : S.players.length;
      let h = '';
      for (let i = 0; i < n; i++) {
        const p = S.players[i];
        if (!p) { h += `<div class="seat empty">${candles(0, 3)}<div class="nm">${esc(K.tr('waitingSeat'))}</div><div class="tag">&nbsp;</div></div>`; continue; }
        let tag = '&nbsp;';
        if (!inLobby) {
          const t = P.screen.tag ? P.screen.tag(p, S, K) : null;
          tag = t != null ? t : !p.connected ? esc(K.tr('tagOff')) : '&nbsp;';
        }
        const cls = ['seat', !p.alive && !inLobby ? 'ghost' : '', !p.connected && !inLobby ? 'off' : ''].join(' ');
        h += `<div class="${cls}" style="--c:${p.color}">${inLobby ? `<button class="kick" data-do="kick" data-id="${p.id}" title="${esc(K.tr('kick', { x: p.name }))}">×</button>` : ''}${candles(p.alive || inLobby ? 3 : 0, 3)}<div class="nm" style="border-bottom:3px solid ${p.color}">${esc(p.name)}</div><div class="tag">${tag}</div></div>`;
      }
      return h;
    }

    function setStage(html, key) {
      if (html === lastHTML) return;
      const changed = key !== setStage.key;
      setStage.key = key; lastHTML = html;
      if (changed && stage.innerHTML) {
        clearTimeout(swapTimer); pending = html; stage.classList.add('swap');
        swapTimer = setTimeout(() => { stage.innerHTML = pending; stage.classList.remove('swap'); }, 380);
      } else if (stage.classList.contains('swap')) pending = html;
      else stage.innerHTML = html;
    }

    function render() {
      if (!S) return;
      const id = S.phase + '|' + (P.screen.key ? P.screen.key(S) : '');
      if (id !== phaseId) { phaseId = id; if (P.screen.enter) P.screen.enter(S, K); }
      const html = S.phase === 'lobby' ? lobby() : P.screen.render(S, K);
      setStage(html, id);
      actmark.innerHTML = S.phase === 'lobby' ? '' : P.screen.mark ? P.screen.mark(S, K) : '';
      const playing = !['lobby', 'fin'].includes(S.phase);
      skipBtn.hidden = !playing;
      hubLink.hidden = playing;
      const rl = $('#rulesLink'); if (rl) { rl.hidden = playing; rl.href = '/rules/' + (S.game || location.pathname.split('/')[2]); }
      const h = seatsHTML();
      if (h !== lastSeats) { lastSeats = h; seatsEl.innerHTML = h; }
      const light = S.phase === 'lobby' ? 1 : P.screen.light ? P.screen.light(S) : 1;
      document.body.style.setProperty('--light', Math.max(0.2, Math.min(1, light)).toFixed(2));
    }

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-do]');
      if (!b || b.disabled) return;
      const d = b.dataset.do;
      if (d === 'target') send({ t: 'target', n: Number(b.dataset.n) });
      else if (d === 'lang') send({ t: 'lang', lang: b.dataset.lang });
      else if (d === 'start') { if (!g.FX.isEnabled()) g.FX.enable(); soundBtn.hidden = true; send({ t: 'start' }); }
      else if (d === 'restart') send({ t: 'restart' });
      else if (d === 'kick') send({ t: 'kick', id: b.dataset.id });
    });
    skipBtn.onclick = () => send({ t: 'skip' });
    soundBtn.onclick = () => { g.FX.enable(); soundBtn.hidden = true; };

    (function loop() {
      if (S) {
        const running = S.endsAt && !['lobby', 'fin'].includes(S.phase);
        const left = S.endsAt - now();
        clock.textContent = running ? mmss(left) : '';
        clock.classList.toggle('low', running && left < 10000 && left > 0);
        const big = document.getElementById('big');
        if (big) { big.textContent = mmss(left); big.classList.toggle('low', left < 10000); }
      }
      requestAnimationFrame(loop);
    })();
    soundBtn.textContent = KT.fr.soundBtn + ' / ' + KT.aeb.soundBtn;
    connect();
  }

  // =====================================================================================
  //  TÉLÉPHONE
  // =====================================================================================
  function phone(P) {
    const main = $('#main'); const hdr = $('#hdr'); const conn = $('#conn'); const tbar = $('#timerbar i'); const toast = $('#toast');
    const params = new URLSearchParams(location.search);
    let room = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    let ws = null; let S = null; let content = null; let offset = 0; let joined = false; let wantJoin = false; let joinName = '';
    let total = 1; let endsSeen = 0; let lastSig = ''; let meta = null;
    const now = () => Date.now() + offset;
    const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
    const ui = {}; // état local du jeu (sélections non encore envoyées)
    const K = {
      tr: makeTr(() => (S && S.lang) || 'fr', () => content),
      esc, candles, send, ui, now, rerender: () => render(true),
      vib: (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* rien */ } },
      toast: (t) => { toast.textContent = t; toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2200); },
    };
    const tokenKey = 'pgs.token.' + gameId + '.' + (room || '');
    const token = () => {
      const k = 'pgs.token.' + gameId + '.' + room;
      let t = localStorage.getItem(k);
      if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(k, t); }
      return t;
    };
    void tokenKey;

    function connect() {
      if (ws && ws.readyState <= 1) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?role=player&room=${room}`);
      ws.onopen = () => { conn.hidden = true; if (wantJoin) send({ t: 'join', name: joinName, token: token() }); };
      ws.onmessage = (e) => onMsg(JSON.parse(e.data));
      ws.onclose = () => { if (joined) { conn.hidden = false; setTimeout(connect, 1500); } };
    }

    function onMsg(m) {
      if (m.t === 'joined') { joined = true; content = m.content; keepAwake(); }
      else if (m.t === 'error') {
        if (m.code === 'kicked') { joined = false; wantJoin = false; localStorage.removeItem('pgs.token.' + gameId + '.' + room); showJoin(m.text); }
        else if (!joined) {
          wantJoin = false;
          if (m.code === 'noroom') { localStorage.removeItem('pgs.token.' + gameId + '.' + room); room = ''; }
          showJoin(m.text);
        }
      } else if (m.t === 'state') {
        offset = m.now - Date.now(); S = m;
        if (S.lang !== K.lang) { K.lang = S.lang; g.I18N.set(S.lang); document.title = K.tr('pageTitle'); conn.textContent = K.tr('connLost'); lastSig = ''; }
        render();
      }
    }

    async function keepAwake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* rien */ } }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && joined) { keepAwake(); connect(); } });

    async function showJoin(err) {
      hdr.hidden = true; lastSig = '';
      if (!meta) { try { meta = (await (await fetch('/api/games')).json()).find((x) => x.id === gameId) || null; } catch (e) { meta = null; } }
      const T = meta ? meta.title : { fr: 'Parent Game Show', aeb: '' };
      main.innerHTML = `<section class="stack" style="padding-top:8vh">
        <h1 class="h2" style="font-size:2.7rem">${esc(T.fr)}</h1>
        <p class="h2 arsub" dir="rtl" lang="ar-TN">${esc(T.aeb)}</p>
        <p class="lead muted">${esc(KT.fr.joinIntro)}<br><span dir="rtl" lang="ar-TN">${esc(KT.aeb.joinIntro)}</span></p>
        ${room ? '' : `<input class="input code" id="code" maxlength="4" placeholder="CODE" autocapitalize="characters" autocomplete="off" aria-label="${esc(bothKT('joinCode'))}">`}
        <input class="input" id="name" maxlength="14" placeholder="${esc(bothKT('joinName'))}" autocomplete="off" aria-label="${esc(bothKT('joinName'))}" value="${esc(localStorage.getItem('pgs.name') || '')}">
        <button class="btn primary" id="enter">${esc(bothKT('joinEnter'))}</button>
        <p class="err" id="err" role="alert">${esc(err || '')}</p></section>`;
      $('#enter').onclick = submitJoin;
      $('#name').addEventListener('keydown', (e) => e.key === 'Enter' && submitJoin());
    }

    function submitJoin() {
      const err = $('#err'); const nm = $('#name').value.trim();
      if (!nm) { err.textContent = bothKT('joinNeedName'); return; }
      if (!room) {
        const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (c.length !== 4) { err.textContent = bothKT('joinNeedCode'); return; }
        room = c;
      }
      localStorage.setItem('pgs.name', nm); joinName = nm; wantJoin = true; $('#enter').disabled = true; err.textContent = '';
      if (ws) { try { ws.close(); } catch (e) { /* rien */ } ws = null; }
      connect();
    }

    function render(force) {
      if (!S) return;
      const sig = JSON.stringify({ ...S, now: 0 }) + JSON.stringify(ui);
      if (sig !== lastSig || force) {
        lastSig = sig;
        const inLobby = S.phase === 'lobby';
        document.body.classList.toggle('ghost', !S.me.alive && !inLobby);
        const h = !inLobby && P.phone.header ? P.phone.header(S, K) : null;
        hdr.hidden = false;
        hdr.innerHTML = `<div class="who"><b style="border-bottom:3px solid ${S.me.color}">${esc(S.me.name)}</b><small>${h && h.sub ? esc(h.sub) : ''}</small></div><div>${h && h.right ? h.right : ''}</div>`;
        const phaseKey = S.phase + '|' + (P.phone.key ? P.phone.key(S) : '');
        if (phaseKey !== render.pk) { render.pk = phaseKey; if (P.phone.enter) P.phone.enter(S, K); K.vib(40); }
        main.innerHTML = inLobby
          ? `<section class="stack center" style="padding-top:10vh"><h1 class="h2">${esc(K.tr('lobbyWait'))}</h1><p class="lead muted">${esc(K.tr('lobbyWaitSub'))}</p><p class="small">${S.players.map((p) => `<span style="border-bottom:3px solid ${p.color};margin:0 .4em">${esc(p.name)}</span>`).join(' ')}</p></section>`
          : P.phone.render(S, K);
      }
      if (S.endsAt !== endsSeen) { endsSeen = S.endsAt; total = Math.max(1000, S.endsAt - now()); }
    }

    main.addEventListener('click', (e) => {
      const b = e.target.closest('[data-do]');
      if (!b || b.disabled) return;
      const fn = P.phone.actions && P.phone.actions[b.dataset.do];
      if (fn) fn(b, K, S);
    });

    (function loop() {
      if (S && S.endsAt && !['lobby', 'fin'].includes(S.phase)) tbar.style.width = Math.max(0, Math.min(100, ((S.endsAt - now()) / total) * 100)) + '%';
      else tbar.style.width = '0';
      requestAnimationFrame(loop);
    })();

    if (!room) showJoin();
    else showJoin(); // le formulaire s'affiche d'abord (le prénom est demandé), puis la connexion
    if (room && localStorage.getItem('pgs.token.' + gameId + '.' + room)) {
      // reconnexion automatique d'un joueur déjà inscrit
      joinName = localStorage.getItem('pgs.name') || 'Joueur'; wantJoin = true; connect();
    }
  }

  function boot(kind) {
    if (!gameId) { location.href = '/'; return; }
    document.body.classList.add('kit');
    loadPlugin((P) => (kind === 'screen' ? screen(P) : phone(P)));
  }

  g.Kit = { boot, register, pips, KT };
})(window);
