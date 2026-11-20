// Solitaire (Klondike) for Kayzee XP. Original card faces, a pixel grass-hill card back,
// a sunny grass felt and an original "tumble onto the lawn" win animation.

const SUITS = ['S', 'H', 'D', 'C'];
const RED = { H: 1, D: 1 };
const RANKS = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const LS_PREF = 'kayzee-solitaire-pref';
const LS_STATS = 'kayzee-solitaire-stats';

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ------------------------------------------------------------------ art: suits, pips, faces, back, felt
const SUIT_DEFS = `
<symbol id="kzsl-H" viewBox="0 0 100 100"><path d="M50 90C22 68 5 52 5 31 5 16 16 6 29 6c10 0 17 6 21 14 4-8 11-14 21-14 13 0 24 10 24 25 0 21-17 37-45 59z"/></symbol>
<symbol id="kzsl-D" viewBox="0 0 100 100"><path d="M50 3 86 50 50 97 14 50z"/></symbol>
<symbol id="kzsl-S" viewBox="0 0 100 100"><path d="M50 4c12 19 44 35 44 58 0 14-11 22-22 22-8 0-15-4-18-10 1 9 5 16 13 22H33c8-6 12-13 13-22-3 6-10 10-18 10-11 0-22-8-22-22C6 39 38 23 50 4z"/></symbol>
<symbol id="kzsl-C" viewBox="0 0 100 100"><circle cx="50" cy="27" r="19"/><circle cx="27" cy="57" r="19"/><circle cx="73" cy="57" r="19"/><circle cx="50" cy="52" r="12"/><path d="M45 56c0 18-4 29-13 38h36c-9-9-13-20-13-38z"/></symbol>`;
const PIPS = {
  2: [[50, 24], [50, 116, 1]],
  3: [[50, 24], [50, 70], [50, 116, 1]],
  4: [[30, 24], [70, 24], [30, 116, 1], [70, 116, 1]],
  5: [[30, 24], [70, 24], [50, 70], [30, 116, 1], [70, 116, 1]],
  6: [[30, 24], [70, 24], [30, 70], [70, 70], [30, 116, 1], [70, 116, 1]],
  7: [[30, 24], [70, 24], [50, 47], [30, 70], [70, 70], [30, 116, 1], [70, 116, 1]],
  8: [[30, 24], [70, 24], [50, 47], [30, 70], [70, 70], [50, 93, 1], [30, 116, 1], [70, 116, 1]],
  9: [[30, 22], [70, 22], [30, 54], [70, 54], [50, 70], [30, 86, 1], [70, 86, 1], [30, 118, 1], [70, 118, 1]],
  10: [[30, 22], [70, 22], [50, 38], [30, 54], [70, 54], [30, 86, 1], [70, 86, 1], [50, 102, 1], [30, 118, 1], [70, 118, 1]],
};
// tiny pixel emblems for the court cards (original): K = sun crown, Q = tulip, J = sprout in a pot
const EMBLEMS = {
  13: ['s....s....s', 'g...ggg...g', 'gg.ggsgg.gg', 'ggggggggggg', 'gwgggsgggsg', 'ggggggggggg', 'ooooooooooo'],
  12: ['...s.s.s...', '..sssssss..', '..swsssss..', '..sssssss..', '...sssss...', '.....l.....', '..ll.l.ll..', '...lllll...', '.....l.....'],
  11: ['..dl...ld..', '.dll...lld.', '.llll.llll.', '...llllll..', '.....l.....', '.....l.....', '..sssssss..', '..swsssss..', '...sssss...', '...sssss...'],
};
function pixelSVG(rows, pal, x0, y0, d) {
  let out = '';
  rows.forEach((row, r) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) out += `<rect x="${(x0 + i * d).toFixed(2)}" y="${(y0 + r * d).toFixed(2)}" width="${d + 0.15}" height="${d + 0.15}" fill="${c}"/>`; } });
  return out;
}
function centerSVG(s, r) {
  const col = RED[s] ? '#d23a2e' : '#1f2a36';
  if (r === 1) {
    let rays = '';
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, x = 50 + Math.cos(a) * 34, y = 70 + Math.sin(a) * 34;
      rays += `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="${k % 2 ? '#ffd23f' : '#f6a623'}" transform="rotate(${(k * 30).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    return `<circle cx="50" cy="70" r="27" fill="#fff4c6"/>${rays}<use href="#kzsl-${s}" x="24" y="44" width="52" height="52" fill="${col}"/>`;
  }
  if (r <= 10) {
    const u = (x, y) => `<use href="#kzsl-${s}" x="${x - 12}" y="${y - 12}" width="24" height="24" fill="${col}"/>`;
    return PIPS[r].map(([x, y, f]) => (f ? `<g transform="rotate(180 ${x} ${y})">${u(x, y)}</g>` : u(x, y))).join('');
  }
  const pal = { s: col, g: '#f2b632', o: '#c98512', w: '#fff', l: '#4fae32', d: '#2f7d1f' };
  const em = EMBLEMS[r], d = 7, ew = em[0].length * d, eh = em.length * d;
  return `<defs><linearGradient id="kzsl-sky-${s}${r}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe2ff"/><stop offset=".62" stop-color="#fff6d8"/></linearGradient></defs>
    <rect x="6" y="6" width="88" height="128" rx="6" fill="url(#kzsl-sky-${s}${r})" stroke="${col}" stroke-width="2.5"/>
    <circle cx="74" cy="30" r="10" fill="#ffd23f"/><circle cx="74" cy="30" r="14" fill="none" stroke="#ffd23f" stroke-width="2" stroke-dasharray="3 4"/>
    <path d="M7.2 108c18-16 40-20 58-14 12 4 20 2 28-3v36a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6z" fill="#69c043"/>
    <path d="M7.2 118c22-10 52-12 86-6v16a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6z" fill="#4a9e2e"/>
    ${pixelSVG(em, pal, 50 - ew / 2, 72 - eh / 2, d)}
`;
}
function backDataURL() {
  const W = 24, H = 34, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const sky = ['#4f9ff0', '#5aa8f3', '#66b0f5', '#74b9f7', '#84c3f9', '#95ccfb', '#a7d6fc'];
  for (let y = 0; y < H; y++) px(0, y, W, 1, sky[Math.min(sky.length - 1, Math.floor(y / 3.4))]);
  // sun
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - 17, y + 0.5 - 7.5); if (d < 3.2) px(x, y, 1, 1, d < 2 ? '#fff1a0' : '#ffd23f'); }
  [[17, 2], [17, 13], [11.5, 7], [22.5, 7], [13, 3], [21, 3], [13, 11], [21, 11]].forEach(([x, y]) => px(Math.floor(x), Math.floor(y), 1, 1, '#ffc22a'));
  // clouds
  const cloud = (x, y) => { px(x + 1, y, 4, 1, '#ffffff'); px(x, y + 1, 7, 1, '#ffffff'); px(x + 2, y - 1, 2, 1, '#ffffff'); px(x, y + 2, 7, 1, '#dfeeff'); };
  cloud(2, 5); cloud(6, 12);
  // hill
  for (let x = 0; x < W; x++) {
    const top = Math.round(22 + 3.5 * Math.cos((x - 7) / W * Math.PI * 1.3));
    px(x, top, 1, H - top, '#5cb83a'); px(x, top, 1, 1, '#9ee36a');
    for (let y = top + 1; y < H; y++) if (((x * 7 + y * 13) % 11) === 0) px(x, y, 1, 1, '#479a2a');
  }
  px(0, 30, W, 4, '#4ea532');
  for (let x = 0; x < W; x++) if ((x * 5) % 7 === 0) px(x, 29 + (x % 2), 1, 1, '#3f8f2a');
  // two flowers
  px(5, 26, 1, 1, '#ffffff'); px(5, 27, 1, 1, '#6fbf45'); px(18, 28, 1, 1, '#ffd23f'); px(18, 29, 1, 1, '#4fae32');
  return cv.toDataURL();
}
function feltDataURL() {
  const N = 160, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'); g.fillStyle = '#4caa3c'; g.fillRect(0, 0, N, N);
  const r = rng(42), cols = ['#55b545', '#469f37', '#5cbc4a', '#3f9632', '#62c24f'];
  for (let i = 0; i < 900; i++) {
    const x = r() * N, y = r() * N, h = 2 + r() * 4;
    g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = 0.55 + r() * 0.4;
    g.fillRect(Math.floor(x), Math.floor(y), 1, Math.ceil(h));
  }
  g.globalAlpha = 1;
  return cv.toDataURL();
}
function sunDataURL() {
  const N = 20, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 10); if (d < 5.2) { g.fillStyle = d < 4.3 ? '#ffd23f' : '#f29a16'; g.fillRect(x, y, 1, 1); } }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; for (let d = 6.6; d < 9; d += 1) { g.fillStyle = '#ffb21e'; g.fillRect(Math.round(10 + Math.cos(a) * d - 0.5), Math.round(10 + Math.sin(a) * d - 0.5), 1, 1); } }
  g.fillStyle = '#4a2a0a'; g.fillRect(8, 8, 1, 2); g.fillRect(11, 8, 1, 2); g.fillRect(8, 12, 1, 1); g.fillRect(9, 13, 2, 1); g.fillRect(11, 12, 1, 1);
  return cv.toDataURL();
}

// ------------------------------------------------------------------ the app
export default {
  id: 'solitaire',
  title: 'Solitaire',
  icon: 'solitaire',
  size: [720, 540],
  minSize: [420, 340],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const pref = lsGet(LS_PREF, { draw: 1 });
    let drawN = pref.draw === 3 ? 3 : 1;

    root.innerHTML = `
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SUIT_DEFS}</defs></svg>
      <div class="sl-menubar" role="menubar">
        <div class="sl-menu"><button class="sl-mtitle" type="button"><u>G</u>ame</button>
          <div class="sl-drop" role="menu">
            <button data-a="deal">Deal<span>F2</span></button>
            <button data-a="undo">Undo<span>Ctrl+Z</span></button><hr>
            <button data-a="draw1" class="radio">Draw One</button>
            <button data-a="draw3" class="radio">Draw Three</button><hr>
            <button data-a="finish">Auto-finish</button><hr>
            <button data-a="exit">Exit</button>
          </div></div>
        <div class="sl-menu"><button class="sl-mtitle" type="button"><u>H</u>elp</button>
          <div class="sl-drop" role="menu">
            <button data-a="howto">How to Play</button><hr>
            <button data-a="about">About Solitaire</button>
          </div></div>
      </div>
      <div class="sl-board"></div>
      <div class="sl-status"><span class="sl-st-msg"></span><span class="sl-st-score"></span><span class="sl-st-time"></span></div>
      <div class="sl-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const board = $('.sl-board'), menubar = $('.sl-menubar'), modal = $('.sl-modal');
    const stMsg = $('.sl-st-msg'), stScore = $('.sl-st-score'), stTime = $('.sl-st-time');
    board.style.setProperty('--sl-back', `url(${backDataURL()})`);
    board.style.setProperty('--sl-felt', `url(${feltDataURL()})`);
    const sunURL = sunDataURL();

    // slots (empty pile markers)
    const slots = {};
    const mkSlot = (name, cls, html = '') => { const d = document.createElement('div'); d.className = 'sl-slot ' + cls; d.dataset.pile = name; d.innerHTML = html; board.appendChild(d); slots[name] = d; };
    mkSlot('stock', 'sl-slot-stock', '<span class="sl-recycle"></span>');
    mkSlot('waste', 'sl-slot-waste');
    for (let i = 0; i < 4; i++) mkSlot('f' + i, 'sl-slot-found', `<span class="sl-ace">A</span>`);
    for (let i = 0; i < 7; i++) mkSlot('t' + i, 'sl-slot-tab');

    // cards
    const cards = [];
    for (const s of SUITS) for (let r = 1; r <= 13; r++) {
      const el = document.createElement('div');
      el.className = 'sl-card ' + (RED[s] ? 'red' : 'black');
      el.dataset.id = cards.length;
      const sym = `<svg viewBox="0 0 100 100"><use href="#kzsl-${s}"/></svg>`;
      el.innerHTML = `<div class="sl-face${r > 10 ? ' court' : ''}"><div class="sl-corner tl"><b>${RANKS[r]}</b>${sym}</div><div class="sl-corner br"><b>${RANKS[r]}</b>${sym}</div>
        <svg class="sl-mid" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">${centerSVG(s, r)}</svg></div><div class="sl-back"></div>`;
      el.setAttribute('aria-label', `${RANKS[r]} of ${{ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[s]}`);
      board.appendChild(el);
      cards.push({ id: cards.length, s, r, red: !!RED[s], up: false, el, x: 0, y: 0 });
    }

    // ---------------------------------------------------------------- state
    let stock, waste, found, tab, score, moves, history, timeStart, timeAcc, timerId, won, finishing, winAnim;
    let geo = null;
    const pileOf = (name) => (name === 'stock' ? stock : name === 'waste' ? waste : name[0] === 'f' ? found[+name[1]] : tab[+name[1]]);
    function locate(card) {
      if (stock.includes(card)) return { pile: 'stock', idx: stock.indexOf(card) };
      if (waste.includes(card)) return { pile: 'waste', idx: waste.indexOf(card) };
      for (let i = 0; i < 4; i++) if (found[i].includes(card)) return { pile: 'f' + i, idx: found[i].indexOf(card) };
      for (let i = 0; i < 7; i++) if (tab[i].includes(card)) return { pile: 't' + i, idx: tab[i].indexOf(card) };
      return null;
    }

    function newGame(seed) {
      stopWin();
      const r = rng(seed ?? ((Math.random() * 2 ** 32) >>> 0));
      const deck = cards.slice();
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      tab = [[], [], [], [], [], [], []]; found = [[], [], [], []]; waste = []; stock = [];
      for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) { const c = deck.pop(); c.up = j === i; tab[j].push(c); }
      while (deck.length) { const c = deck.pop(); c.up = false; stock.push(c); }
      score = 0; moves = 0; history = []; won = false; finishing = false;
      clearInterval(timerId); timerId = 0; timeStart = 0; timeAcc = 0;
      board.classList.remove('sl-won');
      cards.forEach((c) => { c.el.style.transition = 'none'; });
      layout(false);
      requestAnimationFrame(() => cards.forEach((c) => { c.el.style.transition = ''; }));
      status('Deal: ' + (drawN === 1 ? 'Draw One' : 'Draw Three'));
      ctx.sound && ctx.sound('click');
      clearTimeout(autoT); autoT = setTimeout(afterMove, 450); // aces showing on the deal hop up too
    }
    const elapsed = () => Math.floor(timeAcc + (timeStart ? (performance.now() - timeStart) / 1000 : 0));
    function startClock() {
      if (timerId || won) return;
      timeStart = performance.now();
      let lastPen = Math.floor(elapsed() / 10);
      timerId = setInterval(() => {
        const t = elapsed(), pen = Math.floor(t / 10);
        if (pen > lastPen) { score = Math.max(0, score - 2 * (pen - lastPen)); lastPen = pen; }
        status();
      }, 500);
    }
    function stopClock() { if (timerId) { timeAcc = elapsed(); timeStart = 0; clearInterval(timerId); timerId = 0; } }
    function status(msg) {
      if (msg !== undefined) stMsg.textContent = msg;
      const t = elapsed();
      stScore.textContent = 'Score: ' + score;
      stTime.textContent = 'Time: ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      ctx.setStatus && ctx.setStatus(`Score ${score} · ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    }

    // ---------------------------------------------------------------- undo
    function snapshot() {
      return { stock: stock.map((c) => c.id), waste: waste.map((c) => c.id), found: found.map((p) => p.map((c) => c.id)), tab: tab.map((p) => p.map((c) => c.id)), up: cards.filter((c) => c.up).map((c) => c.id), score, moves };
    }
    function pushHistory() { history.push(snapshot()); if (history.length > 300) history.shift(); }
    function undo() {
      if (!history.length || won || finishing) return;
      const s = history.pop(), m = (ids) => ids.map((i) => cards[i]);
      stock = m(s.stock); waste = m(s.waste); found = s.found.map(m); tab = s.tab.map(m);
      const up = new Set(s.up); cards.forEach((c) => { c.up = up.has(c.id); });
      score = s.score; moves = s.moves;
      layout(true); status('Undo');
    }

    // ---------------------------------------------------------------- rules
    const top = (p) => p[p.length - 1];
    function canFound(card, fi) {
      const p = found[fi];
      if (!p.length) return card.r === 1;
      const t = top(p); return t.s === card.s && card.r === t.r + 1;
    }
    function canTab(card, ti) {
      const p = tab[ti];
      if (!p.length) return card.r === 13;
      const t = top(p); return t.up && t.red !== card.red && card.r === t.r - 1;
    }
    function legal(cardsMoving, dest) {
      const c = cardsMoving[0];
      if (dest[0] === 'f') return cardsMoving.length === 1 && canFound(c, +dest[1]);
      if (dest[0] === 't') return canTab(c, +dest[1]);
      return false;
    }
    function movable(card) {
      const loc = locate(card);
      if (!loc || !card.up) return null;
      const p = pileOf(loc.pile);
      if (loc.pile === 'waste' || loc.pile[0] === 'f') return loc.idx === p.length - 1 ? { loc, list: [card] } : null;
      if (loc.pile[0] === 't') return { loc, list: p.slice(loc.idx) };
      return null;
    }
    function doMove(list, from, dest, { record = true, auto = false } = {}) {
      if (record) pushHistory();
      const src = pileOf(from), dst = pileOf(dest);
      src.splice(src.length - list.length, list.length);
      dst.push(...list);
      if (from === 'waste' && dest[0] === 't') score += 5;
      else if (from === 'waste' && dest[0] === 'f') score += 10;
      else if (from[0] === 't' && dest[0] === 'f') score += 10;
      else if (from[0] === 'f' && dest[0] === 't') score = Math.max(0, score - 15);
      if (from[0] === 't' && src.length && !top(src).up) { top(src).up = true; score += 5; }
      moves++; if (!auto) startClock();
      list.forEach((c) => fly(c));
      layout(true); status(auto ? '' : undefined);
      afterMove();
    }
    function deal() {
      if (won || finishing) return;
      if (!stock.length) {
        if (!waste.length) return;
        pushHistory();
        stock = waste.reverse(); waste = []; stock.forEach((c) => { c.up = false; });
        score = Math.max(0, score - (drawN === 1 ? 100 : 20));
        startClock(); layout(true); status('Recycled the waste'); return;
      }
      pushHistory();
      for (let k = 0; k < drawN && stock.length; k++) { const c = stock.pop(); c.up = true; waste.push(c); fly(c); }
      startClock(); layout(true); status('');
      afterMove();
    }
    function sendToFoundation(card) {
      const m = movable(card);
      if (!m || m.list.length !== 1) return false;
      for (let i = 0; i < 4; i++) if (canFound(card, i)) { doMove([card], m.loc.pile, 'f' + i); return true; }
      return false;
    }
    let autoT = 0;
    function afterMove() {
      clearTimeout(autoT);
      if (found.every((p) => p.length === 13)) { autoT = setTimeout(win, 260); return; }
      autoT = setTimeout(() => {
        // auto-move aces
        const cands = [top(waste), ...tab.map(top)].filter((c) => c && c.up && c.r === 1);
        if (cands.length) {
          const c = cands[0], m = movable(c), fi = found.findIndex((p) => !p.length);
          if (m && fi >= 0) { doMove([c], m.loc.pile, 'f' + fi, { record: false, auto: true }); return; }
        }
        if (!stock.length && !waste.length && tab.every((p) => p.every((c) => c.up)) && !finishing) autoFinish();
      }, 170);
    }
    function allUp() { return tab.every((p) => p.every((c) => c.up)); }
    function autoFinish() {
      if (won || finishing) return;
      if (!allUp()) { status('Turn every card face up first'); ctx.sound && ctx.sound('error'); return; }
      finishing = true; status('Auto-finishing…');
      let idle = 0;
      const step = () => {
        if (!finishing) return;
        if (found.every((p) => p.length === 13)) { finishing = false; win(); return; }
        const avail = [top(waste), ...tab.map(top)].filter(Boolean).sort((a, b) => a.r - b.r);
        for (const c of avail) {
          const fi = [0, 1, 2, 3].find((i) => canFound(c, i));
          if (fi !== undefined) {
            const from = locate(c).pile, src = pileOf(from);
            src.pop(); found[fi].push(c);
            score += from === 'waste' ? 10 : 10; moves++;
            fly(c); layout(true); status(); idle = 0;
            setTimeout(step, 85); return;
          }
        }
        if ((stock.length || waste.length) && idle < 60) { // dig through the stock
          idle++;
          if (!stock.length) { stock = waste.reverse(); waste = []; stock.forEach((c) => { c.up = false; }); }
          for (let k = 0; k < drawN && stock.length; k++) { const c = stock.pop(); c.up = true; waste.push(c); }
          layout(true); setTimeout(step, 85); return;
        }
        finishing = false; status('No more automatic moves');
      };
      step();
    }

    // ---------------------------------------------------------------- layout
    function computeGeo() {
      const W = board.clientWidth, H = board.clientHeight;
      const gap = Math.max(5, Math.round(W * 0.016));
      let cw = Math.floor((W - gap * 8) / 7);
      cw = Math.min(cw, Math.floor((H - gap * 3) / (1.42 * 2.9)), 132);
      cw = Math.max(cw, 34);
      const ch = Math.round(cw * 1.42);
      const used = cw * 7 + gap * 6, x0 = Math.round((W - used) / 2);
      const col = (i) => x0 + i * (cw + gap);
      return { W, H, gap, cw, ch, col, y0: gap + 2, ty: gap + 2 + ch + Math.round(gap * 1.6) };
    }
    function pos(name) {
      const g = geo;
      if (name === 'stock') return [g.col(0), g.y0];
      if (name === 'waste') return [g.col(1), g.y0];
      if (name[0] === 'f') return [g.col(3 + +name[1]), g.y0];
      return [g.col(+name[1]), g.ty];
    }
    function tabOffsets(p) {
      const g = geo, down = Math.round(g.ch * 0.1);
      let up = Math.round(g.ch * 0.25);
      const nDown = p.filter((c) => !c.up).length, nUp = p.length - nDown;
      const room = g.H - g.ty - g.ch - 6 - nDown * down;
      if (nUp > 1 && (nUp - 1) * up > room) up = Math.max(Math.round(g.ch * 0.11), Math.floor(room / (nUp - 1)));
      return { down, up };
    }
    let flying = new Set();
    function fly(c) { flying.add(c); c.el.classList.add('sl-fly'); setTimeout(() => { flying.delete(c); c.el.classList.remove('sl-fly'); }, 260); }
    function place(c, x, y, z) {
      c.x = x; c.y = y;
      c.el.style.transform = `translate(${x}px, ${y}px)`;
      c.el.style.zIndex = flying.has(c) ? 900 + z : z;
      c.el.classList.toggle('up', c.up);
    }
    function layout(animate = true) {
      geo = computeGeo();
      const g = geo;
      board.style.setProperty('--cw', g.cw + 'px'); board.style.setProperty('--ch', g.ch + 'px');
      for (const [name, el] of Object.entries(slots)) {
        const [x, y] = pos(name); el.style.transform = `translate(${x}px, ${y}px)`;
      }
      slots.stock.classList.toggle('empty-done', !stock.length && !waste.length);
      if (!animate) cards.forEach((c) => { c.el.style.transition = 'none'; });
      const [sx, sy] = pos('stock');
      stock.forEach((c, i) => place(c, sx + Math.min(2, Math.floor(i / 8)), sy + Math.min(2, Math.floor(i / 8)) * 0, 10 + i));
      const [wx, wy] = pos('waste'), fan = Math.round(g.cw * 0.2);
      const showN = drawN === 3 ? 3 : 1, visStart = Math.max(0, waste.length - showN);
      waste.forEach((c, i) => place(c, wx + Math.max(0, i - visStart) * fan, wy, 100 + i));
      found.forEach((p, f) => { const [fx, fy] = pos('f' + f); p.forEach((c, i) => place(c, fx, fy, 200 + i)); });
      tab.forEach((p, t) => {
        const [tx, ty] = pos('t' + t), o = tabOffsets(p);
        let y = ty;
        p.forEach((c, i) => { place(c, tx, y, 300 + i); y += c.up ? o.up : o.down; });
      });
      if (!animate) { void board.offsetWidth; requestAnimationFrame(() => cards.forEach((c) => { c.el.style.transition = ''; })); }
    }

    // ---------------------------------------------------------------- pointer input (tilt-safe: offsets are in board space)
    let drag = null, lastTap = { id: -1, t: 0 };
    function toLocal(e) {
      if (e.target === board) return [e.offsetX, e.offsetY];
      const el = e.target.closest && e.target.closest('.sl-card, .sl-slot');
      if (el && el.parentElement === board && !el.classList.contains('sl-drag')) {
        const c = el.classList.contains('sl-card') ? cards[+el.dataset.id] : null;
        const [x, y] = c ? [c.x, c.y] : pos(el.dataset.pile);
        return [x + e.offsetX, y + e.offsetY];
      }
      const r = board.getBoundingClientRect();
      return [(e.clientX - r.left) * board.clientWidth / r.width, (e.clientY - r.top) * board.clientHeight / r.height];
    }
    function onDown(e) {
      focused = true;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (drag) return;
      if (winAnim) { skipWin(); return; }
      if (won || finishing) return;
      const el = e.target.closest('.sl-card, .sl-slot');
      if (!el) return;
      e.preventDefault();
      if (el.classList.contains('sl-slot')) { if (el.dataset.pile === 'stock') deal(); return; }
      const card = cards[+el.dataset.id], loc = locate(card);
      if (loc.pile === 'stock') { deal(); return; }
      const m = movable(card);
      if (!m) return;
      const [lx, ly] = toLocal(e);
      drag = { id: e.pointerId, list: m.list, from: m.loc.pile, sx: lx, sy: ly, moved: false, card };
      try { board.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const [lx, ly] = toLocal(e), dx = lx - drag.sx, dy = ly - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.base = drag.list.map((c) => [c.x, c.y]);
        drag.list.forEach((c, i) => { c.el.style.transition = 'none'; c.el.style.zIndex = 2000 + i; c.el.classList.add('sl-drag'); });
      }
      drag.dx = dx; drag.dy = dy;
      drag.list.forEach((c, i) => { c.el.style.transform = `translate(${drag.base[i][0] + dx}px, ${drag.base[i][1] + dy}px)`; });
    }
    function dropTarget() {
      const g = geo, c0 = drag.list[0];
      const x = drag.base[0][0] + drag.dx, y = drag.base[0][1] + drag.dy;
      let best = null, bestA = 0;
      const test = (name, rx, ry, rh) => {
        if (name === drag.from) return;
        const ox = Math.max(0, Math.min(x + g.cw, rx + g.cw) - Math.max(x, rx));
        const oy = Math.max(0, Math.min(y + g.ch, ry + rh) - Math.max(y, ry));
        const a = ox * oy;
        if (a > bestA && legal(drag.list, name)) { bestA = a; best = name; }
      };
      for (let i = 0; i < 4; i++) { const [fx, fy] = pos('f' + i); test('f' + i, fx, fy, g.ch); }
      for (let i = 0; i < 7; i++) {
        const p = tab[i], [tx, ty] = pos('t' + i);
        const t = top(p), yTop = t ? t.y : ty;
        test('t' + i, tx, yTop, g.ch);
      }
      void c0;
      return best;
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      d.list.forEach((c) => { c.el.classList.remove('sl-drag'); c.el.style.transition = ''; });
      if (!d.moved) {
        const now = performance.now();
        if (lastTap.id === d.card.id && now - lastTap.t < 420) { lastTap.id = -1; if (!sendToFoundation(d.card)) ctx.sound && ctx.sound('error'); }
        else lastTap = { id: d.card.id, t: now };
        return;
      }
      drag = d; const dest = e.type === 'pointerup' ? dropTarget() : null; drag = null;
      if (dest) doMove(d.list, d.from, dest);
      else layout(true);
    }
    board.addEventListener('pointerdown', onDown);
    board.addEventListener('pointermove', onMove);
    board.addEventListener('pointerup', onUp);
    board.addEventListener('pointercancel', onUp);
    board.addEventListener('dblclick', (e) => e.preventDefault());
    board.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---------------------------------------------------------------- win: cards tumble onto the lawn
    let lawn = null, banner = null, winRaf = 0;
    function win() {
      if (won) return;
      won = true; finishing = false; stopClock();
      const t = elapsed();
      if (t >= 30) score += Math.round(700000 / t);
      status('You won!');
      const st = lsGet(LS_STATS, { wins: 0, best: 0 }); st.wins++; st.best = Math.max(st.best, score); lsSet(LS_STATS, st);
      ctx.sound && ctx.sound('ding');
      board.classList.add('sl-won');
      lawn = document.createElement('div'); lawn.className = 'sl-lawn'; board.appendChild(lawn);
      requestAnimationFrame(() => lawn.classList.add('in'));
      const g = geo, W = g.W, H = g.H, lawnH = Math.round(Math.min(H * 0.3, g.ch * 1.1));
      lawn.style.height = lawnH + 'px';
      const order = [];
      for (let k = 12; k >= 0; k--) for (let f = 0; f < 4; f++) if (found[f][k]) order.push(found[f][k]);
      const r = rng(7);
      const gScale = H / 520;
      winAnim = {
        t0: performance.now(), last: performance.now(),
        parts: order.map((c, i) => ({
          c, x: c.x, y: c.y, vx: (r() - 0.5) * 520 * gScale, vy: -(520 + r() * 380) * gScale, rot: 0, vr: (r() - 0.5) * 900,
          ph: 0, vph: (r() < 0.5 ? -1 : 1) * (6 + r() * 10), launch: i * 70, ground: H - lawnH * (0.35 + r() * 0.45) - g.ch,
          rest: (r() - 0.5) * 50, state: 0, z: 3000 + i, bounces: 0,
        })),
        g: 1900 * gScale, W, lawnH,
      };
      order.forEach((c) => { c.el.style.transition = 'none'; });
      const tick = (now) => {
        if (!winAnim) return;
        const dt = Math.min(0.033, (now - winAnim.last) / 1000); winAnim.last = now;
        const el = now - winAnim.t0; let resting = 0;
        for (const p of winAnim.parts) {
          if (el < p.launch) continue;
          if (p.state === 0) { p.state = 1; p.c.el.style.zIndex = p.z; }
          if (p.state === 1) {
            p.vy += winAnim.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.ph += p.vph * dt;
            if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * 0.6; }
            if (p.x > W - g.cw) { p.x = W - g.cw; p.vx = -Math.abs(p.vx) * 0.6; }
            if (p.y > p.ground && p.vy > 0) {
              p.y = p.ground; p.bounces++;
              p.vy = -p.vy * 0.38; p.vx *= 0.62; p.vr *= 0.5; p.vph *= 0.55;
              if (Math.abs(p.vy) < 90 * gScale || p.bounces > 4) p.state = 2;
            }
          } else if (p.state === 2) {
            p.vx *= 0.88; p.x += p.vx * dt;
            p.rot += (p.rest - p.rot) * Math.min(1, dt * 8);
            const target = Math.round(p.ph / (2 * Math.PI)) * 2 * Math.PI; // settle face up
            p.ph += (target - p.ph) * Math.min(1, dt * 7);
            if (Math.abs(p.vx) < 2 && Math.abs(p.rot - p.rest) < 0.5 && Math.abs(p.ph - target) < 0.02) { p.ph = target; p.state = 3; }
          }
          if (p.state === 3) resting++;
          const sx = Math.cos(p.ph);
          p.c.el.classList.toggle('up', sx >= 0);
          p.c.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.rot.toFixed(1)}deg) scaleX(${Math.max(0.04, Math.abs(sx)).toFixed(3)})`;
        }
        if (resting === winAnim.parts.length) { winAnim = null; showBanner(); return; }
        winRaf = requestAnimationFrame(tick);
      };
      winRaf = requestAnimationFrame(tick);
    }
    function skipWin() {
      if (!winAnim) return;
      for (const p of winAnim.parts) {
        p.y = p.ground; p.rot = p.rest; p.c.el.style.zIndex = p.z; p.c.el.classList.add('up');
        p.c.el.style.transform = `translate(${Math.max(0, Math.min(winAnim.W - geo.cw, p.x + p.vx * 0.4)).toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.rot.toFixed(1)}deg)`;
      }
      cancelAnimationFrame(winRaf); winAnim = null; showBanner();
    }
    function showBanner() {
      const t = elapsed();
      banner = document.createElement('div'); banner.className = 'sl-banner';
      banner.innerHTML = `<img alt="" src="${sunURL}"><div><b>You won!</b><span>Score ${score} · Time ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</span></div><button type="button" class="sl-btn default">Deal again</button>`;
      banner.querySelector('button').addEventListener('click', () => newGame());
      board.appendChild(banner);
    }
    function stopWin() {
      cancelAnimationFrame(winRaf); winAnim = null;
      if (lawn) { lawn.remove(); lawn = null; }
      if (banner) { banner.remove(); banner = null; }
      cards.forEach((c) => { c.el.style.zIndex = ''; });
    }

    // ---------------------------------------------------------------- menus
    let openMenu = null;
    function setMenu(m) {
      openMenu = m;
      root.querySelectorAll('.sl-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) {
        root.querySelector('[data-a="draw1"]').classList.toggle('on', drawN === 1);
        root.querySelector('[data-a="draw3"]').classList.toggle('on', drawN === 3);
        root.querySelector('[data-a="undo"]').disabled = !history.length || won;
        root.querySelector('[data-a="finish"]').disabled = won || !allUp();
      }
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.sl-mtitle');
      if (t) { e.preventDefault(); setMenu(openMenu === t.parentElement ? null : t.parentElement); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.sl-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => { const b = e.target.closest('.sl-drop button'); if (b && !b.disabled) { setMenu(null); action(b.dataset.a); } });
    const outside = (e) => { if (openMenu && !openMenu.contains(e.target)) setMenu(null); if (!root.contains(e.target)) focused = false; };
    document.addEventListener('pointerdown', outside, true);
    function action(a) {
      if (a === 'deal') newGame();
      else if (a === 'undo') undo();
      else if (a === 'draw1' || a === 'draw3') { drawN = a === 'draw1' ? 1 : 3; lsSet(LS_PREF, { draw: drawN }); newGame(); }
      else if (a === 'finish') autoFinish();
      else if (a === 'exit') ctx.close && ctx.close();
      else if (a === 'howto') dialog('How to Play', `<p>Build four piles on the top right, one per suit, from <b>A</b> up to <b>K</b>.</p>
        <ul><li>In the seven columns, stack cards downward in alternating colours. Only a <b>K</b> may fill an empty column.</li>
        <li><b>Drag</b> cards (or a run of face-up cards) to move them. <b>Double-click</b> a card to send it up.</li>
        <li>Click the deck to turn over ${drawN === 1 ? 'one card' : 'three cards'}. Aces hop up by themselves.</li>
        <li><b>Ctrl+Z</b> undoes, <b>F2</b> deals again.</li></ul>`);
      else if (a === 'about') dialog('About Solitaire', `<p><b>Solitaire</b> for Kayzee XP.</p><p>Original card art and code. A fan homage to the classic patience game; not affiliated with any operating-system vendor.</p>`);
    }
    function dialog(title, html) {
      modal.innerHTML = `<div class="sl-dlg" role="dialog" aria-label="${title}"><div class="sl-dlg-t">${title}</div><div class="sl-dlg-b">${html}</div><div class="sl-dlg-f"><button type="button" class="sl-btn default">OK</button></div></div>`;
      modal.querySelector('button').addEventListener('click', () => { modal.hidden = true; });
      modal.hidden = false; modal.querySelector('button').focus({ preventScroll: true });
    }

    // ---------------------------------------------------------------- keys & focus
    let focused = false;
    const onKey = (e) => {
      if (!focused) return;
      if (e.key === 'F2') { e.preventDefault(); newGame(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); }
      else if (e.key === 'Escape') { setMenu(null); modal.hidden = true; }
    };
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', () => { focused = true; });

    const ro = new ResizeObserver(() => { if (!winAnim && !won) layout(false); });
    ro.observe(board);
    newGame();

    // test hooks (harmless in production)
    Object.defineProperty(root, '_kzSol', { configurable: true, value: {
      get state() { return { stock: stock.length, waste: waste.map((c) => c.id), found: found.map((p) => p.map((c) => c.id)), tab: tab.map((p) => p.map((c) => ({ id: c.id, up: c.up }))), score, won, moves, drawN, history: history.length }; },
      card: (id) => { const c = cards[id]; const r = c.el.getBoundingClientRect(); return { id, s: c.s, r: c.r, red: c.red, up: c.up, loc: locate(c), rect: [r.left, r.top, r.width, r.height] }; },
      slot: (name) => { const r = slots[name].getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; },
      legal: (id, dest) => { const m = movable(cards[id]); return !!m && legal(m.list, dest); },
      newGame, deal, undo,
      get winAnimating() { return !!winAnim; }, get banner() { return !!banner; },
      rig() { // arrange a fully-open tableau so auto-finish runs (used by the test harness)
        stopWin(); won = false; finishing = false; history = []; stock = []; waste = []; found = [[], [], [], []]; tab = [[], [], [], [], [], [], []];
        const by = (s, r) => cards.find((c) => c.s === s && c.r === r);
        const pairs = [['S', 'H'], ['H', 'S'], ['D', 'C'], ['C', 'D']];
        pairs.forEach(([a, b], i) => { for (let r = 13; r >= 1; r--) { const c = by((13 - r) % 2 ? b : a, r); c.up = true; tab[i].push(c); } });
        layout(false);
      },
    } });

    return {
      onResize() { if (!winAnim && !won) layout(false); },
      onFocus() { focused = true; },
      onBlur() { focused = false; setMenu(null); },
      unmount() {
        clearInterval(timerId); clearTimeout(autoT); cancelAnimationFrame(winRaf); finishing = false; winAnim = null;
        ro.disconnect();
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', outside, true);
        delete root._kzSol;
        root.innerHTML = '';
      },
    };
  },
};
