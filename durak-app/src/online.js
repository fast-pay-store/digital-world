"use strict";
/* Игра между людьми через Net (Firebase). Ветка /dk:
   q/<uid>        — очередь быстрой игры 1 на 1: {n имя, r рейтинг, v id ВК, p фото, t время, c — id стола (кто забрал)}
   t/<tid>        — стол (виден всем): h — uid хозяина, sz — мест, st — 0 ждём / 1 играем, x — номер партии, room — код (стол с друзьями),
                    s/<i> — место {u, n, r, v, p} или бот {bot:1, n, lvl}; m/<uid> — номер места;
                    g — открытое состояние партии (строка JSON, пишет только хозяин), a/<id> — ходы гостей {u, m, x},
                    e/<id> — фразы {u, x, t}, p/<uid> — «на связи», lf/<uid> — ушёл, rm/<uid> — «ещё раз» (номер партии).
   k/<tid>/<uid>  — карты игрока «шаг:карты» (читает только он сам, пишет хозяин).
   lb/<uid>       — таблица рейтинга {n, r, w, l, v, p, t}.
   Партию считает хозяин стола (Match): получает ходы гостей, проверяет их по правилам и рассылает состояние. */
const Online = (() => {
  const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = (n) => { let s = ''; for (let i = 0; i < n; i++) s += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; return s; };
  const seatOf = (prof) => ({ u: Net.uid, n: prof.n, r: prof.r, v: prof.v || 0, p: prof.p || '' });
  const enc = (m) => m.t === 'a' ? 'a' + m.c : m.t === 'd' ? 'd' + m.k + ',' + m.c : m.t === 'take' ? 't' : 'p';
  const dec = (s) => { s = String(s || ''); const t = s[0]; if (t === 'a') return { t: 'a', c: +s.slice(1) }; if (t === 'd') { const [k, c] = s.slice(1).split(','); return { t: 'd', k: +k, c: +c }; } if (t === 't') return { t: 'take' }; if (t === 'p') return { t: 'pass' }; return null; };
  const botName = (used) => { const f = T.botNames.filter(x => used.indexOf(x) < 0); return (f.length ? f : T.botNames)[(Math.random() * (f.length || T.botNames.length)) | 0]; };

  /* ---------- Быстрая игра 1 на 1 ---------- */
  function search(prof, on) {
    let stopped = false, unl = null, refT = 0, scanT = 0, queued = false;
    const me = () => Net.uid;
    const stop = () => { stopped = true; clearInterval(refT); clearInterval(scanT); if (unl) unl(); unl = null; };
    const entry = () => ({ n: prof.n, r: prof.r, v: prof.v || 0, p: prof.p || '', t: Net.TS });
    async function claim(meQueued) {
      let q;
      try { q = await Net.get('q', 'orderBy=%22t%22&startAt=' + (Date.now() - 60000)); } catch (_) { return false; }
      if (stopped || !q) return false;
      const now = Date.now();
      const cand = Object.keys(q).filter(u => u !== me() && q[u] && !q[u].c && now - (q[u].t || 0) < 30000 && (!meQueued || u < me()))
        .sort((x, y) => Math.abs((q[x].r || 0) - prof.r) - Math.abs((q[y].r || 0) - prof.r));
      for (const u of cand) {
        if (stopped) return false;
        if (meQueued) { if (!(await Net.tryReq('PUT', `q/${me()}/c`, 'x'))) return false; }
        const tid = 'q' + Net.pushId();
        if (await Net.tryReq('PUT', `q/${u}/c`, tid)) {
          const e = q[u], m = {}; m[me()] = 0; m[u] = 1;
          await Net.put(`t/${tid}`, { h: me(), sz: 2, st: 0, x: 0, t: Net.TS, quick: 1, s: { 0: seatOf(prof), 1: { u, n: e.n, r: e.r, v: e.v || 0, p: e.p || '' } }, m });
          if (meQueued) Net.del(`q/${me()}`).catch(() => {});
          stop(); on.found(new Room(tid, true, prof, { autoStart: true })); return true;
        }
        if (meQueued) { await Net.put(`q/${me()}`, entry()); }
      }
      return false;
    }
    (async () => {
      try { await Net.auth(); } catch (_) { on.error && on.error('net'); return; }
      if (stopped) return;
      if (await claim(false)) return;
      if (stopped) return;
      try { await Net.put(`q/${me()}`, entry()); queued = true; } catch (_) { on.error && on.error('net'); return; }
      unl = Net.listen(`q/${me()}/c`, (c) => {
        if (stopped || typeof c !== 'string' || c === 'x') return;
        stop(); Net.del(`q/${me()}`).catch(() => {});
        on.found(new Room(c, false, prof));
      });
      refT = setInterval(() => { if (!stopped) Net.patch(`q/${me()}`, { t: Net.TS }).catch(() => {}); }, 8000);
      scanT = setInterval(() => { if (!stopped) claim(true).catch(() => {}); }, 4000);
    })();
    return () => { if (stopped) return; stop(); if (queued) Net.del(`q/${me()}`).catch(() => {}); };
  }

  /* ---------- Стол с друзьями ---------- */
  async function createRoom(prof, sz) {
    await Net.auth();
    for (let i = 0; i < 6; i++) {
      const code = rnd(5), tid = 'r' + code, m = {}; m[Net.uid] = 0;
      if (await Net.tryReq('PUT', `t/${tid}`, { h: Net.uid, sz, st: 0, x: 0, t: Net.TS, room: code, s: { 0: seatOf(prof) }, m })) return new Room(tid, true, prof);
    }
    throw new Error('room');
  }
  async function joinRoom(code, prof) {
    await Net.auth();
    code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const tid = 'r' + code;
    let t; try { t = await Net.get(`t/${tid}`); } catch (_) { t = null; }
    if (!t || t.st !== 0) return null;
    if (t.m && t.m[Net.uid] != null) return new Room(tid, t.h === Net.uid, prof);
    for (let i = 1; i < t.sz; i++) {
      if (t.s && t.s[i]) continue;
      const up = {}; up['s/' + i] = seatOf(prof); up['m/' + Net.uid] = i;
      if (await Net.tryReq('PATCH', `t/${tid}`, up)) return new Room(tid, false, prof);
    }
    return null;
  }

  /* ---------- Стол: и у хозяина, и у гостя ---------- */
  class Room {
    constructor(tid, host, prof, opt) {
      this.tid = tid; this.host = host; this.prof = prof; this.opt = opt || {}; this.t = null; this.cb = {}; this.closed = false;
      this.x = 0; this.ctl = null; this.seenE = null; this.seenA = {}; this.lastP = {}; this.pubS = null; this.hand = null; this.created = Date.now();
      this.unl = Net.listen(`t/${tid}`, (t) => this.onData(t));
      if (!host) this.unk = Net.listen(`k/${tid}/${Net.uid}`, (h) => { this.hand = h; this.guestRender(); });
      this.hb = setInterval(() => this.beat(), 8000); this.beat();
      this.wd = setInterval(() => this.watch(), 1000);
    }
    on(e, f) { this.cb[e] = f; return this; }
    call(e, a, b) { const f = this.cb[e]; if (f) f(a, b); }
    beat() { if (!this.closed) Net.put(`t/${this.tid}/p/${Net.uid}`, Net.TS).catch(() => {}); }
    get code() { return this.t && this.t.room; }
    get mySeat() { return this.t && this.t.m ? this.t.m[Net.uid] : -1; }
    seatsList() { const t = this.t, r = []; for (let i = 0; i < (t ? t.sz : 0); i++) r.push(t.s && t.s[i] ? t.s[i] : null); return r; }

    onData(t) {
      if (this.closed) return;
      const had = !!this.t; this.t = t;
      if (!t) { if (had) { this.call('gone', 'host'); this.close(); } return; }
      if (t.m && t.m[Net.uid] == null && had && !this.host) { this.call('gone', 'kicked'); this.close(); return; }
      const now = Date.now();
      if (t.p) for (const u in t.p) if (t.p[u] !== (this.lastP[u] || {}).v) this.lastP[u] = { v: t.p[u], at: now };
      // фразы
      const E = t.e || {};
      if (!this.seenE) { this.seenE = {}; for (const k in E) this.seenE[k] = 1; }
      for (const k of Object.keys(E).sort()) { if (this.seenE[k]) continue; this.seenE[k] = 1; const e = E[k]; if (e && t.m && t.m[e.u] != null && e.u !== Net.uid) this.call('emote', t.m[e.u], e.x); }
      if (t.st === 0) { this.call('lobby', this.seatsList()); if (this.host && this.opt.autoStart && !this.autoT) this.autoT = setTimeout(() => this.start(), 400); return; }
      // партия
      if (t.x !== this.x) { this.x = t.x; this.pubS = null; this.newGame(); }
      if (this.host) { this.hostActions(); this.hostWatchLeft(); this.hostRematch(); }
      else {
        let p = null; try { p = t.g ? JSON.parse(t.g) : null; } catch (_) {}
        if (p && p.x === this.x) { this.pubS = p; this.guestRender(); }
        if (t.lf && t.lf[t.h]) this.hostGone();
      }
    }
    // Хозяин: начать партию (свободные места — компьютер)
    async start() {
      const t = this.t; if (!this.host || !t || this.closed) return;
      if (this.opt.autoStart) { // быстрая игра: ждём, пока соперник появится на связи (до 12 с)
        const opp = t.s[1] && t.s[1].u;
        if (opp && !(this.lastP[opp]) && Date.now() - this.created < 12000) { this.autoT = setTimeout(() => this.start(), 500); return; }
        if (opp && !this.lastP[opp]) { this.call('gone', 'lost'); this.leave(); return; }
      }
      const s = {}, used = [];
      for (let i = 0; i < t.sz; i++) { const x = t.s && t.s[i]; if (x && !x.bot && !(t.lf && t.lf[x.u])) s[i] = x; else { const n = (x && x.bot) ? x.n : botName(used); used.push(n); s[i] = { bot: 1, n, lvl: 1 }; } }
      const up = { s, st: 1, x: (t.x || 0) + 1, a: null, rm: null, g: null };
      try { await Net.patch(`t/${this.tid}`, up); } catch (_) { this.call('error'); }
    }
    newGame() {
      const t = this.t, seats = [];
      for (let i = 0; i < t.sz; i++) {
        const x = t.s[i];
        seats.push(x.bot ? { kind: 'bot', n: x.n, lvl: x.lvl == null ? 1 : x.lvl, r: CFG.START_RATING, bot: true }
          : { kind: x.u === Net.uid ? 'me' : 'net', n: x.n, r: x.r || CFG.START_RATING, v: x.v || 0, p: x.p || '', u: x.u });
      }
      const me = t.m[Net.uid];
      if (this.ctl) this.ctl.leave();
      this.humans0 = seats.filter(x => !x.bot).length;
      if (this.host) {
        const ctl = new LocalCtl(seats, me); this.ctl = ctl; this.seenA = {};
        for (const k in (t.a || {})) this.seenA[k] = 1;
        ctl.m.on((pub) => this.publish(pub));
        ctl.m.onIdle = () => {};
        this.call('game', ctl);
        ctl.start();
      } else {
        const ctl = new GuestCtl(seats, me, this); this.ctl = ctl;
        this.call('game', ctl);
      }
    }
    publish(pub) {
      if (this.closed) return;
      const m = this.ctl.m, up = {}; pub.x = this.x;
      up[`t/${this.tid}/g`] = JSON.stringify(pub);
      m.seats.forEach((st, i) => { if (st.kind === 'net' && !st.gone) up[`k/${this.tid}/${st.u}`] = pub.st + ':' + m.s.hands[i].join(','); });
      Net.patch('', up).catch(() => {});
    }
    hostActions() {
      const A = this.t.a || {}, ctl = this.ctl; if (!ctl) return;
      for (const k of Object.keys(A).sort()) {
        if (this.seenA[k]) continue; this.seenA[k] = 1;
        const a = A[k]; if (!a || a.x !== this.x) continue;
        const i = ctl.seats.findIndex(st => st.u === a.u && st.kind === 'net'); if (i < 0) continue;
        const m = dec(a.m); if (!m) continue;
        ctl.seats[i].idle = 0;
        if (!ctl.m.act(i, m)) ctl.m.flush();
      }
    }
    hostWatchLeft() {
      const t = this.t, ctl = this.ctl; if (!ctl || !t.lf) return;
      ctl.seats.forEach((st, i) => { if (st.kind === 'net' && !st.gone && t.lf[st.u]) this.hostDrop(i); });
    }
    hostDrop(i) {
      const ctl = this.ctl, m = ctl.m; if (m.s.over) { ctl.seats[i].gone = true; return; }
      const left = ctl.seats.filter((st, k) => k !== i && st.kind !== 'bot' && !st.gone).length;
      if (this.humans0 === 2 && left === 1) { ctl.seats[i].gone = true; Rules.leave(m.s, i); m.flush(); }
      else m.replaceWithBot(i);
    }
    hostRematch() {
      const t = this.t, ctl = this.ctl; if (!ctl || !ctl.v || !ctl.v.over || this.rmT) return;
      const rm = t.rm || {}, lf = t.lf || {};
      const humans = ctl.seats.filter(st => st.kind !== 'bot' && !st.gone && !lf[st.u]);
      if (humans.length && humans.every(st => rm[st.u] === this.x)) { this.rmT = setTimeout(() => { this.rmT = 0; this.start(); }, 300); }
    }
    hostGone() { if (this.ctl && !this.closed && !this.goneSent) { this.goneSent = true; this.call('gone', 'host'); } }
    guestRender() {
      const p = this.pubS, h = this.hand; if (!p || !this.ctl || this.closed) return;
      let hs = -1, cards = [];
      if (typeof h === 'string') { const i = h.indexOf(':'); hs = +h.slice(0, i); cards = h.slice(i + 1) ? h.slice(i + 1).split(',').map(Number) : []; }
      if (hs !== p.st) { clearTimeout(this.rT); if (hs < p.st) this.rT = setTimeout(() => this.guestApply(p, cards), 700); return; }
      clearTimeout(this.rT); this.guestApply(p, cards);
    }
    guestApply(p, cards) { if (this.lastSt === p.st || !this.ctl) return; this.lastSt = p.st; this.ctl.incoming(p, cards); }
    watch() {
      if (this.closed || !this.t) return;
      const now = Date.now(), lost = (u) => { const l = this.lastP[u]; return l && now - l.at > CFG.LOST_SEC * 1000; };
      if (this.host && this.ctl && this.t.st === 1) this.ctl.seats.forEach((st, i) => { if (st.kind === 'net' && !st.gone && lost(st.u)) this.hostDrop(i); });
      if (!this.host && this.t.st === 1 && (lost(this.t.h) || !this.lastP[this.t.h] && now - this.created > CFG.LOST_SEC * 1000)) this.hostGone();
    }
    send(m) { const id = Net.pushId(); Net.put(`t/${this.tid}/a/${id}`, { u: Net.uid, m: enc(m), x: this.x }).catch(() => {}); }
    emote(i) {
      const now = Date.now(); if (now - (this.lastEm || 0) < 1500) return false; this.lastEm = now;
      const id = Net.pushId(); if (this.seenE) this.seenE[id] = 1;
      Net.put(`t/${this.tid}/e/${id}`, { u: Net.uid, x: i, t: Net.TS }).catch(() => {}); return true;
    }
    again() { Net.put(`t/${this.tid}/rm/${Net.uid}`, this.x).catch(() => {}); }
    close() { if (this.closed) return; this.closed = true; clearInterval(this.hb); clearInterval(this.wd); clearTimeout(this.autoT); clearTimeout(this.rT); clearTimeout(this.rmT); if (this.unl) this.unl(); if (this.unk) this.unk(); if (this.ctl) this.ctl.leave(); }
    leave() {
      const t = this.t, wasHost = this.host; this.close();
      if (!t) return;
      if (t.st === 0) { // ещё в комнате ожидания
        if (wasHost) Net.del(`t/${this.tid}`).catch(() => {});
        else { const i = t.m && t.m[Net.uid]; const up = {}; if (i != null) up['s/' + i] = null; up['m/' + Net.uid] = null; Net.patch(`t/${this.tid}`, up).catch(() => {}); }
        return;
      }
      const others = Object.keys(t.m || {}).filter(u => u !== Net.uid && !(t.lf && t.lf[u]));
      if (wasHost && others.length === 0) Net.del(`t/${this.tid}`).catch(() => {});
      else Net.put(`t/${this.tid}/lf/${Net.uid}`, 1).catch(() => {});
    }
  }

  // Гость: состояние приходит от хозяина, свои ходы уходят на сервер.
  class GuestCtl extends Ctl {
    constructor(seats, me, room) { super(seats, me); this.room = room; this.lastSt = -1; }
    incoming(p, cards) {
      const v = Match.view(p, cards, this.me);
      // события для анимации: хозяин присылает только итог, поэтому восстанавливаем главное по разнице
      const evs = [], prev = this.v;
      if (!prev) evs.push({ t: 'deal' });
      else {
        const was = new Set(); prev.table.forEach(x => { was.add(x.a); if (x.d >= 0) was.add(x.d); });
        v.table.forEach((x, k) => { if (!was.has(x.a)) evs.push({ t: 'a', i: -1, c: x.a }); if (x.d >= 0 && !was.has(x.d)) evs.push({ t: 'd', i: v.def, k, c: x.d }); });
        if (prev.table.length && !v.table.length) { if (v.hands[prev.def].length > prev.hands[prev.def].length) evs.push({ t: 'took', i: prev.def }); else evs.push({ t: 'bito' }); }
        // кто подкинул: у кого стало меньше карт
        const add = evs.filter(e => e.t === 'a');
        if (add.length) for (let i = 0; i < v.n; i++) if (i !== v.def && v.hands[i].length < prev.hands[i].length && i !== this.me) { add.forEach(e => { if (e.i < 0) e.i = i; }); break; }
        if (prev.taking !== v.taking && v.taking) evs.push({ t: 'take', i: v.def });
        for (let i = 0; i < v.n; i++) { if (v.passed[i] && !prev.passed[i]) evs.push({ t: 'pass', i }); if (v.out[i] && !prev.out[i]) evs.push({ t: 'out', i }); if (v.gone[i] && !prev.gone[i]) evs.push({ t: 'gone', i }); }
        if (v.over && !prev.over) evs.push({ t: 'over', i: v.fool });
      }
      this.emit(v, evs);
    }
    send(m) {
      if (!this.v) return;
      this.room.send(m);
      const ev = m.t === 'a' ? [{ t: 'a', i: this.me, c: m.c }] : m.t === 'd' ? [{ t: 'd', i: this.me, k: m.k, c: m.c }] : m.t === 'take' ? [{ t: 'take', i: this.me }] : [{ t: 'pass', i: this.me }];
      this.emit(optimistic(this.v, this.me, m), ev);
    }
  }

  /* ---------- Рейтинг ---------- */
  const E = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  // Изменение рейтинга игрока i по итогу партии (fool — номер дурака, -1 — ничья)
  function delta(seats, i, fool) {
    const K = CFG.ELO_K, n = seats.length, R = (k) => seats[k].r || CFG.START_RATING;
    if (fool < 0) return 0;
    if (i === fool) { let s = 0; for (let k = 0; k < n; k++) if (k !== i) s += R(k); return -Math.round(K * E(R(i), s / (n - 1))); }
    return Math.max(1, Math.round(K * (1 - E(R(i), R(fool))) / (n - 1)));
  }
  function saveLb(prof, stats) { return Net.put(`lb/${Net.uid}`, { n: prof.n, r: prof.r, w: stats.w, l: stats.l, v: prof.v || 0, p: prof.p || '', t: Net.TS }).catch(() => {}); }
  async function top() { const d = await Net.get('lb', 'orderBy=%22r%22&limitToLast=50'); return Object.keys(d || {}).map(k => Object.assign({ u: k }, d[k])).filter(x => (x.t || 0) >= (CFG.LB_SINCE || 0)).sort((a, b) => b.r - a.r); }

  return { search, createRoom, joinRoom, delta, saveLb, top, Room };
})();
