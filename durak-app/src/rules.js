"use strict";
/* Правила «Дурака подкидного» (36 карт, 2–4 игрока). Чистая логика без графики — её используют и бой с ботами, и хозяин онлайн-стола.
   Карта — число 0..35: масть = c/9 (0♠ 1♣ 2♦ 3♥), достоинство = c%9 (0=6 … 4=10, 5=В, 6=Д, 7=К, 8=Т).
   Колода: deck[0] — козырь (лежит открыто под колодой), берут с конца.
   Подкидывать может любой, кроме отбивающегося; карт в отбое ≤ 6 (в первом отбое ≤ 5) и не больше, чем карт у отбивающегося.
   Каждое действие возвращает true/false и дописывает события в s.ev (по ним рисуются анимации и звуки). */
const Rules = (() => {
  const S = (c) => (c / 9) | 0, R = (c) => c % 9;
  const RANKS = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
  const beats = (c, a, tr) => (S(c) === S(a) && R(c) > R(a)) || (S(c) === tr && S(a) !== tr);
  const val = (c, tr) => R(c) + (S(c) === tr ? 10 : 0);

  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function create(n, rnd) {
    rnd = rnd || Math.random;
    const deck = shuffle(Array.from({ length: 36 }, (_, i) => i), rnd);
    const s = { n, hands: [], deck, trumpCard: deck[0], trump: S(deck[0]), out: [], places: [], att: 0, def: 1, table: [], taking: false,
      passed: [], limit: 5, first: true, over: false, fool: -1, disc: 0, gone: [], ev: [], moves: 0 };
    for (let i = 0; i < n; i++) { s.hands.push([]); s.out.push(false); s.passed.push(false); }
    for (let k = 0; k < 6; k++) for (let i = 0; i < n; i++) s.hands[i].push(deck.pop());
    // Первым ходит тот, у кого младший козырь; если козырей ни у кого — случайный.
    let best = 99, who = (rnd() * n) | 0;
    for (let i = 0; i < n; i++) for (const c of s.hands[i]) if (S(c) === s.trump && R(c) < best) { best = R(c); who = i; }
    s.att = who; s.def = nextActive(s, who);
    s.ev.push({ t: 'deal', i: who, c: best < 99 ? s.trump * 9 + best : -1 });
    return s;
  }
  function nextActive(s, i) { for (let k = 1; k <= s.n; k++) { const j = (i + k) % s.n; if (!s.out[j]) return j; } return i; }
  const ranksOnTable = (s) => { const m = 0; let r = m; for (const p of s.table) { r |= 1 << R(p.a); if (p.d >= 0) r |= 1 << R(p.d); } return r; };
  const unbeaten = (s) => { let k = 0; for (const p of s.table) if (p.d < 0) k++; return k; };
  const allBeaten = (s) => s.table.length > 0 && unbeaten(s) === 0;
  // Может ли игрок i подкидывать/ходить вообще (не отбивающийся и в игре)
  const isAttacker = (s, i) => !s.over && !s.out[i] && i !== s.def;

  function canAttack(s, i, c) {
    if (!isAttacker(s, i) || s.hands[i].indexOf(c) < 0) return false;
    if (s.table.length === 0) return i === s.att;
    if (s.table.length >= s.limit) return false;
    if (unbeaten(s) + 1 > s.hands[s.def].length) return false;
    return (ranksOnTable(s) & (1 << R(c))) !== 0;
  }
  function canDefend(s, k, c) {
    if (s.over || s.taking) return false;
    const p = s.table[k]; if (!p || p.d >= 0) return false;
    return s.hands[s.def].indexOf(c) >= 0 && beats(c, p.a, s.trump);
  }
  const canTake = (s) => !s.over && !s.taking && unbeaten(s) > 0;
  const canPass = (s, i) => isAttacker(s, i) && !s.passed[i] && s.table.length > 0 && (s.taking || allBeaten(s));
  function legalAttacks(s, i) { const r = []; for (const c of s.hands[i] || []) if (canAttack(s, i, c)) r.push(c); return r; }

  const rm = (h, c) => { const k = h.indexOf(c); if (k >= 0) h.splice(k, 1); };
  function changed(s) { for (let i = 0; i < s.n; i++) s.passed[i] = false; s.moves++; settle(s); }

  function attack(s, i, c) {
    if (!canAttack(s, i, c)) return false;
    rm(s.hands[i], c); s.table.push({ a: c, d: -1 }); s.ev.push({ t: 'a', i, c });
    changed(s); return true;
  }
  function defend(s, k, c) {
    if (!canDefend(s, k, c)) return false;
    rm(s.hands[s.def], c); s.table[k].d = c; s.ev.push({ t: 'd', i: s.def, k, c });
    changed(s); return true;
  }
  function take(s, i) {
    if (i !== s.def || !canTake(s)) return false;
    s.taking = true; s.ev.push({ t: 'take', i });
    changed(s); return true;
  }
  function pass(s, i) {
    if (!canPass(s, i)) return false;
    s.passed[i] = true; s.ev.push({ t: 'pass', i });
    settle(s); return true;
  }

  // Автоматически: у кого нечего подкинуть — пасует; когда все спасовали — отбой закончен.
  function settle(s) {
    if (s.over || s.table.length === 0) return;
    if (!s.taking && !allBeaten(s)) return;
    if (!s.taking && s.hands[s.def].length === 0) return endBout(s);
    let open = 0;
    for (let i = 0; i < s.n; i++) {
      if (!isAttacker(s, i) || s.passed[i]) continue;
      if (legalAttacks(s, i).length === 0) s.passed[i] = true; else open++;
    }
    if (open === 0) endBout(s);
  }

  function endBout(s) {
    const cards = []; for (const p of s.table) { cards.push(p.a); if (p.d >= 0) cards.push(p.d); }
    const took = s.taking, def = s.def;
    if (took) { s.hands[def].push(...cards); s.ev.push({ t: 'took', i: def, n: cards.length }); }
    else { s.disc += cards.length; s.gone.push(...cards); s.ev.push({ t: 'bito', n: cards.length }); }
    s.table = []; s.taking = false; s.first = false; s.limit = 6;
    // Добор: сначала ходивший, потом остальные по кругу, отбивавшийся — последним.
    const order = [s.att]; for (let k = 1; k < s.n; k++) { const j = (s.att + k) % s.n; if (j !== def) order.push(j); }
    if (def !== s.att) order.push(def);
    for (const i of order) {
      if (s.out[i]) continue;
      let got = 0; while (s.hands[i].length < 6 && s.deck.length) { s.hands[i].push(s.deck.pop()); got++; }
      if (got) s.ev.push({ t: 'draw', i, n: got });
    }
    if (s.deck.length === 0) for (let i = 0; i < s.n; i++) if (!s.out[i] && s.hands[i].length === 0) { s.out[i] = true; s.places.push(i); s.ev.push({ t: 'out', i }); }
    const left = []; for (let i = 0; i < s.n; i++) if (!s.out[i]) left.push(i);
    if (left.length <= 1) { s.over = true; s.fool = left.length ? left[0] : -1; s.ev.push({ t: 'over', i: s.fool }); return; }
    s.att = took ? nextActive(s, def) : (s.out[def] ? nextActive(s, def) : def);
    s.def = nextActive(s, s.att);
    for (let i = 0; i < s.n; i++) s.passed[i] = false;
  }

  // Игрок покинул стол (онлайн): его карты уходят в отбой, он выбывает последним местом (как дурак), игра идёт дальше.
  function leave(s, i) {
    if (s.over || s.out[i]) return;
    if (s.table.length && (i === s.def)) { s.taking = false; for (const p of s.table) { s.disc++; if (p.d >= 0) s.disc++; } s.table = []; }
    s.disc += s.hands[i].length; s.hands[i] = []; s.out[i] = true; s.left = (s.left || []).concat(i); s.ev.push({ t: 'left', i });
    const left = []; for (let k = 0; k < s.n; k++) if (!s.out[k]) left.push(k);
    if (left.length <= 1) { s.over = true; s.fool = i; s.ev.push({ t: 'over', i }); return; }
    if (s.table.length === 0) { if (s.att === i || s.def === i || s.out[s.att]) { s.att = s.out[s.att] ? nextActive(s, s.att) : s.att; } s.def = nextActive(s, s.att); s.limit = s.first ? 5 : 6; }
    else if (s.att === i) s.att = nextActive(s, i);
    for (let k = 0; k < s.n; k++) s.passed[k] = false;
    settle(s);
  }

  // Кто сейчас должен действовать: 'att' (первый ход отбоя), 'def' (отбиваться), 'throw' (подкинуть или «Бито»/«Пас»)
  function phase(s) {
    if (s.over) return 'over';
    if (s.table.length === 0) return 'att';
    if (!s.taking && unbeaten(s) > 0) return 'def';
    return 'throw';
  }

  return { S, R, RANKS, beats, val, create, nextActive, canAttack, canDefend, canTake, canPass, legalAttacks,
    attack, defend, take, pass, leave, phase, unbeaten, allBeaten, isAttacker, shuffle };
})();
if (typeof module !== 'undefined') module.exports = Rules;
