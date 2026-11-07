"use strict";
(async () => {
  await Platform.init();
  // Шрифт из assets.js (работает и с двойного клика)
  try { if (window.ASSETS && ASSETS.fonts.RussoOne) { const f = new FontFace('Russo One', `url(${ASSETS.fonts.RussoOne})`); await f.load(); document.fonts.add(f); } } catch (_) {}
  await Save.load();
  // Чёткая картинка на экранах высокой плотности: холст в dpr раз больше, zoom 1/dpr.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = () => Math.max(1, Math.round(window.innerWidth * dpr)), H = () => Math.max(1, Math.round(window.innerHeight * dpr));
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#0a2416',
    scale: { mode: Phaser.Scale.NONE, width: W(), height: H(), zoom: 1 / dpr },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 }, banner: false, audio: { noAudio: true },
    input: { activePointers: 2 },
    scene: [],
  });
  game.registry.set('dpr', dpr); window.__game = game;
  game.events.once('tableReady', (tb) => {
    UI.init(tb);
    const b = document.getElementById('boot'); b.style.opacity = 0; setTimeout(() => b.remove(), 450);
  });
  game.scene.add('Table', Table, true);
  let to = 0;
  window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(() => { game.scale.resize(W(), H()); game.scale.setZoom(1 / dpr); }, 120); });
  Platform.banner();
  Platform.onPause(() => { game.loop.sleep(); Sfx.pause(); });
  Platform.onResume(() => { game.loop.wake(); Sfx.resume(); });
})();
