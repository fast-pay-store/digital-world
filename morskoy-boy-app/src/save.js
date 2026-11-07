"use strict";
/* Сохранение игрока (Platform.load/save: браузер + облако ВК). */
const SAVE_KEY = 'seabattle_save_v1';
const Save = {
  d: null,
  async load() {
    const d = await Platform.load(SAVE_KEY);
    this.d = Object.assign({ coins: 100, r: CFG.START_RATING, w: 0, l: 0, bw: 0, bl: 0, own: ['steel'], sk: 'steel', day: '', streak: 0, sfx: true, mus: true, guest: '' }, d || {});
    if (!this.d.guest) this.d.guest = T.guest + ' ' + (1000 + ((Math.random() * 9000) | 0));
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
