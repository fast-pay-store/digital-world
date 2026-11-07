"use strict";
/* UI — меню, окна, панель игры. Тексты интерфейса — здесь. */
const UI = (() => {
  const $ = s => document.querySelector(s);
  const ICON = {
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 7H4V2M4.5 7A9 9 0 1 1 3 13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="#ffe08a" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    neu: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="11" height="15" rx="2" fill="#fff" stroke="currentColor" stroke-width="2" transform="rotate(-10 8 12)"/><rect x="10" y="4" width="11" height="15" rx="2" fill="#ffe08a" stroke="currentColor" stroke-width="2" transform="rotate(8 15 11)"/></svg>',
    rules: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8M12 17h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#f2b84b" stroke="#9a6418" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    extra: '<svg viewBox="0 0 24 24"><path d="M4 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    snd: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    mus: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="16" r="2.8" fill="currentColor"/></svg>',
    coll: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="11" rx="1.5" fill="#2d5aa0" stroke="currentColor" stroke-width="1.6"/><rect x="8" y="7" width="8" height="11" rx="1.5" fill="#a8323e" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="10" width="8" height="11" rx="1.5" fill="#1f7a5a" stroke="currentColor" stroke-width="1.6"/></svg>',
  };
  /* маленькие картинки пасьянсов в меню */
  function mini(id) {
    const R = ['#c8323c', '#23262e'];
    const c = (x, y, up, t, red, rot) => up
      ? `<g transform="translate(${x} ${y}) rotate(${rot || 0} 9 12.5)"><rect width="18" height="25" rx="2.5" fill="#fffdf6" stroke="#b79d74" stroke-width=".8"/><text x="3" y="9" font-size="8" font-weight="800" fill="${R[red ? 0 : 1]}" font-family="Nunito,sans-serif">${t}</text></g>`
      : `<g transform="translate(${x} ${y}) rotate(${rot || 0} 9 12.5)"><rect width="18" height="25" rx="2.5" fill="#2d5aa0" stroke="#fff" stroke-width="1"/></g>`;
    let s = '';
    const col = (x, n, up, labels) => { for (let i = 0; i < n; i++) s += c(x, 6 + i * 7, i >= n - up, labels ? labels[i] : '', i % 2); };
    switch (id) {
      case 'klondike': col(6, 3, 1, ['', '', 'K']); col(28, 4, 2, ['', '', 'Q', 'J']); col(50, 5, 3, ['', '', '9', '8', '7']); s += c(72, 6, 1, 'A', 1); break;
      case 'spider': for (let k = 0; k < 4; k++) for (let i = 0; i < 5 - (k % 2); i++) s += c(4 + k * 21, 6 + i * 7, i >= 2, ['K', 'Q', 'J', '10', '9'][i], 0); break;
      case 'freecell': for (let k = 0; k < 4; k++) s += c(4 + k * 21, 2, k === 1, '7', 1); for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) s += c(4 + k * 21, 32 + i * 7, true, ['9', '8', '7'][i], (i + k) % 2); break;
      case 'yukon': col(6, 6, 5, ['', 'K', 'Q', '4', 'J', '10']); col(30, 5, 3, ['', '', '8', '7', '6']); col(54, 4, 4, ['A', 'K', 'Q', 'J']); break;
      case 'forty': for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) s += c(4 + k * 21, 6 + i * 8, true, ['9', '8', '7', '6'][i], k % 2); break;
      case 'pyramid': for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) s += c(37 - r * 10 + k * 20, 2 + r * 12, true, ['K', '6', '7', 'Q', 'A', '9', '4', '3', '10', '2'][r * (r + 1) / 2 + k], (r + k) % 2); break;
      case 'tripeaks': for (let p = 0; p < 3; p++) { s += c(4 + p * 28, 4, false); s += c(-2 + p * 28, 16, true, '5', p % 2); s += c(10 + p * 28, 16, true, '6', 1 - p % 2); } s += c(38, 50, true, '7', 1); break;
      case 'golf': for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) s += c(6 + k * 21, 2 + i * 7, true, ['4', 'J', '8', '2'][(k + i) % 4], (k + i) % 2); s += c(37, 50, true, '5', 0); break;
      case 'montecarlo': for (let k = 0; k < 9; k++) s += c(12 + (k % 3) * 22, 2 + ((k / 3) | 0) * 26, k !== 4, ['8', '8', 'Q', '3', '', '5', 'K', '3', '9'][k], k % 2); break;
      case 'montana': for (let k = 0; k < 8; k++) { if (k === 2 || k === 5) continue; s += c(2 + (k % 4) * 22, 10 + ((k / 4) | 0) * 30, true, ['2', '3', '', '9', '2', '', '6', 'J'][k], k > 3); } break;
      case 'clock': for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; s += c(37 + Math.sin(a) * 30, 27 - Math.cos(a) * 24, k === 1, '2', 1); } s += c(37, 27, true, 'K', 0); break;
      case 'calculation': ['A', '2', '3', '4'].forEach((t, k) => { s += c(3 + k * 22, 4, true, t, k % 2); s += `<text x="${8 + k * 22}" y="40" font-size="9" font-weight="800" fill="#8a6a48" font-family="Nunito,sans-serif">+${k + 1}</text>`; }); s += c(26, 48, true, '6', 1); s += c(48, 48, true, '8', 0); break;
      case 'accordion': for (let k = 0; k < 6; k++) s += c(2 + k * 12, 14 + (k % 2) * 3, true, ['7', '7', 'Q', '5', '5', 'K'][k], k > 2, (k - 2.5) * 6); break;
    }
    return `<svg class="mini" viewBox="0 0 92 80">${s}</svg>`;
  }
  const dots = n => '<span class="dots">' + [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('') + '</span>';
  const DIFF = ['', 'лёгкий', 'средний', 'трудный'];

  let toastT = 0;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }
  function modal(html, onBind) {
    const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.remove('hide');
    m.onclick = e => { if (e.target === m && !m._lock) close(); };
    if (onBind) onBind(m.firstChild);
  }
  function close() { const m = $('#modal'); m.classList.add('hide'); m.innerHTML = ''; m._lock = false; }
  function press(root) {   // «сплющивание» кнопок
    root.addEventListener('pointerdown', e => { const b = e.target.closest('.btn,.tile,.it'); if (b) { b.classList.add('pr'); Snd.play('click'); } });
    const up = () => document.querySelectorAll('.pr').forEach(b => b.classList.remove('pr'));
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('pointerleave', up);
  }
  function fmtTime(s) { const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
  function cardHTML(back, up, c) {
    return `<div class="b${back}" style="position:relative;display:inline-block"><div class="card${up ? ' up' : ''}" style="position:relative"><div class="in"><div class="fa s${c ? c.s : 0}${c && c.r > 10 ? ' face' : ''}">${c ? Cards.face(c) : ''}</div><div class="ba"></div></div></div></div>`;
  }
  return { $, ICON, mini, dots, DIFF, toast, modal, close, press, fmtTime, cardHTML };
})();
