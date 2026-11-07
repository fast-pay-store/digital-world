"use strict";
/* Звук: файлы из ASSETS.audio (mp3, CC0 Kenney: Casino Audio + интерфейс), WebAudio. Музыки нет (по желанию — добавить music.mp3 в assets).
   Sfx.play(имя, громкость, разброс тона). Частые звуки ограничены по времени, всего ≤ 14 голосов. */
const Sfx = (() => {
  let ctx = null, sfxGain = null, musGain = null, sfxOn = true, musOn = true, music = null, wantMusic = false;
  const buf = {}, last = {}, MINGAP = { place1: 0.04, place2: 0.04, place3: 0.04, slide1: 0.1, slide2: 0.1, chip: 0.05 };
  const VOL = { place1: 0.8, place2: 0.8, place3: 0.8, slide1: 0.7, slide2: 0.6, shuffle: 0.7, fan: 0.7, shove: 0.8, chips: 0.7, chip: 0.6, click: 0.6, err: 0.5, select: 0.5, open: 0.5, msg: 0.5, win: 0.8, lose: 0.8 };
  let voices = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      sfxGain = ctx.createGain(); sfxGain.gain.value = sfxOn ? 0.8 : 0; sfxGain.connect(ctx.destination);
      musGain = ctx.createGain(); musGain.gain.value = musOn ? 0.32 : 0; musGain.connect(ctx.destination);
      const A = (window.ASSETS && ASSETS.audio) || {};
      for (const k in A) decode(k, A[k]);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function decode(k, uri) {
    const b64 = uri.slice(uri.indexOf(',') + 1), bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(u8.buffer, b => { buf[k] = b; if (k === 'music' && wantMusic) startMusic(); }, () => {});
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
