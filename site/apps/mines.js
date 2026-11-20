// Mines: an original take on the classic mine-grid puzzle, in the Voxel Luna style.
// Raised grass blocks, flat earth when dug, moles instead of mines, a sun-face reset button
// and wooden counters. All art is drawn procedurally here (no external assets).

const LEVELS = {
  beginner: { c: 9, r: 9, m: 10, label: 'Beginner' },
  intermediate: { c: 16, r: 16, m: 40, label: 'Intermediate' },
  expert: { c: 30, r: 16, m: 99, label: 'Expert' },
};
const LS_BEST = 'kayzee-mines-best';
const LS_PREF = 'kayzee-mines-pref';
const HEAD_H = 50, FRAME_PAD = 10, MENU_H = 22, MIN_CS = 16, MAX_CS = 40;

// ------------------------------------------------------------------ palette (original)
const P = {
  grassHi: '#a8e46e', grass: '#6cc243', grassMid: '#5cb336', grassLo: '#479a2a', grassDk: '#357a1f',
  tuft: '#8fd85a', side: '#8a5a32', sideHi: '#a06c3e', sideDk: '#6b4224',
  earth: '#d9b27c', earthHi: '#e6c592', earthLo: '#c69a62', earthDk: '#ad824d', earthLine: '#b88b55',
  boom: '#e8604a', boomHi: '#f48a6c',
  num: [null, '#2f72d6', '#2f8f2a', '#e0402f', '#7b3fb0', '#c77a10', '#13878a', '#c42a6a', '#3d3654'],
};
const DIGITS = {
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
};

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }

