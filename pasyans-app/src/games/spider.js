"use strict";
GAMES.push({
  id: 'spider', name: 'Паук', diff: 2, about: 'Две колоды, десять столбцов. Собирай полные ряды от короля до туза.',
  rules: ['Цель — собрать в столбцах 8 полных рядов от короля до туза одной масти. Готовый ряд уходит сам.',
    'Карту можно класть на карту на 1 старше любой масти (на 9 — 8).',
    'Переносить несколько карт сразу можно, только если они одной масти и идут подряд.',
    'В пустой столбец можно положить любую карту.',
    'Нажми на колоду — в каждый столбец ляжет по карте (пустых столбцов при этом быть не должно).'],
  options: [{ k: 'suits', name: 'Мастей', vals: [1, 2, 4], labels: ['1 — легко', '2 — средне', '4 — трудно'] }],
  setup(E, o) {
    const d = E.deck(2, o.suits || 1);
    this.st = E.pile('stock', { kind: 'stock' });
    this.f = []; for (let i = 0; i < 8; i++) this.f.push(E.pile('f' + i, { kind: 'found' }));
    this.t = []; for (let i = 0; i < 10; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down', fu: 0.25, fd: 0.09 }));
    let k = 0;
    for (let i = 0; i < 10; i++) { const n = i < 4 ? 6 : 5; for (let j = 0; j < n; j++) E.put(this.t[i], d[k++], j === n - 1); }
    while (k < d.length) E.put(this.st, d[k++], false);
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 10, 6.3, 0.1);
    this.st.x = L.x(0); this.st.y = L.y0;
    this.f.forEach((p, i) => { p.x = L.x(2 + i); p.y = L.y0; });
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.gap * 2; });
  },
  canPick(p, i) { return p.kind === 'tab' && p.cards[i] && p.cards[i].up && U.suit(p.cards, i); },
  canDrop(cards, from, t) {
    if (t.kind !== 'tab') return false;
    const tp = U.top(t);
    return !tp || (tp.up && tp.r === cards[0].r + 1);
  },
  autoTargets(cards, from) {   // сначала — та же масть, потом любая, потом пустой
    const a = this.t.filter(p => p.cards.length && U.top(p).s === cards[0].s);
    return a.concat(this.t.filter(p => p.cards.length && U.top(p).s !== cards[0].s), this.t.filter(p => !p.cards.length));
  },
  tap(p) {
    if (p !== this.st || !this.st.cards.length) return false;
    if (this.t.some(q => !q.cards.length)) { E.toast('Сначала заполни пустые столбцы'); return false; }
    for (const q of this.t) E.move(this.st, this.st.cards.length - 1, q, { up: true });
    return true;
  },
  after() {
    for (const p of this.t) {
      const n = p.cards.length; if (n < 13) continue;
      const s = n - 13; if (p.cards[s].r !== 13 || !U.suit(p.cards, s)) continue;
      const f = this.f.find(q => !q.cards.length); if (f) E.move(p, s, f, { up: true });
    }
    U.flipTops(this.t);
  },
  won() { return this.f.every(f => f.cards.length === 13); },
  stockAvail() { return this.st.cards.length > 0; },
  caption(p) { return p === this.st && p.cards.length ? 'раздач: ' + p.cards.length / 10 : ''; },
});
