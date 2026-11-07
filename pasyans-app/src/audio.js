"use strict";
/* Snd — все звуки создаются кодом (Web Audio), без файлов. Тихая музыка — мягкие аккорды. */
const Snd = (() => {
  let ctx = null, out = null, mus = null, noise = null, sOn = true, mOn = true, chain = 0, chainT = 0, musT = 0, step = 0;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination);
    mus = ctx.createGain(); mus.gain.value = 0.0; mus.connect(ctx.destination);
    const n = ctx.sampleRate * 0.5, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noise = b;
    setMusic(mOn);
  }
  function burst(t, dur, freq, q, vol) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  function tone(t, f, dur, vol, type, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || out); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  const hz = n => 440 * Math.pow(2, (n - 9) / 12) * 1;   // n — полутон от C5 примерно
  function play(name) {
    if (!ctx || !sOn) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'pick': burst(t, 0.035, 3200, 1.2, 0.12); break;
      case 'place': burst(t, 0.05, 1700, 0.9, 0.22); tone(t, 160, 0.07, 0.05); break;
      case 'deal': burst(t, 0.04, 2400, 1, 0.16); break;
      case 'shuffle': for (let i = 0; i < 14; i++) burst(t + i * 0.035, 0.03, 2000 + Math.random() * 1500, 1, 0.1); break;
      case 'found': {
        const now = performance.now(); chain = now - chainT < 1600 ? Math.min(chain + 1, PENTA.length - 1) : 0; chainT = now;
        burst(t, 0.04, 1900, 1, 0.15);
        const f = hz(PENTA[chain] + 3); tone(t + 0.01, f, 0.5, 0.09); tone(t + 0.01, f * 2, 0.25, 0.025); break;
      }
      case 'no': tone(t, 210, 0.09, 0.06, 'triangle'); tone(t + 0.07, 170, 0.12, 0.05, 'triangle'); break;
      case 'undo': burst(t, 0.08, 900, 0.7, 0.12); break;
      case 'click': tone(t, 1100, 0.04, 0.04); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => { tone(t + i * 0.11, hz(n), 0.9, 0.08); tone(t + i * 0.11, hz(n) * 2, 0.4, 0.02); }); break;
      case 'wish': [12, 16, 19, 24, 28].forEach((n, i) => tone(t + i * 0.09, hz(n), 1.2, 0.05, 'sine')); break;
      case 'unlock': [7, 12, 16].forEach((n, i) => tone(t + i * 0.13, hz(n), 0.7, 0.07)); break;
    }
  }
  /* музыка: медленные аккорды C – Am – F – G, по одной ноте пентатоники, очень тихо */
  const CH = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
  function musicTick() {
    if (!ctx || !mOn) return;
    const t = ctx.currentTime, ch = CH[Math.floor(step / 4) % 4], night = document.body.classList.contains('night');
    if (step % 4 === 0) ch.forEach(n => pad(t, hz(n - 12), 5.5, 0.05));
    if (Math.random() < (night ? 0.45 : 0.7)) pad(t + 0.2, hz(ch[(Math.random() * 3) | 0] + (Math.random() < 0.5 ? 12 : 0)), 2.8, 0.035);
    step++;
    musT = setTimeout(musicTick, night ? 1800 : 1400);
  }
  function pad(t, f, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + 0.1);
  }
  function setMusic(on) {
    mOn = on; if (!ctx) return;
    clearTimeout(musT);
    mus.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.4);
    if (on) musT = setTimeout(musicTick, 600);
  }
  function pause() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  return { unlock, play, setSound(on) { sOn = on; }, setMusic, pause, resume, get sound() { return sOn; }, get music() { return mOn; } };
})();
