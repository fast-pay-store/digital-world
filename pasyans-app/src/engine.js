"use strict";
/* E — общий движок всех пасьянсов.
   Пасьянс (файл в src/games/) описывает стопки и правила, движок делает остальное:
   карты на экране, перетаскивание и нажатия, отмену, подсказки, авто-сбор, проверку победы.
   Описание пасьянса (все поля, кроме id/name/setup/layout, — по желанию):
     setup(E, opt)            — создать стопки E.pile(), разложить E.deck() через E.put()
     layout(E, W, H)          — расставить стопки: p.x, p.y (пиксели), E.size(cw)
     canPick(p, i)            — можно ли взять карту i из стопки p (с картами поверх)
     pickStart(p, i)          — с какой карты брать (по умолчанию i)
     canDrop(cards, from, to) — можно ли положить
     doMove(from, start, to)  — свой способ хода (пары в «Пирамиде»)
     tap(p, i)                — своё нажатие (колода и т.п.); true — обработано. i = -1 — пустое место
     autoTargets(cards, from) — куда пробовать при нажатии (порядок)
     after()                  — после хода (перевернуть карты, убрать собранное)
     won(), lost(), stockAvail(), canFinish(), autoSafe, slotLabel(p), caption(p), extra {label(), fn()}
   Состояние для отмены: карты в стопках + объект G.ext. */
