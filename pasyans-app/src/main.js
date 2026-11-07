"use strict";
/* App — запуск, меню, ход партии, победа, желания, коллекция, реклама за подсказки. */
const App = (() => {
  const $ = UI.$, CUR = 'pasyansy_cur';
  let cur = null;        // { id, seed, opt, daily, wish, counted, hints }
  let hudT = 0;
  const byId = id => GAMES.find(g => g.id === id);

  /* ---------- меню ---------- */
  function menu() {
    stopHud();
    $('#play').classList.add('hide'); $('#menu').classList.remove('hide');
    const d = Meta.d, dg = Meta.dailyGame(), G = byId(dg.id);
    let saved = null; try { saved = JSON.parse(localStorage.getItem(CUR) || 'null'); } catch (_) {}
    const top = [];
    top.push(`<div class="tile daily" data-act="daily">${UI.mini(G.id)}<span class="badge2">${Meta.dailyDone() ? 'разложен ✓' : 'сегодня'}</span><h3>Пасьянс дня: ${G.name}</h3><p>Один расклад для всех игроков на сегодня.${d.dl.streak > 1 && Meta.dailyDone() ? ' Дней подряд: ' + d.dl.streak + '.' : ''}</p><div class="row">Разложено «Пасьянсов дня»: ${d.dl.n}</div></div>`);
    if (saved && byId(saved.id)) top.push(`<div class="tile cont" data-act="cont">${UI.mini(saved.id)}<h3>Продолжить: ${byId(saved.id).name}</h3><p>Расклад №${saved.seed}${saved.wish ? ' · загадано желание' : ''}</p><div class="row">Ходов: ${saved.st.s.m}</div></div>`);
    else top.push(`<div class="tile" data-act="coll">${UI.mini('accordion')}<h3>Коллекция</h3><p>Рубашки карт и столы. Открываются победами в разных пасьянсах.</p><div class="row">Побед всего: ${d.wins} · разных пасьянсов: ${Meta.games()} из ${GAMES.length}</div></div>`);
    $('#mtop').innerHTML = top.join('');
    $('#glist').innerHTML = GAMES.map(g => {
      const s = d.st[g.id] || { p: 0, w: 0 };
      return `<div class="tile" data-g="${g.id}">${UI.mini(g.id)}<h3>${g.name}</h3><p>${g.about}</p><div class="row">${UI.dots(g.diff)} ${UI.DIFF[g.diff]}${s.w ? ` <span class="medal">побед: ${s.w}</span>` : ''}</div></div>`;
    }).join('');
    $('#wishline').textContent = d.wish.made ? `Загадано желаний: ${d.wish.made} · пасьянс сошёлся: ${d.wish.came}` : 'Перед раскладом можно загадать желание — если пасьянс сойдётся, оно сбудется!';
    sndButtons();
  }
  function sndButtons() {
    const d = Meta.d;
    $('#bSnd').innerHTML = UI.ICON.snd + (d.snd ? 'Звуки' : 'Без звуков'); $('#bSnd').style.opacity = d.snd ? 1 : .6;
    $('#bMus').innerHTML = UI.ICON.mus + (d.mus ? 'Музыка' : 'Без музыки'); $('#bMus').style.opacity = d.mus ? 1 : .6;
  }
  function onMenuClick(e) {
    const t = e.target.closest('[data-g],[data-act]'); if (!t) return;
    if (t.dataset.g) return choose(t.dataset.g);
    const a = t.dataset.act;
    if (a === 'daily') { const dg = Meta.dailyGame(); const G = byId(dg.id); start(dg.id, optFor(G), dg.seed, true); }
    if (a === 'cont') resume();
    if (a === 'coll') collection(0);
  }
  function optFor(G) {
    const o = {}, saved = Meta.d.opt[G.id] || {};
    (G.options || []).forEach(op => { o[op.k] = saved[op.k] !== undefined ? saved[op.k] : op.vals[0]; });
    return o;
  }
  /* выбор пасьянса: если есть настройки — короткое окно выбора (запоминается) */
  function choose(id) {
    const G = byId(id);
    if (!G.options || Meta.d.opt[id]) return start(id, optFor(G));
    optionsModal(G, o => start(id, o));
  }
  function optionsModal(G, go) {
    const o = optFor(G);
    const draw = () => (G.options || []).map(op => `<p><b>${op.name}:</b></p><div class="opts">${op.vals.map((v, i) => `<button class="btn${o[op.k] === v ? ' on' : ''}" data-k="${op.k}" data-v="${v}">${op.labels[i]}</button>`).join('')}</div>`).join('');
    UI.modal(`<h2>${G.name}</h2><div id="oo">${draw()}</div><div class="bt"><button class="btn green big" id="oGo">Разложить</button></div>`, box => {
      box.onclick = e => {
        const b = e.target.closest('[data-k]');
        if (b) { o[b.dataset.k] = +b.dataset.v; box.querySelector('#oo').innerHTML = draw(); return; }
        if (e.target.closest('#oGo')) { Meta.d.opt[G.id] = Object.assign({}, o); Meta.save(); UI.close(); go(o); }
      };
    });
  }

  /* ---------- партия ---------- */
  function showPlay(G) {
    $('#menu').classList.add('hide'); $('#play').classList.remove('hide');
    $('#gName').textContent = G.name;
    applyLook();
  }
  function start(id, opt, seed, daily) {
    const G = byId(id);
    localStorage.removeItem(CUR);
    cur = { id, seed: seed || (1 + Math.floor(Math.random() * 999998)), opt, daily: !!daily, wish: false, counted: false, hints: 3 };
    showPlay(G);
    requestAnimationFrame(() => { E.start(G, opt, cur.seed); hud(); startHud(); tutorial(G); });
  }
  function resume() {
    let s = null; try { s = JSON.parse(localStorage.getItem(CUR) || 'null'); } catch (_) {}
    if (!s || !byId(s.id)) return menu();
    cur = { id: s.id, seed: s.seed, opt: s.opt, daily: s.daily, wish: s.wish, counted: true, hints: s.hints === undefined ? 3 : s.hints };
    const G = byId(s.id); showPlay(G);
    requestAnimationFrame(() => { try { E.start(G, s.opt, s.seed, s.st); } catch (_) { E.start(G, s.opt, s.seed); } hud(); startHud(); });
  }
  let svT = 0;
  function persist() {
    clearTimeout(svT);
    svT = setTimeout(() => {
      if (!cur) return;
      const st = E.saveState();
      if (!st || !E.moves) { localStorage.removeItem(CUR); return; }
      try { localStorage.setItem(CUR, JSON.stringify({ id: cur.id, seed: cur.seed, opt: cur.opt, daily: cur.daily, wish: cur.wish, hints: cur.hints, st })); } catch (_) {}
    }, 500);
  }
  function hud() {
    if (!cur) return;
    const G = E.G;
    $('#gSub').textContent = (cur.daily ? 'Пасьянс дня · ' : '') + 'Расклад №' + cur.seed;
    $('#gMoves').textContent = 'Ходы: ' + E.moves;
    $('#gTime').textContent = UI.fmtTime(E.time());
    $('#bUndo').disabled = !E.canUndo;
    $('#bHint').innerHTML = UI.ICON.hint + '<span class="lb">Подсказка</span>' + `<span class="n">${cur.hints > 0 ? cur.hints : '+'}</span>`;
    const ex = G && G.extra;
    $('#bExtra').classList.toggle('hide', !ex);
    if (ex) $('#bExtra').innerHTML = UI.ICON.extra + ex.label();
    const w = $('#bWish');
    w.classList.toggle('on', cur.wish);
    w.classList.toggle('hide', !cur.wish && E.moves > 0);
    w.innerHTML = UI.ICON.star + '<span class="lb">' + (cur.wish ? 'Желание загадано' : 'Загадать желание') + '</span>';
  }
  function startHud() { stopHud(); hudT = setInterval(() => { if (!document.hidden) $('#gTime').textContent = UI.fmtTime(E.time()); }, 1000); }
  function stopHud() { clearInterval(hudT); }
  function onChange() {
    if (!cur) return;
    if (E.moves > 0 && !cur.counted) { cur.counted = true; Meta.played(cur.id); }
    hud(); persist();
  }
  function onStuck(on) {
    $('#stuck').classList.toggle('hide', !on);
  }

  /* ---------- окна партии ---------- */
  function rules() {
    const G = E.G, s = Meta.d.st[G.id] || { p: 0, w: 0 };
    const opt = G.options ? `<p class="small">Настройки: ${G.options.map(op => op.name.toLowerCase() + ' — ' + op.labels[op.vals.indexOf(cur.opt[op.k])]).join(', ')}</p><div class="bt"><button class="btn" id="rOpt">Изменить настройки</button></div>` : '';
    UI.modal(`<h2>${G.name}</h2><ul>${G.rules.map(r => `<li>${r}</li>`).join('')}</ul>${opt}
      <div class="stats">Разложено: ${s.p} · сошлось: ${s.w}${s.p ? ' (' + Math.round(s.w / s.p * 100) + '%)' : ''}${s.bt ? ' · лучшее время ' + UI.fmtTime(s.bt) : ''}</div>
      <div class="bt"><button class="btn green" id="rOk">Понятно</button></div>`, box => {
      box.querySelector('#rOk').onclick = UI.close;
      const b = box.querySelector('#rOpt'); if (b) b.onclick = () => optionsModal(G, o => start(G.id, o));
    });
  }
  function wish() {
    if (cur.wish) { UI.toast('Желание уже загадано. Разложи пасьянс!'); return; }
    UI.modal(`<div class="star">★</div><h2>Загадай желание</h2><p>Подумай о нём про себя. Старая примета: если пасьянс сойдётся — желание сбудется.</p><p class="small">Загадывать можно до первого хода.</p><div class="bt"><button class="btn gold big" id="wOk">Загадал!</button><button class="btn" id="wNo">Не сейчас</button></div>`, box => {
      box.querySelector('#wOk').onclick = () => { cur.wish = true; Meta.d.wish.made++; Meta.save(); UI.close(); Snd.play('wish'); hud(); persist(); };
      box.querySelector('#wNo').onclick = UI.close;
    });
  }
  function newDeal() {
    if (E.moves > 0 && !E.over) {
      UI.modal(`<h2>Новый расклад?</h2><p>Текущий расклад закончится.${cur.wish ? ' Загаданное желание останется с тобой — можно загадать снова.' : ''}</p><div class="bt"><button class="btn green" id="nYes">Разложить заново</button><button class="btn" id="nRe">Этот же расклад сначала</button><button class="btn" id="nNo">Отмена</button></div>`, box => {
        box.querySelector('#nYes').onclick = () => { UI.close(); start(cur.id, cur.opt); };
        box.querySelector('#nRe').onclick = () => { UI.close(); const w = cur.wish; start(cur.id, cur.opt, cur.seed, cur.daily); cur.wish = w; hud(); };
        box.querySelector('#nNo').onclick = UI.close;
      });
    } else start(cur.id, cur.opt);
  }
  function hint() {
    if (E.over) return;
    if (cur.hints <= 0) {
      UI.modal(`<h2>Подсказки</h2><p>Подсказки на этот расклад закончились.</p><div class="bt"><button class="btn gold" id="hAd">Реклама: +3 подсказки</button><button class="btn" id="hNo">Не надо</button></div>`, box => {
        box.querySelector('#hAd').onclick = async () => { UI.close(); const ok = await Platform.rewarded(); if (ok) { cur.hints += 3; hud(); persist(); UI.toast('+3 подсказки'); } else UI.toast('Реклама сейчас недоступна'); };
        box.querySelector('#hNo').onclick = UI.close;
      });
      return;
    }
    if (E.hint()) { cur.hints--; hud(); persist(); }
    else UI.toast('Ходов не видно. Попробуй «Отмена» или новый расклад');
  }

  function onWin() {
    const G = E.G, sec = E.time(), mv = E.moves;
    localStorage.removeItem(CUR);
    const r = Meta.win(G.id, sec, mv, cur.daily, cur.wish);
    const news = r.news.map(n => `<div class="newit">${n.t === 'back' ? UI.cardHTML(n.i, false) : `<div class="tbl tb${n.i}"></div>`}<span>Открыта ${n.t === 'back' ? 'рубашка' : 'новый стол'}: «${n.n}»</span></div>`).join('');
    const head = cur.wish ? '<div class="star">★</div><h2>Пасьянс сошёлся — желание сбудется!</h2>' : '<h2>Пасьянс сошёлся!</h2>';
    UI.modal(`${head}<div class="stats">Время: ${UI.fmtTime(sec)} · ходов: ${mv}${r.best && Meta.gs(G.id).w > 1 ? ' · лучшее время!' : ''}</div>
      ${r.first ? `<p>Первая победа в пасьянсе «${G.name}»!</p>` : ''}${cur.daily ? '<p>«Пасьянс дня» разложен. Завтра будет новый.</p>' : ''}${news}
      <div class="bt"><button class="btn green" id="wAgain">Ещё расклад</button><button class="btn" id="wMenu">Другой пасьянс</button></div>`, box => {
      box.parentNode._lock = true;
      box.querySelector('#wAgain').onclick = () => { UI.close(); start(cur.id, cur.opt); after(); };
      box.querySelector('#wMenu').onclick = () => { UI.close(); menu(); after(); };
    });
    if (r.news.length) setTimeout(() => Snd.play('unlock'), 900);
    hud();
  }
  function after() { Platform.gameOver(); }
  function onLose() {
    localStorage.removeItem(CUR);
    UI.modal(`<h2>Не сошлось…</h2><p>${cur.wish ? 'Карты сегодня молчат. Можно загадать ещё раз — новый расклад.' : 'В этом пасьянсе всё решает удача. Попробуешь ещё раз?'}</p><div class="bt"><button class="btn green" id="lAgain">Новый расклад</button><button class="btn" id="lMenu">Другой пасьянс</button></div>`, box => {
      box.parentNode._lock = true;
      box.querySelector('#lAgain').onclick = () => { UI.close(); start(cur.id, cur.opt); after(); };
      box.querySelector('#lMenu').onclick = () => { UI.close(); menu(); after(); };
    });
  }
  function tutorial(G) {   // мягкий вход: при первом раскладе каждого пасьянса — коротко, что делать
    const seen = Meta.d.seen || (Meta.d.seen = {});
    if (seen[G.id]) return;
    seen[G.id] = 1; Meta.save();
    setTimeout(() => { if (E.G === G && !E.moves) UI.modal(`<h2>${G.name}</h2><p>${G.about}</p><ul>${G.rules.slice(0, 3).map(r => `<li>${r}</li>`).join('')}</ul><p class="small">Все правила — кнопка «?» внизу. Ошибся — «Отмена», это бесплатно.</p><div class="bt"><button class="btn green" id="tOk">Начать</button></div>`, b => { b.querySelector('#tOk').onclick = UI.close; }); }, 900);
  }

  /* ---------- коллекция ---------- */
  function applyLook() {
    const d = Meta.d, t = $('#table');
    t.className = 'b' + d.back;
    $('#play').className = 'tb' + d.table;
    const h = new Date().getHours(); document.body.classList.toggle('night', h >= 21 || h < 6);
  }
  function collection(tab) {
    const d = Meta.d;
    const items = tab === 0
      ? BACKS.map((b, i) => ({ i, n: b.n, ok: Meta.ok(b), c: Meta.cond(b), pv: UI.cardHTML(i, false), on: d.back === i }))
      : TABLES.map((b, i) => ({ i, n: b.n, ok: Meta.ok(b), c: Meta.cond(b), pv: `<div class="tb${i}" style="position:absolute;inset:0"></div>`, on: d.table === i }));
    UI.modal(`<h2>Коллекция</h2><div class="tabs"><button class="btn${tab === 0 ? ' gold' : ''}" data-tab="0">Рубашки</button><button class="btn${tab === 1 ? ' gold' : ''}" data-tab="1">Столы</button></div>
      <div class="grid">${items.map(it => `<div class="it${it.on ? ' on' : ''}${it.ok ? '' : ' lock'}" data-i="${it.i}"><div class="pv">${it.pv}${it.ok ? '' : '<div class="lk"><svg viewBox="0 0 24 24" width="30" height="30"><rect x="5" y="10" width="14" height="11" rx="2.5" fill="#8a6a48"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#8a6a48" stroke-width="2.6"/></svg></div>'}</div>${it.n}${it.ok ? '' : `<div class="small">${it.c}</div>`}</div>`).join('')}</div>
      <div class="bt"><button class="btn green" id="cOk">Готово</button></div>`, box => {
      box.onclick = e => {
        const tb = e.target.closest('[data-tab]'); if (tb) return collection(+tb.dataset.tab);
        const it = e.target.closest('[data-i]');
        if (it) { const i = +it.dataset.i, list = tab === 0 ? BACKS : TABLES; if (!Meta.ok(list[i])) { UI.toast(Meta.cond(list[i])); return; } if (tab === 0) d.back = i; else d.table = i; Meta.save(); applyLook(); collection(tab); return; }
        if (e.target.closest('#cOk')) { UI.close(); if (!$('#menu').classList.contains('hide')) menu(); }
      };
    });
  }

  /* ---------- запуск ---------- */
  async function boot() {
    await Platform.init();
    await Meta.load();
    Snd.setSound(!!Meta.d.snd); Snd.setMusic(!!Meta.d.mus);
    E.init($('#table'));
    E.on('change', onChange); E.on('win', onWin); E.on('lose', onLose); E.on('stuck', onStuck);
    E.on('toast', UI.toast); E.on('sound', n => Snd.play(n));
    UI.press(document.getElementById('app'));
    $('#bMenu').innerHTML = UI.ICON.back;
    $('#bNew').innerHTML = UI.ICON.neu + '<span class="lb">Новый</span>';
    $('#bUndo').innerHTML = UI.ICON.undo + '<span class="lb">Отмена</span>';
    $('#bRules').innerHTML = UI.ICON.rules + '<span class="lb">Правила</span>';
    $('#bColl').innerHTML = UI.ICON.coll + 'Коллекция';
    $('#menu').addEventListener('click', onMenuClick);
    $('#bMenu').onclick = () => { persist(); setTimeout(menu, 0); };
    $('#bNew').onclick = newDeal;
    $('#bUndo').onclick = () => E.undo();
    $('#bHint').onclick = hint;
    $('#bRules').onclick = rules;
    $('#bWish').onclick = wish;
    $('#bExtra').onclick = () => { const ex = E.G && E.G.extra; if (ex) { ex.fn(); hud(); } };
    $('#sUndo').onclick = () => E.undo();
    $('#sNew').onclick = () => start(cur.id, cur.opt);
    $('#bColl').onclick = () => collection(0);
    $('#bSnd').onclick = () => { Meta.d.snd = Meta.d.snd ? 0 : 1; Snd.setSound(!!Meta.d.snd); Meta.save(); sndButtons(); };
    $('#bMus').onclick = () => { Meta.d.mus = Meta.d.mus ? 0 : 1; Snd.setMusic(!!Meta.d.mus); Meta.save(); sndButtons(); };
    Platform.onPause(() => { E.pause(); Snd.pause(); persist(); });
    Platform.onResume(() => { E.resume(); Snd.resume(); });
    window.addEventListener('pagehide', persist);
    // стартовый экран: веер карт
    const fan = [{ s: 1, r: 1 }, { s: 0, r: 13 }, { s: 2, r: 12 }, { s: 3, r: 11 }, { s: 1, r: 10 }];
    $('.slogo').innerHTML = fan.map((c, i) => `<div class="card up" style="transform:translateX(${(i - 2) * 34 - 41}px) rotate(${(i - 2) * 11}deg);transform-origin:50% 120%"><div class="in"><div class="fa s${c.s}${c.r > 10 ? ' face' : ''}">${Cards.face(c)}</div><div class="ba"></div></div></div>`).join('');
    $('#bStart').onclick = () => {
      Snd.unlock(); Snd.setMusic(!!Meta.d.mus); Snd.play('shuffle');
      $('#startScreen').classList.add('hide2'); setTimeout(() => $('#startScreen').remove(), 600);
      Platform.banner();
      const qs = new URLSearchParams(location.search), qg = qs.get('g');
      if (qg && byId(qg)) { const G = byId(qg), o = optFor(G); (G.options || []).forEach(op => { const v = qs.get(op.k); if (v !== null && op.vals.indexOf(+v) >= 0) o[op.k] = +v; }); start(qg, o); }
      else menu();
    };
    menu();
  }
  return { boot, menu, start };
})();
App.boot();
