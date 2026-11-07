"use strict";
/* Cards — колода, случайность по номеру расклада, внешний вид карты (HTML).
   Масти: 0 пики, 1 червы, 2 бубны, 3 трефы. Ранги 1..13 (A..K). */
const Cards = (() => {
  const VS = '︎';                                   // текстовый вид значка масти (не эмодзи)
  const SUIT = ['♠' + VS, '♥' + VS, '♦' + VS, '♣' + VS];
  const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const NAME = ['', 'Туз', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Валет', 'Дама', 'Король'];

  /* mulberry32 — один номер расклада = один и тот же расклад у всех */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* suits: 4 — все масти; 2 — пики и червы; 1 — только пики (для «Паука») */
  function deck(decks, suits) {
    const out = [], ss = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
    const per = 4 / ss.length;
    for (let d = 0; d < decks; d++) for (let k = 0; k < per; k++) for (const s of ss) for (let r = 1; r <= 13; r++) out.push({ id: out.length, s, r, up: false });
    return out;
  }

  /* расположение значков масти на числовых картах (x,y в %; f — перевёрнут) */
  const PIPS = {
    2: [[50, 18], [50, 82, 1]], 3: [[50, 18], [50, 50], [50, 82, 1]],
    4: [[30, 18], [70, 18], [30, 82, 1], [70, 82, 1]],
    5: [[30, 18], [70, 18], [50, 50], [30, 82, 1], [70, 82, 1]],
    6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82, 1], [70, 82, 1]],
    7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82, 1], [70, 82, 1]],
    8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66, 1], [30, 82, 1], [70, 82, 1]],
    9: [[30, 16], [70, 16], [30, 38], [70, 38], [50, 50], [30, 62, 1], [70, 62, 1], [30, 84, 1], [70, 84, 1]],
    10: [[30, 16], [70, 16], [50, 28], [30, 38], [70, 38], [30, 62, 1], [70, 62, 1], [50, 72, 1], [30, 84, 1], [70, 84, 1]],
  };
  function face(c) {
    const s = SUIT[c.s], R = RANK[c.r];
    let mid;
    if (c.r === 1) mid = `<div class="ace">${s}</div>`;
    else if (c.r > 10) mid = `<div class="fc"><b>${R}</b><i>${s}</i><u>${s}</u></div>`;
    else mid = '<div class="pips">' + PIPS[c.r].map(p => `<i style="left:${p[0]}%;top:${p[1]}%"${p[2] ? ' class="f"' : ''}>${s}</i>`).join('') + '</div>';
    return `<div class="ix"><b>${R}</b><i>${s}</i></div>${mid}<div class="ix br"><b>${R}</b><i>${s}</i></div><div class="cbig"><b>${R}</b><i>${s}</i></div>`;
  }
  return { SUIT, RANK, NAME, rng, shuffle, deck, face, red: c => c.s === 1 || c.s === 2 };
})();
