"use strict";
GAMES.push({
  id: 'klondike', name: 'Косынка', diff: 2, about: 'Самый известный пасьянс. Собери все масти от туза до короля.',
  rules: ['Цель — разложить все карты на 4 базы (вверху справа): по мастям, от туза до короля.',
    'В столбцах карты кладутся по убыванию с чередованием цвета: на чёрную 8 — красную 7.',
    'В пустой столбец можно положить только короля (вместе с картами на нём).',
    'Нажми на колоду — откроются новые карты. Колоду можно проходить сколько угодно раз.',
    'Нажми на карту — она сама перейдёт на подходящее место. Или перетащи её.'],
  options: [{ k: 'draw', name: 'Из колоды брать', vals: [1, 3], labels: ['по 1 карте', 'по 3 карты'] }],
  autoSafe: true,
  setup(E, o) {
    const d = E.deck(1, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.wa = E.pile('waste', { kind: 'waste', fan: o.draw === 3 ? 'right3' : 'none' });
    this.f = []; for (let i = 0; i < 4; i++) this.f.push(E.pile('f' + i, { kind: 'found' }));
    this.t = []; for (let i = 0; i < 7; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down' }));
    let k = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) E.put(this.t[i], d[k++], j === i);
    while (k < d.length) E.put(this.st, d[k++], false);
    this.draw = o.draw || 1;
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 7, 6.1);
    this.st.x = L.x(0); this.wa.x = L.x(1);
    this.f.forEach((p, i) => { p.x = L.x(3 + i); p.y = L.y0; });
    this.st.y = this.wa.y = L.y0;
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.gap * 1.6; });
  },
  canPick(p, i) {
    const c = p.cards[i]; if (!c || !c.up) return false;
    if (p.kind === 'tab') return true;
    return (p.kind === 'waste' || p.kind === 'found') && i === p.cards.length - 1;
  },
  canDrop(cards, from, t) {
    if (t.kind === 'found') return U.found(cards, t);
    if (t.kind !== 'tab') return false;
    const c = cards[0], tp = U.top(t);
    if (!tp) return c.r === 13;
    return tp.up && U.red(tp) !== U.red(c) && c.r === tp.r - 1;
  },
  tap(p) {
    if (p !== this.st) return false;
    if (!this.st.cards.length) { if (this.wa.cards.length) E.move(this.wa, 0, this.st, { up: false, reverse: true }); return true; }
    for (let k = 0; k < this.draw && this.st.cards.length; k++) E.move(this.st, this.st.cards.length - 1, this.wa, { up: true });
    return true;
  },
  after() { U.flipTops(this.t); },
  won() { return U.full(this.f); },
  stockAvail() { return this.st.cards.length + this.wa.cards.length > 0; },
  canFinish() { return !this.st.cards.length && !this.wa.cards.length && U.allUp(this.t); },
  slotLabel(p) { return p.kind === 'found' ? 'A' : p.kind === 'tab' ? 'K' : p === this.st && this.wa.cards.length ? '↻' : ''; },
});
