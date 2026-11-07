"use strict";
/* Platform — единый слой VK: реклама, сохранение, пауза, соц. функции.
   Внутри VK: в URL есть vk_app_id. Иначе локальный режим (двойной клик) — всё работает, реклама пропускается.
   Реклама: только за награду (по кнопке) и постоянный баннер resize. Межстраничной нет — она перекрывает игру сама. */
const Platform = (() => {
  const q = new URLSearchParams(location.search);
  const B = window.vkBridge;
  const isVK = !!(B && q.has('vk_app_id'));
  let lastAd = 0, games = 0, busy = false, hidden = false, bannerOn = false;
  const subs = { pause: [], resume: [] };
  const emit = (ev) => subs[ev].forEach(f => { try { f(); } catch (_) {} });
  const send = (m, p) => isVK ? B.send(m, p) : Promise.reject(new Error('local'));
  const preload = (fmt) => { if (isVK) send('VKWebAppCheckNativeAds', { ad_format: fmt }).catch(() => {}); };

  function setHidden(h) { if (h === hidden) return; hidden = h; emit(h ? 'pause' : 'resume'); }

  async function init() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    document.addEventListener('visibilitychange', () => setHidden(document.hidden || busy));
    if (!isVK) return;
    B.subscribe(e => {
      const t = e && e.detail && e.detail.type;
      if (t === 'VKWebAppViewHide') setHidden(true);
      if (t === 'VKWebAppViewRestore' && !busy) setHidden(false);
    });
    await Promise.race([send('VKWebAppInit').catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
    preload('reward');
  }

  async function showAd(fmt) {
    if (!isVK || busy) return false;
    busy = true; setHidden(true);
    let ok = false;
    try { const r = await send('VKWebAppShowNativeAds', { ad_format: fmt }); ok = !!(r && r.result); } catch (_) {}
    busy = false; lastAd = Date.now(); preload(fmt);
    if (!document.hidden) setHidden(false);
    return ok;
  }

  return {
    isVK,
    lang: (q.get('vk_language') || 'ru'),
    init,
    onPause(f) { subs.pause.push(f); },
    onResume(f) { subs.resume.push(f); },
    /** Конец забега/уровня. Межстраничной рекламы НЕТ (правило владельца: реклама сама не перекрывает игру). */
    async gameOver() { games++; return false; },
    /** Реклама за награду. true — награду выдать. Локально — всегда true (для проверки). */
    async rewarded() { return isVK ? showAd('reward') : true; },
    /** Постоянный баннер снизу: окно игры уменьшается (resize), баннер НЕ поверх игры. Вызывать один раз при запуске. */
    banner() {
      if (!isVK || bannerOn) return; bannerOn = true;
      send('VKWebAppShowBannerAd', { banner_location: 'bottom', layout_type: 'resize', can_close: false }).catch(() => { bannerOn = false; });
    },
    /** Сохранение: localStorage всегда + облако VK. Значение — объект, ≤4 КБ в JSON. */
    async load(key) {
      let local = null, cloud = null;
      try { local = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
      if (isVK) { try { const r = await send('VKWebAppStorageGet', { keys: [key] }); const v = r.keys[0].value; if (v) cloud = JSON.parse(v); } catch (_) {} }
      if (local && cloud) return (cloud._t || 0) > (local._t || 0) ? cloud : local;
      return cloud || local || {};
    },
    save(key, obj) {
      obj._t = Date.now();
      const s = JSON.stringify(obj);
      try { localStorage.setItem(key, s); } catch (_) {}
      if (isVK) send('VKWebAppStorageSet', { key, value: s }).catch(() => {});
    },
    share(text) { if (isVK) send('VKWebAppShowWallPostBox', { message: text }).catch(() => {}); },
    invite() { if (isVK) send('VKWebAppShowInviteBox').catch(() => {}); },
    /** Данные игрока ВК {id, first_name, last_name, photo_100} или null (локально). */
    async user() { if (!isVK) return null; if (!this._u) this._u = send('VKWebAppGetUserInfo').catch(() => null); return this._u; },
    /** Поделиться ссылкой (личные сообщения/стена — выбирает игрок). */
    shareLink(link) { if (isVK) return send('VKWebAppShare', { link }).catch(() => {}); return Promise.resolve(); },
    copy(text) { if (isVK) return send('VKWebAppCopyText', { text }).catch(() => {}); try { return navigator.clipboard.writeText(text); } catch (_) { return Promise.resolve(); } },
    appId: +(q.get('vk_app_id') || 0),
    leaderboard(score) { if (isVK) send('VKWebAppShowLeaderBoardBox', { user_result: score }).catch(() => {}); },
  };
})();
