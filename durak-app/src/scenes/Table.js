"use strict";
/* Сцена стола: сукно, колода с козырем, отбой, карты на столе, свои карты (веером снизу), карты соперников (рубашкой сверху).
   Рисует по «виду» (Match.view): сравнивает с прошлым видом и плавно переносит карты — так анимации получаются сами
   и при игре с ботами, и по сети. Ввод: нажать на карту или перетащить её на стол. Ход отправляется в this.ctl.play(c, k).
   Для HTML-интерфейса сцена отдаёт раскладку this.L (координаты в CSS-пикселях) через событие 'layout'. */
class Table extends Phaser.Scene {
  constructor() { super('Table'); }

  create() {
    this.dpr = this.registry.get('dpr') || 1;
    this.backId = Save.d.bk || 'red'; this.feltId = Save.d.tb || 'green';
    this.bg = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(0);
    this.face = new Map(); this.opp = []; this.deckSpr = []; this.discSpr = []; this.trumpSpr = null; this.trumpIcon = null;
    this.v = null; this.me = 0; this.seats = []; this.ctl = null; this.menuSpr = []; this.dying = new Set();
    this.makeTextures();
    this.deckTxt = this.add.text(0, 0, '', { fontFamily: '"Russo One"', fontSize: 20, color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(40).setVisible(false);
    this.layout();
    this.scale.on('resize', () => { this.layout(); this.relayout(); });
    this.input.on('dragstart', (p, o) => { if (!o.cid && o.cid !== 0) return; o.dragging = true; this.tweens.killTweensOf(o); o.setDepth(450); });
    this.input.on('drag', (p, o, x, y) => { o.x = x; o.y = y; o.rotation = 0; });
    this.input.on('dragend', (p, o) => {
      o.dragging = false;
      const moved = Phaser.Math.Distance.Between(p.downX, p.downY, p.upX, p.upY) > 12 * this.dpr;
      if (!moved) { this.tap(o.cid); return; }
      if (o.y < this.L.handTop - this.ch * 0.25) this.drop(o.cid, o.x, o.y); else this.relayout();
    });
    this.input.on('gameobjectover', (p, o) => { if (o.cid != null && !o.dragging && this.v) { o.hover = true; this.layoutHand(true); } });
    this.input.on('gameobjectout', (p, o) => { if (o.cid != null && o.hover) { o.hover = false; this.layoutHand(true); } });
    this.game.events.emit('tableReady', this);
  }

  makeTextures() {
    const W = this.scale.width, H = this.scale.height;
    const th = Math.round(Phaser.Math.Clamp(Math.min(H * 0.24, W * 0.2), 150, 400));
    this.tex = Gfx.cards(this, th, Object.keys(Gfx.BACKS));
    // значки мастей для козыря
    for (let s = 0; s < 4; s++) {
      const key = 'suit' + s; if (this.textures.exists(key)) this.textures.remove(key);
      const t = this.textures.createCanvas(key, 128, 128), g = t.getContext();
      Gfx.suitPath(g, s, 64, 64, 110); g.fillStyle = s >= 2 ? '#ff4d5e' : '#f2f2f7'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.fill(); t.refresh();
    }
    this.setFelt(this.feltId);
  }
  setFelt(id) { this.feltId = id; Gfx.felt(this, id, this.scale.width, this.scale.height); this.bg.setTexture('felt'); this.bg.setDisplaySize(this.scale.width, this.scale.height); }
  setBack(id) {
    this.backId = id;
    const k = 'b_' + id;
    for (const a of this.opp) for (const s of a) s.setTexture(k);
    for (const s of this.deckSpr) s.setTexture(k);
    for (const s of this.discSpr) s.setTexture(k);
  }
  get backKey() { return 'b_' + this.backId; }

  /* ---------- Раскладка ---------- */
  layout() {
    const W = this.scale.width, H = this.scale.height, d = this.dpr, port = H > W * 1.15;
    this.bg.setDisplaySize(W, H);
    const ch = port ? Math.min(W * 0.165 * 1.4, H * 0.14) : Math.min(H * 0.205, W * 0.1 * 1.4);
    const cw = ch / 1.4; this.ch = ch; this.cw = cw; this.port = port;
    this.k = ch / this.tex.h;
    const L = { W, H, port, ch, cw };
    L.handY = H - ch * 0.5 - 8 * d; L.handTop = L.handY - ch * 0.5;
    L.ctrlY = L.handTop - 32 * d;
    L.oppAvY = (port ? 86 : 40) * d; L.oppK = port ? 0.42 : 0.46; L.oppFanY = L.oppAvY + 48 * d + ch * L.oppK * 0.42;
    const topBottom = L.oppFanY + ch * L.oppK * 0.5 + 6 * d;
    L.tblTop = topBottom; L.tblBot = L.ctrlY - 30 * d; L.tblY = (L.tblTop + L.tblBot) / 2;
    L.deckX = port ? cw * 0.42 : Math.max(cw * 0.9 + 10 * d, W * 0.09); L.deckY = L.tblY;
    L.discX = W - L.deckX; L.discY = L.tblY;
    const avail = W - 2 * (port ? cw * 0.95 : L.deckX + cw * 0.9);
    const rowsH = L.tblBot - L.tblTop;
    L.cols = (!port && avail >= cw * 1.24 * 6) ? 6 : 3;
    L.colW = Math.min(cw * 1.42, avail / L.cols);
    L.rowH = Math.min(ch * 1.18, rowsH / (L.cols === 6 ? 1 : 2));
    this.L = L;
    this.events.emit('layout', this.cssLayout());
  }
  seatXY(rel, n) { // rel: 1..n-1 → верхний ряд слева направо
    const k = n - 1, W = this.L.W;
    const d = this.dpr, a = this.L.port ? W * 0.12 : Math.max(W * 0.12, 100 * d), b = this.L.port ? W * 0.88 : Math.min(W * 0.88, W - 150 * d);
    const x = k === 1 ? W / 2 : a + (b - a) * (rel - 1) / (k - 1);
    return { x, y: this.L.oppAvY, fy: this.L.oppFanY };
  }
  rel(i) { return (i - this.me + this.seats.length) % this.seats.length; }
  cssLayout() {
    const d = this.dpr, L = this.L, n = this.seats.length || 2, out = { seats: [], port: L.port, ctrlY: L.ctrlY / d, handTop: L.handTop / d, W: L.W / d, H: L.H / d,
      deck: { x: L.deckX / d, y: L.deckY / d, cw: L.cw / d, ch: L.ch / d }, tblY: L.tblY / d };
    for (let i = 0; i < n; i++) { const r = (i - this.me + n) % n; if (r === 0) { out.seats[i] = { me: true }; continue; } const p = this.seatXY(r, n); out.seats[i] = { x: p.x / d, y: p.y / d }; }
    return out;
  }
  tablePos(k) {
    const L = this.L, cols = L.cols, n = this.v ? Math.max(this.v.table.length, 1) : 1;
    const rows = cols === 6 ? 1 : (n > 3 ? 2 : 1), row = (k / cols) | 0, col = k % cols, inRow = Math.min(cols, n - row * cols);
    const x = L.W / 2 + (col - (inRow - 1) / 2) * L.colW - L.cw * 0.08;
    const y = L.tblY + (row - (rows - 1) / 2) * L.rowH - L.ch * 0.05;
    return { x, y };
  }
  sortHand(h, tr) { const ord = (c) => { const s = Rules.S(c); return (s === tr ? 10 : [0, 2, 1, 3].indexOf(s)) * 20 + Rules.R(c); }; return h.slice().sort((a, b) => ord(a) - ord(b)); }

  /* ---------- Спрайты ---------- */
  card(id, x, y, back) {
    const s = this.add.image(x, y, back ? this.backKey : 'c' + id).setScale(this.k).setDepth(400);
    s.cid = null; s.cardId = id; return s;
  }
  fly(s, x, y, rot, sc, delay, dur, toTex, depth) {
    this.tweens.killTweensOf(s);
    const o = { targets: s, x, y, rotation: rot, scaleY: sc, duration: dur || 260, delay: delay || 0, ease: 'Cubic.easeOut' };
    if (depth != null) o.onStart = () => s.setDepth(depth);
    if (toTex && s.texture.key !== toTex) {
      this.tweens.add(o);
      this.tweens.add({ targets: s, scaleX: 0, duration: (dur || 260) / 2, delay: delay || 0, ease: 'Sine.easeIn', onComplete: () => { if (!s.active) return; s.setTexture(toTex); this.tweens.add({ targets: s, scaleX: sc, duration: (dur || 260) / 2, ease: 'Sine.easeOut' }); } });
    } else { o.scaleX = sc; this.tweens.add(o); }
  }
  kill(s, ms) { const f = () => { this.dying.delete(s); if (s.active) { this.tweens.killTweensOf(s); s.destroy(); } }; if (ms) { this.dying.add(s); this.time.delayedCall(ms, f); } else f(); }
  clearAll() {
    this.tweens.killAll(); this.time.removeAllEvents();
    for (const s of this.dying) if (s.active) s.destroy(); this.dying.clear();
    for (const s of this.face.values()) s.destroy(); this.face.clear();
    for (const a of this.opp) for (const s of a) s.destroy(); this.opp = [];
    for (const s of this.deckSpr) s.destroy(); this.deckSpr = [];
    for (const s of this.discSpr) s.destroy(); this.discSpr = [];
    if (this.trumpSpr) this.trumpSpr.destroy(); this.trumpSpr = null;
    if (this.trumpIcon) this.trumpIcon.destroy(); this.trumpIcon = null;
    for (const s of this.menuSpr) { this.tweens.killTweensOf(s); s.destroy(); } this.menuSpr = [];
    this.deckTxt.setVisible(false); this.v = null;
  }

  /* ---------- Меню: красивый веер тузов внизу ---------- */
  showMenu() {
    this.clearAll(); this.ctl = null; this.seats = [];
    const L = this.L, ids = [35, 26, 8, 17, 34];
    ids.forEach((c, i) => {
      const t = (i - 2) / 2, s = this.card(c, L.W / 2 + t * L.cw * 0.9, L.H + L.ch * 0.15, false).setDepth(5 + i).setScale(this.k * 1.25);
      s.rotation = t * 0.35; s.y += Math.abs(t) * L.ch * 0.12;
      this.tweens.add({ targets: s, y: s.y - L.ch * 0.08, duration: 1800 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.menuSpr.push(s);
    });
  }

  /* ---------- Партия ---------- */
  startGame(seats, me, ctl) {
    this.clearAll(); this.seats = seats; this.me = me; this.ctl = ctl;
    for (let i = 0; i < seats.length; i++) this.opp.push([]);
    this.events.emit('layout', this.cssLayout());
  }

  // Новый вид стола (после каждого хода). evs — события шага (для анимаций и звуков).
  show(v, evs) {
    if (!this.ctl) return;
    const L = this.L, prev = this.v; this.v = v; evs = evs || [];
    const src = new Map(); let taker = -1, bito = false, deal = false;
    for (const e of evs) { if (e.t === 'a' || e.t === 'd') src.set(e.c, e.i); if (e.t === 'took') taker = e.i; if (e.t === 'bito') bito = true; if (e.t === 'deal') deal = true; }
    let drawN = 0; const drawDelay = () => (taker >= 0 || bito ? 330 : 0) + (deal ? 250 : 0) + (drawN++) * (deal ? 55 : 80);
    const deckPos = { x: L.deckX, y: L.deckY };

    // 1) карты на столе
    const onTable = new Set();
    v.table.forEach((p, k) => {
      const pos = this.tablePos(k);
      for (const [c, dx, dy, rot, dep] of [[p.a, 0, 0, -0.04, 20 + k * 2], [p.d, L.cw * 0.2, L.ch * 0.16, 0.12, 21 + k * 2]]) {
        if (c < 0) continue; onTable.add(c);
        let s = this.face.get(c); const toTex = 'c' + c;
        if (!s) {
          const from = src.has(c) ? src.get(c) : -1;
          if (from >= 0 && from !== this.me && this.opp[from] && this.opp[from].length) {
            const b = this.opp[from].pop(); s = this.card(c, b.x, b.y, true); s.rotation = b.rotation; s.setScale(b.scaleX, b.scaleY); this.kill(b);
          } else s = this.card(c, L.W / 2, L.tblTop, true);
          this.face.set(c, s);
          Sfx.play(Math.random() < 0.5 ? 'place1' : 'place2', 0.9, 0.08);
        } else if (s.cid != null) { s.cid = null; s.disableInteractive(); Sfx.play('place3', 0.9, 0.08); }
        this.fly(s, pos.x + dx, pos.y + dy, rot, this.k, 0, 240, toTex, dep);
      }
    });
    // 2) свои карты
    const hand = this.sortHand(v.hands[this.me] || [], v.trump), inHand = new Set(hand);
    if (this.trumpSpr && v.deck.length === 0) {
      if (inHand.has(v.trumpCard) && !this.face.has(v.trumpCard)) { this.face.set(v.trumpCard, this.trumpSpr); this.trumpSpr.setDepth(400); }
      else this.fly(this.trumpSpr, this.trumpSpr.x, this.trumpSpr.y, 0, this.k, 150, 200, this.backKey);
      const ts = this.trumpSpr; this.trumpSpr = null;
      if (!inHand.has(v.trumpCard)) this.kill(ts, 450);
    }
    for (const c of hand) {
      let s = this.face.get(c);
      if (!s) { s = this.card(c, deckPos.x, deckPos.y, true); s.setVisible(false); s.dDelay = drawDelay(); this.face.set(c, s); }
      if (s.cid == null) { s.cid = c; s.setInteractive({ draggable: true, useHandCursor: true }); }
    }
    // 3) ушедшие со стола (в отбой или взял соперник)
    for (const [c, s] of this.face) {
      if (onTable.has(c) || inHand.has(c)) continue;
      this.face.delete(c);
      if (taker >= 0 && taker !== this.me) { const p = this.seatXY(this.rel(taker), v.n); this.fly(s, p.x, p.fy, 0, this.k * L.oppK, 120, 300, this.backKey, 300); }
      else { this.fly(s, L.discX + (Math.random() - 0.5) * L.cw * 0.3, L.discY + (Math.random() - 0.5) * L.ch * 0.2, (Math.random() - 0.5) * 0.8, this.k * 0.9, 120, 320, this.backKey, 15); }
      this.kill(s, 470);
    }
    if (taker >= 0) Sfx.play('shove', 0.9); else if (bito) Sfx.play('slide1', 0.9);
    if (deal) Sfx.play('shuffle', 0.8);
    // 4) карты соперников
    for (let i = 0; i < v.n; i++) {
      if (i === this.me) continue;
      const a = this.opp[i], need = v.hands[i].length, p = this.seatXY(this.rel(i), v.n);
      while (a.length > need) { const s = a.pop(); this.fly(s, L.discX, L.discY, 0.3, this.k * 0.9, 0, 300, null, 15); this.kill(s, 320); }
      while (a.length < need) {
        const fromTbl = taker === i, s = this.card(-1, fromTbl ? L.W / 2 : deckPos.x, fromTbl ? L.tblY : deckPos.y, true);
        s.setScale(this.k * (fromTbl ? 1 : 0.9)); if (!fromTbl) { s.setVisible(false); s.dDelay = drawDelay(); } else s.dDelay = 150;
        a.push(s);
      }
    }
    // 5) колода, козырь, отбой
    this.drawDeck(v); this.drawDiscard(v);
    this.layoutHand(false); this.layoutOpp();
    if (drawN && !deal) Sfx.play('slide2', 0.6);
    this.events.emit('view', v, evs);
  }

  drawDeck(v) {
    const L = this.L, n = v.deck.length, rest = Math.max(0, n - 1), vis = rest === 0 ? 0 : Math.min(5, Math.ceil(rest / 5));
    if (n > 0 && !this.trumpSpr) { this.trumpSpr = this.card(v.trumpCard, L.deckX + L.cw * 0.35, L.deckY, false).setDepth(9); this.trumpSpr.rotation = Math.PI / 2; }
    if (this.trumpSpr) { this.trumpSpr.setPosition(L.deckX + L.cw * 0.35, L.deckY).setScale(this.k); this.trumpSpr.rotation = Math.PI / 2; }
    while (this.deckSpr.length > vis) this.kill(this.deckSpr.pop());
    while (this.deckSpr.length < vis) this.deckSpr.push(this.card(-1, 0, 0, true).setDepth(10 + this.deckSpr.length));
    this.deckSpr.forEach((s, i) => { s.setPosition(L.deckX - i * 2 * this.dpr, L.deckY - i * 2 * this.dpr).setScale(this.k).setRotation(0); });
    this.deckTxt.setText(n ? String(n) : '').setVisible(n > 0).setPosition(L.deckX - vis * 2 * this.dpr, L.deckY - vis * 2 * this.dpr).setFontSize(Math.round(L.ch * 0.2));
    if (!this.trumpIcon) this.trumpIcon = this.add.image(0, 0, 'suit' + v.trump).setDepth(8);
    this.trumpIcon.setTexture('suit' + v.trump).setPosition(L.deckX, L.deckY).setDisplaySize(L.cw * 0.6, L.cw * 0.6).setAlpha(n ? 0 : 0.5);
  }
  drawDiscard(v) {
    const L = this.L, want = Math.min(12, Math.ceil(v.disc / 2));
    while (this.discSpr.length < want) {
      const s = this.card(-1, L.discX, L.discY, true).setDepth(12 + this.discSpr.length); s.rotation = (Math.random() - 0.5) * 0.9;
      s.ox = (Math.random() - 0.5) * L.cw * 0.3; s.oy = (Math.random() - 0.5) * L.ch * 0.2; s.setScale(this.k * 0.9); s.setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, delay: 380, duration: 1 });
      this.discSpr.push(s);
    }
    while (this.discSpr.length > want) this.kill(this.discSpr.pop());
    for (const s of this.discSpr) s.setPosition(L.discX + s.ox, L.discY + s.oy);
  }

  // Что можно сыграть сейчас: множество карт
  playable() {
    const v = this.v, me = this.me, r = new Set(); if (!v || v.over || !this.ctl || this.ctl.locked) return r;
    for (const c of v.hands[me]) {
      if (Rules.canAttack(v, me, c)) r.add(c);
      else if (me === v.def && !v.taking) for (let k = 0; k < v.table.length; k++) if (Rules.canDefend(v, k, c)) { r.add(c); break; }
    }
    return r;
  }
  layoutHand(quick) {
    const v = this.v; if (!v) return;
    const L = this.L, hand = this.sortHand(v.hands[this.me] || [], v.trump), n = hand.length, play = this.playable(), myTurn = play.size > 0;
    const maxW = L.port ? L.W - 12 * this.dpr : Math.min(L.W * 0.66, L.W - 2 * (L.deckX + L.cw));
    const step = n > 1 ? Math.min(L.cw * (L.port ? 0.62 : 0.72), (maxW - L.cw) / (n - 1)) : 0;
    hand.forEach((c, i) => {
      const s = this.face.get(c); if (!s || s.dragging) return;
      const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const lift = (myTurn && play.has(c) ? L.ch * 0.1 : 0) + (s.hover ? L.ch * 0.08 : 0);
      const x = L.W / 2 + (i - (n - 1) / 2) * step, y = L.handY + t * t * L.ch * 0.05 - lift, rot = t * Math.min(0.12, n * 0.012);
      s.setTint(myTurn && !play.has(c) ? 0xb8b8b8 : 0xffffff);
      const dep = 100 + i;
      if (s.dDelay != null) { const dl = s.dDelay; s.dDelay = null; s.setDepth(400); this.time.delayedCall(dl, () => s.setVisible(true)); this.fly(s, x, y, rot, this.k, dl, 280, 'c' + c, dep); }
      else { s.setDepth(dep); this.fly(s, x, y, rot, this.k, 0, quick ? 120 : 240, 'c' + c); }
    });
  }
  layoutOpp() {
    const v = this.v, L = this.L;
    for (let i = 0; i < v.n; i++) {
      if (i === this.me) continue;
      const a = this.opp[i], n = a.length, p = this.seatXY(this.rel(i), v.n), cwm = L.cw * L.oppK;
      const span = Math.min(cwm * 0.28 * Math.max(0, n - 1), L.W / Math.max(2, v.n) * 0.6);
      a.forEach((s, k) => {
        const t = n > 1 ? k / (n - 1) - 0.5 : 0, x = p.x + t * span, y = p.fy + Math.abs(t) * cwm * 0.12, rot = t * 0.5;
        const dl = s.dDelay; s.dDelay = null;
        if (dl != null) { this.time.delayedCall(dl, () => s.setVisible(true)); }
        this.fly(s, x, y, rot, this.k * L.oppK, dl || 0, 280, null, 30 + k);
      });
    }
  }
  relayout() {
    if (!this.v) { if (this.menuSpr.length) this.showMenu(); return; }
    this.events.emit('layout', this.cssLayout());
    this.v.table.forEach((p, k) => { const pos = this.tablePos(k); const a = this.face.get(p.a); if (a) a.setPosition(pos.x, pos.y); const d = this.face.get(p.d); if (d) d.setPosition(pos.x + this.L.cw * 0.2, pos.y + this.L.ch * 0.16); });
    for (const s of this.face.values()) s.setScale(this.k);
    this.drawDeck(this.v); this.drawDiscard(this.v); this.layoutHand(true); this.layoutOpp();
  }

  /* ---------- Ввод ---------- */
  tap(c) {
    if (!this.playable().has(c)) { Sfx.play('err', 0.5); this.layoutHand(true); return; }
    this.ctl.play(c, -1);
  }
  drop(c, x, y) {
    if (!this.playable().has(c)) { Sfx.play('err', 0.5); this.layoutHand(true); return; }
    let best = -1, bd = 1e9;
    this.v.table.forEach((p, k) => { if (p.d >= 0) return; const pos = this.tablePos(k), dd = Math.hypot(pos.x - x, pos.y - y); if (dd < bd && dd < this.L.cw * 1.1) { bd = dd; best = k; } });
    this.ctl.play(c, best);
  }
}
