"use strict";
/* Сохранение игрока (Platform.load/save: браузер + облако ВК).
   pend — «залог» рейтинга онлайн-партии: в начале партии рейтинг записывается как при поражении; если игрок доиграл —
   ставится настоящий. Закрыл игру посреди партии — так и остаётся поражение. */
const SAVE_KEY = 'durak_save_v1';
const Save = {
  d: null,
  async load() {
    const d = await Platform.load(SAVE_KEY);
    this.d = Object.assign({ coins: 100, r: CFG.START_RATING, w: 0, l: 0, games: 0, ownB: ['red', 'blue'], ownT: ['green'], bk: 'red', tb: 'green',
      day: '', streak: 0, sfx: true, mus: true, guest: '', lvl: 1, nb: 1, pend: null }, d || {});
    if (!this.d.guest) this.d.guest = T.guest + ' ' + (1000 + ((Math.random() * 9000) | 0));
    if (this.d.pend) { this.d.r = this.d.pend.r; this.d.l++; this.d.pend = null; this.save(); }
    return this.d;
  },
  save() { Platform.save(SAVE_KEY, this.d); },
  today() { const t = new Date(); return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(); },
  dailyReady() { return this.d.day !== this.today(); },
  takeDaily() {
    const y = new Date(Date.now() - 86400000), ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    this.d.streak = this.d.day === ys ? this.d.streak + 1 : 1;
    this.d.day = this.today();
    const prize = CFG.COINS.daily[Math.min(this.d.streak, 7) - 1];
    this.d.coins += prize; this.save(); return prize;
  },
};
