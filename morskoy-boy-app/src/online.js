"use strict";
/* Игра между людьми через Net (Firebase). Схема данных в ветке /sb:
   q/<uid>      — очередь поиска: {n имя, r рейтинг, v id ВК, sk флот, p фото, t время, c — кто забрал (id игры)}
   g/<id>       — бой: a,b — uid игроков; an/bn имена, ar/br рейтинг, av/bv id ВК, as/bs флот, ap/bp фото,
                  ah/bh — «отпечаток» расстановки (хэш), f — кто ходит первым ('a'|'b'), t — время создания,
                  s/<n> — выстрелы по порядку {u кто, c клетка, r ответ 0/1/2, k потопленный корабль},
                  e/<id> — фразы {u, x номер, t}, p/<uid> — «я на связи», w — итог {u победитель, why},
                  rv/<uid> — раскрытая расстановка (проверка честности), rm/<uid> — хочу реванш, nx — id реванша, lf/<uid> — ушёл.
   Комнаты для друга: g/r<КОД>. lb/<uid> — таблица рейтинга {n, r, w, l, v, t}. */
const Online = (() => {
  const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = (n) => { let s = ''; for (let i = 0; i < n; i++) s += CODE_ABC[(Math.random() * CODE_ABC.length) | 0]; return s; };
  async function hash(str) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      let h1 = 0x811c9dc5, h2 = 0x01000193;
      for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
      return 'f' + h1.toString(16) + h2.toString(16);
    }
  }
  async function secretOf(ships) { const enc = Rules.encode(ships), salt = rnd(12); return { enc, salt, h: await hash(enc + '|' + salt) }; }
  const side = (prof, sec, pre) => { const o = {}; o[pre] = Net.uid; o[pre + 'n'] = prof.n; o[pre + 'r'] = prof.r; o[pre + 'v'] = prof.v || 0; o[pre + 's'] = prof.sk; o[pre + 'p'] = prof.p || ''; if (sec) o[pre + 'h'] = sec.h; return o; };

  /* ---------- Поиск случайного соперника ---------- */
  function search(prof, ships, on) {
    let stopped = false, unl = null, refT = 0, scanT = 0, queued = false, sec = null;
    const me = () => Net.uid;
    const stop = () => { stopped = true; clearInterval(refT); clearInterval(scanT); if (unl) unl(); unl = null; };
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
        const gid = Net.pushId();
        if (await Net.tryReq('PUT', `q/${u}/c`, gid)) {
          const e = q[u], g = Object.assign(side(prof, sec, 'a'), { b: u, bn: e.n, br: e.r, bv: e.v || 0, bs: e.sk, bp: e.p || '', f: Math.random() < 0.5 ? 'a' : 'b', t: Net.TS });
          await Net.put(`g/${gid}`, g);
          if (meQueued) Net.del(`q/${me()}`).catch(() => {});
          stop(); on.found(new Session(gid, 'a', sec, prof)); return true;
        }
        if (meQueued) { await Net.put(`q/${me()}`, entry()); }
      }
      return false;
    }
    const entry = () => ({ n: prof.n, r: prof.r, v: prof.v || 0, sk: prof.sk, p: prof.p || '', t: Net.TS });
    (async () => {
      try { await Net.auth(); sec = await secretOf(ships); } catch (_) { on.error && on.error('net'); return; }
      if (stopped) return;
      if (await claim(false)) return;
      if (stopped) return;
      try { await Net.put(`q/${me()}`, entry()); queued = true; } catch (_) { on.error && on.error('net'); return; }
      unl = Net.listen(`q/${me()}/c`, (c) => {
        if (stopped || typeof c !== 'string' || c === 'x') return;
        stop(); Net.del(`q/${me()}`).catch(() => {});
        Net.put(`g/${c}/bh`, sec.h).catch(() => {});
        on.found(new Session(c, 'b', sec, prof));
      });
      refT = setInterval(() => { if (!stopped) Net.patch(`q/${me()}`, { t: Net.TS }).catch(() => {}); }, 8000);
      scanT = setInterval(() => { if (!stopped) claim(true).catch(() => {}); }, 4000);
    })();
    return () => { if (stopped) return; stop(); if (queued) Net.del(`q/${me()}`).catch(() => {}); };
  }

  /* ---------- Комната для друга ---------- */
  async function createRoom(prof, ships) {
    await Net.auth();
    const sec = await secretOf(ships);
    for (let i = 0; i < 6; i++) {
      const code = rnd(5), gid = 'r' + code;
      const g = Object.assign(side(prof, sec, 'a'), { f: Math.random() < 0.5 ? 'a' : 'b', t: Net.TS, room: 1 });
      if (await Net.tryReq('PUT', `g/${gid}`, g)) return { code, session: new Session(gid, 'a', sec, prof) };
    }
    throw new Error('room');
  }
  async function joinRoom(code, prof, ships) {
    await Net.auth();
    code = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const gid = 'r' + code;
    let g; try { g = await Net.get(`g/${gid}`); } catch (_) { g = null; }
    if (!g || g.b || g.w || g.a === Net.uid) return null;
    const sec = await secretOf(ships);
    if (!(await Net.tryReq('PATCH', `g/${gid}`, side(prof, sec, 'b')))) return null;
    return new Session(gid, 'b', sec, prof);
  }

  /* ---------- Один бой по сети ---------- */
  class Session {
    constructor(gid, sideKey, sec, prof) {
      this.gid = gid; this.side = sideKey; this.os = sideKey === 'a' ? 'b' : 'a'; this.sec = sec; this.prof = prof;
      this.g = null; this.b = null; this.done = 0; this.seenE = {}; this.lastOpp = performance.now(); this.oppP = null;
      this.cb = {}; this.seen = {}; this.lastEmote = 0; this.revealed = false; this.closed = false; this.started = false; this.created = performance.now();
      this.unl = Net.listen(`g/${gid}`, (g) => this.onData(g));
      this.hb = setInterval(() => { if (!this.closed) Net.put(`g/${gid}/p/${Net.uid}`, Net.TS).catch(() => {}); }, 8000);
      Net.put(`g/${gid}/p/${Net.uid}`, Net.TS).catch(() => {});
      this.wd = setInterval(() => this.watch(), 1000);
    }
    on(e, f) { this.cb[e] = f; return this; }
    call(e, d) { const f = this.cb[e]; if (f) f(d); }
    get oppUid() { return this.g && this.g[this.os]; }
    oppInfo() { const g = this.g, o = this.os; return { name: g[o + 'n'] || T.guest, r: g[o + 'r'] || CFG.START_RATING, v: g[o + 'v'] || 0, sk: g[o + 's'] || 'steel', p: g[o + 'p'] || '' }; }
    attach(battle) { this.b = battle; battle.opp = this; this.process(); }
    setSecret(sec) { this.sec = sec; return Net.put(`g/${this.gid}/${this.side}h`, sec.h).catch(() => {}); }
    // Копия данных меняется на месте, поэтому «новое ли событие» помним сами (once)
    once(k) { if (this.seen[k]) return false; this.seen[k] = 1; return true; }
    onData(g) {
      if (this.closed) return;
      const had = !!this.g; this.g = g;
      if (!g) { if (had) this.call('gone'); return; }
      const ou = g[this.os];
      if (ou && g.p && g.p[ou] !== this.oppP) { this.oppP = g.p[ou]; this.lastOpp = performance.now(); }
      if (ou && this.once('joined')) this.call('oppJoined', this.oppInfo());
      if (!this.started && g.a && g.b && g.ah && g.bh) { this.started = true; this.lastOpp = performance.now(); this.call('start', { first: g.f === this.side ? 'me' : 'opp', opp: this.oppInfo() }); }
      if (this.b) this.process();
      if (g.rm && g.rm[ou] && this.once('rmAsk')) this.call('rematchAsk');
      if (g.rm && g.rm[g.a] && g.rm[g.b] && !g.nx) this.tryRematch();
      if (g.nx && this.once('nx')) this.call('rematch', g.nx);
      if (g.lf && g.lf[ou] && this.once('lf')) this.call('oppLeft');
      if (g.rv && g.rv[ou] && this.once('rv')) this.verify(g.rv[ou]);
    }
    process() {
      const g = this.g, b = this.b; if (!g || !b) return;
      const S = g.s || {}, me = Net.uid;
      while (!b.over) {
        const s = S[this.done]; if (!s || s.c === undefined || s.u === undefined) break;
        if (s.u === me) { if (s.r === undefined) break; b.result(s.c, s.r, s.k); }
        else {
          this.lastOpp = performance.now();
          const res = b.incoming(s.c);
          if (res && s.r === undefined) { const v = { r: res.r }; if (res.k) v.k = res.k; Net.patch(`g/${this.gid}/s/${this.done}`, v).catch(() => {}); }
        }
        this.done++;
      }
      if (g.e) for (const k of Object.keys(g.e).sort()) {
        if (this.seenE[k]) continue; this.seenE[k] = 1; const e = g.e[k];
        if (e && e.u !== me) { this.lastOpp = performance.now(); b.oppEmote(e.x); }
      }
      if (g.w && !b.over) {
        const win = g.w.u === me, why = g.w.why;
        b.finish(win, win ? (why === 'win' ? 'win' : why) : (why === 'win' ? 'win' : why === 'surr' ? 'surr' : 'time'));
      }
      if (b.over && !this.revealed) this.reveal();
    }
    watch() {
      if (this.closed || !this.g) return;
      const idle = (performance.now() - this.lastOpp) / 1000;
      if (!this.started) { if (this.g[this.os] && idle > 60) this.call('oppLost'); return; }
      const b = this.b; if (!b || b.over) return;
      if (b.turn === 'opp' && idle > CFG.LOST_SEC) Net.tryReq('PUT', `g/${this.gid}/w`, { u: Net.uid, why: 'time' }).catch(() => {});
    }
    reveal() { this.revealed = true; if (this.sec) Net.put(`g/${this.gid}/rv/${Net.uid}`, this.sec.enc + '|' + this.sec.salt).catch(() => {}); }
    async verify(rv) {
      const b = this.b, g = this.g; if (!b || !g) return;
      const i = String(rv).lastIndexOf('|'), enc = rv.slice(0, i);
      const ok = (await hash(rv)) === g[this.os + 'h'];
      const ships = Rules.decode(enc); let fair = ok && Rules.validFleet(ships);
      if (fair) {
        const grid = Rules.grid(ships), me = Net.uid, S = g.s || {};
        for (let n = 0; S[n]; n++) { const s = S[n]; if (s.u !== me || s.r === undefined) continue; if ((grid[s.c] ? 1 : 0) !== (s.r ? 1 : 0)) { fair = false; break; } }
      }
      this.call('reveal', { ships: fair ? ships : null, fair });
    }
    // --- методы соперника для Battle ---
    shoot(c) { Net.patch(`g/${this.gid}/s/${this.done}`, { u: Net.uid, c }).catch(() => { this.b && (this.b.busy = false); }); }
    emote(i) {
      const now = performance.now(); if (now - this.lastEmote < 1200) return; this.lastEmote = now;
      const id = Net.pushId(); this.seenE[id] = 1;
      Net.put(`g/${this.gid}/e/${id}`, { u: Net.uid, x: i, t: Net.TS }).catch(() => {});
    }
    surrender() { if (this.oppUid) Net.tryReq('PUT', `g/${this.gid}/w`, { u: this.oppUid, why: 'surr' }).catch(() => {}); }
    askRematch() { Net.put(`g/${this.gid}/rm/${Net.uid}`, true).catch(() => {}); this.tryRematch(); }
    tryRematch() {
      const g = this.g; if (!g || this.side !== 'a' || g.nx || this.rmSent) return;
      if (!(g.rm && g.rm[g.a] && g.rm[g.b])) return;
      this.rmSent = true; const gid = Net.pushId();
      const o = { a: g.a, an: g.an, ar: g.ar, av: g.av, as: g.as, ap: g.ap, b: g.b, bn: g.bn, br: g.br, bv: g.bv, bs: g.bs, bp: g.bp, f: g.f === 'a' ? 'b' : 'a', t: Net.TS };
      Net.put(`g/${gid}`, o).then(() => Net.tryReq('PUT', `g/${this.gid}/nx`, gid)).catch(() => {});
    }
    leave() {
      if (this.closed) return; this.closed = true;
      clearInterval(this.hb); clearInterval(this.wd); if (this.unl) this.unl();
      const g = this.g; if (!g) return;
      if (!this.started && this.side === 'a' && g.room && !g.b) { Net.del(`g/${this.gid}`).catch(() => {}); return; }
      if (!this.started && !g.w && g[this.os]) { Net.tryReq('PUT', `g/${this.gid}/w`, { u: g[this.os], why: 'left' }).catch(() => {}); }
      if (this.b && !this.b.over && this.oppUid) Net.tryReq('PUT', `g/${this.gid}/w`, { u: this.oppUid, why: 'surr' }).catch(() => {});
      if (g.w && g.lf && g.lf[g[this.os]]) Net.del(`g/${this.gid}`).catch(() => {});
      else Net.put(`g/${this.gid}/lf/${Net.uid}`, true).catch(() => {});
    }
  }
  // Сессия реванша: уже созданная игра без отпечатков — каждый пишет свой после расстановки
  function rematchSession(gid, sideKey, prof) { return new Session(gid, sideKey, null, prof); }

  /* ---------- Рейтинг ---------- */
  function elo(my, opp, win) { const e = 1 / (1 + Math.pow(10, (opp - my) / 400)); return Math.round(CFG.ELO_K * ((win ? 1 : 0) - e)); }
  function saveLb(prof, stats) { return Net.put(`lb/${Net.uid}`, { n: prof.n, r: prof.r, w: stats.w, l: stats.l, v: prof.v || 0, p: prof.p || '', t: Net.TS }).catch(() => {}); }
  async function top() { const d = await Net.get('lb', 'orderBy=%22r%22&limitToLast=50'); return Object.keys(d || {}).map(k => Object.assign({ u: k }, d[k])).filter(x => (x.t || 0) >= (CFG.LB_SINCE || 0)).sort((a, b) => b.r - a.r); }

  return { search, createRoom, joinRoom, rematchSession, secretOf, elo, saveLb, top, Session };
})();
