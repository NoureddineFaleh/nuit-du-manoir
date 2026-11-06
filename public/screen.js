/* Écran partagé (PC / TV) : salon, déroulé de la nuit, révélations. */
(() => {
  'use strict';
  const { esc, candles, mmss } = window.UI;
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
    ws = new WebSocket(`${proto}://${location.host}/ws?role=screen${room ? '&room=' + room : ''}`);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'hello') {
        hello = m;
        sessionStorage.setItem('manoir.room', m.code);
      } else if (m.t === 'screen') {
        offset = m.now - Date.now();
        S = m;
        render();
      }
    };
    ws.onclose = () => setTimeout(connect, 1500);
  }

  // ---------------------------------------------------------------- aides
  const pips = (done, total) =>
    `<div class="progress">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < done ? 'on' : ''}"></span>`).join('')}<span>${done} sur ${total}</span></div>`;
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
        <h1 class="title">La Nuit<br>du Manoir</h1>
        <p class="lede">Chaque invité scanne le code avec son téléphone pour s’asseoir à la table.</p>
        <div class="count"><span>Invités à la table</span>
          ${[4, 5].map((k) => `<button class="btn ${S.target === k ? 'on' : ''}" data-do="target" data-n="${k}" ${n > k ? 'disabled' : ''}>${k}</button>`).join('')}
        </div>
        <div class="actions">
          <button class="btn primary" data-do="start" ${S.canStart ? '' : 'disabled'}>Ouvrir le manoir</button>
          <span class="muted sans">${S.canStart ? 'Tout le monde est là.' : `${n} sur ${S.target} installés. Il manque ${S.target - n} invité${S.target - n > 1 ? 's' : ''}.`}</span>
        </div>
      </div>
      <div>${hello ? `<div class="qr"><img src="${hello.qr}" alt="QR code pour rejoindre la partie"><div class="code">${esc(hello.code)}</div><div class="how">${esc(hello.joinUrl)}</div></div>` : ''}</div>
    </section>`;
  };

  V.roles = () => `
    <h1 class="phase-title">Chacun son secret</h1>${narr()}
    <p class="sub">Regardez votre téléphone, découvrez votre rôle, et cachez bien l’écran.</p>
    ${pips(S.ready.done, S.ready.total)}`;

  V.crepuscule = () => {
    const c = S.ch;
    let body = '';
    if (c.type === 'bluff') {
      body += `<p class="prompt-q">${esc(c.prompt)}</p>`;
      if (c.step === 'pick') body += `<ol class="optlist">${c.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>`;
    }
    const lbl = c.type === 'bluff' ? (c.step === 'write' ? 'ont écrit' : 'ont choisi') : 'ont fini';
    return `<h1 class="phase-title">${esc(c.name)}</h1>
      <p class="sub">${esc(c.sub)}</p>${body}
      ${c.progress ? pips(c.progress.done, c.progress.total).replace('</span></div>', ` ${lbl}</span></div>`) : ''}
      ${eventBar()}`;
  };

  V.podium = () => {
    const p = S.podium;
    const rows = p.rows
      .map(
        (r, i) => `<li><span class="pos">${i + 1}</span><span>${esc(r.name)}${r.marker ? ' <span class="crown" style="color:var(--flame)">♛ Marqueur</span>' : ''}${r.gained ? '<span class="gift">reçoit un objet de la Chose</span>' : ''}</span><span class="lbl">${esc(r.label || '')}</span></li>`
      )
      .join('');
    let reveal = '';
    if (p.reveal) {
      reveal = `<p class="sub">La vérité était dans la liste :</p><ol class="optlist">${p.reveal.opts
        .map((o) => `<li class="${o.real ? 'real' : ''}">${esc(o.text)}<small>${o.real ? 'La vraie réponse' : o.author ? 'Écrit par ' + esc(o.author) : ''}</small></li>`)
        .join('')}</ol>`;
    }
    return `<h1 class="phase-title">Résultat de l’épreuve</h1>${narr()}
      <ol class="ranks">${rows}</ol>
      ${p.immune ? `<p class="sub">Dernier Cercle : ${esc(p.immune)} est protégé du Rituel ce soir.</p>` : ''}
      ${reveal}`;
  };

  V.minuit = () => `
    <h1 class="phase-title">Minuit</h1>${narr()}
    <p class="sub">${esc(S.minuit.marker)} est le Marqueur : il peut désigner une cible en secret. Chacun agit sur son téléphone.</p>
    ${pips(S.minuit.ready.done, S.minuit.ready.total)}
    ${S.minuit.ghosts ? '<p class="sub" style="color:var(--ghost)">Les Hantés murmurent entre eux. Une malédiction se prépare.</p>' : ''}`;

  V.veillee = () => {
    const v = S.veillee;
    const left = S.endsAt - now();
    const gest = v.gestures.filter((g) => now() - g.at < 7000);
    if (v.silence) {
      return `<div class="silence">Silence</div><p class="sub">Plus un mot. Seuls les gestes sont permis.</p>
        <div class="bigclock" id="big">${mmss(left)}</div>
        <div class="gest">${gest.map((g) => `<div class="g">${esc(g.name)} ${g.icon}${g.target ? ' ' + esc(g.target) : ''}<small>${esc(g.label)}</small></div>`).join('')}</div>
        ${v.curse ? `<div class="eventbar"><b>${esc(v.curse.name)}.</b> ${esc(v.curse.text)}</div>` : ''}`;
    }
    return `<div class="vgrid">
      <div><h1 class="phase-title">La veillée</h1>${narr()}
        ${eventBar()}
        ${v.curse ? `<div class="eventbar" style="border-color:var(--ghost)"><b style="color:var(--ghost)">${esc(v.curse.name)}.</b> ${esc(v.curse.text)}</div>` : ''}
        ${v.rune ? `<p class="sub">Une rune brûle sur le mur :</p><div class="runebig">${v.rune}</div>` : ''}
      </div>
      <div><div class="bigclock" id="big">${mmss(left)}</div>
        <p class="sub">Parlez, accusez, mentez.</p>${pips(v.ready.done, v.ready.total).replace('</span></div>', ' prêts à voter</span></div>')}
      </div></div>`;
  };

  V.rituel = () => {
    const r = S.rituel;
    return `<h1 class="phase-title">Le Rituel</h1>${narr()}
      ${r.auto ? '<p class="sub">Il ne reste qu’une proie. Le duel est décisif.</p>' : `<p class="sub">Chacun désigne un invité sur son téléphone.</p>${pips(r.voted, r.total).replace('</span></div>', ' ont voté</span></div>')}`}
      ${r.immune ? `<p class="sub">${esc(r.immune)} est protégé par la Chose ce soir.</p>` : ''}
      ${r.hidden ? '<div class="eventbar"><b>Brouillard.</b> Personne ne saura qui a voté pour qui.</div>' : ''}
      <div class="bigclock ${S.endsAt - now() < 10000 ? 'low' : ''}" id="big" style="font-size:6em">${mmss(S.endsAt - now())}</div>`;
  };

  V.aube = () => {
    const a = S.aube;
    const detail = a.detail && a.detail.length
      ? `<div class="votes">${a.detail.map((d) => `<span>${esc(d.from)} ${d.to ? 'désigne ' + esc(d.to) : 's’abstient'}</span>`).join('')}</div>`
      : a.hidden
        ? '<div class="votes"><span>Dans l’obscurité, personne n’a vu qui a voté pour qui.</span></div>'
        : '';
    return `<h1 class="phase-title">L’aube</h1>${detail}
      <ul class="ledger">${a.lines.map((l, i) => `<li class="${l.kind}" style="--t:${(i * 1.4).toFixed(1)}s">${esc(l.text)}</li>`).join('')}</ul>`;
  };

  V.fin = () => {
    const e = S.end;
    const roleName = { lie: 'Lié', solitaire: 'Solitaire' };
    return `<h1 class="phase-title">${esc(e.title)}</h1>${narr()}
      <div class="endgrid">${e.roles
        .map((r) => `<div class="who ${e.winnerIds.includes(r.id) ? 'win' : ''}" style="--c:${r.color}">${esc(r.name)}<small>${roleName[r.role]}${r.alive ? ', encore debout' : ', Hanté'}</small></div>`)
        .join('')}</div>
      <div class="actions" style="margin-top:2em"><button class="btn primary" data-do="restart">Rejouer avec les mêmes invités</button></div>`;
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
        h += `<div class="seat empty">${candles(0, 3)}<div class="nm">en attente…</div><div class="tag">&nbsp;</div></div>`;
        continue;
      }
      const d = disp(p);
      const hit = hitSet.has(p.id);
      let tag = '&nbsp;';
      if (p.crown && !lobby) tag = '<span class="crown">♛ Marqueur</span>';
      else if (!d.alive) tag = 'Hanté';
      else if (p.done && ['roles', 'minuit', 'veillee'].includes(S.phase)) tag = '<span class="ok">✓ prêt</span>';
      else if (!p.connected && !lobby) tag = 'déconnecté';
      const cls = ['seat', !d.alive && !lobby ? 'ghost' : '', !p.connected && !lobby ? 'off' : '', hit ? 'hit' : ''].join(' ');
      h += `<div class="${cls}" style="--c:${p.color}">${lobby ? `<button class="kick" data-do="kick" data-id="${p.id}" title="Renvoyer ${esc(p.name)}">×</button>` : ''}${candles(lobby ? 3 : d.raison, 3)}<div class="nm" style="border-bottom:3px solid ${p.color}">${esc(p.name)}</div><div class="tag">${tag}</div></div>`;
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
    el.innerHTML = `<div class="a">Acte ${esc(S.actRoman)}</div><div class="b">${esc(S.actName)}</div>`;
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
      S.phase === 'lobby' ? '' : S.phase === 'fin' ? 'La nuit est finie' : `<b>Acte ${esc(S.actRoman)}</b> ${esc(S.actName)}${S.night > 0 ? ', nuit ' + S.night : ''}`;
    skipBtn.hidden = ['lobby', 'fin'].includes(S.phase);
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
      case 'kick': send({ t: 'kick', id: b.dataset.id }); break;
      default:
    }
  });
  skipBtn.onclick = () => send({ t: 'skip' });

  function soundLabel() {
    soundBtn.textContent = !FX.isEnabled() ? 'Activer le son et la voix' : FX.voice() ? 'Voix du narrateur : activée' : 'Voix du narrateur : coupée';
  }
  function enableSound() {
    FX.enable();
    soundLabel();
  }
  soundBtn.onclick = () => {
    if (!FX.isEnabled()) enableSound();
    else {
      FX.toggleVoice();
      soundLabel();
    }
  };
  soundLabel();

  connect();
  requestAnimationFrame(loop);
})();
