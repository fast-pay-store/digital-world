"use strict";
GAMES.push({
  id: 'montana', name: 'Монтана', diff: 2, about: 'Четыре ряда с дырками. Выстрой каждую масть от двойки до короля.',
  rules: ['Цель — в каждом ряду выстроить одну масть по порядку: 2, 3, 4 … король.',
    'Тузы убраны — вместо них 4 дырки.',
    'В дырку можно положить карту той же масти и на 1 старше, чем карта слева от дырки (справа от 5♥ — только 6♥).',
    'В дырку в начале ряда — любую двойку. Справа от короля дырка остаётся пустой.',
    'Нажми на дырку — подходящая карта встанет сама. Или нажми на карту.',
    'Застрял — «Перетасовать» (2 раза за партию): карты, стоящие не на своих местах, перемешаются.'],
  setup(E) {
    const d = E.deck(1, 4);
    this.s = []; for (let i = 0; i < 52; i++) this.s.push(E.pile('m' + i, { kind: 'gap', row: (i / 13) | 0, col: i % 13 }));
    d.forEach((c, k) => { if (c.r !== 1) E.put(this.s[k], c, true); });
    this.aces = E.pile('aces', { kind: 'discard', hidden: true });
    d.forEach(c => { if (c.r === 1) E.put(this.aces, c, true); });
    this.ext.shuf = 2;
    const self = this;
    this.extra = { label: () => 'Перетасовать (' + self.ext.shuf + ')', fn: () => { if (self.ext.shuf <= 0) { E.toast('Перетасовки закончились'); return; } E.act(() => self.reshuffle()); } };
  },
  layout(E, W, H) {
    const port = H > W;
    this.port = port; this.aces.x = W / 2 - E.cw / 2; this.aces.y = H / 2;
    if (!port) {
      const g = 0.08, cw = Math.min(W / (13 * (1 + g) + g), H / (4 * 1.4 * (1 + g) + 0.2), 110); E.size(cw);
      const px = E.cw * (1 + g), py = E.ch + E.cw * g, x0 = (W - 13 * px + E.cw * g) / 2, y0 = Math.max(6, (H - 4 * py) / 2);
      this.s.forEach(p => { p.x = x0 + p.col * px; p.y = y0 + p.row * py; });
    } else {
      const g = 0.1, k = 0.42, cw = Math.min(W / (4 * (1 + g) + g), H / (1.4 * (12 * k + 1) + 0.3), 110); E.size(cw);
      const px = E.cw * (1 + g), py = E.ch * k, x0 = (W - 4 * px + E.cw * g) / 2, y0 = 6;
      this.s.forEach(p => { p.x = x0 + p.row * px; p.y = y0 + p.col * py; });
    }
  },
  layoutEnd: 0,
  at(row, col) { return this.s[row * 13 + col]; },
  fits(c, p) {
    if (p.kind !== 'gap' || p.cards.length) return false;
    if (p.col === 0) return c.r === 2;
    const l = U.top(this.at(p.row, p.col - 1));
    return !!l && l.s === c.s && c.r === l.r + 1;
  },
  canPick(p) { return p.kind === 'gap' && p.cards.length > 0; },
  canDrop(cards, from, t) { if (!this.fits(cards[0], t)) return false; return !(t.col === 0 && from.col === 0); },
  autoTargets(cards, from) { return this.s.filter(p => this.canDrop(cards, from, p)); },
  tap(p, i) {
    if (p.kind !== 'gap' || p.cards.length) return false;
    const src = this.s.find(q => q.cards.length && this.canDrop(q.cards, q, p));
    if (!src) { E.toast(p.col > 0 && U.top(this.at(p.row, p.col - 1)) && U.top(this.at(p.row, p.col - 1)).r === 13 ? 'Справа от короля ничего не кладётся' : 'Сюда пока нечего положить'); return false; }
    E.move(src, 0, p); return true;
  },
  prefix(row) {
    const a = this.at(row, 0).cards[0]; if (!a || a.r !== 2) return 0;
    let n = 1; while (n < 12) { const c = this.at(row, n).cards[0]; if (!c || c.s !== a.s || c.r !== n + 2) break; n++; } return n;
  },
  reshuffle() {
    this.ext.shuf--;
    const pre = [0, 1, 2, 3].map(r => this.prefix(r));
    for (let r = 0; r < 4; r++) for (let c = pre[r]; c < 13; c++) { const p = this.at(r, c); if (p.cards.length) E.move(p, 0, this.aces); }
    const pool = Cards.shuffle(this.aces.cards.filter(c => c.r !== 1), E.rnd);
    this.aces.cards = this.aces.cards.filter(c => c.r === 1).concat(pool);
    for (let r = 0; r < 4; r++) for (let c = pre[r] + 1; c < 13; c++) { if (this.aces.cards.length <= 4) break; E.move(this.aces, this.aces.cards.length - 1, this.at(r, c), { up: true }); }
  },
  won() { return [0, 1, 2, 3].every(r => this.prefix(r) === 12); },
  stockAvail() { return this.ext.shuf > 0; },
  hintTap() { return null; },
});
