"use strict";
GAMES.push({
  id: 'freecell', name: 'Свободная ячейка', diff: 2, about: 'Все карты открыты — почти каждый расклад можно решить.',
  rules: ['Цель — разложить все карты на 4 базы (вверху справа): по мастям, от туза до короля.',
    'В столбцах — по убыванию с чередованием цвета.',
    '4 свободные ячейки (вверху слева) хранят по одной любой карте.',
    'Сразу несколько карт можно перенести, если хватает свободных ячеек и пустых столбцов.',
    'Почти все расклады решаются — думай на пару ходов вперёд.'],
  autoSafe: true,
  setup(E) {
    const d = E.deck(1, 4); d.forEach(c => { c.up = true; });
    this.c = []; for (let i = 0; i < 4; i++) this.c.push(E.pile('c' + i, { kind: 'cell' }));
    this.f = []; for (let i = 0; i < 4; i++) this.f.push(E.pile('f' + i, { kind: 'found' }));
    this.t = []; for (let i = 0; i < 8; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down', fu: 0.26 }));
    d.forEach((c, k) => E.put(this.t[k % 8], c, true));
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 8, 6.2);
    this.c.forEach((p, i) => { p.x = L.x(i); p.y = L.y0; });
    this.f.forEach((p, i) => { p.x = L.x(4 + i); p.y = L.y0; });
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.gap * 2; });
  },
  cap(t) {
    const free = this.c.filter(p => !p.cards.length).length;
    const empty = this.t.filter(p => !p.cards.length && p !== t).length;
    return (free + 1) * Math.pow(2, empty);
  },
  canPick(p, i) {
    if (!p.cards[i]) return false;
    if (p.kind === 'tab') return U.alt(p.cards, i) && p.cards.length - i <= this.cap(null);
    return i === p.cards.length - 1;
  },
  canDrop(cards, from, t) {
    if (t.kind === 'found') return U.found(cards, t);
    if (t.kind === 'cell') return cards.length === 1 && !t.cards.length;
    if (t.kind !== 'tab' || cards.length > this.cap(t)) return false;
    const tp = U.top(t), c = cards[0];
    return !tp || (U.red(tp) !== U.red(c) && c.r === tp.r - 1);
  },
  won() { return U.full(this.f); },
  canFinish() { return this.t.every(p => { for (let i = 1; i < p.cards.length; i++) if (p.cards[i].r > p.cards[i - 1].r) return false; return true; }); },
  slotLabel(p) { return p.kind === 'found' ? 'A' : ''; },
});
