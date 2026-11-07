"use strict";
/* U — общие помощники правил и раскладки для файлов пасьянсов. */
const U = {
  top: p => p.cards[p.cards.length - 1],
  red: c => c.s === 1 || c.s === 2,
  /* база от туза до короля одной масти */
  found(cards, t) {
    if (cards.length !== 1 || t.kind !== 'found') return false;
    const c = cards[0], tp = U.top(t);
    return tp ? tp.s === c.s && c.r === tp.r + 1 : c.r === 1;
  },
  /* убывание с чередованием цвета */
  alt(list, from) { for (let i = (from || 0) + 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (!b.up || U.red(a) === U.red(b) || b.r !== a.r - 1) return false; } return true; },
  /* убывание одной масти */
  suit(list, from) { for (let i = (from || 0) + 1; i < list.length; i++) { const a = list[i - 1], b = list[i]; if (!b.up || a.s !== b.s || b.r !== a.r - 1) return false; } return true; },
  flipTops(ps) { for (const p of ps) { const c = U.top(p); if (c && !c.up) E.flip(c, true); } },
  full: fs => fs.every(f => f.cards.length === 13),
  allUp: ps => ps.every(p => p.cards.every(c => c.up)),
  /* раскладка «n столбцов»: возвращает размеры и x столбца */
  cols(E, W, H, n, hUnits, gapK) {
    const g = gapK === undefined ? 0.14 : gapK;
    const cw = Math.min(W / (n * (1 + g) + g), H / hUnits, 124);
    E.size(cw);
    const pitch = E.cw * (1 + g), x0 = (W - (n * pitch - E.cw * g)) / 2;
    return { cw: E.cw, ch: E.ch, gap: E.cw * g, pitch, x: i => x0 + i * pitch, y0: Math.max(6, E.cw * g) };
  },
  /* слово для числа: 1 карта, 2 карты, 5 карт */
  plural(n, a, b, c) { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); },
};
