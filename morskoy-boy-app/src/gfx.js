"use strict";
/* Вся графика рисуется кодом (canvas 2D) один раз при запуске и кладётся в текстуры Phaser.
   C — размер клетки в текстурах (поле потом масштабируется). Флоты (скины) — палитры в SKINS. */
const Gfx = (() => {
  const C = 80;
  const SKINS = {
    steel:  { hull: '#53616e', hull2: '#3b4651', deck: '#8d9ba8', deck2: '#6f7d8a', rim: '#d5dee6', det: '#2e3842', acc: '#d8483a', gun: '#28313a' },
    pirate: { hull: '#7a4a24', hull2: '#4f2d14', deck: '#b8854f', deck2: '#946238', rim: '#f0d9a8', det: '#3a210d', acc: '#efe3c2', gun: '#1d140c', planks: 1 },
    arctic: { hull: '#eef5fa', hull2: '#b8cddd', deck: '#c7dcea', deck2: '#9fbdd2', rim: '#ffffff', det: '#4d6f88', acc: '#2f86d0', gun: '#3b5568' },
    neon:   { hull: '#1a1d3b', hull2: '#0d0f24', deck: '#2b3066', deck2: '#20244d', rim: '#3ef3ff', det: '#ff3ea8', acc: '#3ef3ff', gun: '#0b0c1c', glow: 1 },
    gold:   { hull: '#a67414', hull2: '#6e4a07', deck: '#ecc256', deck2: '#cf9f33', rim: '#fff3bf', det: '#6a4405', acc: '#ffffff', gun: '#4a3104' },
  };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function radial(size, stops) { const [c, g] = mk(size, size), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; }

  // Блики на воде: сумма синусов с целыми периодами — текстура бесшовная
  function ocean(S) {
    const [c, g] = mk(S, S), img = g.createImageData(S, S), d = img.data, P = Math.PI * 2 / S;
    const W = [[3, 2, 0.0], [-2, 5, 1.3], [5, -3, 2.1], [1, 7, 0.7], [-6, 1, 4.0], [4, 4, 5.2]];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = 0; for (const w of W) v += Math.sin((w[0] * x + w[1] * y) * P + w[2]);
      v = Math.abs(v) / 6; v = Math.pow(1 - v, 9);
      const i = (y * S + x) * 4; d[i] = 150 + v * 105; d[i + 1] = 220 + v * 35; d[i + 2] = 255; d[i + 3] = Math.min(255, v * 255);
    }
    g.putImageData(img, 0, 0); return c;
  }
  function board() {
    const S = C * 11, [c, g] = mk(S, S);
    rr(g, 4, 4, S - 8, S - 8, 26); g.fillStyle = 'rgba(4,18,40,0.55)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(160,215,255,0.35)'; g.stroke();
    const o = C;
    const gr = g.createLinearGradient(0, o, 0, S); gr.addColorStop(0, 'rgba(30,110,170,0.35)'); gr.addColorStop(1, 'rgba(10,50,100,0.35)');
    g.fillStyle = gr; g.fillRect(o, o, C * 10, C * 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) & 1) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(o + x * C, o + y * C, C, C); }
    g.strokeStyle = 'rgba(190,230,255,0.28)'; g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(o + i * C, o); g.lineTo(o + i * C, o + C * 10); g.stroke(); g.beginPath(); g.moveTo(o, o + i * C); g.lineTo(o + C * 10, o + i * C); g.stroke(); }
    g.strokeStyle = 'rgba(200,235,255,0.6)'; g.lineWidth = 3; g.strokeRect(o, o, C * 10, C * 10);
    g.font = `${C * 0.46}px "Russo One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(215,236,255,0.9)';
    for (let i = 0; i < 10; i++) { g.fillText(Rules.LET[i], o + i * C + C / 2, C * 0.56); g.fillText(String(i + 1), C * 0.52, o + i * C + C / 2 + 2); }
    return c;
  }
  // Корабль длиной len, нос вправо
  function ship(len, P) {
    const w = len * C, h = C, [c, g] = mk(w, h), m = 9, top = m + 2, bot = h - m - 2, mid = h / 2;
    const bow = len === 1 ? C * 0.38 : C * 0.6;
    const hull = () => { g.beginPath(); g.moveTo(m + 6, top + 4); g.lineTo(w - m - bow, top); g.quadraticCurveTo(w - m - bow * 0.25, top + 2, w - m, mid); g.quadraticCurveTo(w - m - bow * 0.25, bot - 2, w - m - bow, bot); g.lineTo(m + 6, bot - 4); g.quadraticCurveTo(m, mid, m + 6, top + 4); g.closePath(); };
    // тень на воде
    g.save(); g.translate(3, 5); hull(); g.fillStyle = 'rgba(0,10,25,0.45)'; g.fill(); g.restore();
    hull(); let gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, P.hull); gr.addColorStop(1, P.hull2); g.fillStyle = gr; g.fill();
    if (P.glow) { g.shadowColor = P.rim; g.shadowBlur = 12; }
    g.lineWidth = 3; g.strokeStyle = P.rim; g.stroke(); g.shadowBlur = 0;
    // палуба
    const dt = top + 7, db = bot - 7;
    g.beginPath(); g.moveTo(m + 12, dt + 2); g.lineTo(w - m - bow - 2, dt); g.quadraticCurveTo(w - m - bow * 0.35, dt + 3, w - m - 10, mid); g.quadraticCurveTo(w - m - bow * 0.35, db - 3, w - m - bow - 2, db); g.lineTo(m + 12, db - 2); g.closePath();
    gr = g.createLinearGradient(0, dt, 0, db); gr.addColorStop(0, P.deck); gr.addColorStop(1, P.deck2); g.fillStyle = gr; g.fill();
    if (P.planks) { g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 1.5; for (let y = dt + 7; y < db; y += 7) { g.beginPath(); g.moveTo(m + 14, y); g.lineTo(w - m - bow, y); g.stroke(); } }
    // ватерлиния-акцент
    g.strokeStyle = P.acc; g.lineWidth = 2.5; g.beginPath(); g.moveTo(m + 14, mid); g.lineTo(m + 26, mid); g.stroke();
    const turret = (x) => {
      g.fillStyle = P.gun; g.fillRect(x, mid - 3.5, C * 0.42, 7);
      g.beginPath(); g.arc(x, mid, 11, 0, Math.PI * 2); gr = g.createRadialGradient(x - 3, mid - 3, 1, x, mid, 11); gr.addColorStop(0, P.rim); gr.addColorStop(0.35, P.deck2); gr.addColorStop(1, P.det); g.fillStyle = gr; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = P.det; g.stroke();
    };
    const house = (x, ww) => {
      rr(g, x, mid - 13, ww, 26, 6); gr = g.createLinearGradient(0, mid - 13, 0, mid + 13); gr.addColorStop(0, P.rim); gr.addColorStop(1, P.det); g.fillStyle = gr; g.fill();
      g.fillStyle = P.acc; for (let i = 0; i < Math.floor(ww / 12); i++) g.fillRect(x + 6 + i * 12, mid - 9, 5, 4);
      rr(g, x + 4, mid - 7, ww - 8, 14, 4); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
    };
    if (len === 1) { house(C * 0.22, C * 0.3); turret(C * 0.66); }
    else if (len === 2) { turret(C * 0.38); house(C * 0.72, C * 0.42); turret(C * 1.4); }
    else if (len === 3) { turret(C * 0.42); house(C * 0.8, C * 0.7); g.beginPath(); g.arc(C * 1.25, mid, 6, 0, 7); g.fillStyle = P.det; g.fill(); turret(C * 1.9); turret(C * 2.35); }
    else { turret(C * 0.45); turret(C * 0.95); house(C * 1.35, C * 0.95); g.beginPath(); g.arc(C * 1.95, mid, 7, 0, 7); g.fillStyle = P.det; g.fill(); rr(g, C * 2.35, mid - 9, C * 0.35, 18, 5); g.fillStyle = P.det; g.fill(); turret(C * 2.95); turret(C * 3.4); }
    if (P.glow) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(62,243,255,0.35)'; g.lineWidth = 6; hull(); g.stroke(); g.globalCompositeOperation = 'source-over'; }
    return c;
  }
  function miss() {
    const [c, g] = mk(C, C), m = C / 2;
    let gr = g.createRadialGradient(m, m, 2, m, m, C * 0.32); gr.addColorStop(0, 'rgba(230,248,255,0.95)'); gr.addColorStop(0.35, 'rgba(160,215,255,0.55)'); gr.addColorStop(1, 'rgba(120,190,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, C * 0.32, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,245,255,0.7)'; g.lineWidth = 2.5; g.beginPath(); g.arc(m, m, C * 0.2, 0, 7); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(m, m, C * 0.075, 0, 7); g.fill();
    return c;
  }
  function blocked() { const [c, g] = mk(C, C); g.fillStyle = 'rgba(200,230,255,0.45)'; g.beginPath(); g.arc(C / 2, C / 2, C * 0.07, 0, 7); g.fill(); return c; }
  function hit() {
    const [c, g] = mk(C, C), m = C / 2;
    const gr = g.createRadialGradient(m, m, 2, m, m, C * 0.46); gr.addColorStop(0, 'rgba(40,10,0,0.85)'); gr.addColorStop(0.6, 'rgba(60,20,5,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, C, C);
    g.strokeStyle = '#ff4b2b'; g.lineCap = 'round'; g.lineWidth = 8; g.shadowColor = '#ff7a2b'; g.shadowBlur = 10;
    const k = C * 0.24; g.beginPath(); g.moveTo(m - k, m - k); g.lineTo(m + k, m + k); g.moveTo(m + k, m - k); g.lineTo(m - k, m + k); g.stroke();
    return c;
  }
  function aim() {
    const [c, g] = mk(C, C), a = 8, L = 20;
    g.strokeStyle = '#ffd34d'; g.lineWidth = 5; g.lineCap = 'round'; g.shadowColor = '#ffb000'; g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(a, a + L); g.lineTo(a, a); g.lineTo(a + L, a);
    g.moveTo(C - a - L, a); g.lineTo(C - a, a); g.lineTo(C - a, a + L);
    g.moveTo(C - a, C - a - L); g.lineTo(C - a, C - a); g.lineTo(C - a - L, C - a);
    g.moveTo(a + L, C - a); g.lineTo(a, C - a); g.lineTo(a, C - a - L);
    g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(C / 2, C / 2, 9, 0, 7); g.stroke();
    return c;
  }
  function ball() {
    const [c, g] = mk(32, 32), gr = g.createRadialGradient(12, 11, 1, 16, 16, 15);
    gr.addColorStop(0, '#9aa3ad'); gr.addColorStop(0.3, '#3d434b'); gr.addColorStop(1, '#0c0e11');
    g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 14, 0, 7); g.fill(); return c;
  }
  function ring() { const [c, g] = mk(64, 64); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); return c; }
  function cellGlow() { const [c, g] = mk(C, C); rr(g, 4, 4, C - 8, C - 8, 12); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); return c; }

  function make(scene) {
    const add = (k, cv) => { if (!scene.textures.exists(k)) scene.textures.addCanvas(k, cv); };
    add('ocean', ocean(256)); add('board', board());
    add('miss', miss()); add('blocked', blocked()); add('hit', hit()); add('aim', aim()); add('ball', ball()); add('ring', ring()); add('glow', cellGlow());
    add('flame', radial(64, [[0, 'rgba(255,255,220,1)'], [0.25, 'rgba(255,200,60,0.95)'], [0.6, 'rgba(255,90,20,0.55)'], [1, 'rgba(255,40,0,0)']]));
    add('smoke', radial(64, [[0, 'rgba(60,60,64,0.75)'], [0.6, 'rgba(50,50,55,0.35)'], [1, 'rgba(40,40,45,0)']]));
    add('spark', radial(16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
    add('shadow', radial(32, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]));
    for (const id in SKINS) skin(scene, id);
  }
  function skin(scene, id) { const P = SKINS[id] || SKINS.steel; for (let len = 1; len <= 4; len++) { const k = `ship_${id}_${len}`; if (!scene.textures.exists(k)) scene.textures.addCanvas(k, ship(len, P)); } }
  // Картинка-превью флота для магазина (data URL)
  function preview(id) { const [c, g] = mk(C * 4, C * 2.1); g.drawImage(ship(4, SKINS[id] || SKINS.steel), 0, 0); g.drawImage(ship(2, SKINS[id] || SKINS.steel), C * 0.3, C * 1.05); g.drawImage(ship(1, SKINS[id] || SKINS.steel), C * 2.6, C * 1.05); return c.toDataURL(); }
  return { C, SKINS, make, preview };
})();
