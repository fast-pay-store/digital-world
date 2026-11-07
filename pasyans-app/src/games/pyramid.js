"use strict";
GAMES.push({
  id: 'pyramid', name: 'Пирамида', diff: 2, about: 'Убирай пары карт, которые вместе дают 13.',
  rules: ['Цель — разобрать всю пирамиду.',
    'Убирай пары открытых карт, сумма которых 13: туз = 1, валет = 11, дама = 12. Например, 6 + 7, 9 + 4, дама + туз.',
    'Король стоит 13 — он уходит один, просто нажми на него.',
    'Карта открыта, если на ней не лежат две нижние карты.',
    'Верхняя карта сброса (рядом с колодой) тоже участвует. Колоду можно пройти 3 раза.',
    'Нажми на карту, затем на её пару — или перетащи одну на другую.'],
  setup(E) {
    const d = E.deck(1, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.wa = E.pile('waste', { kind: 'waste' });
    this.dis = E.pile('discard', { kind: 'discard' });
    this.p = []; this.rows = [];
    for (let r = 0; r < 7; r++) { const row = []; for (let c = 0; c <= r; c++) { const p = E.pile('p' + r + '_' + c, { kind: 'pyr', r, c }); row.push(p); this.p.push(p); } this.rows.push(row); }
    for (let r = 0; r < 6; r++) for (let c = 0; c <= r; c++) this.rows[r][c].cov = [this.rows[r + 1][c], this.rows[r + 1][c + 1]];
    for (const c of this.rows[6]) c.cov = [];
    let k = 0; for (const p of this.p) E.put(p, d[k++], true);
    while (k < d.length) E.put(this.st, d[k++], false);
    this.ext.pass = 2;
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 7, 6.75, 0.12);
    const cx = W / 2 - L.cw / 2, dy = L.ch * 0.47;
    this.st.x = L.x(0); this.st.y = L.y0; this.wa.x = L.x(1); this.wa.y = L.y0;
    this.dis.x = L.x(6); this.dis.y = L.y0;
    for (const p of this.p) { p.x = cx + (p.c - p.r / 2) * L.pitch; p.y = L.y0 + L.ch * 0.5 + p.r * dy; }
  },
  open(p) { return p.kind !== 'pyr' || p.cov.every(q => !q.cards.length); },
  canPick(p, i) { return (p.kind === 'pyr' || p.kind === 'waste') && i === p.cards.length - 1 && this.open(p); },
  canDrop(cards, from, t) {
    if (cards.length !== 1) return false;
    const c = cards[0];
    if (t.kind === 'discard') return c.r === 13;
    if ((t.kind !== 'pyr' && t.kind !== 'waste') || !t.cards.length || !this.open(t)) return false;
    return c.r + U.top(t).r === 13;
  },
  doMove(from, s, to) {
    E.move(from, s, this.dis, { up: true });
    if (to !== this.dis) E.move(to, to.cards.length - 1, this.dis, { up: true });
  },
  autoTargets(cards, from) {
    if (cards[0].r === 13) return [this.dis];
    const a = this.p.concat([this.wa]).filter(t => t !== from && this.canDrop(cards, from, t));
    return a.length === 1 ? a : [];
  },
  tap(p, i) {
    if (p === this.st) {
      if (p.cards.length) { E.move(p, p.cards.length - 1, this.wa, { up: true }); return true; }
      if (this.ext.pass > 0 && this.wa.cards.length) { this.ext.pass--; E.move(this.wa, 0, p, { up: false, reverse: true }); return true; }
      return false;
    }
    return false;
  },
  won() { return this.p.every(p => !p.cards.length); },
  stockAvail() { return this.st.cards.length > 0 || (this.ext.pass > 0 && this.wa.cards.length > 0); },
  slotLabel(p) { return p === this.st && this.ext.pass > 0 && this.wa.cards.length ? '↻' + this.ext.pass : ''; },
  caption(p) { return p === this.st && p.cards.length ? String(p.cards.length) : p === this.dis && p.cards.length ? 'убрано ' + p.cards.length : ''; },
});