// ------------------------------------------------------------------ sprite painter (16x16 logical grid)
function painter(S) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const p = S / 16;
  const R = (v) => Math.round(v * p);
  const px = (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(x0, y0, R(x + w) - x0, R(y + h) - y0); };
  return { cv, g, px, p };
}
function bitmap(px, rows, x, y, d, c) {
  rows.forEach((row, r) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') px(x + i * d, y + r * d, d, d, c); });
}
function grassTile(S, variant, pressed) {
  const { cv, px } = painter(S);
  if (pressed) {
    px(0, 0, 16, 16, P.earthLo); px(0, 0, 16, 1, P.earthDk); px(0, 0, 1, 16, P.earthDk);
    px(1, 1, 15, 1, '#b98d56'); px(1, 1, 1, 15, '#b98d56');
    return cv;
  }
  px(0, 0, 16, 16, P.grass);
  px(0, 12, 16, 4, P.side); px(0, 12, 16, 1, P.grassLo); px(0, 13, 16, 1, P.sideHi); px(0, 15, 16, 1, P.sideDk);
  px(0, 0, 16, 1, P.grassHi); px(0, 0, 1, 12, P.grassHi); px(15, 1, 1, 11, P.grassLo); px(1, 11, 15, 1, P.grassMid);
  const r = rng(variant * 977 + 13);
  for (let i = 0; i < 7; i++) { const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 8); px(x, y, 1, 1, r() < 0.5 ? P.grassMid : P.tuft); }
  // a little tuft and a soil fleck on the side face
  const tx = 3 + Math.floor(r() * 9), ty = 3 + Math.floor(r() * 6);
  px(tx, ty, 1, 2, P.grassDk); px(tx + 1, ty - 1, 1, 3, P.grassLo); px(tx + 2, ty + 1, 1, 1, P.grassDk);
  px(2 + Math.floor(r() * 11), 14, 2, 1, P.sideDk);
  if (variant % 5 === 0) { const fx = 4 + Math.floor(r() * 8), fy = 3 + Math.floor(r() * 5); px(fx, fy, 1, 1, '#fff6c8'); px(fx + 1, fy, 1, 1, '#ffd23f'); }
  return cv;
}
function earthTile(S, variant, boom) {
  const { cv, px } = painter(S);
  px(0, 0, 16, 16, boom ? P.boom : P.earth);
  px(0, 0, 16, 1, boom ? '#c94a36' : P.earthLine); px(0, 0, 1, 16, boom ? '#c94a36' : P.earthLine);
  const r = rng(variant * 331 + 7);
  for (let i = 0; i < 6; i++) { const x = 2 + Math.floor(r() * 13), y = 2 + Math.floor(r() * 13); px(x, y, 1, 1, boom ? P.boomHi : (r() < 0.5 ? P.earthHi : P.earthLo)); }
  return cv;
}
function numberTile(S, n) {
  const { cv, px } = painter(S);
  const d = 1.75, w = 5 * d, h = 7 * d, x = (16 - w) / 2, y = (16 - h) / 2;
  bitmap(px, DIGITS[n], x + 0.75, y + 0.75, d, 'rgba(90,55,20,.3)');
  bitmap(px, DIGITS[n], x, y, d, P.num[n]);
  return cv;
}
function flagTile(S) {
  const { cv, px } = painter(S);
  px(6, 3, 1, 9, '#7a4a22'); px(7, 3, 1, 9, '#5c3416'); // wooden stake
  px(8, 3, 5, 1, '#ff8a3a'); px(8, 4, 6, 1, '#ff6a2a'); px(8, 5, 5, 1, '#f0521f'); px(8, 6, 3, 1, '#d84416'); px(8, 7, 1, 1, '#c03a12');
  px(9, 3, 2, 1, '#ffb070');
  px(4, 11, 6, 1, P.grassDk); px(5, 10, 4, 1, P.grassLo);
  return cv;
}
function questionTile(S) {
  const { cv, px } = painter(S);
  const rows = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
  bitmap(px, rows, 4.7, 2.9, 1.5, 'rgba(30,60,10,.45)');
  bitmap(px, rows, 4.2, 2.4, 1.5, '#fff7d6');
  return cv;
}
function moleTile(S) {
  const { cv, px } = painter(S);
  // dirt mound
  px(2, 12, 12, 2, '#7a5232'); px(1, 13, 14, 2, '#6b4426'); px(3, 11, 10, 1, '#8f6238');
  // body
  px(4, 5, 8, 7, '#6e5a4e'); px(5, 4, 6, 1, '#6e5a4e'); px(3, 7, 1, 4, '#6e5a4e'); px(12, 7, 1, 4, '#6e5a4e');
  px(5, 4, 4, 1, '#8a7466'); px(4, 5, 2, 2, '#8a7466');
  px(10, 9, 2, 3, '#5a483e');
  // face
  px(6, 7, 1, 1, '#1d1714'); px(9, 7, 1, 1, '#1d1714');
  px(7, 8, 2, 2, '#ff8fa8'); px(7, 8, 1, 1, '#ffc4d2');
  px(6, 10, 4, 1, '#d8c9b8');
  // paws
  px(3, 11, 3, 1, '#ffb9a8'); px(10, 11, 3, 1, '#ffb9a8');
  return cv;
}
function crossTile(S) {
  const { cv, px } = painter(S);
  for (let i = 0; i < 10; i++) { px(3 + i, 3 + i, 1.4, 1.4, '#d22a1c'); px(12 - i, 3 + i, 1.4, 1.4, '#d22a1c'); }
  return cv;
}

