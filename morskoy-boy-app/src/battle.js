"use strict";
/* Бой: состояние обоих полей и очередь ходов, не зависит от того, кто соперник (компьютер или человек по сети).
   Соперник (opp) — объект с методами shoot(c) — мой выстрел, emote(i), leave(), и он сам вызывает
   battle.result(c, r, shipStr) — ответ на мой выстрел, battle.incoming(c) — его выстрел, battle.oppEmote(i), battle.finish(win, why).
   Отметки выстрелов: 0 неизвестно, 1 мимо, 2 ранен, 3 потоплен, 4 пусто (рядом с потопленным).
   События (on): fire {by,c}, result {by,c,r,ship,auto}, turn {turn}, emote {by,x}, end {win,why}. */
class Battle {
  constructor(o) {
    this.mode = o.mode; this.me = o.me; this.oppInfo = o.oppInfo; this.opp = null;
    this.ships = o.ships; this.grid = Rules.grid(o.ships); this.hp = o.ships.map(s => s.len);
    this.myShots = new Int8Array(100); this.oppShots = new Int8Array(100);
    this.sunkByMe = 0; this.sunkByOpp = 0; this.oppShips = [];
    this.turn = o.first; this.busy = false; this.over = false; this.ev = {};
    this.turnSec = o.turnSec || 0; this.turnT = performance.now(); this.myShotsCount = 0; this.myHits = 0;
    this.left = Rules.FLEET.slice();
    if (this.turnSec) this.timer = setInterval(() => this.tick(), 250);
  }
  on(e, f) { (this.ev[e] = this.ev[e] || []).push(f); return this; }
  emit(e, d) { const a = this.ev[e]; if (a) for (const f of a) f(d); }
  timeLeft() { return this.turnSec ? Math.max(0, this.turnSec - (performance.now() - this.turnT) / 1000) : 0; }
  setTurn(t) { if (this.turn !== t) { this.turn = t; this.turnT = performance.now(); } else this.turnT = performance.now(); this.emit('turn', { turn: t }); }
  canFire(c) { return !this.over && this.turn === 'me' && !this.busy && c >= 0 && c < 100 && this.myShots[c] === 0; }
  fire(c, auto) {
    if (!this.canFire(c)) return false;
    this.busy = true; this.myShotsCount++; this.emit('fire', { by: 'me', c, auto });
    this.opp.shoot(c); return true;
  }
  tick() {
    if (this.over || this.turn !== 'me' || this.busy) return;
    if (this.timeLeft() <= 0) { const free = []; for (let i = 0; i < 100; i++) if (this.myShots[i] === 0) free.push(i); if (free.length) this.fire(free[(Math.random() * free.length) | 0], true); }
  }
  // Ответ соперника на мой выстрел
  result(c, r, shipStr) {
    if (this.over || this.myShots[c] !== 0) return;
    this.busy = false;
    let ship = null;
    if (r === 0) this.myShots[c] = 1;
    else {
      this.myHits++;
      this.myShots[c] = 2;
      if (r === 2 && shipStr) {
        ship = Rules.decShip(shipStr); this.oppShips.push(ship);
        for (const k of Rules.cells(ship)) this.myShots[k] = 3;
        for (const k of Rules.around(ship)) if (this.myShots[k] === 0) this.myShots[k] = 4;
        this.sunkByMe++; const i = this.left.indexOf(ship.len); if (i >= 0) this.left.splice(i, 1);
      }
    }
    this.emit('result', { by: 'me', c, r, ship });
    if (this.sunkByMe >= Rules.FLEET.length) { this.finish(true, 'win'); return; }
    this.setTurn(r === 0 ? 'opp' : 'me');
  }
  // Выстрел соперника по мне. Возвращает {r, k} — что ответить.
  incoming(c) {
    if (this.over || this.oppShots[c] !== 0) return null;
    this.emit('fire', { by: 'opp', c });
    const id = this.grid[c]; let r = 0, ship = null, k;
    if (!id) this.oppShots[c] = 1;
    else {
      this.oppShots[c] = 2; r = 1;
      if (--this.hp[id - 1] === 0) {
        r = 2; ship = this.ships[id - 1]; k = Rules.encShip(ship); this.sunkByOpp++;
        for (const q of Rules.cells(ship)) this.oppShots[q] = 3;
        for (const q of Rules.around(ship)) if (this.oppShots[q] === 0) this.oppShots[q] = 4;
      }
    }
    this.emit('result', { by: 'opp', c, r, ship });
    if (this.sunkByOpp >= Rules.FLEET.length) this.finish(false, 'win');
    else this.setTurn(r === 0 ? 'me' : 'opp');
    return { r, k };
  }
  emote(i) { this.emit('emote', { by: 'me', x: i }); this.opp.emote(i); }
  oppEmote(i) { this.emit('emote', { by: 'opp', x: i }); }
  surrender() { if (this.over) return; this.opp.surrender && this.opp.surrender(); this.finish(false, 'surr'); }
  finish(win, why) {
    if (this.over) return; this.over = true; clearInterval(this.timer);
    this.emit('end', { win, why });
  }
  destroy() { this.over = true; clearInterval(this.timer); this.ev = {}; if (this.opp && this.opp.leave) this.opp.leave(); }
}

/* Компьютер как соперник */
class BotOpp {
  constructor(battle, mistakes) {
    this.b = battle; this.ships = Rules.random(); this.grid = Rules.grid(this.ships); this.hp = this.ships.map(s => s.len);
    this.shots = new Int8Array(100); this.left = Rules.FLEET.slice(); this.mistakes = mistakes; this.t = 0; this.alive = true;
    battle.opp = this;
    battle.on('turn', ({ turn }) => { if (turn === 'opp') this.think(); });
    if (battle.turn === 'opp') this.think();
  }
  shoot(c) {
    const id = this.grid[c]; let r = 0, k;
    if (id) { r = 1; if (--this.hp[id - 1] === 0) { r = 2; k = Rules.encShip(this.ships[id - 1]); } }
    setTimeout(() => {
      if (!this.alive) return;
      this.b.result(c, r, k);
      if (r === 2 && Math.random() < 0.35) this.say([3, 5, 7]);
    }, 60);
  }
  think() {
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      if (!this.alive || this.b.over || this.b.turn !== 'opp') return;
      const c = Bot.pick(this.shots, this.left, this.mistakes);
      if (c < 0) return;
      const res = this.b.incoming(c);
      if (!res) return;
      if (res.r === 0) this.shots[c] = 1;
      else {
        this.shots[c] = 2;
        if (res.r === 2) {
          const s = Rules.decShip(res.k);
          for (const q of Rules.cells(s)) this.shots[q] = 3;
          for (const q of Rules.around(s)) if (this.shots[q] === 0) this.shots[q] = 4;
          const i = this.left.indexOf(s.len); if (i >= 0) this.left.splice(i, 1);
          if (Math.random() < 0.3) this.say([4, 2]);
        }
      }
    }, 900 + Math.random() * 700);
  }
  say(list) { setTimeout(() => { if (this.alive && !this.b.over) this.b.oppEmote(list[(Math.random() * list.length) | 0]); }, 700); }
  emote(i) { if (i === 0 || i === 1) this.say([0, 1]); else if (i === 10) this.say([10, 11]); }
  surrender() {}
  leave() { this.alive = false; clearTimeout(this.t); }
  revealShips() { return this.ships; }
}
