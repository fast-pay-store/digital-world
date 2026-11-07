"use strict";
GAMES.push({
  id: 'golf', name: 'Гольф', diff: 1, about: 'Семь открытых столбцов. Сбрасывай карты цепочкой ±1.',
  rules: ['Цель — убрать все карты из семи столбцов.',
    'Нижнюю карту столбца можно переложить на сброс, если она на 1 старше или на 1 младше верхней карты сброса. Масть не важна.',
    'В отличие от «Трёх пиков», после короля туз НЕ кладётся, и наоборот.',
    'Нет хода — нажми на колоду.'],
  noSelect: true,
  setup(E) {
    const d = E.deck(1, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.wa = E.pile('waste', { kind: 'waste' });
    this.t = []; for (let i = 0; i < 7; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down', fu: 0.3 }));
    let k = 0;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) E.put(this.t[i], d[k++], true);
    E.put(this.wa, d[k++], true);
    while (k < d.length) E.put(this.st, d[k++], false);
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 7, 5.3);
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0; p.maxY = H - L.ch * 2 - L.gap * 3; });
    const by = H - L.ch - L.gap * 2;
    this.st.x = W / 2 - L.pitch * 1.2; this.wa.x = W / 2 + L.pitch * 0.2; this.st.y = this.wa.y = by;
  },
  canPick(p, i) { return p.kind === 'tab' && i === p.cards.length - 1; },
  canDrop(cards, from, t) { return t === this.wa && cards.length === 1 && Math.abs(cards[0].r - U.top(t).r) === 1; },
  autoTargets() { return [this.wa]; },
  tap(p) { if (p !== this.st || !p.cards.length) return false; E.move(p, p.cards.length - 1, this.wa, { up: true }); return true; },
  won() { return this.t.every(p => !p.cards.length); },
  stockAvail() { return this.st.cards.length > 0; },
});