// ------------------------------------------------------------------ sun-face button & wooden counter (CSS px, drawn at DPR)
function drawSun(cv, mood, pressed) {
  const N = 22, dpr = Math.min(3, window.devicePixelRatio || 1);
  const css = cv.clientWidth || 34;
  cv.width = Math.round(css * dpr); cv.height = cv.width;
  const g = cv.getContext('2d'); const p = cv.width / N;
  const R = (v) => Math.round(v * p);
  const px = (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(x0, y0, R(x + w) - x0, R(y + h) - y0); };
  g.clearRect(0, 0, cv.width, cv.height);
  const sad = mood === 'sad';
  const body = sad ? '#f2c94c' : '#ffd23f', hi = sad ? '#f8dc84' : '#ffe98a', rim = sad ? '#d9962a' : '#f29a16', ray = sad ? '#e8b03a' : '#ffb21e';
  const cx = 10.5, cy = 10.5 + (pressed ? 0.5 : 0);
  for (let a = 0; a < 8; a++) {
    const t = a * Math.PI / 4;
    for (let d = 7.8; d < 10; d += 0.9) px(Math.round(cx + Math.cos(t) * d - 0.5), Math.round(cy + Math.sin(t) * d - 0.5), 1, 1, ray);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < 6.0) px(x, y, 1, 1, body); else if (d < 6.9) px(x, y, 1, 1, rim);
  }
  px(7, 6 + (pressed ? 0.5 : 0), 3, 1, hi); px(6, 7 + (pressed ? 0.5 : 0), 1, 2, hi);
  const oy = pressed ? 0.5 : 0, ink = '#4a2a0a', blush = '#ff9a6a';
  if (mood === 'smile') {
    px(8, 9 + oy, 1, 2, ink); px(12, 9 + oy, 1, 2, ink);
    px(8, 13 + oy, 1, 1, ink); px(9, 14 + oy, 3, 1, ink); px(12, 13 + oy, 1, 1, ink);
    px(6, 12 + oy, 1, 1, blush); px(14, 12 + oy, 1, 1, blush);
  } else if (mood === 'gasp') {
    px(7, 8 + oy, 2, 2, ink); px(12, 8 + oy, 2, 2, ink);
    px(9, 12 + oy, 3, 3, ink); px(10, 13 + oy, 1, 1, '#c9502a');
  } else if (mood === 'cool') {
    px(6, 8 + oy, 10, 1, '#1a1a22'); px(6, 9 + oy, 4, 2, '#1a1a22'); px(11, 9 + oy, 4, 2, '#1a1a22');
    px(7, 9 + oy, 1, 1, '#7fd0ff'); px(12, 9 + oy, 1, 1, '#7fd0ff');
    px(8, 13 + oy, 1, 1, ink); px(9, 14 + oy, 4, 1, ink); px(13, 13 + oy, 1, 1, ink);
  } else if (sad) {
    px(8, 10, 1, 1, ink); px(12, 10, 1, 1, ink); px(7, 9, 1, 1, ink); px(13, 9, 1, 1, ink);
    px(9, 13, 3, 1, ink); px(8, 14, 1, 1, ink); px(12, 14, 1, 1, ink);
    // a little grey rain cloud drifting over the sun
    const cl = '#b9c3cf', clh = '#dfe6ee', cld = '#8d99a8';
    px(10, 2, 6, 2, cl); px(8, 3, 11, 3, cl); px(12, 1, 3, 1, clh); px(9, 3, 3, 1, clh); px(8, 6, 11, 1, cld);
    px(11, 8, 1, 2, '#5aa8ff'); px(15, 9, 1, 2, '#5aa8ff');
  }
}
function drawCounter(cv, value) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = 3 * 6 + 3, H = 11; // logical pixels: 3 digits of 5 + gaps + border
  const cssW = cv.clientWidth || 54;
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssW * dpr * H / W);
  const g = cv.getContext('2d'); const p = cv.width / W;
  const R = (v) => Math.round(v * p);
  const px = (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(x0, y0, R(x + w) - x0, R(y + h) - y0); };
  // wooden plank
  px(0, 0, W, H, '#9a6431'); px(0, 0, W, 1, '#c08447'); px(0, H - 1, W, 1, '#5e3814'); px(0, 0, 1, H, '#b07840'); px(W - 1, 0, 1, H, '#6a4019');
  px(3, 0.5, 6, 0.5, '#86552a'); px(12, H - 1.5, 7, 0.5, '#86552a');
  // burned-in display
  px(1.5, 1.5, W - 3, H - 3, '#2e1a0c'); px(1.5, 1.5, W - 3, 0.5, '#1d0f06');
  let v = Math.max(-99, Math.min(999, value | 0));
  const s = v < 0 ? '-' + String(-v).padStart(2, '0') : String(v).padStart(3, '0');
  for (let i = 0; i < 3; i++) {
    const x0 = 2.5 + i * 5.5, y0 = 2;
    const rows = DIGITS[s[i]];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const on = rows[r][c] === '#';
      px(x0 + c * 0.9 + 0.05, y0 + r * 1.0 + 0.05, 0.8, 0.9, on ? '#ffd23f' : '#4a2c14');
      if (on) px(x0 + c * 0.9 + 0.05, y0 + r * 1.0 + 0.05, 0.8, 0.25, '#fff1a6');
    }
  }
}

