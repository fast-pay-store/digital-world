"use strict";
GAMES.push({
  id: 'forty', name: 'Сорок разбойников', diff: 3, about: 'Две колоды и строгие правила: по одной карте, только по масти.',
  rules: ['Цель — разложить обе колоды на 8 баз по мастям, от туза до короля.',
    'В столбцах карты кладутся по убыванию одной масти: на пиковую 9 — пиковую 8.',
    'Переносить можно только по одной карте.',
    'В пустой столбец — любая карта.',
    'Колода проходится один раз: нажми на неё — откроется следующая карта.'],
  setup(E) {
    const d = E.deck(2, 4);
    this.st = E.pile('stock', { kind: 'stock' });
    this.wa = E.pile('waste', { kind: 'waste', fan: 'right', fr: 0.16 });
    this.f = []; for (let i = 0; i < 8; i++) this.f.push(E.pile('f' + i, { kind: 'found' }));
    this.t = []; for (let i = 0; i < 10; i++) this.t.push(E.pile('t' + i, { kind: 'tab', fan: 'down', fu: 0.25 }));
    let k = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 10; i++) E.put(this.t[i], d[k++], true);
    while (k < d.length) E.put(this.st, d[k++], false);
  },
  layout(E, W, H) {
    const L = U.cols(E, W, H, 10, 6.2, 0.1);
    this.f.forEach((p, i) => { p.x = L.x(2 + i); p.y = L.y0; });
    this.t.forEach((p, i) => { p.x = L.x(i); p.y = L.y0 + L.ch + L.gap * 2.4; });
    // колода и сброс — под столбцами не помещаются, поэтому слева сверху: колода, сброс веером над базами не нужен
    this.st.x = L.x(0); this.st.y = L.y0;
    this.wa.x = L.x(1); this.wa.y = L.y0; this.wa.fan = 'none';
  },
  canPick(p, i) { return (p.kind === 'tab' || p.kind === 'waste' || p.kind === 'found') && i === p.cards.length - 1 && p.cards[i].up; },
  canDrop(cards, from, t) {
    if (cards.length !== 1) return false;
    if (t.kind === 'found') return U.found(cards, t);
    if (t.kind !== 'tab') return false;
    const tp = U.top(t), c = cards[0];
    return !tp || (tp.s === c.s && c.r === tp.r - 1);
  },
  tap(p) { if (p !== this.st || !p.cards.length) return false; E.move(p, p.cards.length - 1, this.wa, { up: true }); return true; },
  won() { return U.full(this.f); },
  stockAvail() { return this.st.cards.length > 0; },
  canFinish() { return !this.st.cards.length && !this.wa.cards.length && this.t.every(p => U.suit(p.cards, 0)); },
  slotLabel(p) { return p.kind === 'found' ? 'A' : ''; },
});
