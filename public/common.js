/* Petits utilitaires partagés par l'écran et le téléphone. */
(function (g) {
  'use strict';

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Une bougie en SVG : allumée (flamme qui vacille) ou éteinte (filet de fumée). */
  function candle(lit, i) {
    const d = (2 + ((i || 0) * 0.37) % 1.5).toFixed(2) + 's';
    return (
      `<svg class="candle" viewBox="0 0 24 56" width="24" height="56" style="--d:${d}" aria-hidden="true">` +
      '<ellipse cx="12" cy="53.5" rx="9" ry="2.4" fill="#000" opacity=".5"/>' +
      `<rect x="7.5" y="22" width="9" height="31" rx="1.6" fill="${lit ? '#e6dac0' : '#6f6656'}"/>` +
      '<rect x="13.5" y="22" width="3" height="31" rx="1.2" fill="#000" opacity=".22"/>' +
      `<path d="M7.5 28q-1.4 5 .4 8" stroke="${lit ? '#f6eedb' : '#8c836f'}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      '<line x1="12" y1="22" x2="12" y2="18" stroke="#2a1a12" stroke-width="1.3"/>' +
      (lit
        ? '<g class="flame"><path d="M12 3C16.5 9.5 17.5 14 12 19 6.5 14 7.5 9.5 12 3Z" fill="#f0b35a"/><path d="M12 10c2.2 3 2.4 5.4 0 8-2.4-2.6-2.2-5 0-8Z" fill="#fff3c9"/></g>'
        : '<path class="smoke" d="M12 16q-3.5-3.5 0-7t0-7" stroke="rgba(234,223,200,.5)" stroke-width="1.2" fill="none"/>') +
      '</svg>'
    );
  }

  /** `n` bougies allumées sur `max`. */
  function candles(n, max) {
    let h = '<span class="candles" role="img" aria-label="' + esc(g.I18N.t('candlesAria', { n, m: max })) + '">';
    for (let i = 0; i < max; i++) h += candle(i < n, i);
    return h + '</span>';
  }

  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  g.UI = { esc, candle, candles, mmss };

  // ---- Langue (textes servis par /ui.js : window.UI_TEXT = { fr: {...}, aeb: {...} }, window.UI_META)
  let cur = 'fr';
  const dict = (code) => (g.UI_TEXT && g.UI_TEXT[code]) || {};
  const fill = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
  g.I18N = {
    get lang() { return cur; },
    set(code) {
      const meta = (g.UI_META && g.UI_META[code]) || { dir: 'ltr', htmlLang: 'fr' };
      cur = g.UI_TEXT && g.UI_TEXT[code] ? code : 'fr';
      const root = document.documentElement;
      if (root.lang !== meta.htmlLang) root.lang = meta.htmlLang;
      if (root.dir !== meta.dir) root.dir = meta.dir;
      document.body.classList.toggle('rtl', meta.dir === 'rtl');
    },
    t(key, vars) {
      const d = dict(cur);
      return fill(d[key] != null ? d[key] : dict('fr')[key] != null ? dict('fr')[key] : key, vars);
    },
    in(code, key, vars) {
      return fill(dict(code)[key] != null ? dict(code)[key] : key, vars);
    },
    both(key) {
      return fill(dict('fr')[key] || key) + '  /  ' + fill(dict('aeb')[key] || key);
    },
  };
})(window);
