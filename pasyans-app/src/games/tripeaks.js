"use strict";
GAMES.push({
  id: 'tripeaks', name: 'Три пика', diff: 1, about: 'Быстрый пасьянс: убирай карты на 1 старше или младше.',
  rules: ['Цель — убрать все карты трёх вершин.',
    'Открытую карту можно переложить на сброс (внизу), если она на 1 старше или на 1 младше верхней карты сброса. Масть не важна.',
    'После короля можно класть туза, после туза — короля.',
    'Карта открывается, когда с неё убраны обе нижние карты.',
    'Нет хода — нажми на колоду. Чем длиннее цепочка без колоды, тем приятнее!'],
  noSelect: true,
  setup(E) {
    const d = E.deck(1, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.wa = E.pile('waste', { kind: 'waste' });
    const R = [3, 6, 9, 10]; this.rows = []; this.p = [];
    R.forEach((n, r) => { const row = []; for (let c = 0; c < n; c++) { const p = E.pile('k' + r + '_' + c, { kind: 'peak', r, c }); row.push(p); this.p.push(p); } this.rows.push(row); });
    const [r0, r1, r2, r3] = this.rows;
    r3.forEach(p => { p.cov = []; });
    r2.forEach((p, k) => { p.cov = [r3[k], r3[k + 1]]; });
    r1.forEach((p, k) => { const pk = k >> 1; p.cov = [r2[k + pk], r2[k + pk + 1]]; });
    r0.forEach((p, k) => { p.cov = [r1[2 * k], r1[2 * k + 1]]; });
    let k = 0; for (const p of this.p) E.put(p, d[k++], p.r === 3);
    E.put(this.wa, d[k++], true);
    while (k < d.length) E.put(this.st, d[k++], false);
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 10, 5.4, 0.06);
    const dy = L.ch * 0.5;
    this.rows[3].forEach((p, c) => { p.x = L.x(c); });
    for (let r = 2; r >= 0; r--) this.rows[r].forEach(p => { p.x = (p.cov[0].x + p.cov[1].x) / 2; });
    this.p.forEach(p => { p.y = L.y0 + p.r * dy; });
    const by = L.y0 + 3 * dy + L.ch + L.gap * 4;
    this.st.x = W / 2 - L.pitch * 1.2; this.wa.x = W / 2 + L.pitch * 0.2; this.st.y = this.wa.y = by;
  },
  open(p) { return p.cov.every(q => !q.cards.length); },
  canPick(p, i) { return p.kind === 'peak' && p.cards.length > 0 && p.cards[0].up && this.open(p); },
  canDrop(cards, from, t) {
    if (t !== this.wa || cards.length !== 1) return false;
    const d = Math.abs(cards[0].r - U.top(t).r);
    return d === 1 || d === 12;
  },
  autoTargets() { return [this.wa]; },
  tap(p) { if (p !== this.st || !p.cards.length) return false; E.move(p, p.cards.length - 1, this.wa, { up: true }); return true; },
  after() { for (const p of this.p) { const c = U.top(p); if (c && !c.up && this.open(p)) E.flip(c, true); } },
  won() { return this.p.every(p => !p.cards.length); },
  stockAvail() { return this.st.cards.length > 0; },
});
