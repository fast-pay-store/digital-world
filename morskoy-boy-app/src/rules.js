"use strict";
/* Правила «Морского боя»: поле 10×10, флот 4+3+3+2+2+2+1+1+1+1, корабли не касаются даже углами.
   Корабль: {len, x, y, v} (v — вертикально). Клетка — число 0..99 (y*10+x). */
const Rules = (() => {
  const N = 10, FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1], LET = 'АБВГДЕЖЗИК';
  function cells(s) { const a = []; for (let i = 0; i < s.len; i++) a.push((s.y + (s.v ? i : 0)) * N + s.x + (s.v ? 0 : i)); return a; }
  function inside(s) { return s.x >= 0 && s.y >= 0 && (s.v ? s.y + s.len <= N && s.x < N : s.x + s.len <= N && s.y < N); }
  // Можно ли поставить s, не касаясь других (ignore — сам этот корабль при перемещении)
  function fits(ships, s, ignore) {
    if (!inside(s)) return false;
    const my = cells(s);
    for (const o of ships) {
      if (o === ignore || o.x < 0) continue;
      for (const c of cells(o)) {
        const cx = c % N, cy = (c / N) | 0;
        for (const m of my) { const mx = m % N, my_ = (m / N) | 0; if (Math.abs(mx - cx) <= 1 && Math.abs(my_ - cy) <= 1) return false; }
      }
    }
    return true;
  }
  function random() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const ships = []; let ok = true;
      for (const len of FLEET) {
        let placed = false;
        for (let t = 0; t < 300 && !placed; t++) {
          const s = { len, v: Math.random() < 0.5, x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 };
          if (fits(ships, s)) { ships.push(s); placed = true; }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    return null;
  }
  function grid(ships) { const g = new Int8Array(N * N); ships.forEach((s, i) => cells(s).forEach(c => { g[c] = i + 1; })); return g; }
  function around(s) {
    const own = new Set(cells(s)), out = [];
    for (const c of own) {
      const cx = c % N, cy = (c / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const k = y * N + x; if (!own.has(k) && out.indexOf(k) < 0) out.push(k);
      }
    }
    return out;
  }
  // Строка-описание флота: «x,y,v,len;…» (для показа потопленного и проверки честности)
  const encShip = (s) => `${s.x},${s.y},${s.v ? 1 : 0},${s.len}`;
  const decShip = (t) => { const p = String(t).split(',').map(Number); return { x: p[0], y: p[1], v: !!p[2], len: p[3] }; };
  const encode = (ships) => ships.map(encShip).join(';');
  const decode = (str) => String(str).split(';').filter(Boolean).map(decShip);
  function validFleet(ships) {
    if (!ships || ships.length !== FLEET.length) return false;
    const lens = ships.map(s => s.len).sort((a, b) => b - a);
    if (lens.join() !== FLEET.join()) return false;
    for (let i = 0; i < ships.length; i++) if (!fits(ships.slice(0, i), ships[i])) return false;
    return true;
  }
  const name = (c) => LET[c % N] + (((c / N) | 0) + 1);
  return { N, FLEET, LET, cells, inside, fits, random, grid, around, encShip, decShip, encode, decode, validFleet, name };
})();
