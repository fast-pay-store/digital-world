"use strict";
/* Все экраны и окна (HTML поверх холста): меню, выбор игры с компьютером, поиск, стол с друзьями (комната ожидания),
   игра (места игроков, таймеры, кнопки «Беру»/«Бито», фразы), итог партии, рейтинг, магазин, подарок дня.
   cur — то, что надо закрыть при уходе с экрана: поиск (stop), комната (room), партия (ctl). */
const UI = (() => {
  let tb = null, root = null, prof = null, cur = { stop: null, room: null, ctl: null }, game = null, hudT = 0;
  const $ = (s, e) => (e || root).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const click = () => Sfx.play('click', 0.7);
  const S = () => Save.d;
  function set(html) { closeOv(); root.innerHTML = `<div class="scr">${html}</div>`; return root.firstChild; }
  function bind(map, scope) { for (const k in map) { (scope || root).querySelectorAll(k).forEach(e => { e.onclick = (ev) => { click(); map[k](ev, e); }; }); } }
  function ov(html, cls) { closeOv(); const d = document.createElement('div'); d.className = 'ov ' + (cls || ''); d.innerHTML = `<div class="panel">${html}</div>`; root.appendChild(d); return d; }
  function closeOv() { root.querySelectorAll('.ov').forEach(e => e.remove()); }
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; root.appendChild(d); setTimeout(() => d.remove(), 2500); }
  const ava = (p, txt, cls) => `<div class="ava ${cls || ''}" ${p ? `style="background-image:url('${esc(p)}')"` : ''}>${p ? '' : esc(txt)}</div>`;
  const initials = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
  function stopAll() {
    if (cur.stop) { cur.stop(); cur.stop = null; }
    if (cur.room) { cur.room.leave(); cur.room = null; }
    if (cur.ctl) { cur.ctl.leave(); cur.ctl = null; }
    clearInterval(hudT); game = null;
  }

  async function init(scene) {
    tb = scene; root = document.getElementById('ui');
    const u = await Platform.user();
    prof = { n: u ? (u.first_name + ' ' + (u.last_name ? u.last_name[0] + '.' : '')).trim() : S().guest, v: u ? u.id : 0, p: u ? (u.photo_100 || '') : '', r: S().r };
    Sfx.setSfx(S().sfx); Sfx.setMusic(S().mus);
    tb.events.on('layout', (L) => placeSeats(L));
    tb.events.on('view', (v, evs) => onView(v, evs));
    Platform.onPause(() => { if (game && game.kind === 'bot' && cur.ctl) cur.ctl.pause(true); });
    Platform.onResume(() => { if (game && game.kind === 'bot' && cur.ctl) cur.ctl.pause(false); });
    const m = /r([A-Z0-9]{5})/.exec(location.hash || '');
    if (m) { history.replaceState(null, '', location.pathname + location.search); joinRoom(m[1]); }
    else menu();
  }
  const syncProf = () => { prof.r = S().r; };

  /* ---------- Меню ---------- */
  function menu() {
    stopAll(); tb.showMenu(); syncProf();
    set(`<div class="menu">
      <div class="corner"><button class="btn ghost icon" id="snd">${S().sfx ? '🔊' : '🔇'}</button></div>
      <div class="logo"><b>${T.title}</b><i>${T.sub.toUpperCase()}</i></div>
      <div class="chips"><span class="chip">🏆 ${S().r}</span><span class="chip">🪙 ${S().coins}</span><span class="chip">${T.stats(S())}</span></div>
      <button class="btn gold big" id="on">⚡ ${T.playOnline}</button>
      <button class="btn big" id="fr">👥 ${T.playFriend}</button>
      <button class="btn green big" id="bot">🤖 ${T.playBot}</button>
      <p style="opacity:.75;font-size:13px;margin:6px 0 0;text-align:center">Игра без всплывающей рекламы</p>
      <div class="row"><button class="btn ghost sm" id="lb">🏆 ${T.rating}</button><button class="btn ghost sm" id="sh">🎴 ${T.shop}</button><button class="btn ghost sm ${Save.dailyReady() ? 'badge' : ''}" id="gf">🎁 ${T.gift}</button></div>
    </div>`);
    bind({ '#on': search, '#fr': friendMenu, '#bot': botMenu, '#lb': leaderboard, '#sh': shop, '#gf': daily,
      '#snd': () => { S().sfx = !S().sfx; Sfx.setSfx(S().sfx); Save.save(); menu(); } });
    if (Save.dailyReady() && !menu.shown) { menu.shown = true; setTimeout(() => { if (!root.querySelector('.ov') && !cur.room && !cur.stop && !game) daily(); }, 500); }
  }

  /* ---------- С компьютером ---------- */
  function botMenu() {
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.botTitle}</h2>
      <p>${T.players}</p><div class="seg" id="np">${[2, 3, 4].map(n => `<button data-v="${n}" class="${S().nb + 1 === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p>${T.level}</p><div class="seg" id="lv">${T.levels.map((t, i) => `<button data-v="${i}" class="${S().lvl === i ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="col" style="margin-top:16px"><button class="btn green big" id="go">▶ ${T.start}</button></div>`);
    d.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { click(); sg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }));
    bind({ '.x': closeOv, '#go': () => { S().nb = +$('#np .on', d).dataset.v - 1; S().lvl = +$('#lv .on', d).dataset.v; Save.save(); startBot(); } }, d);
  }
  function startBot() {
    stopAll(); syncProf();
    const seats = [{ kind: 'me', n: prof.n, p: prof.p, r: S().r }], used = [];
    for (let i = 0; i < S().nb; i++) { const f = T.botNames.filter(x => used.indexOf(x) < 0); const n = f[(Math.random() * f.length) | 0]; used.push(n); seats.push({ kind: 'bot', n, lvl: S().lvl, bot: true }); }
    const ctl = new LocalCtl(seats, 0); cur.ctl = ctl;
    playScreen(ctl, 'bot');
    ctl.start();
  }

  /* ---------- Быстрая игра онлайн ---------- */
  function search() {
    if (!Net.ready()) { toast(T.netSoon); return; }
    stopAll(); syncProf();
    const t0 = Date.now();
    const d = ov(`<h2>${T.searching}</h2><div class="spin"></div><p id="st">0:00</p><div class="col"><button class="btn ad" id="bt" style="display:none">🤖 ${T.searchBot}</button><button class="btn ghost" id="cn">${T.cancel}</button></div>`);
    const tick = setInterval(() => {
      const s = ((Date.now() - t0) / 1000) | 0; const e = $('#st', d); if (!e) { clearInterval(tick); return; }
      e.textContent = (s >= CFG.SEARCH_BOT_SEC ? T.searchLong + ' ' : '') + ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
      if (s >= CFG.SEARCH_BOT_SEC) $('#bt', d).style.display = '';
    }, 500);
    const stop = Online.search(prof, {
      found: (room) => { clearInterval(tick); cur.stop = null; useRoom(room, 'quick'); },
      error: () => { clearInterval(tick); cur.stop = null; closeOv(); toast(T.noNet); },
    });
    cur.stop = () => { clearInterval(tick); stop(); };
    bind({ '#cn': () => { stopAll(); closeOv(); }, '#bt': () => { stopAll(); S().nb = 1; startBot(); } }, d);
  }

  /* ---------- Стол с друзьями ---------- */
  function friendMenu() {
    if (!Net.ready()) { toast(T.netSoon); return; }
    let sz = 4;
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.friendTitle}</h2><p>${T.friendHint}</p>
      <p style="margin-bottom:6px">${T.players}</p><div class="seg" id="np">${[2, 3, 4].map(n => `<button data-v="${n}" class="${n === sz ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="col" style="margin-top:14px"><button class="btn gold" id="cr">➕ ${T.createRoom}</button>
      <p style="margin:8px 0 0">${T.enterCode}:</p><input class="inp" id="cd" maxlength="5" placeholder="•••••" autocomplete="off">
      <button class="btn green" id="jn">${T.join}</button></div>`);
    d.querySelectorAll('#np button').forEach(b => b.onclick = () => { click(); sz = +b.dataset.v; d.querySelectorAll('#np button').forEach(x => x.classList.toggle('on', x === b)); });
    bind({ '.x': closeOv, '#cr': () => createRoom(sz), '#jn': () => { const v = $('#cd', d).value.trim().toUpperCase(); if (v.length === 5) joinRoom(v); else Sfx.play('err'); } }, d);
  }
  async function createRoom(sz) {
    stopAll(); syncProf();
    ov(`<h2>${T.friendTitle}</h2><div class="spin"></div>`);
    let r; try { r = await Online.createRoom(prof, sz); } catch (_) { closeOv(); toast(T.noNet); return; }
    useRoom(r, 'room');
  }
  async function joinRoom(code) {
    if (!Net.ready()) { toast(T.netSoon); menu(); return; }
    stopAll(); syncProf(); if (!root.firstChild) menu();
    ov(`<h2>${T.friendTitle}</h2><div class="spin"></div>`);
    let r = null; try { r = await Online.joinRoom(code, prof); } catch (_) { closeOv(); toast(T.noNet); return; }
    if (!r) { closeOv(); toast(T.noRoom); return; }
    useRoom(r, 'room');
  }
  function lobby(r, seats) {
    const appId = Platform.appId || CFG.APP_ID, link = (!Platform.isVK && CFG.WEB_URL && r.code) ? CFG.WEB_URL + '#r' + r.code : appId && r.code ? `https://vk.com/app${appId}#r${r.code}` : '';
    const list = seats.map((s, i) => `<div class="lseat ${s ? '' : 'empty'}">${ava(s && s.p, s ? initials(s.n) : '+')}<b>${s ? esc(s.n) + (i === 0 ? ' 👑' : '') : T.emptySeat}</b>${s ? `<i>🏆 ${s.r}</i>` : ''}</div>`).join('');
    const full = seats.every(Boolean);
    let d = root.querySelector('.ov.lobby');
    const html = `<button class="btn ghost icon sm x">✕</button><h2>${T.roomCode}</h2><div class="code">${esc(r.code || '')}</div>
      <div class="lseats">${list}</div><p>${r.host ? T.waitFriends : T.waitHost}</p><div class="col">
      ${r.host ? `<button class="btn green" id="st">▶ ${full ? T.start : T.startBots}</button>` : ''}
      ${Platform.isVK && link ? `<button class="btn gold" id="iv">✉️ ${T.invite}</button>` : ''}
      <button class="btn" id="cp">📋 ${T.copyLink}</button></div>`;
    if (!d) d = ov(html, 'lobby'); else d.firstChild.innerHTML = html;
    bind({ '.x': () => { menu(); }, '#st': () => r.start(), '#iv': () => Platform.shareLink(link), '#cp': () => { Platform.copy(link ? T.inviteText(r.code) + ' ' + link : r.code); toast(T.copied); } }, d);
  }
  function useRoom(r, kind) {
    cur.room = r;
    if (kind === 'quick') ov(`<h2>${T.searching}</h2><div class="spin"></div>`);
    const mine = (f) => (a, b) => { if (cur.room === r) f(a, b); }; // события только от текущего стола
    r.on('lobby', mine((seats) => { if (kind === 'room') lobby(r, seats); }))
      .on('game', mine((ctl) => { cur.ctl = ctl; closeOv(); playScreen(ctl, kind, r); }))
      .on('emote', mine((i, x) => bubble(i, T.phrases[x], true)))
      .on('gone', mine((why) => onGone(why)))
      .on('error', mine(() => toast(T.noNet)));
  }
  function onGone(why) {
    const g = game, r = cur.room;
    cur.room = null; if (r) r.leave();
    if (why === 'lost') { toast(T.searchLong); search(); return; }
    if (g && g.v && !g.v.over && g.online) {
      if (r && r.humans0 === 2) { finish(g, 0, T.oppLeft); }
      else { restoreRating(); toast(T.hostLeft); setTimeout(() => { if (game === g) menu(); }, 1600); }
      return;
    }
    if (!g) { closeOv(); toast(T.noRoom); menu(); }
  }

  /* ---------- Игра ---------- */
  function playScreen(ctl, kind, room) {
    clearInterval(hudT);
    const online = kind !== 'bot';
    game = { ctl, kind, room, online, me: ctl.me, seats: ctl.seats, dlAt: 0, done: false, v: null, rated: false };
    set(`<div class="hud">
      <div class="corner l"><button class="btn ghost icon" id="ex">✕</button></div>
      <div class="corner"><button class="btn ghost icon" id="ph">💬</button><button class="btn ghost icon" id="snd">${S().sfx ? '🔊' : '🔇'}</button></div>
      <div id="seats"></div>
      <div class="ctrl" id="ctrl"><div class="mine" id="mine"></div><div class="status" id="status"></div><div class="act"><button class="btn" id="act" style="visibility:hidden"></button></div></div>
      <div class="tbadge" id="trump"></div>
    </div>`);
    bind({ '#ex': askLeave, '#ph': phrases, '#act': () => { const a = $('#act').dataset.a; if (a === 'take') ctl.take(); else if (a === 'pass') ctl.pass(); },
      '#snd': (e, b) => { S().sfx = !S().sfx; Sfx.setSfx(S().sfx); Save.save(); b.textContent = S().sfx ? '🔊' : '🔇'; } });
    tb.startGame(ctl.seats, ctl.me, ctl);
    ctl.onView((v, evs) => { if (game && game.ctl === ctl) { game.v = v; if (v.dl != null && !v.opt) game.dlAt = Date.now() + v.dl; } tb.show(v, evs); });
    hudT = setInterval(timers, 100);
    if (online) escrow();
  }
  function placeSeats(L) {
    const box = $('#seats'); if (!box || !game) return;
    let html = '';
    game.seats.forEach((st, i) => {
      if (i === game.me) return; const p = L.seats[i]; if (!p) return;
      html += `<div class="seat" data-i="${i}" style="left:${p.x}px;top:${p.y}px">${ava(st.p, st.bot ? '🤖' : initials(st.n))}<svg class="ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27"/></svg>
        <div class="nm">${esc(st.n)}</div><div class="role"></div><div class="bubs"></div></div>`;
    });
    box.innerHTML = html;
    const me = game.seats[game.me];
    const mine = $('#mine'); if (mine) mine.innerHTML = `<div class="seat my" data-i="${game.me}">${ava(me.p, initials(me.n))}<svg class="ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27"/></svg><div class="role"></div><div class="bubs"></div></div><div class="mynm">${esc(me.n)}</div>`;
    const c = $('#ctrl'); if (c) c.style.top = (L.ctrlY - 26) + 'px';
    const t = $('#trump'); if (t) { t.style.left = Math.max(6, L.deck.x - L.deck.cw * 0.5) + 'px'; t.style.top = (L.deck.y + L.deck.ch * 0.58) + 'px'; }
    if (game.v) hud(game.v);
  }
  const seatEl = (i) => root.querySelector(`.seat[data-i="${i}"]`);
  function bubble(i, text, phrase) {
    const e = seatEl(i); if (!e) return; const b = e.querySelector('.bubs'); if (!b) return;
    const d = document.createElement('div'); d.className = 'bubble' + (phrase ? ' ph' : ''); d.textContent = text; b.innerHTML = ''; b.appendChild(d);
    setTimeout(() => d.remove(), 2600); if (phrase) Sfx.play('msg', 0.7);
  }
  function onView(v, evs) {
    if (!game) return;
    for (const e of evs) {
      if (e.t === 'take') bubble(e.i, T.sTake);
      else if (e.t === 'pass') bubble(e.i, v.taking ? T.sPass : T.sBito);
      else if (e.t === 'out') { bubble(e.i, T.sOut); if (e.i === game.me) Sfx.play('win', 0.6); }
      else if (e.t === 'gone') { bubble(e.i, T.sGone); toast(game.seats[e.i].n + ': ' + T.sGone); }
    }
    if (!game.online) botTalk(v, evs);
    hud(v);
    if (v.over && !game.done) { const g = game; g.done = true; setTimeout(() => { if (game === g) finish(g, v.fool); }, 1100); }
  }
  // Компьютерные соперники иногда что-то говорят — так живее.
  function botTalk(v, evs) {
    for (const e of evs) {
      const bots = game.seats.map((s, i) => i).filter(i => game.seats[i].bot && !v.out[i] && i !== e.i);
      const say = (k) => { if (!bots.length || Math.random() > 0.3) return; const i = bots[(Math.random() * bots.length) | 0]; setTimeout(() => bubble(i, T.phrases[k], true), 500 + Math.random() * 600); };
      if (e.t === 'took' && e.i === game.me) say(8);
      if (e.t === 'deal' && Math.random() < 0.6) say(Math.random() < 0.5 ? 0 : 1);
      if (e.t === 'over') say(10);
    }
  }
  function hud(v) {
    if (!game) return;
    const me = game.me, ph = Rules.phase(v), nm = (i) => game.seats[i] ? game.seats[i].n : '';
    let st = '';
    if (!v.over) {
      if (ph === 'att') st = me === v.att ? T.myAttack : T.oppAttack(nm(v.att));
      else if (ph === 'def') st = me === v.def ? T.myDefend : T.oppDefend(nm(v.def)) + (Rules.legalAttacks(v, me).length ? T.canThrow : '');
      else if (me === v.def) st = v.taking ? T.oppTake('Вы') : T.waitThrow;
      else if (Rules.canPass(v, me)) st = v.taking ? T.myThrowTake : T.myThrow;
      else st = v.taking ? T.oppTake(nm(v.def)) : T.waitThrow;
      if (v.out[me]) st = T.sOut;
    }
    const se = $('#status'); if (se) { se.textContent = st; se.classList.toggle('me', !!st && (st === T.myAttack || st === T.myDefend || st === T.myThrow || st === T.myThrowTake)); }
    const b = $('#act');
    if (b) {
      let a = '', txt = '', cls = 'btn';
      if (!v.over && me === v.def && Rules.canTake(v)) { a = 'take'; txt = T.take; cls = 'btn red'; }
      else if (!v.over && Rules.canPass(v, me)) { a = 'pass'; txt = v.taking ? T.letTake : T.bito; cls = 'btn green'; }
      b.dataset.a = a; b.className = cls; b.textContent = txt; b.style.visibility = a ? 'visible' : 'hidden';
    }
    for (let i = 0; i < v.n; i++) {
      const e = seatEl(i); if (!e) continue;
      const r = e.querySelector('.role'); if (r) r.textContent = v.out[i] ? '🏁' : i === v.def ? '🛡' : i === v.att ? '⚔' : '';
      e.classList.toggle('out', !!v.out[i]); e.classList.toggle('fool', v.over && v.fool === i);
    }
    const tr = $('#trump'); if (tr) tr.innerHTML = `${T.trump}: <b class="s${v.trump}">${['♠', '♣', '♦', '♥'][v.trump]}&#xFE0E;</b>`;
  }
  // Кольца таймеров
  function timers() {
    const v = game && game.v; if (!v) return;
    const ph = Rules.phase(v), left = Math.max(0, game.dlAt - Date.now()), tot = (ph === 'throw' ? CFG.THROW_SEC : CFG.TURN_SEC) * 1000, f = Math.min(1, left / tot);
    for (let i = 0; i < v.n; i++) {
      const e = seatEl(i); if (!e) continue;
      const on = !v.over && (ph === 'att' ? i === v.att : ph === 'def' ? i === v.def : (Rules.isAttacker(v, i) && !v.passed[i] && Rules.legalAttacks(v, i).length > 0));
      const c = e.querySelector('.ring circle'); e.classList.toggle('act', on);
      if (c) { c.style.strokeDashoffset = on ? (170 * (1 - f)).toFixed(1) : 170; c.style.stroke = f < 0.25 ? '#ff4d4d' : '#ffd34d'; }
    }
  }
  function phrases() {
    if (root.querySelector('.phr')) { root.querySelector('.phr').remove(); return; }
    const d = document.createElement('div'); d.className = 'phr';
    d.innerHTML = T.phrases.map((p, i) => `<button data-i="${i}">${p}</button>`).join('');
    root.firstChild.appendChild(d);
    d.querySelectorAll('button').forEach(b => b.onclick = () => {
      click(); d.remove(); const i = +b.dataset.i;
      if (game && game.room) { if (game.room.emote(i)) bubble(game.me, T.phrases[i], true); }
      else if (game) { bubble(game.me, T.phrases[i], true); const bots = game.seats.map((s, k) => k).filter(k => game.seats[k].bot); if (bots.length && Math.random() < 0.7) setTimeout(() => bubble(bots[(Math.random() * bots.length) | 0], T.phrases[[0, 1, 2, 10, 11, 6][(Math.random() * 6) | 0]], true), 900); }
    });
  }
  function askLeave() {
    const d = ov(`<h2>${game && game.online && game.v && !game.v.over ? T.leaveQ : T.leaveQBot}</h2><div class="row"><button class="btn red" id="y">${T.yes}</button><button class="btn" id="n">${T.no}</button></div>`);
    bind({ '#y': () => { if (game && game.online && game.v && !game.v.over && game.rated) loseByLeave(); menu(); }, '#n': closeOv }, d);
  }

  /* ---------- Рейтинг онлайн: «залог» в начале партии ---------- */
  function escrow() {
    const g = game; if (!g.room || g.room.humans0 < 2) return;
    g.rated = true; g.r0 = S().r;
    const lossR = S().r + Online.delta(g.seats, g.me, g.me);
    S().pend = { r: lossR }; Save.save();
    Online.saveLb(Object.assign({}, prof, { r: lossR }), { w: S().w, l: S().l + 1 });
  }
  function restoreRating() { if (!game || !game.rated) return; S().pend = null; Save.save(); game.rated = false; Online.saveLb(prof, S()); }
  function loseByLeave() { const p = S().pend; if (p) { S().r = p.r; S().l++; S().games++; S().pend = null; Save.save(); syncProf(); Online.saveLb(prof, S()); } }

  /* ---------- Итог партии ---------- */
  function finish(g, fool, note) {
    if (!g || g.shown) return; g.shown = true;
    const me = g.me, win = fool !== me && fool >= 0, draw = fool < 0, online = g.online;
    let coins = online ? (win ? CFG.COINS.win : draw ? 20 : CFG.COINS.lose) : (win ? CFG.COINS.botWin : draw ? 10 : CFG.COINS.botLose);
    let dr = 0;
    if (g.rated) { dr = Online.delta(g.seats, me, fool); S().r = g.r0 + dr; S().pend = null; }
    if (win) S().w++; else if (!draw) S().l++;
    S().games++; S().coins += coins; Save.save(); syncProf();
    if (g.rated) Online.saveLb(prof, S());
    Sfx.play(win || draw ? 'win' : 'lose', 0.8); if (win) Sfx.play('chips', 0.8);
    Platform.gameOver();
    const places = (g.v ? g.v.places : []).map((i, k) => `<span>${k + 1}. ${esc(g.seats[i].n)}</span>`).join('');
    const d = ov(`<div class="big-t ${win ? 'win' : 'lose'}">${draw ? T.draw : win ? T.win : T.lose}</div>
      ${note ? `<p>${esc(note)}</p>` : (!draw && !win ? '' : fool >= 0 ? `<p>${T.foolIs(esc(g.seats[fool].n))}</p>` : '')}
      ${places && g.seats.length > 2 ? `<div class="places">${places}</div>` : ''}
      <div class="rw"><span>🪙 +<b id="cn">${coins}</b></span>${g.rated ? `<span>🏆 ${dr >= 0 ? '+' : ''}<b id="rd">${dr}</b></span>` : ''}</div>
      <div class="col">
        ${!win && g.rated && dr < 0 ? `<button class="btn ad" id="keep">📺 ${T.adKeep}</button>` : `<button class="btn ad" id="x2">📺 ${T.adX2}</button>`}
        <button class="btn gold" id="ag">🔁 ${T.again}</button>
        <div class="row">${win && Platform.isVK ? `<button class="btn ghost sm" id="shr">📣 ${T.share}</button>` : ''}<button class="btn ghost sm" id="mn">${T.toMenu}</button></div>
      </div>`, 'res');
    bind({
      '#x2': async (e, b) => { b.disabled = true; if (await Platform.rewarded()) { S().coins += coins; Save.save(); $('#cn', d).textContent = coins * 2; toast(T.adThanks); Sfx.play('chips'); } else b.disabled = false; },
      '#keep': async (e, b) => { b.disabled = true; if (await Platform.rewarded()) { S().r -= dr; Save.save(); syncProf(); Online.saveLb(prof, S()); $('#rd', d).textContent = 0; toast(T.adThanks); } else b.disabled = false; },
      '#ag': (e, b) => {
        if (g.kind === 'bot') return startBot();
        if (g.room && !g.room.closed) { g.room.again(); b.disabled = true; b.textContent = T.againWait; }
        else if (g.kind === 'quick') search(); else menu();
      },
      '#shr': () => Platform.share(T.shareText(S().w)), '#mn': menu,
    }, d);
  }

  /* ---------- Рейтинг ---------- */
  async function leaderboard() {
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.lbTitle}</h2><div class="spin"></div>`);
    bind({ '.x': closeOv }, d);
    let list = []; try { if (Net.ready()) list = await Online.top(); } catch (_) {}
    if (!root.contains(d)) return;
    const meU = Net.uid;
    const rows = list.slice(0, 30).map((x, i) => `<div class="${x.u === meU ? 'me' : ''}"><span class="n">${i + 1}</span><span class="a" ${x.p ? `style="background-image:url('${esc(x.p)}')"` : ''}></span><span class="nm">${esc(x.n)}</span><span class="r">🏆 ${x.r}</span></div>`).join('');
    d.firstChild.innerHTML = `<button class="btn ghost icon sm x">✕</button><h2>${T.lbTitle}</h2><div class="lb">${rows || `<p>${T.lbEmpty}</p>`}</div>
      <p>${T.lbMe}: 🏆 ${S().r} · ${T.stats(S())}</p>${Platform.isVK ? `<button class="btn ghost sm" id="vlb">VK</button>` : ''}`;
    bind({ '.x': closeOv, '#vlb': () => Platform.leaderboard(S().r) }, d);
  }

  /* ---------- Магазин ---------- */
  function shop(tab) {
    tab = tab === 't' ? 't' : 'b';
    const list = tab === 'b' ? T.backList : T.tableList, own = tab === 'b' ? S().ownB : S().ownT, sel = tab === 'b' ? S().bk : S().tb;
    const items = list.map(x => {
      const img = tab === 'b' ? Gfx.backPreview(x.id, 120) : Gfx.feltPreview(x.id, 160, 100);
      const has = own.indexOf(x.id) >= 0, on = sel === x.id;
      return `<div class="sk ${on ? 'on' : ''}"><img src="${img}" class="${tab === 'b' ? 'bk' : 'tb'}"><b>${x.name}</b>
        ${on ? `<button class="btn sm ghost" disabled>✓ ${T.chosen}</button>` : has ? `<button class="btn sm" data-c="${x.id}">${T.choose}</button>` : `<button class="btn sm gold" data-b="${x.id}" data-p="${x.price}">🪙 ${x.price}</button>`}</div>`;
    }).join('');
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.shopTitle}</h2>
      <div class="seg tabs"><button class="${tab === 'b' ? 'on' : ''}" id="tbB">${T.backs}</button><button class="${tab === 't' ? 'on' : ''}" id="tbT">${T.tables}</button></div>
      <p>🪙 ${S().coins}</p><div class="shop">${items}</div><button class="btn ad" id="adc">📺 ${T.adCoins}</button>`);
    const apply = (id) => { if (tab === 'b') { S().bk = id; tb.setBack(id); } else { S().tb = id; tb.setFelt(id); } Save.save(); shop(tab); };
    bind({ '.x': closeOv, '#tbB': () => shop('b'), '#tbT': () => shop('t'),
      '[data-c]': (e, b) => apply(b.dataset.c),
      '[data-b]': (e, b) => { const p = +b.dataset.p; if (S().coins < p) { toast(T.noCoins); Sfx.play('err'); return; } S().coins -= p; own.push(b.dataset.b); Sfx.play('chips'); apply(b.dataset.b); },
      '#adc': async (e, b) => { b.disabled = true; if (await Platform.rewarded()) { S().coins += CFG.COINS.ad; Save.save(); Sfx.play('chips'); shop(tab); } else b.disabled = false; } }, d);
  }

  /* ---------- Подарок дня ---------- */
  function daily() {
    const ready = Save.dailyReady(), y = new Date(Date.now() - 86400000), ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    const next = ready ? (S().day === ys ? S().streak + 1 : 1) : S().streak, curD = Math.min(next, 7);
    const days = CFG.COINS.daily.map((c, i) => `<div class="${i + 1 === curD ? 'cur' : i + 1 < curD ? 'got' : ''}">${T.dailyDay(i + 1)}<b>${c}</b></div>`).join('');
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.dailyTitle}</h2><div class="days">${days}</div><p>${T.dailyCome}</p>
      <button class="btn gold big" id="tk" ${ready ? '' : 'disabled'}>🪙 ${ready ? T.dailyTake + ' ' + CFG.COINS.daily[curD - 1] : '✓'}</button>`);
    bind({ '.x': () => { closeOv(); if (!game) menu(); }, '#tk': () => { const p = Save.takeDaily(); Sfx.play('chips'); toast('🪙 +' + p); closeOv(); menu(); } }, d);
  }

  return { init, menu, get game() { return game; } };
})();
