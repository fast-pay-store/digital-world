"use strict";
/* Meta — сохранение, статистика, «Пасьянс дня», желания, коллекция рубашек и столов.
   Условия открытия: w — всего побед, g — побед в разных пасьянсах, d — сыгранных «Пасьянсов дня». */
const BACKS = [
  { n: 'Синяя классика' }, { n: 'Вишнёвая', w: 1 }, { n: 'Изумрудная', w: 3 }, { n: 'Клетка', g: 3 },
  { n: 'Золотые ромбы', w: 6 }, { n: 'Ночное небо', d: 2 }, { n: 'Лён', w: 10 }, { n: 'Мозаика', g: 6 },
  { n: 'Северное сияние', w: 16 }, { n: 'Королевская', g: 10 }, { n: 'Звездопад', d: 7 }, { n: 'Мастер', g: 13 },
];
const TABLES = [
  { n: 'Зелёное сукно' }, { n: 'Синее сукно', w: 2 }, { n: 'Бордо', w: 5 }, { n: 'Светлое дерево', g: 4 },
  { n: 'Вечерний сад', d: 3 }, { n: 'Лаванда', w: 12 }, { n: 'Тёмный орех', g: 8 },
];
const Meta = (() => {
  const KEY = 'pasyansy_v1';
  let d = null;
  const def = () => ({ st: {}, back: 0, table: 0, snd: 1, mus: 1, opt: {}, dl: { last: -1, n: 0, streak: 0 }, wish: { made: 0, came: 0 }, wins: 0, tut: 0 });
  const day = () => Math.floor((Date.now() + 3 * 3600e3) / 864e5);   // по Москве
  async function load() { const v = await Platform.load(KEY); d = Object.assign(def(), v || {}); return d; }
  let svT = 0;
  function save() { clearTimeout(svT); svT = setTimeout(() => Platform.save(KEY, d), 300); }
  function gs(id) { return d.st[id] || (d.st[id] = { p: 0, w: 0 }); }
  function games() { return Object.keys(d.st).filter(k => d.st[k].w > 0).length; }
  function ok(it) { return (!it.w || d.wins >= it.w) && (!it.g || games() >= it.g) && (!it.d || d.dl.n >= it.d); }
  function cond(it) { return it.w ? 'Победы: ' + d.wins + ' из ' + it.w : it.g ? 'Победы в разных пасьянсах: ' + games() + ' из ' + it.g : it.d ? '«Пасьянс дня»: ' + d.dl.n + ' из ' + it.d : ''; }
  function unlockedSet() { return BACKS.map(ok).concat(TABLES.map(ok)); }
  function dailyGame() {
    const ids = GAMES.map(g => g.id), dd = day();
    return { id: ids[(dd * 5 + 3) % ids.length], seed: 100000 + (dd % 90000) * 7, day: dd };
  }
  return {
    load, save, day, gs, ok, cond, games, dailyGame,
    get d() { return d; },
    played(id) { gs(id).p++; save(); },
    /* победа: вернёт новые открытые рубашки/столы */
    win(id, sec, moves, daily, wish) {
      const before = unlockedSet();
      const s = gs(id), first = s.w === 0;
      s.w++; d.wins++;
      const best = !s.bt || sec < s.bt; if (best) s.bt = sec;
      if (!s.bm || moves < s.bm) s.bm = moves;
      if (daily && d.dl.last !== day()) { d.dl.streak = d.dl.last === day() - 1 ? d.dl.streak + 1 : 1; d.dl.last = day(); d.dl.n++; }
      if (wish) d.wish.came++;
      const after = unlockedSet(), news = [];
      after.forEach((v, i) => { if (v && !before[i]) news.push(i < BACKS.length ? { t: 'back', i, n: BACKS[i].n } : { t: 'table', i: i - BACKS.length, n: TABLES[i - BACKS.length].n }); });
      save();
      return { first, best, news };
    },
    dailyDone() { return d.dl.last === day(); },
  };
})();
