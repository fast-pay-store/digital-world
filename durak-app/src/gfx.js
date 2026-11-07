"use strict";
/* Вся графика рисуется кодом на canvas (чётко на любом экране, без картинок-файлов):
   карты 'c0'..'c35', рубашки 'b_<id>', сукно стола 'felt'. Масти — векторные фигуры (эмодзи не используются). */
const Gfx = (() => {
  const RED = '#c8102e', BLK = '#16161f';
  const SUIT_COL = [BLK, BLK, RED, RED];
  // Рубашки и столы (цены — в texts.js)
  const BACKS = {
    red:    { a: '#a3121f', b: '#5e0710', l: 'rgba(255,215,160,.28)', e: '#f4c95d' },
    blue:   { a: '#1d4fa8', b: '#0b2556', l: 'rgba(190,220,255,.28)', e: '#e8f1ff' },
    green:  { a: '#11734a', b: '#053a24', l: 'rgba(200,255,220,.25)', e: '#f4c95d' },
    black:  { a: '#2a2a33', b: '#09090c', l: 'rgba(244,201,93,.30)', e: '#f4c95d' },
    purple: { a: '#6a2bb8', b: '#2c0c5c', l: 'rgba(240,210,255,.28)', e: '#ffd76a' },
    gold:   { a: '#e0a92b', b: '#7a4c06', l: 'rgba(255,255,230,.40)', e: '#fff6d0' },
  };
  const TABLES = {
    green: ['#1f7a4a', '#0c3d24', '#062214'],
    blue:  ['#1e5d8f', '#0c2f50', '#06182b'],
    red:   ['#8a2232', '#4a0f1a', '#25060c'],
    gray:  ['#4a4f5a', '#24272e', '#111317'],
  };

  /* ---------- масти ---------- */
  function suitPath(g, s, x, y, k) {
    g.save(); g.translate(x, y); g.scale(k, k); g.beginPath();
    if (s === 3) { // червы
      g.moveTo(0, .45); g.bezierCurveTo(-.15, .3, -.5, .08, -.5, -.16); g.bezierCurveTo(-.5, -.36, -.35, -.48, -.22, -.48);
      g.bezierCurveTo(-.1, -.48, -.02, -.4, 0, -.3); g.bezierCurveTo(.02, -.4, .1, -.48, .22, -.48);
      g.bezierCurveTo(.35, -.48, .5, -.36, .5, -.16); g.bezierCurveTo(.5, .08, .15, .3, 0, .45);
    } else if (s === 2) { // бубны
      g.moveTo(0, -.5); g.quadraticCurveTo(.12, -.18, .38, 0); g.quadraticCurveTo(.12, .18, 0, .5); g.quadraticCurveTo(-.12, .18, -.38, 0); g.quadraticCurveTo(-.12, -.18, 0, -.5);
    } else if (s === 0) { // пики
      g.moveTo(0, -.5); g.bezierCurveTo(.15, -.33, .5, -.12, .5, .1); g.bezierCurveTo(.5, .28, .36, .38, .22, .38);
      g.bezierCurveTo(.12, .38, .05, .33, .03, .27); g.bezierCurveTo(.05, .38, .1, .45, .18, .5); g.lineTo(-.18, .5);
      g.bezierCurveTo(-.1, .45, -.05, .38, -.03, .27); g.bezierCurveTo(-.05, .33, -.12, .38, -.22, .38);
      g.bezierCurveTo(-.36, .38, -.5, .28, -.5, .1); g.bezierCurveTo(-.5, -.12, -.15, -.33, 0, -.5);
    } else { // трефы
      g.arc(0, -.24, .22, 0, Math.PI * 2); g.moveTo(-.02, .06); g.arc(-.25, .06, .22, 0, Math.PI * 2); g.moveTo(.47, .06); g.arc(.25, .06, .22, 0, Math.PI * 2);
      g.moveTo(.13, .04); g.arc(0, .04, .13, 0, Math.PI * 2);
      g.moveTo(.03, .12); g.bezierCurveTo(.05, .35, .1, .45, .18, .5); g.lineTo(-.18, .5); g.bezierCurveTo(-.1, .45, -.05, .35, -.03, .12);
    }
    g.closePath(); g.restore();
  }
  function suit(g, s, x, y, k, flip) {
    g.save(); g.translate(x, y); if (flip) g.rotate(Math.PI);
    suitPath(g, s, 0, 0, k); g.fillStyle = SUIT_COL[s]; g.fill();
    g.restore();
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  const PIPS = {
    0: [[.3, .22], [.3, .5], [.3, .78], [.7, .22], [.7, .5], [.7, .78]],
    1: [[.3, .22], [.3, .5], [.3, .78], [.7, .22], [.7, .5], [.7, .78], [.5, .36]],
    2: [[.3, .22], [.3, .5], [.3, .78], [.7, .22], [.7, .5], [.7, .78], [.5, .36], [.5, .64]],
    3: [[.3, .2], [.3, .4], [.3, .6], [.3, .8], [.7, .2], [.7, .4], [.7, .6], [.7, .8], [.5, .5]],
    4: [[.3, .2], [.3, .4], [.3, .6], [.3, .8], [.7, .2], [.7, .4], [.7, .6], [.7, .8], [.5, .3], [.5, .7]],
  };

  function face(g, c, w, h) {
    const s = (c / 9) | 0, r = c % 9, col = SUIT_COL[s];
    // основа
    rr(g, 1, 1, w - 2, h - 2, w * 0.08);
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#efeae0');
    g.fillStyle = bg; g.fill(); g.lineWidth = Math.max(1, w * 0.012); g.strokeStyle = 'rgba(0,0,0,.28)'; g.stroke();
    // уголки
    const fs = w * 0.2, lab = Rules.RANKS[r];
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `${lab.length > 1 ? fs * 0.82 : fs}px "Russo One", Arial, sans-serif`;
    const cx = w * 0.13;
    g.fillText(lab, cx, h * 0.15); suit(g, s, cx, h * 0.225, w * 0.12);
    g.save(); g.translate(w, h); g.rotate(Math.PI); g.fillText(lab, cx, h * 0.15); suit(g, s, cx, h * 0.225, w * 0.12); g.restore();
    // середина
    const ix = w * 0.24, iw = w * 0.52, iy = h * 0.1, ih = h * 0.8;
    if (r <= 4) {
      for (const [px, py] of PIPS[r]) suit(g, s, w * px, h * (0.08 + py * 0.84), w * 0.16, py > 0.55);
    } else if (r === 8) { // туз
      g.save(); g.strokeStyle = col; g.globalAlpha = 0.25; g.lineWidth = w * 0.015;
      g.beginPath(); g.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.12; g.beginPath(); g.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2); g.stroke(); g.restore();
      suit(g, s, w / 2, h / 2, w * 0.44);
    } else { // валет, дама, король
      rr(g, ix - w * 0.02, iy, iw + w * 0.04, ih, w * 0.05);
      const fg = g.createLinearGradient(0, iy, 0, iy + ih);
      fg.addColorStop(0, s >= 2 ? '#fde7e2' : '#e6e9f2'); fg.addColorStop(1, '#fbf3dc');
      g.fillStyle = fg; g.fill(); g.lineWidth = w * 0.012; g.strokeStyle = col; g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
      emblem(g, r, w / 2, iy + ih * 0.36, w * 0.36, col);
      suit(g, s, w / 2, iy + ih * 0.76, w * 0.22);
    }
  }
  // Корона (К), диадема (Д), шапка с пером (В): золото с обводкой цвета масти
  function emblem(g, r, x, y, k, col) {
    g.save(); g.translate(x, y); g.scale(k, k); g.beginPath();
    if (r === 7) {
      g.moveTo(-.5, .3); g.lineTo(-.55, -.25); g.lineTo(-.28, 0); g.lineTo(0, -.42); g.lineTo(.28, 0); g.lineTo(.55, -.25); g.lineTo(.5, .3); g.closePath();
    } else if (r === 6) {
      g.moveTo(-.48, .3); g.quadraticCurveTo(-.55, -.05, -.38, -.18); g.quadraticCurveTo(-.2, .02, 0, -.3); g.quadraticCurveTo(.2, .02, .38, -.18); g.quadraticCurveTo(.55, -.05, .48, .3); g.closePath();
    } else {
      g.moveTo(-.5, .3); g.quadraticCurveTo(-.5, -.2, 0, -.22); g.quadraticCurveTo(.5, -.2, .5, .3); g.closePath();
    }
    const gr = g.createLinearGradient(0, -.4, 0, .3); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#d08a12');
    g.fillStyle = gr; g.fill(); g.lineWidth = .05; g.strokeStyle = col; g.stroke();
    // обод и камни
    g.beginPath(); g.rect(-.52, .26, 1.04, .16); g.fillStyle = '#c47a0c'; g.fill(); g.stroke();
    g.fillStyle = col;
    if (r === 7) for (const px of [-.55, 0, .55]) { g.beginPath(); g.arc(px, px === 0 ? -.42 : -.25, .08, 0, 7); g.fill(); }
    if (r === 6) for (const px of [-.38, 0, .38]) { g.beginPath(); g.arc(px, px === 0 ? -.3 : -.18, .07, 0, 7); g.fill(); }
    if (r === 5) { g.beginPath(); g.moveTo(.15, -.2); g.bezierCurveTo(.4, -.75, .8, -.55, .7, -.5); g.bezierCurveTo(.5, -.45, .35, -.3, .22, -.17); g.closePath(); g.fill(); }
    for (const px of [-.3, 0, .3]) { g.beginPath(); g.arc(px, .34, .045, 0, 7); g.fillStyle = '#fff3c0'; g.fill(); }
    g.restore();
  }

  function back(g, id, w, h) {
    const B = BACKS[id] || BACKS.red;
    rr(g, 1, 1, w - 2, h - 2, w * 0.08); g.fillStyle = '#fbfaf6'; g.fill(); g.lineWidth = Math.max(1, w * 0.012); g.strokeStyle = 'rgba(0,0,0,.3)'; g.stroke();
    const m = w * 0.07; rr(g, m, m, w - 2 * m, h - 2 * m, w * 0.05);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, B.a); gr.addColorStop(1, B.b); g.fillStyle = gr; g.fill();
    g.save(); g.clip(); g.strokeStyle = B.l; g.lineWidth = w * 0.012; const st = w * 0.09;
    for (let x = -h; x < w + h; x += st) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
    g.restore();
    g.save(); g.translate(w / 2, h / 2);
    g.beginPath(); g.ellipse(0, 0, w * 0.26, h * 0.2, 0, 0, 7); g.fillStyle = B.b; g.fill(); g.lineWidth = w * 0.025; g.strokeStyle = B.e; g.stroke();
    g.fillStyle = B.e;
    for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2); suitPath(g, k, 0, -w * 0.1, w * 0.1); g.fill(); g.restore(); }
    g.restore();
    rr(g, m, m, w - 2 * m, h - 2 * m, w * 0.05); g.lineWidth = w * 0.015; g.strokeStyle = B.e; g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
  }

  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, w, h); const g = t.getContext();
    draw(g, w, h); t.refresh(); return t;
  }
  // Все карты и выбранные рубашки. th — высота текстуры в пикселях.
  function cards(scene, th, backs) {
    const w = Math.round(th / 1.4), h = Math.round(th);
    for (let c = 0; c < 36; c++) canvasTex(scene, 'c' + c, w, h, (g) => face(g, c, w, h));
    for (const id of backs) canvasTex(scene, 'b_' + id, w, h, (g) => back(g, id, w, h));
    canvasTex(scene, 'glow', w + 24, h + 24, (g) => { g.shadowColor = 'rgba(255,214,80,1)'; g.shadowBlur = 12; rr(g, 12, 12, w, h, w * 0.08); g.fillStyle = 'rgba(255,214,80,1)'; g.fill(); });
    canvasTex(scene, 'shadow', w + 30, h + 30, (g) => { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 14; g.shadowOffsetY = 4; rr(g, 15, 15, w, h, w * 0.08); g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); });
    return { w, h };
  }
  function backPreview(id, w) { // картинка рубашки для магазина (dataURL)
    const c = document.createElement('canvas'), h = Math.round(w * 1.4); c.width = w; c.height = h; back(c.getContext('2d'), id, w, h); return c.toDataURL();
  }
  function feltPreview(id, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; feltDraw(c.getContext('2d'), id, w, h, false); return c.toDataURL(); }

  // Сукно: градиент + мелкий шум + виньетка + тонкая линия «стола». Рисуется в половинном размере.
  function feltDraw(g, id, w, h, noise) {
    const C = TABLES[id] || TABLES.green;
    const gr = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    gr.addColorStop(0, C[0]); gr.addColorStop(0.6, C[1]); gr.addColorStop(1, C[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (noise) {
      const n = document.createElement('canvas'); n.width = n.height = 128; const ng = n.getContext('2d'), im = ng.createImageData(128, 128);
      for (let i = 0; i < im.data.length; i += 4) { const v = (Math.random() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 14; }
      ng.putImageData(im, 0, 0); g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, w, h);
    }
    g.save(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = Math.max(2, w * 0.004);
    g.beginPath(); g.ellipse(w / 2, h * 0.5, w * 0.44, h * 0.36, 0, 0, 7); g.stroke(); g.restore();
  }
  function felt(scene, id, w, h) {
    const fw = Math.max(64, Math.round(w / 2)), fh = Math.max(64, Math.round(h / 2));
    return canvasTex(scene, 'felt', fw, fh, (g) => feltDraw(g, id, fw, fh, true));
  }

  return { cards, felt, backPreview, feltPreview, BACKS, TABLES, suitPath, SUIT_COL };
})();
