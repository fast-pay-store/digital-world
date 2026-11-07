"use strict";
/* Управление партией для сцены и интерфейса (одинаковое для игры с компьютером, хозяина стола и гостя).
   ctl.play(c, k) — сыграть карту (k — на какую карту стола положили, -1 — сама найдёт), ctl.take(), ctl.pass().
   ctl.onView(fn) → fn(view, evs) при каждом изменении. ctl.v — текущий вид, ctl.seats, ctl.me. */
class Ctl {
  constructor(seats, me) { this.seats = seats; this.me = me; this.v = null; this.subs = []; this.locked = false; this.dead = false; }
  onView(fn) { this.subs.push(fn); return this; }
  emit(v, evs) { if (this.dead) return; this.v = v; for (const f of this.subs) f(v, evs); }
  decide(c, k) {
    const v = this.v, me = this.me; if (!v || v.over) return null;
    if (me === v.def && !v.taking && Rules.unbeaten(v) > 0) {
      if (k >= 0 && Rules.canDefend(v, k, c)) return { t: 'd', k, c };
      // сама: бьём самую старшую из карт, которые эта карта может побить
      let best = -1; v.table.forEach((p, i) => { if (Rules.canDefend(v, i, c) && (best < 0 || Rules.val(p.a, v.trump) > Rules.val(v.table[best].a, v.trump))) best = i; });
      if (best >= 0) return { t: 'd', k: best, c };
      return null;
    }
    return Rules.canAttack(v, me, c) ? { t: 'a', c } : null;
  }
  play(c, k) { const m = this.decide(c, k); if (m) this.send(m); else Sfx.play('err', 0.5); }
  take() { if (this.v && this.me === this.v.def && Rules.canTake(this.v)) this.send({ t: 'take' }); }
  pass() { if (this.v && Rules.canPass(this.v, this.me)) this.send({ t: 'pass' }); }
  send() {}
  leave() { this.dead = true; this.subs = []; }
  pause() {}
}

// Игра с компьютером: вся партия у игрока.
class LocalCtl extends Ctl {
  constructor(seats, me) {
    super(seats, me);
    this.m = new Match(seats);
    this.m.on((pub, evs) => this.emit(Match.view(pub, this.m.s.hands[me], me), evs));
  }
  start() { this.m.start(); }
  send(m) { this.m.act(this.me, m); }
  leave() { super.leave(); this.m.destroy(); }
  pause(p) { this.m.pause(p); }
}

// Ход на экране сразу (до ответа сервера) — чтобы у гостя не было задержки.
function optimistic(v, me, m) {
  const n = JSON.parse(JSON.stringify(v)), h = n.hands[me]; n.opt = true;
  const rm = (c) => { const i = h.indexOf(c); if (i >= 0) h.splice(i, 1); };
  if (m.t === 'a') { rm(m.c); n.table.push({ a: m.c, d: -1 }); }
  else if (m.t === 'd') { rm(m.c); n.table[m.k].d = m.c; }
  else if (m.t === 'take') n.taking = true;
  else if (m.t === 'pass') n.passed[me] = true;
  return n;
}
