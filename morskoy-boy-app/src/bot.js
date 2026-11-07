"use strict";
/* Компьютерный соперник. Видит только свои выстрелы: 0 неизвестно, 1 мимо, 2 ранен, 3 потоплен, 4 пусто (рядом с потопленным).
   Охота — по «карте вероятностей» (где ещё могут стоять оставшиеся корабли), добивание — вдоль линии попаданий.
   mistakes — доля случайных выстрелов при охоте (чтобы компьютер был не идеальным). */
const Bot = (() => {
  const N = 10;
  function pick(shots, left, mistakes) {
    const hits = []; for (let i = 0; i < 100; i++) if (shots[i] === 2) hits.push(i);
    const free = (c) => c >= 0 && c < 100 && shots[c] === 0;
    if (hits.length) {
      let cand = [];
      if (hits.length >= 2) {
        const horiz = ((hits[0] / N) | 0) === ((hits[1] / N) | 0);
        const sorted = hits.slice().sort((a, b) => a - b), a = sorted[0], b = sorted[sorted.length - 1];
        if (horiz) { if (a % N > 0) cand.push(a - 1); if (b % N < N - 1) cand.push(b + 1); }
        else { cand.push(a - N, b + N); }
        cand = cand.filter(free);
      }
      if (!cand.length) {
        for (const h of hits) {
          const x = h % N;
          if (x > 0) cand.push(h - 1); if (x < N - 1) cand.push(h + 1); cand.push(h - N, h + N);
        }
        cand = cand.filter(free);
      }
      if (cand.length) return cand[(Math.random() * cand.length) | 0];
    }
    const unknown = []; for (let i = 0; i < 100; i++) if (shots[i] === 0) unknown.push(i);
    if (!unknown.length) return -1;
    if (Math.random() < mistakes) return unknown[(Math.random() * unknown.length) | 0];
    const w = new Float32Array(100);
    for (const len of left) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let v = 0; v < 2; v++) {
      if (len === 1 && v) continue;
      if (v ? y + len > N : x + len > N) continue;
      let ok = true; for (let i = 0; i < len && ok; i++) if (shots[(y + (v ? i : 0)) * N + x + (v ? 0 : i)] !== 0) ok = false;
      if (ok) for (let i = 0; i < len; i++) w[(y + (v ? i : 0)) * N + x + (v ? 0 : i)] += 1;
    }
    let best = -1, bc = []; for (const c of unknown) { if (w[c] > best) { best = w[c]; bc = [c]; } else if (w[c] === best) bc.push(c); }
    return bc[(Math.random() * bc.length) | 0];
  }
  return { pick };
})();
