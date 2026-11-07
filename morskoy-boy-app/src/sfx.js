"use strict";
/* Звук: файлы из ASSETS.audio (mp3, CC0 Kenney + музыка cynicmusic CC0), WebAudio.
   Sfx.play(имя, громкость, разброс тона). Частые звуки ограничены по времени, всего ≤ 14 голосов. */
const Sfx = (() => {
  let ctx = null, sfxGain = null, musGain = null, sfxOn = true, musOn = true, music = null, wantMusic = false;
  const buf = {}, last = {}, MINGAP = { splash: 0.05, gun: 0.07, hit: 0.05, die: 0.05, frost: 0.12, tesla: 0.1, cannon: 0.08, boom: 0.06, rocket: 0.09 };
  const VOL = { splash: 0.7, gun: 0.35, hit: 0.35, die: 0.5, cannon: 0.55, boom: 0.6, rocket: 0.45, frost: 0.5, tesla: 0.45, bigboom: 0.8, leak: 0.7, build: 0.7, upgrade: 0.7, sell: 0.6, click: 0.6, err: 0.6, select: 0.5, open: 0.5, msg: 0.5, wave: 0.7, win: 0.8, lose: 0.8, boss: 0.9 };
  let voices = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      sfxGain = ctx.createGain(); sfxGain.gain.value = sfxOn ? 0.8 : 0; sfxGain.connect(ctx.destination);
      musGain = ctx.createGain(); musGain.gain.value = musOn ? 0.32 : 0; musGain.connect(ctx.destination);
      const A = (window.ASSETS && ASSETS.audio) || {};
      for (const k in A) decode(k, A[k]);
      synth();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function decode(k, uri) {
    const b64 = uri.slice(uri.indexOf(',') + 1), bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(u8.buffer, b => { buf[k] = b; if (k === 'music' && wantMusic) startMusic(); }, () => {});
  }
  // Всплеск воды — шум с затуханием и «утоплением» высоких частот (своего файла нет)
  function synth() {
    const sr = ctx.sampleRate, n = (sr * 0.7) | 0, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, a = Math.min(1, i / (sr * 0.01)) * Math.pow(1 - t, 2.2), f = 0.5 - 0.42 * t;
      lp += f * ((Math.random() * 2 - 1) - lp); d[i] = lp * a * 1.6;
    }
    buf.splash = b;
  }
  function startMusic() {
    if (!ctx || !buf.music || music) return;
    music = ctx.createBufferSource(); music.buffer = buf.music; music.loop = true; music.connect(musGain); music.start();
  }
  // Первое касание разрешает звук (правило браузеров).
  const unlock = () => { ensure(); if (wantMusic) startMusic(); };
  ['pointerdown', 'touchend', 'keydown'].forEach(e => window.addEventListener(e, unlock, { passive: true }));

  return {
    play(k, vol, spread) {
      if (!sfxOn || !ctx || ctx.state !== 'running') return;
      const b = buf[k]; if (!b) return;
      const t = ctx.currentTime;
      if (last[k] && t - last[k] < (MINGAP[k] || 0.03)) return;
      if (voices >= 14) return;
      last[k] = t; voices++;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b; g.gain.value = (VOL[k] || 0.6) * (vol || 1);
      if (spread) s.playbackRate.value = 1 + (Math.random() * 2 - 1) * spread;
      s.connect(g); g.connect(sfxGain); s.onended = () => { voices--; };
      s.start();
    },
    music(on) { wantMusic = on; if (on) { if (ctx) startMusic(); } },
    setSfx(v) { sfxOn = v; if (sfxGain) sfxGain.gain.value = v ? 0.8 : 0; },
    setMusic(v) { musOn = v; if (musGain) musGain.gain.value = v ? 0.32 : 0; },
    get sfxOn() { return sfxOn; }, get musOn() { return musOn; },
    pause() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  };
})();
