"use strict";
GAMES.push({
  id: 'calculation', name: 'Калькулятор', diff: 3, about: 'Пасьянс для любителей считать: базы растут на 1, 2, 3 и 4.',
  rules: ['Четыре базы начинаются с туза, двойки, тройки и четвёрки. Масть не важна.',
    'Первая база растёт по 1 (A, 2, 3 … K), вторая — через 2 (2, 4, 6, 8, 10, Q, A, 3 …), третья — через 3 (3, 6, 9, Q, 2 …), четвёртая — через 4 (4, 8, Q, 3 …).',
    'Под каждой базой подписано, какая карта нужна дальше.',
    'Открытую карту из колоды клади на базу или в один из 4 рядов-запасов внизу. Из запаса на базу можно брать только нижнюю карту.',
    'Колода проходится один раз. Цель — довести все базы до короля.'],
  setup(E) {
    const d = E.deck(1, 4);
    this.f = []; for (let i = 0; i < 4; i++) this.f.push(E.pile('f' + i, { kind: 'found', step: i + 1 }));
    this.w = []; for (let i = 0; i < 4; i++) this.w.push(E.pile('w' + i, { kind: 'waste', fan: 'down', fu: 0.24 }));
    this.st = E.pile('stock', { kind: 'stock' });
    this.hand = E.pile('hand', { kind: 'hand' });
    const used = [false, false, false, false];
    for (const c of d) { if (c.r <= 4 && !used[c.r - 1] && c.s === c.r - 1) { used[c.r - 1] = true; E.put(this.f[c.r - 1], c, true); } }
    for (const c of d) if (!this.f.some(f => f.cards[0] === c)) E.put(this.st, c, false);
    E.move(this.st, this.st.cards.length - 1, this.hand, { up: true });
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 6, 6.6, 0.16);
    this.f.forEach((p, i) => { p.x = L.x(i); p.y = L.y0; });
    this.w.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.cw * 0.55; });
    this.hand.x = L.x(4) + L.cw * 0.25; this.hand.y = L.y0;
    this.st.x = L.x(5) + L.cw * 0.15; this.st.y = L.y0;
  },
  need(f) { const t = U.top(f); return ((t.r - 1 + f.step) % 13) + 1; },
  canPick(p, i) { return (p.kind === 'hand' || p.kind === 'waste') && i === p.cards.length - 1; },
  canDrop(cards, from, t) {
    if (cards.length !== 1) return false;
    if (t.kind === 'found') return t.cards.length < 13 && cards[0].r === this.need(t);
    if (t.kind === 'waste') return from === this.hand;
    return false;
  },
  autoTargets() { return this.f; },
  tap(p, i) {
    if (p.kind !== 'waste' || !this.hand.cards.length) return false;
    const c = U.top(p);
    if (c && i === p.cards.length - 1 && this.f.some(f => this.canDrop([c], p, f))) return false;
    E.move(this.hand, 0, p, { up: true }); return true;
  },
  after() { if (!this.hand.cards.length && this.st.cards.length) E.move(this.st, this.st.cards.length - 1, this.hand, { up: true }); },
  won() { return U.full(this.f); },
  caption(p) {
    if (p.kind === 'found') return p.cards.length >= 13 ? 'готово' : '+' + p.step + ' → ' + Cards.RANK[this.need(p)];
    if (p === this.st) return p.cards.length ? String(p.cards.length) : '';
    return '';
  },
});
