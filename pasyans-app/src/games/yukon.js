"use strict";
GAMES.push({
  id: 'yukon', name: 'Юкон', diff: 2, about: 'Родственник «Косынки» без колоды: двигай любые открытые карты.',
  rules: ['Цель — разложить все карты на 4 базы по мастям, от туза до короля.',
    'В столбцах — по убыванию с чередованием цвета, как в «Косынке».',
    'Главное отличие: можно взять ЛЮБУЮ открытую карту вместе со всеми картами на ней, даже если они не по порядку.',
    'В пустой столбец — только король (с картами на нём).',
    'Колоды нет — все карты уже на столе.'],
  autoSafe: true,
  setup(E) {
    const d = E.deck(1, 4);
    this.f = []; for (let i = 0; i < 4; i++) this.f.push(E.pile('f' + i, { kind: 'found' }));
    this.t = []; for (let i = 0; i < 7; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down', fu: 0.24, fd: 0.1 }));
    let k = 0;
    for (let i = 0; i < 7; i++) { const down = i, n = i === 0 ? 1 : i + 5; for (let j = 0; j < n; j++) E.put(this.t[i], d[k++], j >= down); }
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 7, 7.2);
    this.f.forEach((p, i) => { p.x = L.x(3 + i); p.y = L.y0; });
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.gap * 1.6; });
  },
  canPick(p, i) { const c = p.cards[i]; if (!c || !c.up) return false; return p.kind === 'tab' || i === p.cards.length - 1; },
  canDrop(cards, from, t) {
    if (t.kind === 'found') return U.found(cards, t);
    if (t.kind !== 'tab') return false;
    const tp = U.top(t), c = cards[0];
    return !tp ? c.r === 13 : tp.up && U.red(tp) !== U.red(c) && c.r === tp.r - 1;
  },
  after() { U.flipTops(this.t); },
  won() { return U.full(this.f); },
  canFinish() { return U.allUp(this.t) && this.t.every(p => U.alt(p.cards, 0)); },
  slotLabel(p) { return p.kind === 'found' ? 'A' : p.kind === 'tab' ? 'K' : ''; },
});
