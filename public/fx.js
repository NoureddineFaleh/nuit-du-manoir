/* Ambiance sonore de l'écran : tout est synthétisé (aucun fichier audio) + voix du narrateur. */
(function (g) {
  'use strict';

  let ctx = null;
  let master = null;
  let enabled = false;
  let voiceOn = true;
  let drone = null;
  let hbTimer = null;
  let hbBpm = 0;
  let noise = null;

  function enable() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    ctx.resume();
    enabled = true;
    startDrone();
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    return true;
  }

  function startDrone() {
    if (!ctx || drone) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 55;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    const oscs = [
      ['sawtooth', 55],
      ['sawtooth', 55.7],
      ['sine', 82.4],
      ['sine', 27.5],
    ].map(([type, f]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      return o;
    });
    lp.connect(out);
    out.connect(master);
    [...oscs, lfo].forEach((o) => o.start());
    drone = { out, nodes: [...oscs, lfo] };
  }

  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  function burst({ dur = 1, f0 = 600, f1 = 600, q = 6, gain = 0.2, type = 'bandpass' }) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  function tone(freq, { dur = 1, gain = 0.2, type = 'sine', slideTo = null } = {}) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(gain, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn);
    gn.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const creak = () => burst({ dur: 1.5, f0: 280, f1: 950, q: 14, gain: 0.2 });
  const whisper = () => burst({ dur: 2.4, f0: 3200, f1: 1800, q: 1.2, gain: 0.14 });
  const boom = () => {
    tone(95, { dur: 1.6, gain: 0.5, slideTo: 28 });
    burst({ dur: 0.8, f0: 200, f1: 60, q: 0.8, gain: 0.3, type: 'lowpass' });
  };
  const bell = () => {
    [392, 587.5, 786, 1180].forEach((f, i) => tone(f, { dur: 3.4 - i * 0.5, gain: 0.13 / (i + 1) }));
  };
  const thump = (v) => tone(58, { dur: 0.28, gain: v, slideTo: 38 });

  function heart(bpm) {
    clearInterval(hbTimer);
    hbTimer = null;
    hbBpm = bpm || 0;
    if (!bpm || !enabled) return;
    const beat = () => {
      thump(0.5);
      setTimeout(() => thump(0.32), 230);
    };
    beat();
    hbTimer = setInterval(beat, 60000 / bpm);
  }

  let speech = 'fr-FR';
  function setLang(code) {
    speech = code || 'fr-FR';
  }

  function say(text) {
    if (!voiceOn || !enabled || !text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const base = speech.slice(0, 2).toLowerCase();
    const voices = speechSynthesis.getVoices();
    // arabe : on cherche d'abord ar-TN, sinon n'importe quelle voix arabe (le tunisien est rarement installé)
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase() === speech.toLowerCase()) || voices.find((x) => x.lang.toLowerCase().startsWith(base));
    u.lang = v ? v.lang : speech;
    u.rate = 0.82;
    u.pitch = 0.5;
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function cue(name) {
    switch (name) {
      case 'creak': return creak();
      case 'whisper': return whisper();
      case 'boom': return boom();
      case 'bell': return bell();
      case 'death':
        boom();
        return setTimeout(creak, 500);
      case 'hit':
        return boom();
      default:
    }
  }

  g.FX = {
    enable,
    cue,
    heart,
    say,
    setLang,
    isEnabled: () => enabled,
    toggleVoice: () => {
      voiceOn = !voiceOn;
      if (!voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
      return voiceOn;
    },
    voice: () => voiceOn,
    bpm: () => hbBpm,
    _drone: () => drone,
  };
})(window);
