"use strict";
/* Единственная сцена Phaser: море, поля, корабли, выстрелы и эффекты. Меню и кнопки — HTML (src/ui.js).
   Режимы: menu (море и плывущие корабли), place (расстановка), battle (бой).
   BoardView — одно поле 10×10 (контейнер, масштаб = клетка / Gfx.C). */
class BoardView {
  constructor(scene, depth) {
    this.s = scene; const C = Gfx.C;
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.bg = scene.add.image(0, 0, 'board').setOrigin(0);
    this.glow = scene.add.image(C * 5.5 + C / 2, C * 5.5 + C / 2, 'glow').setDisplaySize(C * 10.3, C * 10.3).setTint(0xffd34d).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.shipL = scene.add.container(0, 0); this.markL = scene.add.container(0, 0); this.sunkL = scene.add.container(0, 0); this.fireL = scene.add.container(0, 0);
    this.aim = scene.add.image(0, 0, 'aim').setVisible(false);
    this.root.add([this.glow, this.bg, this.shipL, this.markL, this.sunkL, this.fireL, this.aim]);
    this.ships = []; this.burning = []; this.flames = {}; this.cell = C; this.x = 0; this.y = 0;
  }
  layout(x, y, cell) { this.x = x; this.y = y; this.cell = cell; this.root.setPosition(x, y).setScale(cell / Gfx.C); }
  local(c) { const C = Gfx.C; return { x: C + (c % 10) * C + C / 2, y: C + ((c / 10) | 0) * C + C / 2 }; }
  world(c) { const p = this.local(c), k = this.cell / Gfx.C; return { x: this.x + p.x * k, y: this.y + p.y * k }; }
  cellAt(wx, wy) { const cx = Math.floor((wx - this.x) / this.cell) - 1, cy = Math.floor((wy - this.y) / this.cell) - 1; return cx < 0 || cy < 0 || cx > 9 || cy > 9 ? -1 : cy * 10 + cx; }
  cellXY(wx, wy) { return { x: Math.floor((wx - this.x) / this.cell) - 1, y: Math.floor((wy - this.y) / this.cell) - 1 }; }
  shipPos(img, s) {
    const C = Gfx.C, cx = C + s.x * C + (s.v ? C / 2 : s.len * C / 2), cy = C + s.y * C + (s.v ? s.len * C / 2 : C / 2);
    img.setPosition(cx, cy).setRotation(s.v ? Math.PI / 2 : 0);
  }
  addShip(s, skin) { const img = this.s.add.image(0, 0, `ship_${skin}_${s.len}`); this.shipPos(img, s); this.shipL.add(img); this.ships.push({ s, img }); return img; }
  mark(c, key, anim) {
    const p = this.local(c), m = this.s.add.image(p.x, p.y, key); m._c = c; this.markL.add(m);
    if (anim) { m.setScale(0.2).setAlpha(0); this.s.tweens.add({ targets: m, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out', delay: anim > 1 ? anim : 0 }); }
    return m;
  }
  burn(c) {
    const p = this.local(c), f = this.s.add.image(p.x, p.y - 4, 'flame').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
    this.fireL.add(f); this.burning.push(c); this.flames[c] = f;
    this.s.tweens.add({ targets: f, scaleX: { from: 0.5, to: 0.7 }, scaleY: { from: 0.55, to: 0.85 }, alpha: { from: 0.6, to: 0.9 }, duration: 160 + Math.random() * 160, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
  // Потопленный корабль: пламя стихает, остаётся тлеть
  smolder(cells) {
    for (const c of cells) { const f = this.flames[c]; if (!f) continue; this.s.tweens.killTweensOf(f);
      this.s.tweens.add({ targets: f, scale: { from: 0.32, to: 0.42 }, alpha: { from: 0.35, to: 0.55 }, duration: 300 + Math.random() * 300, yoyo: true, repeat: -1 }); }
  }
  clear() {
    this.shipL.removeAll(true); this.markL.removeAll(true); this.sunkL.removeAll(true);
    this.fireL.each(f => this.s.tweens.killTweensOf(f)); this.fireL.removeAll(true);
    this.ships = []; this.burning = []; this.flames = {}; this.aim.setVisible(false); this.setActive(false);
  }
  setActive(on) {
    this.s.tweens.killTweensOf(this.glow);
    if (on) { this.glow.setAlpha(0.12); this.s.tweens.add({ targets: this.glow, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }); }
    else this.glow.setAlpha(0);
  }
  show(v) { this.root.setVisible(v); }
}

class Sea extends Phaser.Scene {
  constructor() { super('Sea'); }
  create() {
    Gfx.make(this);
    this.dpr = this.game.registry.get('dpr') || 1;
    this.ins = { t: 0, b: 0 };
    this.bgG = this.add.graphics().setDepth(0);
    this.w1 = this.add.tileSprite(0, 0, 10, 10, 'ocean').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setDepth(1);
    this.w2 = this.add.tileSprite(0, 0, 10, 10, 'ocean').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.14).setDepth(1);
    this.deco = [];
    for (let i = 0; i < 4; i++) { const len = [4, 3, 2, 3][i], img = this.add.image(0, 0, `ship_steel_${len}`).setDepth(2).setAlpha(0.95); this.deco.push({ img, sp: 10 + Math.random() * 14, ph: Math.random() * 6 }); }
    this.mine = new BoardView(this, 10); this.enemy = new BoardView(this, 10);
    const fx = (key, cfg) => this.add.particles(0, 0, key, Object.assign({ emitting: false }, cfg)).setDepth(30);
    this.fxFire = fx('flame', { speed: { min: 60, max: 280 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: { min: 280, max: 650 }, blendMode: 'ADD' });
    this.fxSmoke = fx('smoke', { speed: { min: 8, max: 34 }, angle: { min: 245, max: 295 }, scale: { start: 0.45, end: 1.6 }, alpha: { start: 0.5, end: 0 }, lifespan: 1700, rotate: { min: 0, max: 360 } });
    this.fxWater = fx('spark', { speed: { min: 140, max: 380 }, angle: { min: 215, max: 325 }, gravityY: 1100, scale: { start: 1.3, end: 0.4 }, alpha: { start: 1, end: 0 }, lifespan: 650, tint: 0xd8f4ff });
    this.fxSpark = fx('spark', { speed: { min: 180, max: 520 }, scale: { start: 0.9, end: 0 }, lifespan: 520, tint: 0xffd27a, blendMode: 'ADD' });
    this.balls = []; for (let i = 0; i < 4; i++) this.balls.push({ b: this.add.image(0, 0, 'ball').setDepth(40).setVisible(false), sh: this.add.image(0, 0, 'shadow').setDepth(39).setVisible(false), busy: false });
    this.pops = []; for (let i = 0; i < 4; i++) this.pops.push(this.add.text(0, 0, '', { fontFamily: '"Russo One", sans-serif', fontSize: '40px', color: '#fff', stroke: '#06223d', strokeThickness: 8 }).setOrigin(0.5).setDepth(50).setVisible(false));
    this.popI = 0;
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.smokeTick() });
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('gameout', () => this.enemy.aim.setVisible(false));
    this.scale.on('resize', () => this.layout());
    this.mode = 'menu'; this.layout();
    this.game.events.emit('seaReady', this);
  }
  setInsets(t, b) { this.ins.t = t * this.dpr; this.ins.b = b * this.dpr; this.layout(); }

  /* ---------- раскладка ---------- */
  layout() {
    const W = this.scale.width, H = this.scale.height, t = this.ins.t, b = this.ins.b, ah = Math.max(50, H - t - b);
    this.bgG.clear(); this.bgG.fillGradientStyle(0x0b3d6e, 0x0b3d6e, 0x041a35, 0x041a35, 1); this.bgG.fillRect(0, 0, W, H);
    this.w1.setSize(W, H); this.w2.setSize(W, H);
    const ts = Math.max(1.5, Math.min(W, H) / 380); this.w1.setAlpha(this.mode === 'menu' ? 0.2 : 0.14); this.w2.setAlpha(this.mode === 'menu' ? 0.12 : 0.09); this.w1.setTileScale(ts, ts); this.w2.setTileScale(ts * 1.35, ts * 1.35);
    const dk = Math.min(W, H) / 900 * 1.0;
    this.deco.forEach((d, i) => { d.img.setScale(dk); d.y = H * (0.18 + i * 0.22); if (d.x === undefined) d.x = Math.random() * W; });
    this.landscape = W > H * 1.1;
    if (this.mode === 'place') {
      const B = Math.min(W * 0.94, ah * 0.97); this.mine.layout((W - B) / 2 - B / 22, t + (ah - B) / 2, B / 11);
    } else if (this.mode === 'battle') {
      if (this.landscape) {
        const B = Math.min(W * 0.95 / 2.06, ah * 0.97), gap = B * 0.06, x0 = (W - B * 2 - gap) / 2 - B / 44, y0 = t + (ah - B) / 2;
        this.mine.layout(x0, y0, B / 11); this.enemy.layout(x0 + B + gap, y0, B / 11);
      } else {
        const B1 = Math.min(W * 0.98, ah * 0.6), B2 = Math.min(W * 0.6, ah - B1 - 4), y0 = t + (ah - B1 - B2) / 2;
        const sh = (B) => (W - B) / 2 - Math.min(B / 22, (W - B) / 2);
        this.enemy.layout(sh(B1), y0, B1 / 11); this.mine.layout(sh(B2), y0 + B1, B2 / 11);
      }
    }
    const k = Math.max(this.enemy.cell, this.mine.cell) / Gfx.C;
    this.fxk = k; [this.fxFire, this.fxSmoke, this.fxWater, this.fxSpark].forEach(e => e.setScale(k));
    this.pops.forEach(p => p.setScale(k * 1.1));
  }

  update(time, dt) {
    const s = time / 1000;
    this.w1.tilePositionX = s * 9; this.w1.tilePositionY = s * 5;
    this.w2.tilePositionX = -s * 6; this.w2.tilePositionY = s * 8;
    if (this.mode === 'menu') {
      const W = this.scale.width;
      for (let i = 0; i < this.deco.length; i++) {
        const d = this.deco[i]; d.x += d.sp * dt / 1000 * this.dpr * (i & 1 ? -1 : 1);
        const m = d.img.displayWidth; if (d.x > W + m) d.x = -m; if (d.x < -m) d.x = W + m;
        d.img.setPosition(d.x, d.y + Math.sin(s * 1.2 + d.ph) * 4 * this.dpr).setFlipX(!!(i & 1)).setRotation(Math.sin(s * 0.9 + d.ph) * 0.02);
      }
    }
  }

  /* ---------- режимы ---------- */
  showMenu() {
    this.mode = 'menu'; this.battle = null; this.place = null;
    this.mine.clear(); this.enemy.clear(); this.mine.show(false); this.enemy.show(false);
    this.deco.forEach(d => d.img.setVisible(true)); this.layout();
  }
  showPlace(ships, skin, onChange) {
    this.mode = 'place'; this.battle = null; this.deco.forEach(d => d.img.setVisible(false));
    this.mine.clear(); this.enemy.clear(); this.enemy.show(false); this.mine.show(true); this.mine.root.setAlpha(1);
    this.place = { ships, skin, onChange, drag: null };
    ships.forEach(s => this.mine.addShip(s, skin));
    this.layout();
  }
  setShips(ships) { if (!this.place) return; this.place.ships = ships; this.mine.clear(); ships.forEach(s => this.mine.addShip(s, this.place.skin)); this.mine.ships.forEach(o => o.img.setScale(0.6)); this.tweens.add({ targets: this.mine.ships.map(o => o.img), scale: 1, duration: 260, ease: 'Back.Out' }); }
  showBattle(battle, mySkin, oppSkin) {
    this.mode = 'battle'; this.place = null; this.battle = battle; this.oppSkin = oppSkin; this.pending = {};
    this.deco.forEach(d => d.img.setVisible(false));
    this.mine.clear(); this.enemy.clear(); this.mine.show(true); this.enemy.show(true);
    battle.ships.forEach(s => this.mine.addShip(s, mySkin));
    battle.on('fire', (e) => this.onFire(e)).on('result', (e) => this.onResult(e)).on('turn', () => this.turnFx()).on('end', () => { this.enemy.aim.setVisible(false); this.mine.setActive(false); this.enemy.setActive(false); });
    this.layout(); this.turnFx();
  }
  turnFx() {
    const b = this.battle; if (!b) return;
    const me = b.turn === 'me' && !b.over;
    this.enemy.setActive(me); this.mine.setActive(false);
    this.tweens.add({ targets: this.enemy.root, alpha: me ? 1 : 0.82, duration: 250 });
    this.tweens.add({ targets: this.mine.root, alpha: me ? 0.85 : 1, duration: 250 });
    if (!me) this.enemy.aim.setVisible(false);
  }
  // Показать оставшиеся корабли соперника после боя
  revealEnemy(ships) {
    if (!this.battle) return;
    const sunk = new Set(this.battle.oppShips.map(Rules.encShip));
    ships.forEach(s => { if (!sunk.has(Rules.encShip(s))) { const img = this.enemy.addShip(s, this.oppSkin); img.setAlpha(0); this.tweens.add({ targets: img, alpha: 0.75, duration: 500 }); } });
  }

  /* ---------- ввод ---------- */
  onMove(p) {
    if (this.mode === 'battle') {
      const b = this.battle, c = this.enemy.cellAt(p.x, p.y);
      if (b && c >= 0 && b.canFire(c) && p.pointerType !== 'touch' && !p.wasTouch) { const q = this.enemy.local(c); this.enemy.aim.setPosition(q.x, q.y).setVisible(true); }
      else this.enemy.aim.setVisible(false);
    } else if (this.mode === 'place' && this.place.drag) this.dragMove(p);
  }
  onDown(p) {
    if (this.mode === 'place') this.dragStart(p);
    if (this.mode === 'battle' && this.battle) {
      const c = this.enemy.cellAt(p.x, p.y);
      if (c >= 0 && this.battle.canFire(c)) { const q = this.enemy.local(c); this.enemy.aim.setPosition(q.x, q.y).setVisible(true); this.downC = c; } else this.downC = -1;
    }
  }
  onUp(p) {
    if (this.mode === 'place') { this.dragEnd(p); return; }
    if (this.mode === 'battle' && this.battle) {
      const c = this.enemy.cellAt(p.x, p.y);
      if (c >= 0 && c === this.downC && this.battle.canFire(c)) this.battle.fire(c);
      else if (c >= 0 && this.battle.turn !== 'me') Sfx.play('err', 0.5);
      if (p.wasTouch) this.enemy.aim.setVisible(false);
    }
  }

  /* ---------- расстановка: перетаскивание и поворот ---------- */
  dragStart(p) {
    const P = this.place, xy = this.mine.cellXY(p.x, p.y), c = this.mine.cellAt(p.x, p.y); if (c < 0) return;
    const o = this.mine.ships.find(o => Rules.cells(o.s).indexOf(c) >= 0); if (!o) return;
    P.drag = { o, offX: xy.x - o.s.x, offY: xy.y - o.s.y, sx: p.x, sy: p.y, moved: false, orig: { x: o.s.x, y: o.s.y, v: o.s.v } };
    o.img.setDepth(1); this.mine.shipL.bringToTop(o.img);
    this.tweens.add({ targets: o.img, scale: 1.08, duration: 100 });
    Sfx.play('select', 0.6);
  }
  dragMove(p) {
    const D = this.place.drag; if (Math.abs(p.x - D.sx) + Math.abs(p.y - D.sy) > this.mine.cell * 0.35) D.moved = true;
    if (!D.moved) return;
    const xy = this.mine.cellXY(p.x, p.y), s = D.o.s, t = { len: s.len, v: s.v, x: xy.x - D.offX, y: xy.y - D.offY };
    t.x = Math.max(0, Math.min(t.x, s.v ? 9 : 10 - s.len)); t.y = Math.max(0, Math.min(t.y, s.v ? 10 - s.len : 9));
    const ok = Rules.fits(this.place.ships, t, s);
    D.cand = t; D.ok = ok; this.mine.shipPos(D.o.img, t); D.o.img.setTint(ok ? 0xffffff : 0xff6a6a);
  }
  dragEnd() {
    const P = this.place, D = P.drag; if (!D) return; P.drag = null;
    const s = D.o.s; D.o.img.clearTint(); this.tweens.add({ targets: D.o.img, scale: 1, duration: 120 });
    if (!D.moved) {
      // поворот вокруг первой клетки; если не помещается — пробуем сдвинуть
      const tries = [[0, 0], [-1, 0], [0, -1], [-2, 0], [0, -2], [-3, 0], [0, -3], [1, 0], [0, 1]];
      for (const [dx, dy] of tries) { const t = { len: s.len, v: !s.v, x: s.x + dx, y: s.y + dy }; if (Rules.fits(P.ships, t, s)) { Object.assign(s, t); this.mine.shipPos(D.o.img, s); Sfx.play('build', 0.6); P.onChange && P.onChange(); return; } }
      this.tweens.add({ targets: D.o.img, angle: { from: D.o.img.angle - 6, to: D.o.img.angle }, duration: 240, ease: 'Elastic.Out' }); Sfx.play('err', 0.6); return;
    }
    if (D.cand && D.ok) { Object.assign(s, D.cand); Sfx.play('build', 0.6); P.onChange && P.onChange(); }
    else Sfx.play('err', 0.6);
    this.mine.shipPos(D.o.img, s);
  }

  /* ---------- выстрелы ---------- */
  onFire(e) {
    const key = e.by + e.c; this.pending[key] = { landed: false, res: null };
    const target = e.by === 'me' ? this.enemy : this.mine, to = target.world(e.c);
    const W = this.scale.width, H = this.scale.height;
    let from;
    if (e.by === 'me') from = this.landscape ? { x: this.mine.x + this.mine.cell * 6, y: this.mine.y + this.mine.cell * 6 } : { x: W / 2, y: H + 20 };
    else from = this.landscape ? { x: this.enemy.x + this.enemy.cell * 6, y: this.enemy.y + this.enemy.cell * 6 } : { x: W / 2, y: this.enemy.y + this.enemy.cell * 6 };
    Sfx.play('cannon', 0.8, 0.08);
    const slot = this.balls.find(b => !b.busy) || this.balls[0]; slot.busy = true;
    const k = target.cell / Gfx.C, dist = Math.hypot(to.x - from.x, to.y - from.y), arc = Math.min(dist * 0.35, 260 * this.dpr);
    slot.b.setVisible(true).setScale(k * 1.4); slot.sh.setVisible(true).setScale(k * 1.6);
    const o = { t: 0 };
    this.tweens.add({ targets: o, t: 1, duration: 380 + Math.min(260, dist / this.dpr * 0.5), ease: 'Sine.In',
      onUpdate: () => { const t = o.t, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, h = Math.sin(Math.PI * t) * arc;
        slot.b.setPosition(x, y - h).setScale(k * (1.4 + Math.sin(Math.PI * t) * 1.2)); slot.sh.setPosition(x, y).setAlpha(0.3 + t * 0.5); },
      onComplete: () => { slot.b.setVisible(false); slot.sh.setVisible(false); slot.busy = false; const pd = this.pending[key]; if (!pd) return; pd.landed = true; if (pd.res) this.impact(pd.res); },
    });
  }
  onResult(e) { const pd = this.pending[e.by + e.c]; if (!pd) { this.impact(e); return; } pd.res = e; if (pd.landed) this.impact(e); }
  impact(e) {
    delete this.pending[e.by + e.c];
    const B = e.by === 'me' ? this.enemy : this.mine, w = B.world(e.c), k = this.fxk, x = w.x / k, y = w.y / k;
    if (e.r === 0) {
      B.mark(e.c, 'miss', 1); this.fxWater.explode(16, x, y); this.ripple(B, e.c); Sfx.play('splash', 1, 0.15);
      this.pop(w.x, w.y, T.miss, '#bfe6ff');
    } else {
      B.mark(e.c, 'hit', 1); B.burn(e.c);
      this.fxFire.explode(18, x, y); this.fxSpark.explode(14, x, y); this.fxSmoke.explode(4, x, y);
      this.cameras.main.shake(e.r === 2 ? 260 : 140, e.r === 2 ? 0.008 : 0.004);
      Sfx.play(e.r === 2 ? 'bigboom' : 'boom', 1, 0.1);
      if (e.r === 2 && e.ship) this.sink(B, e.ship, e.by === 'me');
      this.pop(w.x, w.y, e.r === 2 ? T.sunk : T.hit, e.r === 2 ? '#ffcf4a' : '#ff8a5c');
    }
  }
  sink(B, s, enemy) {
    if (enemy) { const img = B.addShip(s, this.oppSkin); B.shipL.remove(img); B.sunkL.add(img); img.setAlpha(0).setTint(0x9a9a9a); this.tweens.add({ targets: img, alpha: 0.92, duration: 400 }); }
    else { const o = B.ships.find(o => Rules.encShip(o.s) === Rules.encShip(s)); if (o) this.tweens.addCounter({ from: 255, to: 165, duration: 600, onUpdate: (tw) => { const v = tw.getValue() | 0; o.img.setTint(Phaser.Display.Color.GetColor(v, v, v)); } }); }
    const k = this.fxk;
    for (const c of Rules.cells(s)) { const w = B.world(c); this.fxFire.explode(10, w.x / k, w.y / k); }
    this.time.delayedCall(700, () => B.smolder(Rules.cells(s)));
    Rules.around(s).forEach((c, i) => { if (!B.markL.list.some(m => m._c === c)) B.mark(c, 'blocked', 120 + i * 25); });
  }
  ripple(B, c) {
    const p = B.local(c), r = this.add.image(p.x, p.y, 'ring').setScale(0.3).setAlpha(0.9); B.markL.add(r);
    this.tweens.add({ targets: r, scale: 1.6, alpha: 0, duration: 650, ease: 'Quad.Out', onComplete: () => r.destroy() });
  }
  pop(x, y, txt, color) {
    const t = this.pops[this.popI++ % this.pops.length]; this.tweens.killTweensOf(t);
    t.setText(txt).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
    this.tweens.add({ targets: t, y: y - this.enemy.cell * 0.9, alpha: { from: 1, to: 0 }, duration: 900, delay: 150, ease: 'Quad.Out', onComplete: () => t.setVisible(false) });
  }
  smokeTick() {
    if (this.mode !== 'battle') return;
    const k = this.fxk;
    for (const B of [this.mine, this.enemy]) { if (!B.burning.length) continue; const c = B.burning[(Math.random() * B.burning.length) | 0], w = B.world(c); this.fxSmoke.emitParticleAt(w.x / k, (w.y - B.cell * 0.2) / k, 1); }
  }
}
