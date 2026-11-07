"use strict";
/* Связь с сервером Firebase Realtime Database — без библиотек: REST + поток событий (EventSource).
   Вход анонимный (refresh-токен хранится в браузере). Все пути — внутри ветки CFG.NET.root ('sb').
   Net.listen(path, cb) держит у себя копию данных и вызывает cb(копия) при каждом изменении. */
const Net = (() => {
  const C = (window.CFG && CFG.NET) || {}, LS = 'sb_net_v1';
  let st = {}; try { st = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (_) {}
  const saveSt = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (_) {} };
  let token = null, uid = null, exp = 0, authP = null;
  const ready = () => !!(C.db && C.key);
  // Для проверки на тестовом сервере (эмулятор Firebase) можно подменить адреса входа; в игре не используется.
  const AH = C.authHost || 'https://identitytoolkit.googleapis.com', SH = C.tokenHost || 'https://securetoken.googleapis.com', XQ = C.q ? '&' + C.q : '';
  const TS = { '.sv': 'timestamp' };

  async function doAuth() {
    let r;
    if (st.rt) {
      try {
        r = await fetch(`${SH}/v1/token?key=${C.key}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(st.rt) });
        if (r.ok) { const j = await r.json(); token = j.id_token; uid = j.user_id; st.rt = j.refresh_token; exp = Date.now() + (+j.expires_in) * 1000; saveSt(); return token; }
      } catch (_) {}
    }
    r = await fetch(`${AH}/v1/accounts:signUp?key=${C.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
    if (!r.ok) throw new Error('auth');
    const j = await r.json(); token = j.idToken; uid = j.localId; st.rt = j.refreshToken; exp = Date.now() + (+j.expiresIn) * 1000; saveSt();
    return token;
  }
  async function auth() {
    if (!ready()) throw new Error('cfg');
    if (token && Date.now() < exp - 120000) return token;
    if (!authP) authP = doAuth().finally(() => { authP = null; });
    return authP;
  }
  const url = (p, q) => `${C.db}/${C.root}/${p}.json?auth=${token}${XQ}${q ? '&' + q : ''}`;
  async function req(method, p, body, q) {
    await auth();
    const r = await fetch(url(p, q), { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) { const e = new Error('http' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  // Попытка записи, которая может быть запрещена правилами (занятая комната и т.п.): true/false
  async function tryReq(method, p, body) { try { await req(method, p, body); return true; } catch (e) { if (e.status === 401 || e.status === 403) return false; throw e; } }

  const PC = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  function pushId() { let t = Date.now(), s = ''; for (let i = 0; i < 8; i++) { s = PC.charAt(t % 64) + s; t = Math.floor(t / 64); } for (let i = 0; i < 12; i++) s += PC.charAt((Math.random() * 64) | 0); return s; }

  function setAt(obj, parts, val) {
    if (!parts.length) return val;
    if (obj === null || typeof obj !== 'object') obj = {};
    const k = parts[0], v = setAt(obj[k], parts.slice(1), val);
    if (v === null || v === undefined) delete obj[k]; else obj[k] = v;
    return obj;
  }
  // Подписка: держит копию ветки p. Возвращает функцию отписки.
  function listen(p, cb, q) {
    let es = null, data = null, closed = false, retry = 0, pend = false;
    const fire = () => { if (pend) return; pend = true; Promise.resolve().then(() => { pend = false; if (!closed) cb(data); }); };
    const onEv = (type) => (e) => {
      let j; try { j = JSON.parse(e.data); } catch (_) { return; }
      if (!j) return;
      const parts = j.path.split('/').filter(Boolean);
      if (type === 'put') data = setAt(data, parts, j.data);
      else if (j.data) for (const k in j.data) data = setAt(data, parts.concat(k.split('/').filter(Boolean)), j.data[k]);
      fire();
    };
    async function open() {
      if (closed) return;
      try { await auth(); } catch (_) { retry = setTimeout(open, 5000); return; }
      if (closed) return;
      es = new EventSource(url(p, q));
      es.addEventListener('put', onEv('put')); es.addEventListener('patch', onEv('patch'));
      es.addEventListener('auth_revoked', () => { token = null; reopen(); });
      es.addEventListener('cancel', () => { reopen(); });
    }
    function reopen() { if (es) { es.close(); es = null; } clearTimeout(retry); retry = setTimeout(open, 1500); }
    open();
    return () => { closed = true; clearTimeout(retry); if (es) es.close(); es = null; };
  }

  return {
    ready, auth, TS, pushId, listen, tryReq,
    get uid() { return uid; },
    get: (p, q) => req('GET', p, undefined, q),
    put: (p, v) => req('PUT', p, v),
    patch: (p, v) => req('PATCH', p, v),
    del: (p) => req('DELETE', p),
  };
})();
