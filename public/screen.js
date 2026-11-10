/* Écran partagé (PC / TV) : salon, déroulé de la nuit, révélations. */
(() => {
  'use strict';
  const { esc, candles, mmss } = window.UI;
  const tr = (k, v) => window.I18N.t(k, v);
  const FX = window.FX;
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const seatsEl = $('#seats');
  const clock = $('#clock');
  const actmark = $('#actmark');
  const blackout = $('#blackout');
  const soundBtn = $('#soundBtn');
  const skipBtn = $('#skipBtn');

  let ws = null;
  let hello = null;
  let curLang = null;
  let S = null;
  let offset = 0;
  let lastNarr = 0;
  let lastHTML = '';
  let lastSeats = '';
  let stageKey = '';
  let phaseId = '';
  let pending = null;
  let swapTimer = null;
  let prevSnap = null;
  let aubeView = null;
  let aubeTimers = [];
  const hitSet = new Set();
  const now = () => Date.now() + offset;
  const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

  // ---------------------------------------------------------------- réseau
  function connect() {
    const room = sessionStorage.getItem('manoir.room') || '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?role=screen&game=manoir${room ? '&room=' + room : ''}`);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'hello') {
        hello = m;
        sessionStorage.setItem('manoir.room', m.code);
        if (S) render();
      } else if (m.t === 'screen') {
        offset = m.now - Date.now();
        S = m;
        useLang();
        render();
      }
    };
    ws.onclose = () => setTimeout(connect, 1500);
  }

  // ---------------------------------------------------------------- langue
  const CT = () => (hello && (hello.content[S.lang] || hello.content.fr)) || null;
  function useLang() {
    if (!S || S.lang === curLang) return;
    curLang = S.lang;
    window.I18N.set(S.lang);
    const meta = (window.UI_META && window.UI_META[S.lang]) || {};
    FX.setLang(meta.speech || 'fr-FR', meta.voice !== false);
    document.title = tr('pageTitle');
    skipBtn.textContent = tr('skip');
    soundLabel();
    lastHTML = '';
    lastSeats = '';
    stageKey = '';
  }

  // ---------------------------------------------------------------- aides
  const pips = (done, total) =>
    `<div class="progress">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < done ? 'on' : ''}"></span>`).join('')}<span>${esc(tr('outOf', { a: done, b: total }))}</span></div>`;
  const narr = () => (S.narr && S.narr.text ? `<p class="narr">${esc(S.narr.text)}</p>` : '');
  const eventBar = () =>
    S.event ? `<div class="eventbar"><b>${esc(S.event.name)}.</b> ${esc(S.event.text)}</div>` : '';
  const disp = (p) => (aubeView && aubeView[p.id] ? aubeView[p.id] : { raison: p.raison, alive: p.alive });
  const fraction = () => {
    const max = 3 * S.players.length;
    const sum = S.players.reduce((n, p) => n + disp(p).raison, 0);
    return max ? sum / max : 1;
  };

  // ---------------------------------------------------------------- vues
  const V = {};

  V.lobby = () => {
    const n = S.players.length;
    return `<section class="lobby">
      <div>
        <h1 class="title">${tr('title')}</h1>
        <p class="lede">${esc(tr('lobbyLede'))}</p>
        <div class="count"><span>${esc(tr('guestsAtTable'))}</span>
          ${[4, 5].map((k) => `<button class="btn ${S.target === k ? 'on' : ''}" data-do="target" data-n="${k}" ${n > k ? 'disabled' : ''}>${k}</button>`).join('')}
        </div>
        <div class="count langs" role="group" aria-label="${esc(tr('langLabel'))}"><span>${esc(tr('langLabel'))}</span>
          ${((hello && hello.langs) || []).map((l) => `<button class="btn ${S.lang === l.code ? 'on' : ''}" data-do="lang" data-lang="${l.code}" ${n > 0 && false ? 'disabled' : ''}>${esc(l.label)}</button>`).join('')}
        </div>
        <div class="actions">
          <button class="btn primary" data-do="start" ${S.canStart ? '' : 'disabled'}>${esc(tr('openManor'))}</button>
          <span class="muted sans">${esc(S.canStart ? tr('allHere') : tr(S.target - n > 1 ? 'missingN' : 'missing1', { n, t: S.target, m: S.target - n }))}</span>
        </div>
      </div>
      <div>${hello ? `<div class="qr"><img src="${hello.qr}" alt="${esc(tr('qrAlt'))}"><div class="code">${esc(hello.code)}</div><div class="how">${esc(hello.joinUrl)}</div></div>` : ''}</div>
    </section>`;
  };

  V.roles = () => `
    <h1 class="phase-title">${esc(tr('rolesTitle'))}</h1>${narr()}
    <p class="sub">${esc(tr('rolesSub'))}</p>
    ${pips(S.ready.done, S.ready.total)}`;

  V.crepuscule = () => {
    const c = S.ch;
    let body = '';
    if (c.type === 'bluff') {
      body += `<p class="prompt-q">${esc(c.prompt)}</p>`;
      if (c.step === 'pick') body += `<ol class="optlist">${c.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>`;
    }
    const lbl = tr(c.type === 'bluff' ? (c.step === 'write' ? 'wrote' : 'picked') : 'finished');
    return `<h1 class="phase-title">${esc(c.name)}</h1>
      <p class="sub">${esc(c.sub)}</p>${body}
      ${c.progress ? pips(c.progress.done, c.progress.total).replace('</span></div>', ` ${lbl}</span></div>`) : ''}
      ${eventBar()}`;
  };

  V.podium = () => {
    const p = S.podium;
    const rows = p.rows
      .map(
        (r, i) => `<li><span class="pos">${i + 1}</span><span>${esc(r.name)}${r.marker ? ` <span class="crown" style="color:var(--flame)">${esc(tr('markerTag'))}</span>` : ''}${r.gained ? `<span class="gift">${esc(tr('gift'))}</span>` : ''}</span><span class="lbl">${esc(r.label || '')}</span></li>`
      )
      .join('');
    let reveal = '';
    if (p.reveal) {
      reveal = `<p class="sub">${esc(tr('truthWas'))}</p><ol class="optlist">${p.reveal.opts
        .map((o) => `<li class="${o.real ? 'real' : ''}">${esc(o.text)}<small>${o.real ? esc(tr('realAnswer')) : o.author ? esc(tr('writtenBy', { x: o.author })) : ''}</small></li>`)
        .join('')}</ol>`;
    }
    return `<h1 class="phase-title">${esc(tr('podiumTitle'))}</h1>${narr()}
      <ol class="ranks">${rows}</ol>
      ${p.immune ? `<p class="sub">${esc(tr('lastCircle', { x: p.immune }))}</p>` : ''}
      ${reveal}`;
  };

  V.minuit = () => `
    <h1 class="phase-title">${esc(tr('midnight'))}</h1>${narr()}
    <p class="sub">${esc(tr('midnightSub', { x: S.minuit.marker }))}</p>
    ${pips(S.minuit.ready.done, S.minuit.ready.total)}
    ${S.minuit.ghosts ? `<p class="sub" style="color:var(--ghost)">${esc(tr('ghostsWhisper'))}</p>` : ''}`;

  V.veillee = () => {
    const v = S.veillee;
    const left = S.endsAt - now();
    const gest = v.gestures.filter((g) => now() - g.at < 7000);
    if (v.silence) {
      return `<div class="silence">${esc(tr('silenceWord'))}</div><p class="sub">${esc(tr('silenceSub'))}</p>
        <div class="bigclock" id="big">${mmss(left)}</div>
        <div class="gest">${gest.map((g) => `<div class="g">${esc(g.name)} ${g.icon}${g.target ? ' ' + esc(g.target) : ''}<small>${esc(g.label)}</small></div>`).join('')}</div>
        ${v.curse ? `<div class="eventbar"><b>${esc(v.curse.name)}.</b> ${esc(v.curse.text)}</div>` : ''}`;
    }
    return `<div class="vgrid">
      <div><h1 class="phase-title">${esc(tr('vigil'))}</h1>${narr()}
        ${eventBar()}
        ${v.curse ? `<div class="eventbar" style="border-color:var(--ghost)"><b style="color:var(--ghost)">${esc(v.curse.name)}.</b> ${esc(v.curse.text)}</div>` : ''}
        ${v.rune ? `<p class="sub">${esc(tr('runeBurns'))}</p><div class="runebig">${v.rune}</div>` : ''}
      </div>
      <div><div class="bigclock" id="big">${mmss(left)}</div>
        <p class="sub">${esc(tr('talkAccuse'))}</p>${pips(v.ready.done, v.ready.total).replace('</span></div>', ` ${esc(tr('readyToVote'))}</span></div>`)}
      </div></div>`;
  };

  V.rituel = () => {
    const r = S.rituel;
    const fog = CT().events.brouillard;
    return `<h1 class="phase-title">${esc(tr('ritual'))}</h1>${narr()}
      ${r.auto ? `<p class="sub">${esc(tr('ritualAuto'))}</p>` : `<p class="sub">${esc(tr('ritualPick'))}</p>${pips(r.voted, r.total).replace('</span></div>', ` ${esc(tr('votedWord'))}</span></div>`)}`}
      ${r.immune ? `<p class="sub">${esc(tr('protectedByThing', { x: r.immune }))}</p>` : ''}
      ${r.hidden ? `<div class="eventbar"><b>${esc(fog.name)}.</b> ${esc(fog.text)}</div>` : ''}
      <div class="bigclock ${S.endsAt - now() < 10000 ? 'low' : ''}" id="big" style="font-size:6em">${mmss(S.endsAt - now())}</div>`;
  };

  V.aube = () => {
    const a = S.aube;
    const detail = a.detail && a.detail.length
      ? `<div class="votes">${a.detail.map((d) => `<span>${esc(d.to ? tr('designates', { a: d.from, b: d.to }) : tr('abstains', { a: d.from }))}</span>`).join('')}</div>`
      : a.hidden
        ? `<div class="votes"><span>${esc(tr('darkVotes'))}</span></div>`
        : '';
    return `<h1 class="phase-title">${esc(tr('dawn'))}</h1>${detail}
      <ul class="ledger">${a.lines.map((l, i) => `<li class="${l.kind}" style="--t:${(i * 1.4).toFixed(1)}s">${esc(l.text)}</li>`).join('')}</ul>`;
  };

  V.fin = () => {
    const e = S.end;
    const roleName = { lie: CT().roles.lie.name, solitaire: CT().roles.solitaire.name };
    return `<h1 class="phase-title">${esc(e.title)}</h1>${narr()}
      <div class="endgrid">${e.roles
        .map((r) => `<div class="who ${e.winnerIds.includes(r.id) ? 'win' : ''}" style="--c:${r.color}">${esc(r.name)}<small>${esc(roleName[r.role])}${esc(r.alive ? tr('standing') : tr('hauntedComma'))}</small></div>`)
        .join('')}</div>
      <div class="actions" style="margin-top:2em"><button class="btn primary" data-do="restart">${esc(tr('replay'))}</button></div>`;
  };

  // ---------------------------------------------------------------- rendu
  function setStage(html, key) {
    if (html === lastHTML && key === stageKey) return;
    lastHTML = html;
    if (key !== stageKey) {
      stageKey = key;
      pending = html;
      stage.classList.add('swap');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => {
        stage.innerHTML = pending;
        stage.classList.remove('swap');
      }, 380);
    } else if (stage.classList.contains('swap')) {
      pending = html;
    } else {
      stage.innerHTML = html;
    }
  }

  function seatsHTML() {
    const lobby = S.phase === 'lobby';
    const n = lobby ? S.target : S.players.length;
    let h = '';
    for (let i = 0; i < n; i++) {
      const p = S.players[i];
      if (!p) {
        h += `<div class="seat empty">${candles(0, 3)}<div class="nm">${esc(tr('waitingSeat'))}</div><div class="tag">&nbsp;</div></div>`;
        continue;
      }
      const d = disp(p);
      const hit = hitSet.has(p.id);
      let tag = '&nbsp;';
      if (p.crown && !lobby) tag = `<span class="crown">${esc(tr('markerTag'))}</span>`;
      else if (!d.alive) tag = esc(tr('tagHaunted'));
      else if (p.done && ['roles', 'minuit', 'veillee'].includes(S.phase)) tag = `<span class="ok">${esc(tr('tagReady'))}</span>`;
      else if (!p.connected && !lobby) tag = esc(tr('tagOff'));
      const cls = ['seat', !d.alive && !lobby ? 'ghost' : '', !p.connected && !lobby ? 'off' : '', hit ? 'hit' : ''].join(' ');
      h += `<div class="${cls}" style="--c:${p.color}">${lobby ? `<button class="kick" data-do="kick" data-id="${p.id}" title="${esc(tr('kick', { x: p.name }))}">×</button>` : ''}${candles(lobby ? 3 : d.raison, 3)}<div class="nm" style="border-bottom:3px solid ${p.color}">${esc(p.name)}</div><div class="tag">${tag}</div></div>`;
    }
    return h;
  }

  function renderSeats() {
    const h = seatsHTML();
    hitSet.clear();
    if (h !== lastSeats) {
      lastSeats = h;
      seatsEl.innerHTML = h;
    }
  }

  function startAubeReveal() {
    aubeTimers.forEach(clearTimeout);
    aubeTimers = [];
    aubeView = prevSnap ? JSON.parse(JSON.stringify(prevSnap)) : null;
    if (!aubeView) {
      FX.cue(S.aube.cue);
      return;
    }
    S.aube.lines.forEach((ln, i) => {
      if (ln.kind !== 'loss' && ln.kind !== 'death') return;
      aubeTimers.push(
        setTimeout(() => {
          if (!aubeView || !S) return;
          const p = S.players.find((x) => x.id === ln.pid);
          if (!p) return;
          if (ln.kind === 'loss') {
            aubeView[p.id] = { ...aubeView[p.id], raison: p.raison };
            hitSet.add(p.id);
            FX.cue('hit');
          } else {
            aubeView[p.id] = { ...aubeView[p.id], alive: false };
            FX.cue('death');
          }
          renderSeats();
          updateAmbience();
        }, i * 1400 + 500)
      );
    });
  }

  function onEnter() {
    FX.heart(0);
    switch (S.phase) {
      case 'roles': FX.cue('boom'); break;
      case 'crepuscule':
        FX.cue('creak');
        if (S.banner) showActCard();
        break;
      case 'podium':
      case 'minuit': FX.cue('bell'); break;
      case 'veillee':
        if (S.event && S.event.id === 'murmures') FX.cue('whisper');
        break;
      case 'rituel': FX.cue('boom'); break;
      case 'aube': startAubeReveal(); break;
      case 'fin': FX.cue('bell'); setTimeout(() => FX.cue('boom'), 700); break;
      default:
    }
    if (S.phase !== 'aube') {
      aubeTimers.forEach(clearTimeout);
      aubeTimers = [];
      aubeView = null;
    }
    updateAmbience();
  }

  function showActCard() {
    const el = document.createElement('div');
    el.className = 'actcard';
    el.innerHTML = `<div class="a">${esc(tr('actLabel', { r: S.actRoman }))}</div><div class="b">${esc(S.actName)}</div>`;
    $('#app').appendChild(el);
    setTimeout(() => el.remove(), 5400);
  }

  /** Lumière de la pièce et battements de cœur selon la Raison restante. */
  function updateAmbience() {
    if (!S) return;
    const lobby = S.phase === 'lobby';
    const f = lobby ? 1 : Math.max(0.2, Math.min(1, fraction()));
    document.body.style.setProperty('--light', f.toFixed(2));
    if (['veillee', 'rituel'].includes(S.phase)) {
      const bpm = Math.round(46 + 54 * (1 - f) + (S.phase === 'rituel' ? 10 : 0));
      if (Math.abs(FX.bpm() - bpm) > 3) FX.heart(bpm);
    } else if (FX.bpm()) FX.heart(0);
  }

  function render() {
    if (!S) return;
    const id = S.phase + '|' + S.night;
    if (id !== phaseId) {
      phaseId = id;
      onEnter();
    }
    if (S.narr && S.narr.id !== lastNarr) {
      lastNarr = S.narr.id;
      FX.say(S.narr.text);
    }
    const key = id + '|' + (S.ch ? S.ch.id + (S.ch.step || '') : '');
    setStage(V[S.phase] ? V[S.phase]() : '', key);

    actmark.innerHTML =
      S.phase === 'lobby' ? '' : S.phase === 'fin' ? esc(tr('nightEnded')) : `<b>${esc(tr('actLabel', { r: S.actRoman }))}</b> ${esc(S.actName)}${S.night > 0 ? esc(tr('nightN', { n: S.night })) : ''}`;
    skipBtn.hidden = ['lobby', 'fin'].includes(S.phase);
    $('#hubLink').hidden = !['lobby', 'fin'].includes(S.phase);
    $('#rulesLink').hidden = !['lobby', 'fin'].includes(S.phase);
    renderSeats();
    updateAmbience();
    if (S.phase !== 'aube') {
      prevSnap = Object.fromEntries(S.players.map((p) => [p.id, { raison: p.raison, alive: p.alive }]));
    }
  }

  // ---------------------------------------------------------------- horloge
  function loop() {
    if (S) {
      const left = S.endsAt - now();
      clock.textContent = ['lobby', 'fin'].includes(S.phase) ? '' : mmss(left);
      clock.classList.toggle('low', left < 10000 && left > 0);
      const big = document.getElementById('big');
      if (big) {
        big.textContent = mmss(left);
        big.classList.toggle('low', left < 10000);
      }
      const v = S.veillee;
      blackout.classList.toggle('on', S.phase === 'veillee' && !!v && v.coupure && now() < v.startedAt + v.coupureMs);
    }
    requestAnimationFrame(loop);
  }
  setInterval(() => {
    // rafraîchit les gestes (ils s'effacent) sans reconstruire le reste
    if (S && S.phase === 'veillee' && S.veillee.silence) render();
  }, 1000);

  // ---------------------------------------------------------------- actions
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (!b) return;
    switch (b.dataset.do) {
      case 'target': send({ t: 'target', n: +b.dataset.n }); break;
      case 'start':
        if (!FX.isEnabled()) enableSound();
        send({ t: 'start' });
        break;
      case 'restart': send({ t: 'restart' }); break;
      case 'lang': send({ t: 'lang', lang: b.dataset.lang }); break;
      case 'kick': send({ t: 'kick', id: b.dataset.id }); break;
      default:
    }
  });
  skipBtn.onclick = () => send({ t: 'skip' });

  function soundLabel() {
    soundBtn.textContent = !FX.isEnabled() ? tr('soundOff') : !FX.voiceAllowed() ? tr('musicOn') : FX.voice() ? tr('voiceOn') : tr('voiceMuted');
  }
  function enableSound() {
    FX.enable();
    soundLabel();
  }
  soundBtn.onclick = () => {
    if (!FX.isEnabled()) enableSound();
    else if (FX.voiceAllowed()) {
      FX.toggleVoice();
      soundLabel();
    }
  };
  soundLabel();

  connect();
  requestAnimationFrame(loop);
})();
