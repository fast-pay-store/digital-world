"use strict";
/* Все экраны и окна (HTML поверх холста): меню, расстановка, поиск, комната друга, бой (верх/низ), итог, рейтинг, флот, подарок.
   cur — то, что надо закрыть при уходе с экрана (поиск, сессия, бой). */
const UI = (() => {
  let sea = null, root = null, prof = null, cur = { stop: null, battle: null, session: null }, hudT = 0;
  const $ = (s, e) => (e || root).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const click = () => Sfx.play('click', 0.7);
  function set(html, insT, insB) { closeOv(); root.innerHTML = `<div class="scr">${html}</div>`; sea.setInsets(insT || 0, insB || 0); return root.firstChild; }
  function bind(map, scope) { for (const k in map) { const e = (scope || root).querySelector(k); if (e) e.onclick = (ev) => { click(); map[k](ev); }; } }
  function ov(html, cls) { closeOv(); const d = document.createElement('div'); d.className = 'ov ' + (cls || ''); d.innerHTML = `<div class="panel">${html}</div>`; root.appendChild(d); return d; }
  function closeOv() { root.querySelectorAll('.ov').forEach(e => e.remove()); }
  function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; root.appendChild(d); setTimeout(() => d.remove(), 2500); }
  function stopAll() {
    if (cur.stop) { cur.stop(); cur.stop = null; }
    if (cur.battle) { cur.battle.destroy(); cur.battle = null; }
    if (cur.session) { cur.session.leave(); cur.session = null; }
    clearInterval(hudT);
  }
  const avaHtml = (p, emoji) => `<div class="ava" ${p ? `style="background-image:url('${esc(p)}')"` : ''}>${p ? '' : emoji}</div>`;
  const S = () => Save.d;

  async function init(scene) {
    sea = scene; root = document.getElementById('ui');
    const u = await Platform.user();
    prof = { n: u ? (u.first_name + ' ' + (u.last_name ? u.last_name[0] + '.' : '')).trim() : S().guest, v: u ? u.id : 0, p: u ? (u.photo_100 || '') : '', r: S().r, sk: S().sk };
    Sfx.setSfx(S().sfx); Sfx.setMusic(S().mus); Sfx.music(true);
    const m = /r([A-Z0-9]{5})/.exec(location.hash || '');
    if (m) { history.replaceState(null, '', location.pathname + location.search); place('join', m[1]); }
    else menu();
  }
  const syncProf = () => { prof.r = S().r; prof.sk = S().sk; };

  /* ---------- Меню ---------- */
  function menu() {
    stopAll(); sea.showMenu(); syncProf();
    set(`<div class="menu">
      <div class="corner"><button class="btn ghost icon" id="snd">${S().sfx ? '🔊' : '🔇'}</button><button class="btn ghost icon" id="mus">${S().mus ? '🎵' : '🚫'}</button></div>
      <div class="logo"><b>${T.title}</b><i>${T.sub.toUpperCase()}</i></div>
      <div class="chips"><span class="chip">🏆 ${S().r}</span><span class="chip">🪙 ${S().coins}</span><span class="chip">${T.stats(S())}</span></div>
      <button class="btn gold big" id="on">⚔️ ${T.playOnline}</button>
      <button class="btn big" id="fr">👥 ${T.playFriend}</button>
      <button class="btn green big" id="bot">🤖 ${T.playBot}</button>
      <p style="opacity:.75;font-size:13px;margin:6px 0 0;text-align:center">Игра без всплывающей рекламы</p>
      <div class="row"><button class="btn ghost sm" id="lb">🏆 ${T.rating}</button><button class="btn ghost sm" id="sh">⚓ ${T.fleet}</button><button class="btn ghost sm ${Save.dailyReady() ? 'badge' : ''}" id="gf">🎁 ${T.gift}</button></div>
    </div>`);
    bind({ '#on': () => place('online'), '#fr': friendMenu, '#bot': () => place('bot'), '#lb': leaderboard, '#sh': shop, '#gf': daily,
      '#snd': () => { S().sfx = !S().sfx; Sfx.setSfx(S().sfx); Save.save(); menu(); },
      '#mus': () => { S().mus = !S().mus; Sfx.setMusic(S().mus); Save.save(); menu(); } });
    if (Save.dailyReady() && !menu.shown) { menu.shown = true; setTimeout(daily, 500); }
  }
  function friendMenu() {
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.friendTitle}</h2><div class="col">
      <button class="btn gold" id="cr">➕ ${T.createRoom}</button>
      <p style="margin:6px 0 0">${T.enterCode}:</p><input class="inp" id="cd" maxlength="5" placeholder="•••••" autocomplete="off">
      <button class="btn green" id="jn">${T.join}</button></div>`);
    bind({ '.x': closeOv, '#cr': () => place('room'), '#jn': () => { const v = $('#cd', d).value.trim().toUpperCase(); if (v.length === 5) place('join', v); else Sfx.play('err'); } }, d);
  }

  /* ---------- Расстановка ---------- */
  // what: online | room | join (code) | bot | rematch (сессия)
  function place(what, arg) {
    if (what !== 'rematch') stopAll();
    let ships = Rules.random();
    sea.showPlace(ships, S().sk, () => {});
    const sc = set(`<div class="bar top" style="flex-direction:column;justify-content:center;gap:2px"><div class="title">${T.place}</div><div class="hint">${T.placeHint}</div></div>
      <div class="bar bot" style="gap:10px"><button class="btn ghost" id="bk">← ${T.back}</button><button class="btn" id="rn">🎲 ${T.random}</button><button class="btn gold" id="go">${T.ready}</button></div>`, 64, 72);
    bind({ '#bk': () => { if (what === 'rematch' && arg) arg.leave(); cur.session = null; menu(); }, '#rn': () => { ships = Rules.random(); sea.setShips(ships); Sfx.play('build', 0.7); },
      '#go': () => { const sh = sea.place.ships.map(s => ({ len: s.len, x: s.x, y: s.y, v: s.v })); if (!Rules.validFleet(sh)) { Sfx.play('err'); return; } go(what, arg, sh); } });
    if (what === 'rematch' && arg) { cur.session = arg; arg.on('oppLeft', () => toast(T.oppLeft)).on('gone', () => toast(T.oppLeft)); }
  }
  function go(what, arg, ships) {
    if (what === 'bot') return startBot(ships);
    if (!Net.ready()) { toast(T.netSoon); return; }
    if (what === 'online') return search(ships);
    if (what === 'room') return room(ships);
    if (what === 'join') return join(arg, ships);
    if (what === 'rematch') return rematchReady(arg, ships);
  }

  /* ---------- Поиск ---------- */
  function search(ships) {
    syncProf();
    const t0 = Date.now();
    const d = ov(`<h2>${T.searching}</h2><div class="spin"></div><p id="st">0:00</p><div class="col"><button class="btn ad" id="bt" style="display:none">🤖 ${T.searchBot}</button><button class="btn ghost" id="cn">${T.cancel}</button></div>`);
    const tick = setInterval(() => {
      const s = ((Date.now() - t0) / 1000) | 0; const e = $('#st', d); if (!e) { clearInterval(tick); return; }
      e.textContent = (s >= CFG.SEARCH_BOT_SEC ? T.searchLong + ' ' : '') + ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
      if (s >= CFG.SEARCH_BOT_SEC) $('#bt', d).style.display = '';
    }, 500);
    const stop = Online.search(prof, ships, {
      found: (session) => { clearInterval(tick); cur.stop = null; waitStart(session, ships); },
      error: () => { clearInterval(tick); cur.stop = null; closeOv(); toast(T.noNet); },
    });
    cur.stop = () => { clearInterval(tick); stop(); };
    bind({ '#cn': () => { stopAll(); closeOv(); }, '#bt': () => { stopAll(); startBot(ships); } }, d);
  }

  /* ---------- Комната друга ---------- */
  async function room(ships) {
    syncProf();
    const d = ov(`<h2>${T.friendTitle}</h2><div class="spin"></div>`);
    let r; try { r = await Online.createRoom(prof, ships); } catch (_) { closeOv(); toast(T.noNet); return; }
    cur.session = r.session;
    const appId = Platform.appId || CFG.APP_ID, link = (!Platform.isVK && CFG.WEB_URL && r.code) ? CFG.WEB_URL + '#r' + r.code : appId ? `https://vk.com/app${appId}#r${r.code}` : '';
    const d2 = ov(`<h2>${T.roomCode}</h2><div class="code">${r.code}</div><p>${T.waitFriend}</p><div class="col">
      ${Platform.isVK && link ? `<button class="btn gold" id="iv">✉️ ${T.invite}</button>` : ''}
      <button class="btn" id="cp">📋 ${T.copyLink}</button><button class="btn ghost" id="cn">${T.cancel}</button></div>`);
    bind({ '#iv': () => Platform.shareLink(link), '#cp': () => { Platform.copy(link ? T.inviteText(r.code) + ' ' + link : r.code); toast(T.copied); }, '#cn': () => { stopAll(); closeOv(); } }, d2);
    waitStart(r.session, ships, true);
  }
  async function join(code, ships) {
    syncProf();
    ov(`<h2>${T.friendTitle}</h2><div class="spin"></div>`);
    let s = null; try { s = await Online.joinRoom(code, prof, ships); } catch (_) { closeOv(); toast(T.noNet); return; }
    if (!s) { closeOv(); toast(T.noRoom); return; }
    waitStart(s, ships);
  }
  function rematchReady(session, ships) {
    Online.secretOf(ships).then(sec => session.setSecret(sec));
    ov(`<h2>${T.rematch}</h2><div class="spin"></div><p>${T.waitOpp}</p><div class="col"><button class="btn ghost" id="cn">${T.cancel}</button></div>`);
    bind({ '#cn': () => { stopAll(); menu(); } }, root.querySelector('.ov'));
    waitStart(session, ships, true);
  }
  // Ждём, пока оба готовы (отпечатки расстановок есть), затем бой
  function waitStart(session, ships, keepOv) {
    cur.session = session;
    if (!keepOv) ov(`<h2>${T.searching}</h2><div class="spin"></div><p>${T.waitOpp}</p>`);
    session.on('start', ({ first, opp }) => { closeOv(); startNet(session, ships, first, opp); })
      .on('oppLost', () => { stopAll(); closeOv(); toast(T.oppLeft); menu(); })
      .on('gone', () => { if (!cur.battle) { stopAll(); toast(T.oppLeft); menu(); } });
  }

  /* ---------- Бой ---------- */
  function startBot(ships) {
    stopAll(); syncProf();
    const b = new Battle({ mode: 'bot', ships, first: Math.random() < 0.5 ? 'me' : 'opp', turnSec: 0 });
    const opp = { name: T.bot, r: 0, sk: ['pirate', 'arctic', 'steel'][(Math.random() * 3) | 0], p: '' };
    const bot = new BotOpp(b, 0.28);
    battleScreen(b, opp, null, bot);
  }
  function startNet(session, ships, first, opp) {
    const b = new Battle({ mode: 'net', ships, first, turnSec: CFG.TURN_SEC });
    session.attach(b);
    session.on('gone', () => { if (!b.over) b.finish(true, 'left'); });
    battleScreen(b, opp, session, null);
  }
  function battleScreen(b, opp, session, bot) {
    cur.battle = b; cur.session = session;
    sea.showBattle(b, S().sk, opp.sk);
    const net = !!session;
    set(`<div class="bar top">
        <div class="pl" id="pm">${avaHtml(prof.p, '⚓')}<div class="nm"><b>${esc(prof.n)}</b><i>${net ? '🏆 ' + S().r : ''}</i></div></div>
        <div class="turn" id="tn"><b></b>${net ? '<div class="tm"><i></i></div>' : ''}</div>
        <div class="pl r" id="po">${avaHtml(opp.p, bot ? '🤖' : '🏴‍☠️')}<div class="nm"><b>${esc(opp.name)}</b><i>${net ? '🏆 ' + opp.r : ''}</i></div></div>
      </div>
      <div class="bar bot" style="justify-content:space-between"><button class="btn ghost icon" id="sr" title="${T.surrender}">🏳️</button><button class="btn ghost" id="ph">💬 Фразы</button><button class="btn ghost icon" id="snd">${S().sfx ? '🔊' : '🔇'}</button></div>`, 64, 68);
    const tn = $('#tn'), tm = $('.tm i');
    const upd = () => { const me = b.turn === 'me'; tn.className = 'turn ' + (me ? 'me' : 'op'); $('b', tn).textContent = b.over ? '' : me ? T.yourTurn : T.oppTurn; };
    upd(); b.on('turn', upd);
    if (net) hudT = setInterval(() => { if (tm) tm.style.width = (b.timeLeft() / CFG.TURN_SEC * 100) + '%'; }, 200);
    b.on('turn', () => { if (b.turn === 'me') Sfx.play('select', 0.5); });
    b.on('emote', ({ by, x }) => bubble(by === 'me' ? '#pm' : '#po', T.phrases[x]));
    b.on('end', (e) => { clearInterval(hudT); upd(); const tmb = $('.tm'); if (tmb) tmb.style.visibility = 'hidden'; setTimeout(() => result(b, e, opp, session, bot), e.why === 'win' ? 1400 : 300); });
    bind({
      '#sr': () => { const d = ov(`<h2>${T.surrenderQ}</h2><div class="row"><button class="btn ghost" id="no">${T.no}</button><button class="btn" id="ys">${T.yes}</button></div>`); bind({ '#no': closeOv, '#ys': () => { closeOv(); if (b.over) menu(); else b.surrender(); } }, d); },
      '#ph': () => phrases(b),
      '#snd': (ev) => { S().sfx = !S().sfx; Sfx.setSfx(S().sfx); Save.save(); ev.currentTarget.textContent = S().sfx ? '🔊' : '🔇'; },
    });
  }
  function phrases(b) {
    const old = $('.phr'); if (old) { old.remove(); return; }
    const d = document.createElement('div'); d.className = 'phr';
    d.innerHTML = T.phrases.map((p, i) => `<button data-i="${i}">${p}</button>`).join('');
    d.onclick = (e) => { const t = e.target.closest('button'); if (!t) return; b.emote(+t.dataset.i); Sfx.play('msg', 0.6); d.remove(); };
    root.firstChild.appendChild(d);
  }
  function bubble(sel, text) {
    const pl = $(sel); if (!pl) return; const old = pl.querySelector('.bubble'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'bubble'; d.textContent = text; pl.appendChild(d); Sfx.play('msg', 0.5);
    setTimeout(() => d.remove(), 2900);
  }

  /* ---------- Итог ---------- */
  function result(b, e, opp, session, bot) {
    const net = !!session, win = e.win;
    let dr = 0, coins;
    if (net) {
      dr = Online.elo(S().r, opp.r, win); S().r = Math.max(0, S().r + dr);
      if (win) S().w++; else S().l++;
      coins = win ? CFG.COINS.win : CFG.COINS.lose;
    } else { if (win) S().bw++; else S().bl++; coins = win ? CFG.COINS.botWin : CFG.COINS.botLose; }
    S().coins += coins; Save.save(); syncProf();
    if (typeof Retention !== 'undefined') Retention.moment();   // конец боя — спокойный момент
    if (net) Online.saveLb(prof, S());
    if (bot) sea.revealEnemy(bot.revealShips());
    if (session) session.on('reveal', ({ ships, fair }) => { if (ships) sea.revealEnemy(ships); else if (!fair && !win) { toast(T.whyCheat); } });
    Sfx.play(win ? 'win' : 'lose');
    const why = win ? ({ left: T.whyLeft, surr: T.whySurr, time: T.whyTime }[e.why] || '') : '';
    const acc = b.myShotsCount ? Math.round(b.myHits / b.myShotsCount * 100) : 0;
    const d = ov(`<div class="big-t ${win ? 'win' : 'lose'}">${win ? T.win : T.lose}</div>${why ? `<p>${why}</p>` : ''}
      <div class="rw">${net ? `<span>🏆 ${dr >= 0 ? '+' : ''}${dr}</span>` : ''}<span id="cn">🪙 +${coins}</span><span>🎯 ${acc}%</span></div>
      <div class="col">
        ${win ? `<button class="btn ad" id="x2">🎬 ${T.adX2}</button>` : ''}
        ${!win && net && dr < 0 ? `<button class="btn ad" id="kp">🎬 ${T.adKeep}</button>` : ''}
        ${net ? `<button class="btn gold" id="rm">🔁 ${T.rematch}</button>` : `<button class="btn gold" id="ag">🔁 ${T.rematch}</button>`}
        <div class="row">${win && Platform.isVK ? `<button class="btn sm" id="shr">📣 ${T.share}</button>` : ''}<button class="btn ghost sm" id="hg">${T.phrases[10]}</button><button class="btn ghost sm" id="mn">${T.toMenu}</button></div>
      </div>`);
    d.style.background = 'rgba(2,12,28,.35)';
    bind({
      '#x2': async (ev) => { const btn = ev.currentTarget; btn.disabled = true; if (await Platform.rewarded()) { S().coins += coins; Save.save(); $('#cn', d).textContent = '🪙 +' + coins * 2; toast(T.adThanks); } else btn.disabled = false; },
      '#kp': async (ev) => { const btn = ev.currentTarget; btn.disabled = true; if (await Platform.rewarded()) { S().r -= dr; Save.save(); syncProf(); Online.saveLb(prof, S()); dr = 0; d.querySelector('.rw span').textContent = '🏆 0'; toast(T.adThanks); } else btn.disabled = false; },
      '#rm': (ev) => { ev.currentTarget.disabled = true; ev.currentTarget.textContent = T.rematchWait; session.askRematch(); },
      '#ag': () => place('bot'),
      '#shr': () => Platform.share(T.shareText(S().w + S().bw)),
      '#hg': (ev) => { b.emote(10); ev.currentTarget.disabled = true; },
      '#mn': () => menu(),
    }, d);
    if (session) {
      session.on('rematchAsk', () => { const r = $('#rm', d); if (r && !r.disabled) { r.textContent = '🔁 ' + T.rematchAsk; r.classList.add('green'); } session.tryRematch(); })
        .on('rematch', (gid) => { const s2 = Online.rematchSession(gid, session.side, prof); session.leave(); cur.session = null; cur.battle = null; b.destroy(); place('rematch', s2); })
        .on('oppLeft', () => { const r = $('#rm', d); if (r) { r.disabled = true; r.textContent = T.oppLeft; } });
    }
  }

  /* ---------- Рейтинг ---------- */
  async function leaderboard() {
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.lbTitle}</h2><div class="lb"><div class="spin" style="background:none"></div></div>`);
    bind({ '.x': closeOv }, d);
    let list = []; try { await Net.auth(); list = await Online.top(); } catch (_) { $('.lb', d).innerHTML = `<p>${T.noNet}</p>`; return; }
    const me = Net.uid;
    $('.lb', d).innerHTML = list.length ? list.map((x, i) => `<div class="${x.u === me ? 'me' : ''}"><span class="n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="a" ${x.p ? `style="background-image:url('${esc(x.p)}')"` : ''}></span><span class="nm">${esc(x.n || T.guest)}</span><span class="r">${x.r}</span></div>`).join('') : `<p>${T.lbEmpty}</p>`;
    if (!list.some(x => x.u === me)) $('.lb', d).insertAdjacentHTML('beforeend', `<div class="me"><span class="n">—</span><span class="nm">${T.lbMe}</span><span class="r">${S().r}</span></div>`);
  }

  /* ---------- Флот ---------- */
  function shop() {
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.shopTitle}</h2><p>🪙 ${S().coins}</p><div class="shop">${T.skins.map(s => {
      const own = S().own.indexOf(s.id) >= 0, on = S().sk === s.id;
      return `<div class="sk ${on ? 'on' : ''}"><img src="${Gfx.preview(s.id)}" alt=""><b>${s.name}</b>${on ? `<span class="hint">${T.chosen}</span>` : own ? `<button class="btn sm" data-c="${s.id}">${T.choose}</button>` : `<button class="btn gold sm" data-b="${s.id}">🪙 ${s.price}</button>`}</div>`;
    }).join('')}</div><button class="btn ad" id="ad">🎬 ${T.adCoins}</button>`);
    bind({ '.x': () => { closeOv(); menu(); }, '#ad': async (ev) => { ev.currentTarget.disabled = true; if (await Platform.rewarded()) { S().coins += CFG.COINS.ad; Save.save(); Sfx.play('upgrade'); } shop(); } }, d);
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { click(); S().sk = b.dataset.c; Save.save(); syncProf(); shop(); });
    d.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      const s = T.skins.find(x => x.id === b.dataset.b);
      if (S().coins < s.price) { Sfx.play('err'); toast(T.noCoins); return; }
      S().coins -= s.price; S().own.push(s.id); S().sk = s.id; Save.save(); syncProf(); Sfx.play('upgrade'); shop();
    });
  }

  /* ---------- Подарок дня ---------- */
  function daily() {
    const ready = Save.dailyReady(), y = new Date(Date.now() - 86400000), ys = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    const next = ready ? (S().day === ys ? Math.min(S().streak + 1, 7) : 1) : S().streak;
    const d = ov(`<button class="btn ghost icon sm x">✕</button><h2>${T.dailyTitle}</h2><div class="days">${CFG.COINS.daily.map((c, i) => `<div class="${i + 1 === next ? 'cur' : i + 1 < next ? 'got' : ''}">${T.dailyDay(i + 1)}<b>${c}</b></div>`).join('')}</div>
      <p>${T.dailyCome}</p>${ready ? `<button class="btn gold" id="tk">🪙 ${T.dailyTake}</button>` : ''}`);
    bind({ '.x': () => { closeOv(); menu(); }, '#tk': () => { const p = Save.takeDaily(); Sfx.play('win', 0.7); toast('🪙 +' + p); closeOv(); menu(); } }, d);
  }

  return { init, menu, toast };
})();