const E = (() => {
  let G = null, table = null, W = 0, H = 0, cw = 80, ch = 112;
  let piles = [], cards = [], loc = [], undo = [], changed = false;
  let sel = null, drag = null, down = null, finishing = 0, opt = {}, seed = 1, rnd = Math.random;
  const els = [];                                   // пул DOM-карт (до 104)
  const lifted = new Set(); let liftT = 0;
  const st = { moves: 0, t0: 0, tAcc: 0, running: false, over: false, hints: 0 };
  const cb = { change: () => {}, win: () => {}, lose: () => {}, stuck: () => {}, toast: () => {}, sound: () => {} };

  /* ---------- стопки и карты ---------- */
  function pile(id, o) {
    const p = Object.assign({ id, kind: 'tab', fan: 'none', cards: [], x: 0, y: 0, hidden: false, i: piles.length }, o || {});
    p.slot = document.createElement('div'); p.slot.className = 'slot k-' + p.kind; p.slot.dataset.p = p.i;
    p.cap = document.createElement('div'); p.cap.className = 'cap';
    table.appendChild(p.slot); table.appendChild(p.cap);
    piles.push(p); return p;
  }
  function deck(decks, suits) {
    cards = Cards.shuffle(Cards.deck(decks, suits), rnd);
    for (let k = 0; k < cards.length; k++) {
      let el = els[k];
      if (!el) { el = document.createElement('div'); el.className = 'card'; el.innerHTML = '<div class="in"><div class="fa"></div><div class="ba"></div></div>'; els[k] = el; table.appendChild(el); el._fa = el.firstChild.firstChild; }
      el.style.display = ''; el.dataset.c = k;
      cards[k].el = el; el._x = el._y = el._z = null;
    }
    // id = место в пуле; лицо карты рисуем заново
    cards.forEach((c, k) => { c.id = k; c.el._fa.innerHTML = Cards.face(c); c.el._fa.className = 'fa s' + c.s + (c.r > 10 ? ' face' : ''); });
    for (let k = cards.length; k < els.length; k++) els[k].style.display = 'none';
    return cards.slice();
  }
  function put(p, c, up) { c.up = !!up; p.cards.push(c); loc[c.id] = p; }
  const top = p => p.cards[p.cards.length - 1];

  function move(from, start, to, o) {
    const mv = from.cards.splice(start);
    if (o && o.reverse) mv.reverse();
    if (o && o.up !== undefined) mv.forEach(c => { c.up = o.up; });
    if (o && o.bottom) to.cards.unshift(...mv); else to.cards.push(...mv);
    mv.forEach(c => { loc[c.id] = to; lifted.add(c.id); });
    changed = true; return mv;
  }
  function flip(c, up) { if (c.up !== up) { c.up = up; changed = true; } }

  /* ---------- отмена ---------- */
  function snap() { return { p: piles.map(p => p.cards.map(c => c.id * 2 + (c.up ? 1 : 0))), x: G.ext ? JSON.stringify(G.ext) : null, m: st.moves }; }
  function restore(s) {
    piles.forEach((p, i) => { p.cards = s.p[i].map(v => { const c = cards[v >> 1]; c.up = !!(v & 1); loc[c.id] = p; return c; }); });
    if (s.x) G.ext = JSON.parse(s.x);
    st.moves = s.m;
    if (G.onRestore) G.onRestore();
  }
  function act(fn) {
    if (finishing || st.over) return false;
    const s = snap(); changed = false;
    const r = fn();
    if (!changed) { render(); return r; }
    if (G.after) G.after();
    if (G.autoSafe) safeAuto();
    undo.push(s); if (undo.length > 400) undo.shift();
    st.moves++; if (!st.running) startClock();
    clearSel(); render(); afterAct(); return r;
  }
  function afterAct() {
    cb.change();
    if (G.won()) { win(); return; }
    if (G.lost && G.lost()) { st.over = true; stopClock(); cb.change(); setTimeout(() => cb.lose(), 500); return; }
    if (G.canFinish && G.canFinish() && toFound(false)) { setTimeout(autoFinish, 350); return; }
    cb.stuck(!hasMoves());
  }
  function undoMove() {
    if (finishing || !undo.length || st.over) return false;
    restore(undo.pop()); clearSel(); render(); cb.sound('undo'); cb.change(); cb.stuck(false); return true;
  }

  /* ---------- авто-ходы на базу ---------- */
  function founds() { return piles.filter(p => p.kind === 'found'); }
  function toFound(safeOnly) {
    const fs = founds();
    for (const p of piles) {
      if (p.kind === 'found' || p.kind === 'stock' || !p.cards.length) continue;
      const c = top(p); if (!c.up) continue;
      if (safeOnly && !isSafe(c, fs)) continue;
      for (const f of fs) if (G.canDrop([c], p, f)) return [p, f];
    }
    return null;
  }
  function isSafe(c, fs) {   // карту точно не понадобится класть в столбец: младшие карты другого цвета уже на базе
    if (c.r <= 2) return true;
    const red = Cards.red(c); let need = 0;
    for (const f of fs) { const t = top(f); if (t && Cards.red(t) !== red) need += (t.r >= c.r - 1) ? 1 : 0; }
    return need >= 2;
  }
  function safeAuto() { let m, n = 0; while ((m = toFound(true)) && n++ < 104) { move(m[0], m[0].cards.length - 1, m[1]); if (G.after) G.after(); } }
  function autoFinish() {
    if (st.over || finishing) return;
    finishing = 1; cb.sound('deal');
    const s = snap();
    const step = () => {
      const m = toFound(false);
      if (!m) { finishing = 0; undo.push(s); render(); afterAct(); return; }
      move(m[0], m[0].cards.length - 1, m[1]); if (G.after) G.after(); render(); cb.sound('found');
      setTimeout(step, 70);
    };
    step();
  }

  /* ---------- раскладка на экране ---------- */
  function size(w) {
    cw = Math.max(18, Math.floor(w)); ch = Math.round(cw * 1.4);
    table.style.setProperty('--cw', cw + 'px'); table.style.setProperty('--ch', ch + 'px');
    table.classList.toggle('csm', cw < 62); table.classList.toggle('ctn', cw < 42);
  }
  function fanPos(p, out) {   // заполняет out [x,y,...] для каждой карты стопки
    const n = p.cards.length, x0 = p.x, y0 = p.y;
    if (p.fan === 'down') {
      const fu = (p.fu || 0.27) * ch, fd = (p.fd || 0.11) * ch;
      let tot = 0; for (let i = 1; i < n; i++) tot += p.cards[i - 1].up ? fu : fd;
      const lim = (p.maxY !== undefined ? p.maxY : H - ch - 4) - y0;
      const k = tot > lim && tot > 0 ? Math.max(0.12, lim / tot) : 1;
      let y = y0;
      for (let i = 0; i < n; i++) { out.push(x0, y); if (i < n - 1) y += (p.cards[i].up ? fu : fd) * k; }
    } else if (p.fan === 'right3') {
      for (let i = 0; i < n; i++) { const j = Math.max(0, i - (n - 3)); out.push(x0 + j * 0.3 * cw, y0); }
    } else if (p.fan === 'right') {
      const f = (p.fr || 0.3) * cw;
      for (let i = 0; i < n; i++) out.push(x0 + i * f, y0);
    } else {
      const th = p.kind === 'stock' ? Math.max(1, cw * 0.006) : 0;   // толщина колоды
      for (let i = 0; i < n; i++) { const d = th * Math.min(6, Math.floor(i / 6)); out.push(x0 - d, y0 - d); }
    }
  }
  const tmp = [];
  function render() {
    for (const p of piles) {
      const sl = p.slot;
      if (p.hidden) { sl.style.display = 'none'; p.cap.style.display = 'none'; }
      else {
        sl.style.display = '';
        sl.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
        const lb = G.slotLabel ? G.slotLabel(p) : '';
        if (sl._lb !== lb) { sl._lb = lb; sl.textContent = lb; }
        const cp = G.caption ? G.caption(p) : (p.kind === 'stock' && p.cards.length ? String(p.cards.length) : '');
        if (cp) { p.cap.style.display = ''; if (p.cap._t !== cp) { p.cap._t = cp; p.cap.textContent = cp; }
          p.cap.style.transform = `translate3d(${p.capX !== undefined ? p.capX : p.x}px,${p.capY !== undefined ? p.capY : p.y + ch + 2}px,0)`; }
        else p.cap.style.display = 'none';
      }
      tmp.length = 0; fanPos(p, tmp);
      for (let i = 0; i < p.cards.length; i++) {
        const c = p.cards[i], el = c.el;
        if (drag && drag.ids.has(c.id)) continue;
        const x = Math.round(tmp[i * 2]), y = Math.round(tmp[i * 2 + 1]);
        if (el._x !== x || el._y !== y) { el._x = x; el._y = y; el.style.transform = `translate3d(${x}px,${y}px,0)`; }
        const z = (lifted.has(c.id) ? 5000 : 0) + p.i * 130 + i + 10;
        if (el._z !== z) { el._z = z; el.style.zIndex = z; }
        const cls = c.up ? 1 : 0;
        if (el._u !== cls) { el._u = cls; el.classList.toggle('up', !!cls); }
        el.style.visibility = p.hidden ? 'hidden' : '';
      }
    }
    if (lifted.size) { clearTimeout(liftT); liftT = setTimeout(() => { lifted.clear(); render(); }, 300); }
  }
  function resize() {
    if (!G) return;
    const r = table.getBoundingClientRect(); W = r.width; H = r.height;
    G.layout(E, W, H); render();
  }

  /* ---------- выбор, нажатия, перетаскивание ---------- */
  function clearSel() { if (sel) { sel.p.cards.slice(sel.i).forEach(c => c.el.classList.remove('sel')); sel = null; } }
  function select(p, i) { clearSel(); sel = { p, i }; p.cards.slice(i).forEach(c => c.el.classList.add('sel')); cb.sound('pick'); }
  function shake(p, i) {
    const list = i >= 0 ? p.cards.slice(i) : [];
    list.forEach(c => { c.el.classList.remove('shake'); void c.el.offsetWidth; c.el.classList.add('shake'); });
    if (!list.length) { p.slot.classList.remove('shake'); void p.slot.offsetWidth; p.slot.classList.add('shake'); }
    cb.sound('no');
  }
  function doMove(from, start, to) {
    return act(() => { if (G.doMove) G.doMove(from, start, to); else move(from, start, to); cb.sound(to.kind === 'found' ? 'found' : 'place'); return true; });
  }
  function defaultTargets(cardsMv, from) {
    const a = [];
    if (cardsMv.length === 1) for (const p of piles) if (p.kind === 'found') a.push(p);
    for (const p of piles) if (p.kind === 'tab' && p.cards.length) a.push(p);
    if (cardsMv.length === 1) for (const p of piles) if (p.kind === 'cell') a.push(p);
    for (const p of piles) if (p.kind === 'tab' && !p.cards.length) a.push(p);
    return a;
  }
  function tap(p, i) {
    if (finishing || st.over) return;
    if (sel) {
      const s = sel; clearSel();
      if (p !== s.p) { const mv = s.p.cards.slice(s.i); if (G.canDrop(mv, s.p, p)) { doMove(s.p, s.i, p); return; } }
      else return;
    }
    if (G.tap) { let h = false; act(() => { h = G.tap(p, i); }); if (h) { cb.sound('deal'); return; } }
    if (i < 0) return;
    if (!G.canPick(p, i)) { shake(p, i); return; }
    const s0 = G.pickStart ? G.pickStart(p, i) : i;
    const mv = p.cards.slice(s0);
    const tg = G.autoTargets ? G.autoTargets(mv, p) : defaultTargets(mv, p);
    for (const t of tg) if (t !== p && G.canDrop(mv, p, t)) { doMove(p, s0, t); return; }
    if (G.noSelect) { shake(p, s0); return; }
    select(p, s0);
  }
  function hitPile(el) {
    const c = el.closest('.card');
    if (c) { const card = cards[+c.dataset.c]; const p = loc[card.id]; return [p, p.cards.indexOf(card)]; }
    const s = el.closest('.slot'); if (s) return [piles[+s.dataset.p], -1];
    return null;
  }
  function onDown(e) {
    if (!G || e.button > 0 || down) return;
    const h = hitPile(e.target); if (!h) { clearSel(); return; }
    down = { p: h[0], i: h[1], x: e.clientX, y: e.clientY, id: e.pointerId };
    try { table.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!drag) {
      if (dx * dx + dy * dy < 49 || down.i < 0 || finishing || st.over) return;
      if (!G.canPick(down.p, down.i)) return;
      const s0 = G.pickStart ? G.pickStart(down.p, down.i) : down.i;
      clearSel();
      const list = down.p.cards.slice(s0);
      drag = { p: down.p, s: s0, list, ids: new Set(list.map(c => c.id)), bx: list.map(c => c.el._x), by: list.map(c => c.el._y) };
      list.forEach((c, k) => { c.el.classList.add('drag'); c.el.style.zIndex = 9000 + k; });
      cb.sound('pick');
    }
    drag.dx = dx; drag.dy = dy;
    if (!drag.raf) drag.raf = requestAnimationFrame(() => {
      if (!drag) return; drag.raf = 0;
      drag.list.forEach((c, k) => { c.el.style.transform = `translate3d(${drag.bx[k] + drag.dx}px,${drag.by[k] + drag.dy}px,0) scale(1.04)`; });
    });
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (!drag) { tap(d.p, d.i); return; }
    const g = drag; drag = null; if (g.raf) cancelAnimationFrame(g.raf);
    g.list.forEach(c => { c.el.classList.remove('drag'); c.el._x = null; });
    const x = g.bx[0] + (g.dx || 0), y = g.by[0] + (g.dy || 0);
    let best = null, ba = 0;
    for (const p of piles) {
      if (p === g.p || p.hidden) continue;
      let tx = p.x, ty = p.y;
      if (p.cards.length) { const c = top(p); tx = c.el._x; ty = c.el._y; }
      const ox = Math.min(x + cw, tx + cw) - Math.max(x, tx), oy = Math.min(y + ch, ty + ch) - Math.max(y, ty);
      if (ox <= 0 || oy <= 0) continue;
      const a = ox * oy;
      if (a > ba && G.canDrop(g.list, g.p, p)) { ba = a; best = p; }
    }
    if (best) doMove(g.p, g.s, best);
    else { render(); if (Math.abs(g.dx || 0) + Math.abs(g.dy || 0) > 30) cb.sound('no'); }
  }

  /* ---------- подсказки ---------- */
  function listMoves() {
    const res = [];
    for (const p of piles) {
      if (p.hidden) continue;
      let last = -1;
      for (let i = 0; i < p.cards.length; i++) {
        if (!G.canPick(p, i)) continue;
        const s0 = G.pickStart ? G.pickStart(p, i) : i; if (s0 === last) continue; last = s0;
        const mv = p.cards.slice(s0);
        for (const t of piles) {
          if (t === p || t.hidden || !G.canDrop(mv, p, t)) continue;
          let sc = 1;
          if (t.kind === 'found') sc = 6;
          else if (s0 > 0 && !p.cards[s0 - 1].up) sc = 5;
          else if (s0 === 0 && !t.cards.length && p.kind === 'tab') continue;         // столбец в пустой столбец — без толку
          else if (s0 > 0 && p.kind === 'tab' && t.kind === 'tab' && p.cards[s0 - 1].up && G.id !== 'pyramid') sc = 0.3;
          else if (t.kind === 'cell') sc = 0.5;
          else if (s0 === 0 && p.kind === 'tab') sc = 3;
          res.push({ p, s: s0, t, sc });
        }
      }
    }
    res.sort((a, b) => b.sc - a.sc);
    return res;
  }
  function hasMoves() { return listMoves().length > 0 || (G.stockAvail ? G.stockAvail() : false); }
  function pulse(el) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); }
  function hint() {
    if (st.over || finishing) return false;
    clearSel();
    const all = listMoves(), m = all.find(x => x.sc >= 0.5);
    const sp = G.hintTap ? G.hintTap() : piles.find(p => p.kind === 'stock');
    const stockOk = sp && (!G.stockAvail || G.stockAvail());
    const show = mv => {
      mv.p.cards.slice(mv.s).forEach(c => pulse(c.el));
      setTimeout(() => { if (mv.t.cards.length) pulse(top(mv.t).el); else pulse(mv.t.slot); }, 450);
      return true;
    };
    if (m) return show(m);
    if (stockOk) { if (sp.cards.length) pulse(top(sp).el); else pulse(sp.slot); return true; }
    if (all.length) return show(all[0]);
    return false;
  }

  /* ---------- время ---------- */
  function startClock() { st.running = true; st.t0 = performance.now(); }
  function stopClock() { if (st.running) { st.tAcc += performance.now() - st.t0; st.running = false; } }
  function time() { return Math.floor((st.tAcc + (st.running ? performance.now() - st.t0 : 0)) / 1000); }

  function win() {
    st.over = true; stopClock(); cb.change(); cb.sound('win');
    // праздничный разлёт карт
    const all = cards.filter(c => loc[c.id] && !loc[c.id].hidden);
    all.forEach((c, k) => {
      const el = c.el;
      setTimeout(() => {
        const x = W / 2 - cw / 2 + (Math.random() - 0.5) * W * 0.9, y = H * 0.1 + Math.random() * H * 0.7;
        el.classList.add('fly'); el.classList.add('up'); el._u = 1;
        el.style.transform = `translate3d(${x}px,${y}px,0) rotate(${(Math.random() - 0.5) * 60}deg)`; el._x = null;
      }, 200 + k * 12);
    });
    setTimeout(() => cb.win(), 900 + all.length * 12);
  }

  /* ---------- запуск партии ---------- */
  function start(game, options, sd, saved) {
    G = game; opt = options || {}; seed = sd; rnd = Cards.rng(sd);
    piles.forEach(p => { p.slot.remove(); p.cap.remove(); });
    piles = []; loc = []; undo = []; sel = null; drag = null; down = null; finishing = 0; lifted.clear();
    Object.assign(st, { moves: 0, t0: 0, tAcc: 0, running: false, over: false, hints: 0 });
    G.ext = {};
    els.forEach(el => { el.classList.remove('fly', 'sel', 'hint', 'drag', 'shake'); });
    G.setup(E, opt);
    const r = table.getBoundingClientRect(); W = r.width; H = r.height;
    G.layout(E, W, H);
    if (saved) {
      restore(saved.s); undo = saved.u || []; st.tAcc = (saved.t || 0) * 1000; st.moves = saved.s.m;
      render(); afterAct(); return;
    }
    // раздача: все карты из колоды (или центра) разлетаются по местам
    const sp = piles.find(p => p.kind === 'stock');
    const sx = sp ? sp.x : W / 2 - cw / 2, sy = sp ? sp.y : H + ch;
    let k = 0;
    for (const p of piles) for (const c of p.cards) {
      const el = c.el; el.style.transition = 'none';
      el.style.transform = `translate3d(${sx}px,${sy}px,0)`; el._x = sx; el._y = sy; el._u = null; el.classList.remove('up');
      el.style.transitionDelay = (p.kind === 'stock' ? 0 : Math.min(900, (k++) * 18)) + 'ms';
    }
    void table.offsetWidth;
    cards.forEach(c => { c.el.style.transition = ''; });
    render();
    setTimeout(() => cards.forEach(c => { c.el.style.transitionDelay = ''; }), 1300);
    cb.sound('shuffle'); cb.change();
  }
  function saveState() { if (!G || st.over) return null; return { s: snap(), u: undo.slice(-40), t: time() }; }

  function init(el) {
    table = el;
    table.addEventListener('pointerdown', onDown);
    table.addEventListener('pointermove', onMove);
    table.addEventListener('pointerup', onUp);
    table.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', () => { clearTimeout(init._t); init._t = setTimeout(resize, 80); });
  }

  return {
    init, start, pile, deck, put, move, flip, top, act, size, render, resize, undo: undoMove, hint, hasMoves, listMoves, saveState,
    time, pause: stopClock, resume() { if (!st.running && st.moves && !st.over) startClock(); },
    on(k, f) { cb[k] = f; }, toast: t => cb.toast(t),
    get G() { return G; }, get cw() { return cw; }, get ch() { return ch; }, get piles() { return piles; }, get seed() { return seed; },
    get moves() { return st.moves; }, get over() { return st.over; }, get canUndo() { return undo.length > 0 && !st.over; }, get opt() { return opt; },
    rnd: () => rnd(),
    test: { doMove, tap, get finishing() { return finishing; } },
  };
})();
const GAMES = [];
