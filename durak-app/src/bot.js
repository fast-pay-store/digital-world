"use strict";
/* Компьютерный игрок. Bot.move(s, i, lvl) → действие или null (сейчас ему делать нечего).
   Действие: {t:'a', c} ходить/подкинуть, {t:'d', k, c} отбить карту k, {t:'take'}, {t:'pass'}.
   lvl: 0 — новичок (чаще ошибается), 1 — обычный, 2 — сильный. */
const Bot = (() => {
  const { S, R, val, beats } = Rules;

  // Подбор отбоя для всех неотбитых карт: сначала самые «дорогие» атакующие, каждой — самая дешёвая карта, что её бьёт.
  function planDefense(s, hand) {
    const tr = s.trump, left = hand.slice(), plan = [];
    const ks = []; s.table.forEach((p, k) => { if (p.d < 0) ks.push(k); });
    ks.sort((x, y) => val(s.table[y].a, tr) - val(s.table[x].a, tr));
    for (const k of ks) {
      let best = -1;
      for (const c of left) if (beats(c, s.table[k].a, tr) && (best < 0 || val(c, tr) < val(best, tr))) best = c;
      if (best < 0) return null;
      plan.push({ k, c: best }); left.splice(left.indexOf(best), 1);
    }
    return plan;
  }

  function move(s, i, lvl) {
    const ph = Rules.phase(s), tr = s.trump, hand = s.hands[i], deckN = s.deck.length;
    const oops = lvl === 0 ? 0.35 : lvl === 1 ? 0.08 : 0;
    if (ph === 'over' || s.out[i]) return null;

    if (ph === 'def') {
      if (i !== s.def) return throwIn(s, i, lvl, oops);
      const plan = planDefense(s, hand);
      if (!plan) return { t: 'take' };
      // Не тратить старшие козыри рано на мелочь — иногда выгоднее взять.
      const cost = plan.reduce((a, p) => a + (S(p.c) === tr ? 6 + R(p.c) : 0), 0);
      const cheap = s.table.every(p => S(p.a) !== tr && R(p.a) <= 3);
      if (lvl > 0 && deckN > 10 && cheap && cost >= 12 && s.table.length <= 2 && hand.length <= 6) return { t: 'take' };
      if (lvl === 0 && deckN > 6 && cost > 0 && Math.random() < 0.3) return { t: 'take' };
      return { t: 'd', k: plan[0].k, c: plan[0].c };
    }
    if (ph === 'att') {
      if (i !== s.att) return null;
      return { t: 'a', c: pickLead(s, hand, lvl, oops) };
    }
    // 'throw'
    if (i === s.def) return null;
    return throwIn(s, i, lvl, oops);
  }

  // Карты, которых бот не видел (у соперников или в колоде) — по отбою, столу и своим картам. Подглядывания нет.
  function unknown(s, hand) {
    const k = new Set(hand.concat(s.gone || [])); for (const p of s.table) { k.add(p.a); if (p.d >= 0) k.add(p.d); }
    if (s.deck.length) k.add(s.trumpCard);
    const r = []; for (let c = 0; c < 36; c++) if (!k.has(c)) r.push(c); return r;
  }
  const canBeat = (cards, c, tr) => cards.some(x => beats(x, c, tr));
  function pickLead(s, hand, lvl, oops) {
    const tr = s.trump;
    const smart = lvl === 2 && s.deck.length <= 2, unk = smart ? unknown(s, hand) : null;
    const cnt = {}; for (const c of hand) cnt[R(c)] = (cnt[R(c)] || 0) + 1;
    let best = hand[0], bv = 1e9;
    for (const c of hand) {
      let v = val(c, tr) * 10 - (cnt[R(c)] > 1 ? (lvl === 2 ? 25 : 15) : 0);
      if (smart && !canBeat(unk, c, tr)) v -= 200; // в конце игры — заходить с того, что нечем отбить
      if (Math.random() < oops) v += (Math.random() - 0.5) * 60;
      if (v < bv) { bv = v; best = c; }
    }
    return best;
  }

  function throwIn(s, i, lvl, oops) {
    const tr = s.trump, deckN = s.deck.length;
    const ok = Rules.legalAttacks(s, i);
    if (!ok.length) return Rules.canPass(s, i) ? { t: 'pass' } : null;
    ok.sort((a, b) => val(a, tr) - val(b, tr));
    if (lvl === 2 && deckN <= 2 && !s.taking) { const unk = unknown(s, s.hands[i]); const killer = ok.find(c => !canBeat(unk, c, tr)); if (killer != null) return { t: 'a', c: killer }; }
    const c = ok[0], trump = S(c) === tr;
    let want;
    if (deckN === 0) want = !trump || s.hands[i].length <= 2 || s.taking;
    else if (s.taking) want = !trump && R(c) <= (lvl === 2 ? 7 : 4);
    else want = !trump && R(c) <= (deckN > 12 ? (lvl === 2 ? 4 : 3) : 5);
    if (Math.random() < oops) want = !want && !trump;
    if (want) return { t: 'a', c };
    return Rules.canPass(s, i) ? { t: 'pass' } : null;
  }

  function apply(s, i, m) {
    if (!m) return false;
    if (m.t === 'a') return Rules.attack(s, i, m.c);
    if (m.t === 'd') return i === s.def && Rules.defend(s, m.k, m.c);
    if (m.t === 'take') return Rules.take(s, i);
    if (m.t === 'pass') return Rules.pass(s, i);
    return false;
  }
  return { move, apply, planDefense };
})();
if (typeof module !== 'undefined') module.exports = Bot;