// ------------------------------------------------------------------ the app
export default {
  id: 'mines',
  title: 'Mines',
  icon: 'mines',
  size: [292, 368],
  minSize: [220, 280],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const pref = lsGet(LS_PREF, { level: 'beginner', custom: { c: 12, r: 12, m: 24 }, marks: true });
    let level = LEVELS[pref.level] ? pref.level : (pref.level === 'custom' ? 'custom' : 'beginner');
    let custom = pref.custom || { c: 12, r: 12, m: 24 };
    let marks = pref.marks !== false;
    const dims = () => (level === 'custom' ? { ...custom, label: 'Custom' } : LEVELS[level]);

    root.innerHTML = `
      <div class="mn-menubar" role="menubar">
        <div class="mn-menu" data-m="game"><button class="mn-mtitle" type="button"><u>G</u>ame</button>
          <div class="mn-drop" role="menu">
            <button data-a="new">New<span>F2</span></button><hr>
            <button data-a="beginner" class="radio">Beginner<span>9×9</span></button>
            <button data-a="intermediate" class="radio">Intermediate<span>16×16</span></button>
            <button data-a="expert" class="radio">Expert<span>30×16</span></button>
            <button data-a="custom" class="radio">Custom…</button><hr>
            <button data-a="marks" class="check">Marks (?)</button><hr>
            <button data-a="best">Best Times…</button><hr>
            <button data-a="exit">Exit</button>
          </div></div>
        <div class="mn-menu" data-m="help"><button class="mn-mtitle" type="button"><u>H</u>elp</button>
          <div class="mn-drop" role="menu">
            <button data-a="howto">How to Play</button><hr>
            <button data-a="about">About Mines</button>
          </div></div>
      </div>
      <div class="mn-stage">
        <div class="mn-frame">
          <div class="mn-head">
            <canvas class="mn-count mn-left" aria-label="Moles left"></canvas>
            <button class="mn-sun" type="button" aria-label="New game"><canvas></canvas></button>
            <canvas class="mn-count mn-right" aria-label="Time"></canvas>
          </div>
          <div class="mn-boardwrap"><canvas class="mn-board"></canvas></div>
        </div>
      </div>
      <div class="mn-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.mn-stage'), board = $('.mn-board'), sunBtn = $('.mn-sun'), sunCv = $('.mn-sun canvas');
    const cLeft = $('.mn-left'), cRight = $('.mn-right'), modal = $('.mn-modal'), menubar = $('.mn-menubar');
    const bg = board.getContext('2d');

    // ---------------------------------------------------------------- state
    let C, Rw, M, mine, adj, open, mark, opened, flags, state, exploded, startT, elapsed, timerId, first;
    let cs = 24, dpr = 1, sprites = null, spriteKey = '';
    let mood = 'smile', sunPressed = false;
    let press = null; // { i, chord }
    const variants = [];

    function newGame() {
      const d = dims(); C = d.c; Rw = d.r; M = d.m;
      const n = C * Rw;
      mine = new Uint8Array(n); adj = new Uint8Array(n); open = new Uint8Array(n); mark = new Uint8Array(n);
      opened = 0; flags = 0; state = 'ready'; exploded = -1; elapsed = 0; first = true; press = null;
      clearInterval(timerId); timerId = 0;
      const r = rng((Math.random() * 1e9) | 0);
      variants.length = 0; for (let i = 0; i < n; i++) variants.push((r() * 20) | 0);
      mood = 'smile';
      ctx.setTitle && ctx.setTitle('Mines');
      fit(); draw(); drawHead();
    }
    const nb = (i, f) => {
      const x = i % C, y = (i / C) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < C && ny < Rw) f(ny * C + nx);
      }
    };
    function place(safe) {
      const n = C * Rw, ban = new Set([safe]);
      if (n - 9 >= M) nb(safe, (j) => ban.add(j));
      const pool = []; for (let i = 0; i < n; i++) if (!ban.has(i)) pool.push(i);
      for (let k = 0; k < M && pool.length; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; mine[pool[k]] = 1; }
      for (let i = 0; i < n; i++) { let c = 0; nb(i, (j) => { c += mine[j]; }); adj[i] = c; }
    }
    function startTimer() {
      startT = performance.now(); elapsed = 0;
      timerId = setInterval(() => { elapsed = Math.min(999, Math.floor((performance.now() - startT) / 1000) + 1); drawHead(); }, 250);
      elapsed = 1;
    }
    function reveal(i) {
      if (state === 'won' || state === 'lost' || open[i] || mark[i] === 1) return;
      if (first) { first = false; place(i); state = 'play'; startTimer(); }
      if (mine[i]) return lose(i);
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        if (open[k] || mark[k] === 1) continue;
        open[k] = 1; opened++; if (mark[k] === 2) mark[k] = 0;
        if (adj[k] === 0) nb(k, (j) => { if (!open[j] && !mine[j]) stack.push(j); });
      }
      if (opened === C * Rw - M) win();
    }
    function chord(i) {
      if (!open[i] || !adj[i] || state !== 'play') return;
      let f = 0; nb(i, (j) => { if (mark[j] === 1) f++; });
      if (f !== adj[i]) return;
      nb(i, (j) => { if (!open[j] && mark[j] !== 1) reveal(j); });
    }
    function cycleMark(i) {
      if (open[i] || state === 'won' || state === 'lost') return;
      const before = mark[i];
      mark[i] = before === 0 ? 1 : before === 1 ? (marks ? 2 : 0) : 0;
      flags += (mark[i] === 1) - (before === 1);
    }
    function lose(i) {
      state = 'lost'; exploded = i; mood = 'sad'; clearInterval(timerId);
      ctx.sound && ctx.sound('error');
    }
    function win() {
      state = 'won'; mood = 'cool'; clearInterval(timerId);
      for (let k = 0; k < mine.length; k++) if (mine[k] && mark[k] !== 1) { mark[k] = 1; flags++; }
      ctx.sound && ctx.sound('ding');
      if (level !== 'custom') {
        const best = lsGet(LS_BEST, {});
        if (!best[level] || elapsed < best[level]) { best[level] = elapsed; lsSet(LS_BEST, best); setTimeout(() => showBest(true), 450); }
      }
    }

    // ---------------------------------------------------------------- sizing & drawing
    function fit() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const aw = sw - FRAME_PAD * 2 - 14, ah = sh - FRAME_PAD * 2 - HEAD_H - 18;
      cs = Math.max(MIN_CS, Math.min(MAX_CS, Math.floor(Math.min(aw / C, ah / Rw)) || MIN_CS));
      dpr = Math.min(3, window.devicePixelRatio || 1);
      const S = Math.round(cs * dpr);
      board.style.width = cs * C + 'px'; board.style.height = cs * Rw + 'px';
      board.width = S * C; board.height = S * Rw;
      const key = S + '';
      if (key !== spriteKey) {
        spriteKey = key;
        sprites = { grass: [], earth: [], pressed: grassTile(S, 0, true), num: [], flag: flagTile(S), q: questionTile(S), mole: moleTile(S), boom: earthTile(S, 3, true), cross: crossTile(S) };
        for (let v = 0; v < 20; v++) { sprites.grass.push(grassTile(S, v)); sprites.earth.push(earthTile(S, v)); }
        for (let n = 1; n <= 8; n++) sprites.num[n] = numberTile(S, n);
      }
      // stage scrolls only when the board can't fit at the minimum tile size
      stage.classList.toggle('mn-scroll', cs * C + FRAME_PAD * 2 + 14 > sw || cs * Rw + HEAD_H + FRAME_PAD * 2 + 18 > sh);
    }
    function preferredSize() {
      const d = dims(), t = 26;
      return [Math.max(220, d.c * t + FRAME_PAD * 2 + 22), d.r * t + HEAD_H + FRAME_PAD * 2 + 26 + MENU_H];
    }
    function pressedSet() {
      const s = new Set();
      if (!press || press.i < 0 || state === 'won' || state === 'lost') return s;
      if (press.chord) { s.add(press.i); nb(press.i, (j) => s.add(j)); } else s.add(press.i);
      return s;
    }
    function draw() {
      if (!sprites) return;
      const S = Math.round(cs * dpr), pr = pressedSet(), over = state === 'lost';
      bg.imageSmoothingEnabled = false;
      for (let i = 0; i < C * Rw; i++) {
        const x = (i % C) * S, y = ((i / C) | 0) * S, v = variants[i];
        if (open[i]) {
          bg.drawImage(sprites.earth[v], x, y);
          if (adj[i]) bg.drawImage(sprites.num[adj[i]], x, y);
          continue;
        }
        if (over && mine[i] && mark[i] !== 1) {
          bg.drawImage(i === exploded ? sprites.boom : sprites.earth[v], x, y);
          bg.drawImage(sprites.mole, x, y);
          continue;
        }
        if (pr.has(i) && mark[i] !== 1) { bg.drawImage(sprites.pressed, x, y); if (mark[i] === 2) bg.drawImage(sprites.q, x, y); continue; }
        bg.drawImage(sprites.grass[v], x, y);
        if (mark[i] === 1) {
          bg.drawImage(sprites.flag, x, y);
          if (over && !mine[i]) bg.drawImage(sprites.cross, x, y);
        } else if (mark[i] === 2) bg.drawImage(sprites.q, x, y);
      }
    }
    function drawHead() {
      drawCounter(cLeft, M - flags);
      drawCounter(cRight, elapsed);
      drawSun(sunCv, press && state !== 'won' && state !== 'lost' ? 'gasp' : mood, sunPressed);
      ctx.setStatus && ctx.setStatus(`${dims().label} · ${M} moles`);
    }
    const refresh = () => { draw(); drawHead(); };

    // ---------------------------------------------------------------- input
    let held = 0, mode = null, pendingMark = -1, suppress = false, lastTouch = -1e9;
    let touch = null; // { id, i, x, y, timer, long }
    const cellAt = (e) => {
      let x = e.offsetX, y = e.offsetY;
      if (e.target !== board) { const r = board.getBoundingClientRect(); x = (e.clientX - r.left) * board.clientWidth / r.width; y = (e.clientY - r.top) * board.clientHeight / r.height; }
      const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
      return cx >= 0 && cy >= 0 && cx < C && cy < Rw ? cy * C + cx : -1;
    };
    const active = () => state === 'ready' || state === 'play';
    function mouseChange(e, buttons) {
      const i = cellAt(e);
      const down = buttons & ~held, up = held & ~buttons;
      held = buttons;
      if (!active()) { press = null; return refresh(); }
      if (down) {
        if ((down & 4) || ((down & 1) && (buttons & 2)) || ((down & 2) && (buttons & 1))) { mode = 'chord'; pendingMark = -1; }
        else if (down & 1) mode = 'left';
        else if (down & 2) { mode = 'right'; pendingMark = i; }
      }
      if (mode === 'left' || mode === 'chord') press = { i, chord: mode === 'chord' }; else press = null;
      if (up && !suppress) {
        if (mode === 'chord') { if (i >= 0) chord(i); suppress = true; }
        else if (mode === 'left' && (up & 1)) { if (i >= 0) { if (open[i]) chord(i); else reveal(i); } }
        else if (mode === 'right' && (up & 2)) { if (pendingMark >= 0 && pendingMark === i) cycleMark(i); }
        if (mode !== 'chord') mode = null;
      }
      if (!buttons) { mode = null; suppress = false; press = null; pendingMark = -1; }
      if (mode !== 'left' && mode !== 'chord') press = null;
      refresh();
    }
    function onDown(e) {
      setFocus(true);
      if (e.pointerType === 'mouse') {
        if (performance.now() - lastTouch < 800) return;
        e.preventDefault();
        try { board.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        mouseChange(e, e.buttons);
        return;
      }
      lastTouch = performance.now();
      if (touch || !active()) return;
      const i = cellAt(e);
      if (i < 0) return;
      touch = { id: e.pointerId, i, x: e.clientX, y: e.clientY, long: false };
      press = open[i] ? null : { i, chord: false }; refresh();
      touch.timer = setTimeout(() => {
        if (!touch) return;
        touch.long = true; press = null; cycleMark(touch.i);
        if (mark[touch.i] === 2) cycleMark(touch.i); // touch cycles flag <-> none
        if (navigator.vibrate) try { navigator.vibrate(25); } catch { /* ignore */ }
        refresh();
      }, 380);
    }
    function onMove(e) {
      if (e.pointerType === 'mouse') {
        if (performance.now() - lastTouch < 800) return;
        if (e.buttons !== held) return mouseChange(e, e.buttons);
        if (held) { const i = cellAt(e); if (press && press.i !== i) { press.i = i; refresh(); } }
        return;
      }
      if (touch && e.pointerId === touch.id && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 12) {
        clearTimeout(touch.timer); touch = null; press = null; refresh();
      }
    }
    function onUp(e) {
      if (e.pointerType === 'mouse') {
        if (performance.now() - lastTouch < 800) return;
        mouseChange(e, e.buttons || 0);
        return;
      }
      lastTouch = performance.now();
      if (!touch || e.pointerId !== touch.id) return;
      clearTimeout(touch.timer);
      const t = touch; touch = null; press = null;
      if (!t.long && e.type === 'pointerup') { if (open[t.i]) chord(t.i); else reveal(t.i); }
      refresh();
    }
    board.addEventListener('pointerdown', onDown);
    board.addEventListener('pointermove', onMove);
    board.addEventListener('pointerup', onUp);
    board.addEventListener('pointercancel', onUp);
    board.addEventListener('lostpointercapture', (e) => { if (e.pointerType === 'mouse' && held) { held = 0; mode = null; press = null; suppress = false; refresh(); } });
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    board.addEventListener('auxclick', (e) => e.preventDefault());
    board.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

    sunBtn.addEventListener('pointerdown', () => { sunPressed = true; drawHead(); });
    const sunUp = () => { if (sunPressed) { sunPressed = false; drawHead(); } };
    sunBtn.addEventListener('pointerup', sunUp); sunBtn.addEventListener('pointerleave', sunUp);
    sunBtn.addEventListener('click', () => { ctx.sound && ctx.sound('click'); newGame(); });

    // ---------------------------------------------------------------- menus & dialogs
    let openMenu = null;
    function setMenu(m) {
      openMenu = m;
      root.querySelectorAll('.mn-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) syncMenu();
    }
    function syncMenu() {
      root.querySelectorAll('.mn-drop .radio').forEach((b) => b.classList.toggle('on', b.dataset.a === level));
      root.querySelector('[data-a="marks"]').classList.toggle('on', marks);
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.mn-mtitle');
      if (t) { e.preventDefault(); const m = t.parentElement; setMenu(openMenu === m ? null : m); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.mn-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => {
      const b = e.target.closest('.mn-drop button');
      if (!b) return;
      setMenu(null); action(b.dataset.a);
    });
    const outside = (e) => { if (openMenu && !openMenu.contains(e.target)) setMenu(null); if (!root.contains(e.target)) setFocus(false); };
    document.addEventListener('pointerdown', outside, true);

    function savePref() { lsSet(LS_PREF, { level, custom, marks }); }
    function setLevel(l) {
      level = l; savePref();
      const [w, h] = preferredSize();
      const rs = ctx.resize || ctx.setSize || ctx.requestSize;
      if (rs) try { rs.call(ctx, w, h); } catch { /* core may refuse */ }
      newGame();
      requestAnimationFrame(() => { fit(); refresh(); });
    }
    function action(a) {
      if (a === 'new') newGame();
      else if (LEVELS[a]) setLevel(a);
      else if (a === 'custom') showCustom();
      else if (a === 'marks') { marks = !marks; if (!marks) for (let i = 0; i < mark.length; i++) if (mark[i] === 2) mark[i] = 0; savePref(); refresh(); }
      else if (a === 'best') showBest(false);
      else if (a === 'exit') ctx.close && ctx.close();
      else if (a === 'howto') dialog('How to Play', `<p>Somewhere under this hill, moles are dozing. Dig up every patch of grass that <b>doesn't</b> hide a mole.</p>
        <ul><li><b>Click</b> to dig. Your first dig is always safe.</li><li>A number says how many moles sleep in the 8 patches around it.</li>
        <li><b>Right-click</b> to plant a flag (again for <b>?</b>, again to clear).</li>
        <li><b>Both buttons</b>, <b>middle-click</b>, or a click on a number whose flags are all placed digs the neighbours.</li>
        <li>On touch: <b>tap</b> to dig, <b>long-press</b> to flag.</li></ul>`);
      else if (a === 'about') dialog('About Mines', `<p><b>Mines</b> for Kayzee XP.</p><p>Original art and code. A fan homage to the classic grid puzzle; not affiliated with any operating-system vendor.</p>`);
    }
    function dialog(title, html, buttons = [['OK', () => true]]) {
      modal.innerHTML = `<div class="mn-dlg" role="dialog" aria-label="${title}"><div class="mn-dlg-t">${title}</div><div class="mn-dlg-b">${html}</div><div class="mn-dlg-f"></div></div>`;
      const f = modal.querySelector('.mn-dlg-f');
      buttons.forEach(([label, fn], k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-btn mn-btn' + (k === 0 ? ' default' : ''); b.textContent = label;
        b.addEventListener('click', () => { if (fn() !== false) modal.hidden = true; });
        f.appendChild(b);
      });
      modal.hidden = false;
      const inp = modal.querySelector('input'); (inp || f.firstChild).focus({ preventScroll: true });
    }
    function showBest(isNew) {
      const best = lsGet(LS_BEST, {});
      const row = (k) => `<tr><td>${LEVELS[k].label}</td><td class="t">${best[k] ? best[k] + ' s' : '—'}</td></tr>`;
      dialog('Best Times', `${isNew ? `<p class="mn-new">☀ New best time on ${LEVELS[level].label}: <b>${elapsed} s</b></p>` : ''}
        <table class="mn-best">${row('beginner')}${row('intermediate')}${row('expert')}</table>`,
      [['OK', () => true], ['Reset Scores', () => { lsSet(LS_BEST, {}); showBest(false); return false; }]]);
    }
    function showCustom() {
      dialog('Custom Field', `<div class="mn-form">
        <label>Height <input class="xp-input" type="number" name="r" min="5" max="30" value="${custom.r}"></label>
        <label>Width <input class="xp-input" type="number" name="c" min="5" max="40" value="${custom.c}"></label>
        <label>Moles <input class="xp-input" type="number" name="m" min="1" max="999" value="${custom.m}"></label></div>`,
      [['OK', () => {
        const v = (n) => parseInt(modal.querySelector(`[name="${n}"]`).value, 10);
        const r = Math.max(5, Math.min(30, v('r') || 9)), c = Math.max(5, Math.min(40, v('c') || 9));
        const m = Math.max(1, Math.min(r * c - 1, v('m') || 10));
        custom = { r, c, m }; setLevel('custom'); return true;
      }], ['Cancel', () => true]]);
    }
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { modal.hidden = true; e.stopPropagation(); }
      if (e.key === 'Enter') { const b = modal.querySelector('.mn-btn.default'); if (b) b.click(); e.stopPropagation(); }
    });

    // ---------------------------------------------------------------- focus & keys
    let focused = false;
    function setFocus(v) { focused = v; }
    const onKey = (e) => {
      if (!focused) return;
      if (e.key === 'F2') { e.preventDefault(); newGame(); }
      else if (e.key === 'Escape' && openMenu) setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', () => setFocus(true));

    const ro = new ResizeObserver(() => { fit(); refresh(); });
    ro.observe(stage);
    newGame();

    // test hook (harmless in production): lets the CDP harness inspect the board
    Object.defineProperty(root, '_kzMines', { configurable: true, value: {
      get state() { return state; }, get cs() { return cs; }, get dims() { return { C, R: Rw, M }; },
      cell: (i) => ({ mine: mine[i], adj: adj[i], open: open[i], mark: mark[i] }),
      get opened() { return opened; }, get mood() { return mood; }, get elapsed() { return elapsed; },
      newGame, setLevel,
    } });

    return {
      onResize() { fit(); refresh(); },
      onFocus() { setFocus(true); },
      onBlur() { setFocus(false); setMenu(null); },
      unmount() {
        clearInterval(timerId); ro.disconnect();
        if (touch) clearTimeout(touch.timer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', outside, true);
        delete root._kzMines;
        root.innerHTML = '';
      },
    };
  },
};
