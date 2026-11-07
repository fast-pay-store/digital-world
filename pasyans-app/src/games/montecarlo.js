"use strict";
GAMES.push({
  id: 'montecarlo', name: 'Монте-Карло', diff: 1, about: 'Поле 5×5: убирай соседние пары одинаковых карт.',
  rules: ['Цель — убрать все 52 карты.',
    'Убирай пары одинаковых по значению карт (две семёрки, два валета), которые лежат рядом: слева-справа, сверху-снизу или по диагонали.',
    'Нажми на карту, потом на её пару (если пара одна — уберётся сразу).',
    'Когда пар нет, нажми «Сдвинуть» (или на колоду): карты сдвинутся, закрыв дырки, а пустые места заполнятся из колоды.'],
  setup(E) {
    const d = E.deck(1, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.dis = E.pile('discard', { kind: 'discard' });
    this.g = []; for (let i = 0; i < 25; i++) this.g.push(E.pile('g' + i, { kind: 'grid', n: i }));
    let k = 0; for (const p of this.g) E.put(p, d[k++], true);
    while (k < d.length) E.put(this.st, d[k++], false);
    const self = this;
    this.extra = { label: () => 'Сдвинуть', fn: () => E.act(() => self.squeeze()) };
  },
  layout(E, W, H) {
    const port = H > W * 1.15;
    const g = 0.12;
    const cw = port ? Math.min(W / (5 * (1 + g) + g), H / (5 * 1.4 * (1 + g) + 1.4 + 0.8), 124)
                    : Math.min(W / (6.6 * (1 + g)), H / (5 * 1.4 * (1 + g) + 0.3), 124);
    E.size(cw);
    const px = E.cw * (1 + g), py = E.ch + E.cw * g;
    const gw = 5 * px - E.cw * g, total = port ? gw : gw + px * 1.4;
    const x0 = (W - total) / 2, y0 = Math.max(6, E.cw * g);
    this.g.forEach(p => { p.x = x0 + (p.n % 5) * px; p.y = y0 + Math.floor(p.n / 5) * py; });
    if (port) { const y = y0 + 5 * py + E.cw * 0.1; this.st.x = x0 + px * 1; this.dis.x = x0 + px * 3; this.st.y = this.dis.y = y; }
    else { this.st.x = this.dis.x = x0 + gw + px * 0.4; this.st.y = y0; this.dis.y = y0 + py * 2; }
  },
  adj(a, b) { const ax = a % 5, ay = (a / 5) | 0, bx = b % 5, by = (b / 5) | 0; return a !== b && Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1; },
  canPick(p) { return p.kind === 'grid' && p.cards.length > 0; },
  canDrop(cards, from, t) {
    return from.kind === 'grid' && t.kind === 'grid' && t.cards.length > 0 && this.adj(from.n, t.n) && U.top(t).r === cards[0].r;
  },
  doMove(from, s, to) { E.move(from, 0, this.dis); E.move(to, 0, this.dis); },
  autoTargets(cards, from) { const a = this.g.filter(t => this.canDrop(cards, from, t)); return a.length === 1 ? a : []; },
  squeeze() {
    const filled = this.g.filter(p => p.cards.length);
    if (filled.length === 25) { E.toast('Сдвигать нечего — дырок нет'); return; }
    const cards = filled.map(p => p.cards[0]);
    let k = 0;
    for (const p of this.g) {
      if (k < cards.length) { const c = cards[k++]; const from = this.g.find(q => q.cards[0] === c); if (from !== p) E.move(from, 0, p); }
      else if (this.st.cards.length) E.move(this.st, this.st.cards.length - 1, p, { up: true });
    }
  },
  tap(p) { if (p !== this.st) return false; this.squeeze(); return true; },
  won() { return this.dis.cards.length === 52; },
  stockAvail() {
    const n = this.g.filter(p => p.cards.length).length; if (n === 25) return false;
    if (this.st.cards.length) return true;
    let gap = false; for (const p of this.g) { if (!p.cards.length) gap = true; else if (gap) return true; } return false;
  },
  caption(p) { return p === this.st ? (p.cards.length ? 'в колоде ' + p.cards.length : '') : p === this.dis && p.cards.length ? 'убрано ' + p.cards.length : ''; },
});
