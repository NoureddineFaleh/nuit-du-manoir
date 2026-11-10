/* La Crypte : vues écran et téléphone. */
(() => {
  'use strict';
  const { esc } = window.UI;
  const gl = (c, id) => c.glyphs[id];
  const legend = (c, cls) => `<div class="${cls}">${c.glyphs.map((x) => `<span><b>${x.icon}</b>${esc(x.name)}</span>`).join('')}</div>`;
  const tries = (c, K) =>
    c.attempts.length
      ? `<ul class="tries">${c.attempts.map((a) => `<li>${a.guess.map((i) => gl(c, i).icon).join(' ')}<span class="fb"><b>${a.exact}</b> ${esc(K.tr('exact'))} · <b>${a.near}</b> ${esc(K.tr('near'))}</span></li>`).join('')}</ul>`
      : `<p class="small" style="margin-top:.6em">${esc(K.tr('noAttempts'))}</p>`;
  const codeRow = (c, cls) => `<div class="${cls}">${(c.code || []).map((i) => `<div class="sl open">${gl(c, i).icon}</div>`).join('')}</div>`;

  const screen = {
    key: (S) => S.cr.chamber,
    mark: (S, K) => (S.cr.chamber ? esc(K.tr('chamberTitle', { n: S.cr.chamber, t: S.cr.chambers })) : ''),
    tag: (p, S, K) => (S.cr.opener && S.cr.opener.id === p.id && S.phase === 'chambre' ? `<span class="crown">${esc(K.tr('openerIs', { x: '' }).replace(/[:：]\s*$/, ''))}</span>` : p.done && S.phase === 'intro' ? `<span class="ok">${esc(K.tr('tagReady'))}</span>` : !p.connected ? esc(K.tr('tagOff')) : '&nbsp;'),
    light: (S) => (S.phase === 'fin' ? (S.cr.winner === 'win' ? 1 : 0.2) : S.cr.torches / S.cr.maxTorches),
    enter: (S, K) => {
      const F = K.FX; F.heart(0);
      if (S.phase === 'chambre') { F.cue('creak'); }
      else if (S.phase === 'ouvert') F.cue('bell');
      else if (S.phase === 'fin') { F.cue(S.cr.winner === 'win' ? 'bell' : 'death'); }
    },
    render: (S, K) => {
      const T = K.tr; const c = S.cr;
      const torches = `<div class="torchrow">${esc(T('torches'))} ${K.candles(c.torches, c.maxTorches)}</div>`;
      switch (S.phase) {
        case 'intro': return `<h1 class="phase-title">${esc(T('introTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('introSub'))}</p>${legend(c, 'legend')}${K.pips(c.ready.done, c.ready.total)}`;
        case 'chambre': {
          const slots = [0, 1, 2, 3].map((i) => (c.hints[i] !== null ? `<div class="sl hint">${gl(c, c.hints[i]).icon}</div>` : `<div class="sl">?<small>${esc(T('hintSlot', { p: i + 1 }))}</small></div>`)).join('');
          return `<div class="crgrid"><div><h1 class="phase-title">${esc(T('chamberTitle', { n: c.chamber, t: c.chambers }))}</h1>${K.narr()}
            <p class="sub">${esc(T('openerIs', { x: c.opener ? c.opener.name : '' }))}</p>
            <div class="lock">${slots}</div>${legend(c, 'legend')}</div>
            <div><div class="bigclock" id="big" style="font-size:6em"></div>${torches}<h3 class="sub" style="margin-top:1em">${esc(T('attempts'))}</h3>${tries(c, K)}</div></div>`;
        }
        case 'ouvert': return `<h1 class="phase-title">${esc(T('doorOpen'))}</h1>${K.narr()}${codeRow(c, 'lock')}${torches}`;
        case 'fin': return `<h1 class="phase-title">${esc(T(c.winner === 'win' ? 'winTitle' : 'loseTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('codeWas'))}</p>${codeRow(c, 'lock')}${c.winner === 'win' ? `<p class="sub">${esc(T('torchesLeft', { n: c.torches }))}</p>` : ''}${K.restartBtn()}`;
        default: return '';
      }
    },
  };

  const phone = {
    key: (S) => S.cr && S.cr.chamber,
    header: (S, K) => (S.cr ? { sub: S.cr.chamber ? K.tr('chamberTitle', { n: S.cr.chamber, t: S.cr.chambers }) : '', right: K.candles(S.cr.torches, S.cr.maxTorches) } : null),
    enter: (S, K) => { K.ui.guess = []; K.ui.key = ''; },
    actions: {
      done: (b, K) => K.send({ t: 'done' }),
      pick: (b, K, S) => {
        const id = Number(b.dataset.id);
        if (K.ui.guess.length < 4 && !K.ui.guess.includes(id)) { K.ui.guess.push(id); K.vib(15); K.rerender(); }
      },
      clear: (b, K) => { K.ui.guess = []; K.rerender(); },
      tryit: (b, K) => { if (K.ui.guess.length === 4) { K.send({ t: 'try', guess: K.ui.guess }); K.ui.guess = []; K.rerender(); } },
    },
    render: (S, K) => {
      const T = K.tr; const c = S.cr;
      const key = c.chamber + ':' + c.attempts.length;
      if (K.ui.key !== key) { K.ui.key = key; K.ui.guess = []; }
      const clues = c.clues.map((t) => `<div class="clue">${esc(t)}</div>`).join('');
      switch (S.phase) {
        case 'intro': return `<section class="stack"><h1 class="h2">${esc(T('introTitle'))}</h1><p class="lead muted">${esc(T('introSub'))}</p>${legend(c, 'legendp')}<button class="btn primary" data-do="done" ${S.me.done ? 'disabled' : ''}>${esc(S.me.done ? T('waiting') : T('understood'))}</button></section>`;
        case 'chambre': {
          const opener = c.isOpener;
          const slots = [0, 1, 2, 3].map((i) => (K.ui.guess[i] !== undefined ? `<div class="sl on">${gl(c, K.ui.guess[i]).icon}</div>` : `<div class="sl"></div>`)).join('');
          const panel = opener
            ? `<hr class="sep"><h2 class="h3">${esc(T('youOpen'))}</h2><p class="small">${esc(T('youOpenSub'))}</p><div class="pslots">${slots}</div>
               <div class="gbtns">${c.glyphs.map((x) => `<button class="gbtn" data-do="pick" data-id="${x.id}" ${K.ui.guess.includes(x.id) ? 'disabled' : ''}>${x.icon}<small>${esc(x.name)}</small></button>`).join('')}</div>
               <div style="display:flex;gap:10px"><button class="btn quiet" style="width:auto" data-do="clear">${esc(T('clear'))}</button><button class="btn primary" data-do="tryit" ${K.ui.guess.length === 4 ? '' : 'disabled'}>${esc(T('tryCode'))}</button></div>`
            : `<hr class="sep"><p class="lead">${esc(T('notOpener', { x: c.opener ? c.opener.name : '' }))}</p>${legend(c, 'legendp')}`;
          return `<section class="stack"><h2 class="h3">${esc(T('yourClues'))}</h2>${clues}<p class="small">${esc(T('clueHint'))}</p>${panel}${c.attempts.length ? `<hr class="sep"><h3 class="h3">${esc(T('attempts'))}</h3>${tries(c, K)}` : ''}</section>`;
        }
        case 'ouvert': return `<section class="stack center" style="padding-top:8vh"><div class="rune">🚪</div><h1 class="h2">${esc(T('doorOpen'))}</h1></section>`;
        case 'fin': return `<section class="stack center" style="padding-top:6vh"><h1 class="h2">${esc(T(c.winner === 'win' ? 'winTitle' : 'loseTitle'))}</h1><p class="lead">${esc(T(c.winner === 'win' ? 'youWin' : 'youLose'))}</p><p class="small">${esc(T('codeWas'))}</p><div class="pslots">${(c.code || []).map((i) => `<div class="sl on">${gl(c, i).icon}</div>`).join('')}</div></section>`;
        default: return '';
      }
    },
  };
  window.Kit.register('crypte', { screen, phone });
})();
