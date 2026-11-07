"use strict";
/* Retention — общий для всех игр «уютный» модуль возвращения игрока + статистика удержания.
   Оригинал: Игры ВК/_инструменты/retention.js (копии в src/ игр обновляет _инструменты/sync_retention.sh).
   Подключение (после platform.js):  <script src="src/retention.js" data-game="dk" data-multi="1"></script>
     data-game  — короткий код игры (ветка статистики st/<код>)
     data-multi — 1, если в игру интереснее играть с другом (тогда иногда предлагаем позвать друга)
   Игра в удобный момент (конец партии/уровня, сбор урожая) зовёт Retention.moment(). У игр с Platform.gameOver() это делается само.
   Бережность (правило «уюта»): не больше ОДНОЙ маленькой карточки за заход, только в спокойный момент,
   не раньше 2 минут игры, каждое предложение — не больше 2 раз за всё время (повтор — через 5+ дней), без наград за согласие. */
const Retention = (() => {
  const GROUP_ID = 242536931;                      // сообщество vk.com/uyutnye_igry
  const DB = 'https://tower-defense-vk-chat-default-rtdb.europe-west1.firebasedatabase.app';
  const KEY = 'AIzaSyCHyyzhFGuAJVu-J7EA8KH67EohlMQVbIk';
  const me = document.currentScript || {};
  const GAME = (me.dataset && me.dataset.game) || 'x';
  const MULTI = !!(me.dataset && me.dataset.multi === '1');
  const q = new URLSearchParams(location.search);
  const B = window.vkBridge, isVK = !!(B && q.has('vk_app_id'));
  const LS = 'rt_v1_' + GAME, DAYMS = 864e5;
  const day = () => Math.floor((Date.now() + 3 * 3600e3) / DAYMS);   // день по Москве
  let S = {}; try { S = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (_) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (_) {} };
  const send = (m, p) => isVK ? B.send(m, p) : Promise.reject(new Error('local'));
  let started = false, shownThisSession = false, playMs = 0, lastTick = 0, minSent = 0;

  /* ---------- статистика (Firebase, ветка st/<игра>/<uid>) ---------- */
  const Net = (() => {
    let tok = null, uid = null, exp = 0, p = null;
    async function auth() {
      if (tok && Date.now() < exp - 120000) return true;
      if (p) return p;
      p = (async () => {
        let j = null;
        if (S.rt) {
          try {
            const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.rt) });
            if (r.ok) { const k = await r.json(); j = { t: k.id_token, u: k.user_id, r: k.refresh_token, e: k.expires_in }; }
          } catch (_) {}
        }
        if (!j) {
          const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
          if (!r.ok) return false;
          const k = await r.json(); j = { t: k.idToken, u: k.localId, r: k.refreshToken, e: k.expiresIn };
        }
        tok = j.t; uid = j.u; S.rt = j.r; exp = Date.now() + (+j.e) * 1000; save(); return true;
      })().catch(() => false).finally(() => { p = null; });
      return p;
    }
    async function patch(obj) {
      try { if (!await auth()) return; await fetch(`${DB}/st/${GAME}/${uid}.json?auth=${tok}`, { method: 'PATCH', body: JSON.stringify(obj) }); } catch (_) {}
    }
    return { patch };
  })();

  function plat() { const p = q.get('vk_platform') || (isVK ? 'vk' : 'local'); return p.slice(0, 20); }
  function statStart() {
    const d = day();
    if (!S.f) S.f = d;
    if (S.l !== d) { S.dd = (S.dd || 0) + 1; S.l = d; S.dm = 0; }
    S.s = (S.s || 0) + 1; save();
    if (!isVK) return;                                           // локальные запуски (двойной клик) в статистику не пишем
    const o = { f: S.f, l: d, s: S.s, dd: S.dd, p: plat() };
    const v = +(q.get('vk_user_id') || 0); if (v) o.v = v;
    o.n = q.get('vk_are_notifications_enabled') === '1' ? 1 : 0;
    o.fv = q.get('vk_is_favorite') === '1' ? 1 : 0;
    o['d/' + d] = S.dm || 0;
    Net.patch(o);
  }
  function statMinutes() {                                       // раз в 3 минуты игры — сколько играли сегодня
    const m = Math.floor(playMs / 60000);
    if (m - minSent < 3) return;
    minSent = m; S.dm = (S.dm || 0) + 3; S.m = (S.m || 0) + 3; save();
    if (isVK) { const o = { m: S.m }; o['d/' + day()] = S.dm; Net.patch(o); }
  }
  function statFlag(k) { if (isVK) { const o = {}; o[k] = 1; Net.patch(o); } }

  /* ---------- маленькая карточка в стиле игр ---------- */
  let css = false;
  function addCss() {
    if (css) return; css = true;
    const st = document.createElement('style');
    st.textContent = `.rt-card{position:fixed;left:50%;bottom:14px;z-index:99999;width:min(340px,calc(100vw - 24px));transform:translate(-50%,140%);
background:#fff7e8;color:#5b3d2a;border-radius:20px;padding:14px 16px 14px;box-shadow:0 6px 0 #e4c9a4,0 10px 28px rgba(80,50,20,.25);
font:600 15px/1.35 Nunito,'Segoe UI Rounded','Arial Rounded MT Bold',system-ui,sans-serif;transition:transform .45s cubic-bezier(.34,1.56,.64,1);user-select:none}
.rt-card.on{transform:translate(-50%,0)}.rt-card .rt-t{display:flex;gap:10px;align-items:center}.rt-card .rt-i{font-size:30px;line-height:1;flex:none}
.rt-card .rt-b{display:flex;gap:8px;margin-top:12px}.rt-card button{flex:1;border:0;border-radius:14px;padding:10px 8px;font:800 15px Nunito,system-ui,sans-serif;cursor:pointer;
background:#ffd66e;color:#6b4214;box-shadow:0 4px 0 #d9a83c;transition:transform .08s}.rt-card button.rt-no{background:#f1e3cc;color:#8a6a4e;box-shadow:0 4px 0 #d8c3a3}
.rt-card button:active{transform:translateY(3px) scale(.97);box-shadow:0 1px 0 #d9a83c}`;
    document.head.appendChild(st);
  }
  function card(icon, text, yes, no, onYes, onNo) {
    addCss();
    const c = document.createElement('div'); c.className = 'rt-card';
    c.innerHTML = `<div class="rt-t"><div class="rt-i">${icon}</div><div>${text}</div></div><div class="rt-b"><button class="rt-no">${no}</button><button class="rt-yes">${yes}</button></div>`;
    document.body.appendChild(c);
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('on')));
    let done = false;
    const close = (ok) => { if (done) return; done = true; clearTimeout(t); c.classList.remove('on'); setTimeout(() => c.remove(), 500); (ok ? onYes : onNo)(); };
    c.querySelector('.rt-yes').onclick = () => close(true);
    c.querySelector('.rt-no').onclick = () => close(false);
    const t = setTimeout(() => close(false), 15000);       // сама тихо уезжает, если игрок занят
  }

  /* ---------- предложения: по одному, по очереди, бережно ---------- */
  const A = () => (S.a || (S.a = {}));                      // a[k] = {n: сколько раз спрашивали, d: день, ok: 1}
  function canAsk(k) { const r = A()[k]; if (!r) return true; if (r.ok || r.n >= 2) return false; return day() - r.d >= 5; }
  function asked(k, ok) { const r = A()[k] || (A()[k] = { n: 0 }); r.n++; r.d = day(); if (ok) r.ok = 1; save(); }

  const OFFERS = [
    { k: 'fav', when: () => q.get('vk_is_favorite') !== '1' && (S.m || 0) + playMs / 60000 >= 3,
      show: () => card('⭐', 'Нравится игра? Добавьте её в избранное — она всегда будет под рукой.', 'В избранное', 'Не сейчас',
        () => send('VKWebAppAddToFavorites').then(() => { asked('fav', 1); statFlag('fv'); }).catch(() => asked('fav')), () => asked('fav')) },
    { k: 'grp', when: () => (S.dd || 0) >= 2,
      show: () => card('🏡', 'В нашем уютном сообществе — новые уровни, обновления и новые игры. Заглянете?', 'Вступить', 'Позже',
        () => send('VKWebAppJoinGroup', { group_id: GROUP_ID }).then(() => { asked('grp', 1); statFlag('g'); }).catch(() => asked('grp')), () => asked('grp')) },
    { k: 'ntf', when: () => (S.dd || 0) >= 2 && q.get('vk_are_notifications_enabled') !== '1',
      show: () => card('🔔', 'Можно иногда тихонько напоминать об игре? Не чаще раза в несколько дней.', 'Можно', 'Не надо',
        () => send('VKWebAppAllowNotifications').then(() => { asked('ntf', 1); statFlag('n'); }).catch(() => asked('ntf')), () => asked('ntf')) },
    { k: 'home', when: () => (S.dd || 0) >= 3 && /android/.test(q.get('vk_platform') || '') && S.homeOk === 1,
      show: () => card('📱', 'Поставить игру значком на главный экран телефона? Запускать будет быстрее.', 'Поставить', 'Не нужно',
        () => send('VKWebAppAddToHomeScreen').then(() => asked('home', 1)).catch(() => asked('home')), () => asked('home')) },
    { k: 'inv', when: () => MULTI && (S.s || 0) >= 3,
      show: () => card('🤝', 'С другом играть веселее! Позовёте кого-нибудь?', 'Позвать', 'Потом',
        () => send('VKWebAppShowInviteBox').then(() => asked('inv', 1)).catch(() => asked('inv')), () => asked('inv')) },
  ];

  function moment() {
    if (!started || shownThisSession || !isVK || document.hidden) return;
    if (playMs < 120000) return;                             // в первые 2 минуты захода ничего не предлагаем
    for (const o of OFFERS) {
      if (!canAsk(o.k)) continue;
      let ok = false; try { ok = o.when(); } catch (_) {}
      if (!ok) continue;
      shownThisSession = true;
      setTimeout(() => { if (!document.hidden) o.show(); }, 1200);   // дать игроку увидеть итог партии
      return;
    }
  }

  function tick() {
    const now = performance.now();
    if (!document.hidden && lastTick) playMs += Math.min(now - lastTick, 15000);
    lastTick = now;
    statMinutes();
  }

  function init() {
    if (started) return; started = true;
    statStart();
    lastTick = performance.now(); setInterval(tick, 10000);
    document.addEventListener('visibilitychange', () => { tick(); lastTick = performance.now(); });
    let P = null; try { P = (typeof Platform !== 'undefined') ? Platform : null; } catch (_) {}   // const Platform не попадает в window
    if (P && typeof P.gameOver === 'function' && !P._rt) {         // конец партии = спокойный момент
      const g = P.gameOver.bind(P); P._rt = 1;
      P.gameOver = function () { const r = g.apply(null, arguments); moment(); return r; };
    }
    if (isVK && /android/.test(q.get('vk_platform') || '')) {
      setTimeout(() => send('VKWebAppAddToHomeScreenInfo').then(r => { S.homeOk = (r && r.is_feature_supported && !r.is_added_to_home_screen) ? 1 : 0; save(); }).catch(() => {}), 5000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);

  return { moment, init, _state: () => S, _card: card };
})();
