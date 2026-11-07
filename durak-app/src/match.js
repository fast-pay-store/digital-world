"use strict";
/* Партия за столом: состояние по правилам (Rules), ходы ботов, время на ход, события для сцены.
   Работает у того, кто «держит» стол: в игре с ботами — у игрока, в онлайне — у хозяина стола (остальные получают копию по сети).
   seats[i] = {kind:'me'|'bot'|'net', n имя, p фото, r рейтинг, lvl (бот), u (uid в сети)}.
   Подписка: m.on(fn) → fn(pub, evs) — pub: открытое состояние (без чужих карт), evs: события этого шага.
   Свои карты: m.s.hands[i]. Вид для сцены: Match.view(pub, hand, me). */
class Match {
  constructor(seats, opts) {
    this.seats = seats; this.n = seats.length; opts = opts || {};
    this.s = Rules.create(this.n); this.step = 0; this.subs = [];
    this.dlKey = ''; this.dlAt = 0; this.timer = 0; this.paused = false; this.dead = false;
    this.turnMs = (opts.turn || CFG.TURN_SEC) * 1000; this.throwMs = (opts.thr || CFG.THROW_SEC) * 1000;
    this.botFast = !!opts.fast;
  }
  on(fn) { this.subs.push(fn); return this; }
  start() { this.flush(); }
  destroy() { this.dead = true; clearTimeout(this.timer); this.subs = []; }
  pause(p) { if (this.dead) return; if (p) { this.paused = true; this.pausedLeft = this.dlAt - Date.now(); clearTimeout(this.timer); } else if (this.paused) { this.paused = false; this.dlAt = Date.now() + Math.max(3000, this.pausedLeft || 0); this.schedule(); } }

  // Ход игрока i. Возвращает true, если ход по правилам.
  act(i, m) {
    if (this.dead || this.s.over) return false;
    if (!Bot.apply(this.s, i, m)) return false;
    this.flush(); return true;
  }
  // Игрок ушёл: его место занимает бот (карты остаются у бота).
  replaceWithBot(i) { const st = this.seats[i]; if (!st || st.kind === 'bot') return; st.kind = 'bot'; st.lvl = 1; st.gone = true; this.s.ev.push({ t: 'gone', i }); this.flush(); }

  flush() {
    if (this.dead) return;
    const evs = this.s.ev.splice(0); this.step++;
    const s = this.s, ph = Rules.phase(s), key = ph + '|' + s.att + '|' + s.def + '|' + s.moves + '|' + s.taking;
    if (key !== this.dlKey) { this.dlKey = key; this.dlAt = Date.now() + (ph === 'throw' ? this.throwMs : this.turnMs); }
    const pub = this.pub();
    for (const f of this.subs) f(pub, evs);
    this.schedule();
  }
  pub() {
    const s = this.s;
    return { st: this.step, n: s.n, cnt: s.hands.map(h => h.length), dk: s.deck.length, tc: s.trumpCard, tb: s.table.map(p => [p.a, p.d]),
      tk: s.taking ? 1 : 0, at: s.att, df: s.def, ps: s.passed.map(b => b ? 1 : 0), out: s.out.map(b => b ? 1 : 0), pl: s.places.slice(),
      ov: s.over ? 1 : 0, fl: s.fool, ds: s.disc, lm: s.limit, dl: Math.max(0, this.dlAt - Date.now()), gone: this.seats.map(x => x.gone ? 1 : 0) };
  }

  schedule() {
    clearTimeout(this.timer);
    if (this.dead || this.paused || this.s.over) return;
    const now = Date.now();
    let wait = this.dlAt - now, who = -1, mv = null;
    const s = this.s;
    for (let k = 0; k < this.n; k++) {
      const i = (s.att + k) % this.n;
      if (this.seats[i].kind !== 'bot' || s.out[i]) continue;
      const m = Bot.move(s, i, this.seats[i].lvl == null ? 1 : this.seats[i].lvl);
      if (m) { who = i; mv = m; break; }
    }
    if (mv) {
      const d = this.botFast ? 1 : (mv.t === 'pass' ? 380 + Math.random() * 300 : 650 + Math.random() * 650);
      if (d < wait) { this.timer = setTimeout(() => { if (!this.act(who, mv)) this.schedule(); }, d); return; }
    }
    this.timer = setTimeout(() => this.timeout(), Math.max(0, wait));
  }

  // Время вышло: за людей делается ход по умолчанию.
  timeout() {
    const s = this.s; if (this.dead || s.over) return;
    const ph = Rules.phase(s), human = (i) => this.seats[i].kind !== 'bot';
    if (ph === 'att' && human(s.att)) { const h = s.hands[s.att].slice().sort((a, b) => Rules.val(a, s.trump) - Rules.val(b, s.trump)); Rules.attack(s, s.att, h[0]); this.idle(s.att); }
    else if (ph === 'def' && human(s.def)) { Rules.take(s, s.def); this.idle(s.def); }
    else if (ph === 'throw') { for (let i = 0; i < this.n; i++) if (human(i) && Rules.canPass(s, i)) Rules.pass(s, i); }
    if (s.ev.length) this.flush(); else { this.dlAt = Date.now() + 2000; this.schedule(); }
  }
  idle(i) { const st = this.seats[i]; st.idle = (st.idle || 0) + 1; if (this.onIdle) this.onIdle(i, st.idle); }

  /* Вид для сцены и проверок: «псевдо-состояние» в форме Rules (чужие карты — заглушки -1). */
  static view(p, hand, me) {
    const hands = []; for (let i = 0; i < p.n; i++) hands.push(i === me ? hand.slice() : new Array(p.cnt[i]).fill(-1));
    const deck = new Array(p.dk).fill(-1); if (p.dk) deck[0] = p.tc;
    return { n: p.n, hands, deck, trumpCard: p.tc, trump: Rules.S(p.tc), table: p.tb.map(x => ({ a: x[0], d: x[1] })), taking: !!p.tk,
      att: p.at, def: p.df, passed: p.ps.map(b => !!b), out: p.out.map(b => !!b), places: (p.pl || []).slice(), over: !!p.ov, fool: p.fl,
      disc: p.ds, limit: p.lm, first: p.lm === 5, ev: [], moves: 0, st: p.st, dl: p.dl, gone: (p.gone || []).map(b => !!b), me };
  }
}
