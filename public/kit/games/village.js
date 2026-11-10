/* Le Village maudit : vues écran et téléphone. */
(() => {
  'use strict';
  const { esc } = window.UI;
  const night = (S) => ['nuit', 'aube'].includes(S.phase);

  const screen = {
    key: (S) => S.vil.night,
    mark: (S, K) => (S.vil.night ? esc(K.tr(night(S) ? 'nightN' : 'dayN', { n: S.vil.night }).replace(/^ · /, '')) : ''),
    tag: (p, S, K) => (!p.alive ? esc(K.tr('dead')) : p.done && ['roles', 'nuit', 'debat', 'vote'].includes(S.phase) ? `<span class="ok">${esc(K.tr('tagReady'))}</span>` : !p.connected ? esc(K.tr('tagOff')) : '&nbsp;'),
    light: (S) => (S.phase === 'nuit' ? 0.3 : S.phase === 'aube' ? 0.65 : S.phase === 'fin' ? (S.vil.winner === 'bete' ? 0.25 : 1) : 0.9),
    enter: (S, K) => {
      const F = K.FX;
      F.heart(0);
      if (S.phase === 'nuit') { F.cue('creak'); F.heart(52); }
      else if (S.phase === 'aube') F.cue(S.vil.aube && S.vil.aube.died ? 'death' : 'bell');
      else if (S.phase === 'vote') { F.cue('boom'); F.heart(70); }
      else if (S.phase === 'verdict' || S.phase === 'fin') F.cue('boom');
      else if (S.phase === 'roles') F.cue('whisper');
    },
    render: (S, K) => {
      const T = K.tr; const v = S.vil;
      const omen = v.omen ? `<div class="omenbar"><b>${esc(T('omen', { n: v.omen.name }))}.</b> ${esc(v.omen.text)}</div>` : '';
      switch (S.phase) {
        case 'roles': return `<h1 class="phase-title">${esc(T('rolesTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('rolesSub'))}</p>${K.pips(v.done, v.total)}`;
        case 'nuit': return `<h1 class="phase-title">${esc(T('nightTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('nightSub'))}</p>${omen}${K.pips(v.done, v.total)}`;
        case 'aube': {
          const a = v.aube || {};
          return `<h1 class="phase-title">${esc(T('dawnTitle'))}</h1>${K.narr()}${a.died ? `<div class="bigname"><small>${esc(T('killed'))}</small>${esc(a.died.name)}<small>${esc(a.roleName)}</small></div>` : ''}${omen}`;
        }
        case 'debat': return `<div class="vgrid"><div><h1 class="phase-title">${esc(T('discussTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('discussSub'))}</p>${K.pips(v.done, v.total)}</div><div class="bigclock" id="big"></div></div>`;
        case 'vote': return `<h1 class="phase-title">${esc(T('voteTitle'))}</h1>${K.narr()}<p class="sub">${esc(T('voteSub'))}</p>${K.pips(v.done, v.total)}`;
        case 'verdict': {
          const d = v.verdict || {};
          const tally = d.tally && d.tally.length ? `<ul class="tally">${d.tally.map((x) => `<li><b>${esc(x.name)}</b> ${x.n}</li>`).join('')}</ul>` : '';
          return `<h1 class="phase-title">${esc(T('verdictTitle'))}</h1>${K.narr()}${d.out ? `<div class="bigname"><small>${esc(T('exiled'))}</small>${esc(d.out.name)}<small>${esc(d.roleName)}</small></div>` : ''}${tally}`;
        }
        case 'fin': return `<h1 class="phase-title">${esc(T(v.winner === 'village' ? 'winVillage' : 'winBete'))}</h1>${K.narr()}
          <div class="endgrid">${v.roles.map((r) => `<div class="who ${r.alive ? '' : ''}" style="--c:${r.color}">${esc(r.name)}<small>${esc(r.icon)} ${esc(r.roleName)} · ${esc(T(r.alive ? 'alive' : 'dead'))}</small></div>`).join('')}</div>${K.restartBtn()}`;
        default: return '';
      }
    },
  };

  const chips = (K, list, picked, act) =>
    `<div class="chips">${list.map((t) => `<button class="chip ${picked === t.id ? 'sel' : ''}" style="--c:${t.color}" data-do="${act}" data-id="${t.id}">${esc(t.name)}</button>`).join('')}</div>`;
  const notes = (S, K) => `<hr class="sep"><h3 class="h3">${esc(K.tr('notesTitle'))}</h3>${S.notes && S.notes.length ? S.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('') : `<p class="small">${esc(K.tr('noNotes'))}</p>`}`;
  const omenP = (S, K) => (S.vil.omen ? `<div class="note echo"><small>${esc(K.tr('omen', { n: S.vil.omen.name }))}</small>${esc(S.vil.omen.text)}</div>` : '');

  const phone = {
    key: (S) => S.vil && S.vil.night,
    header: (S) => (S.me.roleInfo ? { sub: `${S.me.roleInfo.icon} ${S.me.roleInfo.name}` } : null),
    enter: (S, K) => { K.ui.picked = null; },
    actions: {
      done: (b, K) => K.send({ t: 'done' }),
      act: (b, K) => K.send({ t: 'act', target: b.dataset.id }),
      vote: (b, K) => K.send({ t: 'vote', target: b.dataset.id }),
      abstain: (b, K) => K.send({ t: 'vote', target: null }),
    },
    render: (S, K) => {
      const T = K.tr; const v = S.vil; const me = S.me; const R = me.roleInfo;
      if (!me.alive && S.phase !== 'fin') return `<section class="stack center" style="padding-top:8vh"><div class="rune">👻</div><h1 class="h2">${esc(T('ghost'))}</h1><p class="lead muted">${esc(T('ghostSub'))}</p></section>`;
      switch (S.phase) {
        case 'roles': return `<section class="stack"><div class="role-card"><div class="ic">${R.icon}</div><p class="small">${esc(T('youAre'))}</p><h1 class="h2">${esc(R.name)}</h1><p class="lead">${esc(R.desc)}</p><p class="small" style="margin-top:.6em">${esc(R.win)}</p></div>
          ${v.mates ? `<div class="note voix"><small>${esc(T('mates'))}</small>${esc(v.mates.length ? v.mates.join(', ') : T('mateNone'))}</div>` : ''}
          <button class="btn primary" data-do="done" ${me.done ? 'disabled' : ''}>${esc(me.done ? T('waiting') : T('understood'))}</button></section>`;
        case 'nuit': {
          if (v.need && !v.acted) {
            const q = R.key === 'bete' ? 'pickBite' : R.key === 'voyant' ? 'pickSee' : 'pickHeal';
            return `<section class="stack"><h1 class="h2">${esc(T(q))}</h1>${omenP(S, K)}${chips(K, v.targets, v.picked, 'act')}${R.key === 'guerisseur' ? `<p class="small">${esc(T('healNoRepeat'))}</p>` : ''}</section>`;
          }
          if (v.need && v.acted) return `<section class="stack center" style="padding-top:8vh"><div class="rune">🕯️</div><h1 class="h2">${esc(T('done'))}</h1></section>${notes(S, K)}`;
          const txt = R.key === 'bete' ? T('firstNightBete') : T('sleep');
          return `<section class="stack"><h1 class="h2">${esc(txt)}</h1>${omenP(S, K)}<button class="btn primary" data-do="done" ${me.done ? 'disabled' : ''}>${esc(me.done ? T('waiting') : T(R.key === 'bete' ? 'ok' : 'sleepBtn'))}</button></section>`;
        }
        case 'aube': return `<section class="stack center" style="padding-top:6vh"><h1 class="h2">${esc(T('dawnTitle'))}</h1>${v.aube && v.aube.died ? `<p class="lead">${esc(T('killed'))} : <b>${esc(v.aube.died.name)}</b> (${esc(v.aube.roleName)})</p>` : `<p class="lead">${esc(T('nobody'))}</p>`}</section>${notes(S, K)}`;
        case 'debat': return `<section class="stack"><h1 class="h2">${esc(T('discussTitle'))}</h1><p class="lead muted">${esc(T('discussSub'))}</p><button class="btn primary" data-do="done" ${me.done ? 'disabled' : ''}>${esc(me.done ? T('waiting') : T('readyVote'))}</button></section>${notes(S, K)}`;
        case 'vote':
          return `<section class="stack"><h1 class="h2">${esc(T('voteWho'))}</h1>${chips(K, v.targets, v.picked, 'vote')}<button class="btn quiet" data-do="abstain">${esc(T('voteAbstain'))}</button><p class="small">${esc(v.voted ? T('voted') + ' ' + T('changeVote') : '')}</p></section>`;
        case 'verdict': return `<section class="stack center" style="padding-top:6vh"><h1 class="h2">${esc(T('verdictTitle'))}</h1>${v.verdict && v.verdict.out ? `<p class="lead"><b>${esc(v.verdict.out.name)}</b> — ${esc(v.verdict.roleName)}</p>` : `<p class="lead">${esc(T('nobody'))}</p>`}</section>`;
        case 'fin': return `<section class="stack center" style="padding-top:5vh"><h1 class="h2">${esc(T(v.winner === 'village' ? 'winVillage' : 'winBete'))}</h1><p class="lead">${esc(T(v.win ? 'youWin' : 'youLose'))}</p></section>
          <h3 class="h3">${esc(T('rolesRevealed'))}</h3><div class="rolelist">${v.roles.map((r) => `<div class="${r.alive ? '' : 'dead'}"><span>${esc(r.name)}</span><span>${esc(r.icon)} ${esc(r.roleName)}</span></div>`).join('')}</div>`;
        default: return '';
      }
    },
  };
  window.Kit.register('village', { screen, phone });
})();
