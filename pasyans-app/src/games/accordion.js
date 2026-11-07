"use strict";
GAMES.push({
  id: 'accordion', name: 'Гармошка', diff: 3, about: 'Все карты в ряд. Складывай их, как меха гармони, в как можно меньше стопок.',
  rules: ['Все 52 карты лежат одной лентой (читается как текст: слева направо, сверху вниз).',
    'Стопку можно положить на соседнюю слева или на третью слева, если их верхние карты одной масти или одного значения.',
    'Двигается вся стопка целиком; пустые места сразу сдвигаются.',
    'Цель — оставить не больше выбранного числа стопок. Одна стопка — высшее мастерство!',
    'Нажми на стопку — если ход один, он сделается сам; если два — выбери, куда.'],
  options: [{ k: 'goal', name: 'Цель', vals: [5, 3, 1], labels: ['до 5 стопок', 'до 3 стопок', '1 стопка (мастер)'] }],
  setup(E, o) {
    const d = E.deck(1, 4);
    this.a = []; for (let i = 0; i < 52; i++) this.a.push(E.pile('a' + i, { kind: 'acc' }));
    d.forEach((c, k) => E.put(this.a[k], c, true));
    this.goal = o.goal || 5;
  },
  layout(E, W, H) {
    let best = null;
    for (let cols = 4; cols <= 13; cols++) {
      const rows = Math.ceil(52 / cols), g = 0.1;
      const cw = Math.min(W / (cols * (1 + g) + g), H / (rows * 1.4 * (1 + g) + 0.3), 110);
      if (!best || cw > best.cw) best = { cols, rows, cw };
    }
    this.cols = best.cols; E.size(best.cw);
    this.W = W; this.H = H; this.place();
  },
  place() {
    const g = 0.1, px = E.cw * (1 + g), py = E.ch + E.cw * g;
    const live = this.a.filter(p => p.cards.length);
    const x0 = (this.W - this.cols * px + E.cw * g) / 2;
    let k = 0;
    for (const p of this.a) {
      if (!p.cards.length) { p.hidden = true; continue; }
      p.hidden = false; p.x = x0 + (k % this.cols) * px; p.y = 6 + Math.floor(k / this.cols) * py; k++;
      p.capX = p.x + E.cw * 0.6; p.capY = p.y + E.ch * 0.7; p.cap.classList.add('badge');
    }
    this.live = live;
  },
  prev(p, n) { const i = this.live.indexOf(p); return i - n >= 0 ? this.live[i - n] : null; },
  canPick(p) { return p.kind === 'acc' && p.cards.length > 0; },
  pickStart() { return 0; },
  canDrop(cards, from, t) {
    if (!t.cards.length || t.kind !== 'acc') return false;
    if (t !== this.prev(from, 1) && t !== this.prev(from, 3)) return false;
    const a = cards[cards.length - 1], b = U.top(t);
    return a.s === b.s || a.r === b.r;
  },
  autoTargets(cards, from) { const a = [this.prev(from, 1), this.prev(from, 3)].filter(t => t && this.canDrop(cards, from, t)); return a.length === 1 ? a : []; },
  after() { this.place(); },
  onRestore() { if (this.W) this.place(); },
  won() { return this.a.filter(p => p.cards.length).length <= this.goal; },
  caption(p) { return p.kind === 'acc' && p.cards.length > 1 ? String(p.cards.length) : ''; },
});
