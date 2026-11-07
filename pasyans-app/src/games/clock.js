"use strict";
GAMES.push({
  id: 'clock', name: 'Часы', diff: 1, about: 'Старинный пасьянс-гадание. Успеешь открыть все карты до четвёртого короля?',
  rules: ['Карты разложены по кругу, как цифры на часах: туз — на 1 часе, двойка — на 2, … дама — на 12, короли — в центре.',
    'Открытая карта отправляется к «своему часу» (под низ стопки), а оттуда берётся следующая закрытая карта.',
    'Пасьянс сходится, если все карты открыты раньше, чем выйдет четвёртый король.',
    'Здесь всё решает удача — хорош для загадывания желания. Просто нажимай на карту или включи «Авто».'],
  noSelect: true,
  setup(E) {
    const d = E.deck(1, 4);
    this.h = []; for (let i = 0; i < 13; i++) this.h.push(E.pile('h' + i, { kind: 'hour', r: i + 1, fan: 'down', fu: 0.13, fd: 0.06 }));
    this.hand = E.pile('hand', { kind: 'hand' });
    let k = 0; for (let j = 0; j < 4; j++) for (const p of this.h) E.put(p, d[k++], false);
    const kp = this.h[12]; E.move(kp, kp.cards.length - 1, this.hand, { up: true });
    const self = this;
    this.extra = { label: () => (self.auto ? 'Стоп' : 'Авто'), fn: () => self.toggleAuto() };
    this.auto = false;
  },
  toggleAuto() {
    this.auto = !this.auto;
    const step = () => { if (!this.auto || E.over || E.G !== this) { this.auto = false; return; } E.act(() => this.tap(this.hand)); setTimeout(step, 420); };
    if (this.auto) step();
  },
  layout(E, W, H) {
    const cw = Math.min(W / 6.8, H / 7.6, 110); E.size(cw);
    const R = E.cw * 2.65, cx = W / 2 - E.cw / 2, cy = H / 2 - E.ch / 2 - E.ch * 0.08;
    this.h.forEach(p => {
      if (p.r === 13) { p.x = cx; p.y = cy; p.capX = cx; p.capY = cy - E.ch * 0.3; p.cap.classList.add('clk'); return; }
      const a = (p.r / 12) * Math.PI * 2;
      p.x = cx + Math.sin(a) * R; p.y = cy - Math.cos(a) * R * 0.92;
      p.capX = p.x + Math.sin(a) * E.cw * 0.98; p.capY = p.y + E.ch * 0.42 - Math.cos(a) * E.ch * 0.78; p.cap.classList.add('clk');
    });
    this.hand.x = cx + E.cw * 1.15; this.hand.y = cy + E.ch * 0.1;
  },
  canPick() { return false; },
  canDrop() { return false; },
  tap() {
    const c = U.top(this.hand); if (!c) return false;
    const p = this.h[c.r - 1];
    E.move(this.hand, 0, p, { up: true, bottom: true });
    const t = U.top(p);
    if (t && !t.up) E.move(p, p.cards.length - 1, this.hand, { up: true });
    return true;
  },
  won() { return !this.hand.cards.length && this.h.every(p => p.cards.every(c => c.up)); },
  lost() { return !this.hand.cards.length && !this.won(); },
  stockAvail() { return this.hand.cards.length > 0; },
  hintTap() { return this.hand; },
  caption(p) { return p.kind === 'hour' ? Cards.RANK[p.r] : ''; },
});
