// Grass Snake: an original grid snake game in the Voxel Luna style.
// A little garden snake with a yellow collar slides over a checkered lawn, eats apples and grows.
// A picket fence rings the lawn (or a garden path when "wrap around edges" is on), a sun-face
// button watches the game, and a golden apple shows up now and then for a few seconds.
// All art is drawn procedurally here (no external assets).

const COLS = 17, ROWS = 15;          // lawn cells; the fence/path ring adds one tile on every side
const TC = COLS + 2, TR = ROWS + 2;
const SPEEDS = {
  slow: { ms: 190, label: 'Slow' },
  normal: { ms: 130, label: 'Normal' },
  fast: { ms: 85, label: 'Fast' },
};
const LS_BEST = 'kayzee-snake-best';
const LS_PREF = 'kayzee-snake-pref';
const CH_X = 36, CH_Y = 83, HEAD_H = 40; // frame chrome around the board canvas, incl. the 40px header bar (see snake.css)
const PAD_SZ = 146;                  // room kept for the on-screen d-pad on phones
const MIN_CS = 8, MAX_CS = 64;
const APPLE_PTS = 10, GOLD_MAX = 50, GOLD_MIN = 20, GOLD_LIFE = 6500, GOLD_EVERY = 5;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = {
  ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right,
  w: DIRS.up, s: DIRS.down, a: DIRS.left, d: DIRS.right,
};

// ------------------------------------------------------------------ palette (original)
const P = {
  grassA: '#6cc243', grassB: '#62b93b', grassHi: '#8fd85a', grassLo: '#4fa530', grassDk: '#357a1f',
  ground: '#4c9c2e', groundDk: '#3a8022', shadow: '#4a9a2c',
  wood: '#c08447', woodHi: '#e0ab6c', woodDk: '#8a5a30', rail: '#9a6431', railDk: '#6b4224', nail: '#5e3814',
  earth: '#d9b27c', earthHi: '#e6c592', earthLo: '#c69a62', earthDk: '#ad824d', stone: '#cfc7b8', stoneHi: '#ebe6dc', stoneDk: '#a39a8a',
};
const SNAKE = { out: '#143d2c', body: '#2f9e6a', hi: '#74d8a0', lo: '#1f7550', spot: '#1c6b47', collar: '#ffd23f', eye: '#ffffff', pupil: '#10201a', tongue: '#e0402f' };
const SNAKE_OUCH = { out: '#33403a', body: '#8aa89c', hi: '#bcd0c7', lo: '#6c877c', spot: '#6c877c', collar: '#e3d08a', eye: '#ffffff', pupil: '#33403a', tongue: '#e0402f' };
const APPLE = [
  '................',
  '.........LL.....',
  '.......S.LLl....',
  '.......SSLl.....',
  '....KKKSKKKK....',
  '...KRRRRSRRRK...',
  '..KRHHRRRRRRrK..',
  '..KRHWRRRRRRrK..',
  '..KRHRRRRRRRrK..',
  '..KRRRRRRRRRrK..',
  '..KRRRRRRRRrrK..',
  '..KrRRRRRRRrrK..',
  '...KrRRRRRrrK...',
  '....KrrKKrrK....',
  '.....KK..KK.....',
  '................',
];
const APPLE_PAL = { K: '#7a1414', R: '#e8432f', r: '#b82a20', H: '#ff8f76', W: '#ffe6dc', S: '#6b4224', L: '#5cc238', l: '#2f7a1f' };
const GOLD_PAL = { K: '#8a5a10', R: '#ffd23f', r: '#e8a21a', H: '#fff1a6', W: '#ffffff', S: '#6b4224', L: '#5cc238', l: '#2f7a1f' };
const BURST = ['#..#..#', '.#.#.#.', '..#o#..', '##ooo##', '..#o#..', '.#.#.#.', '#..#..#'];
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
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
const SMALL = { // 3x5 font for the "+10" floaters
  '+': ['...', '.#.', '###', '.#.', '...'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
};
const ICON_APPLE = ['...l.', '..l..', '.###.', '#####', '#####', '#####', '.#.#.'];
const ICON_CROWN = ['.....', '#.#.#', '#.#.#', '#####', '#####', '.....', '#####'];

function rng(seed) { // seeds are scrambled first so neighbouring tiles don't get look-alike sequences
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b); s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35); s = (s ^ (s >>> 16)) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ pixel painter
// p = device pixels per logical pixel; every rect snaps to whole device pixels so the art stays crisp.
function mkPx(g, p, ox, oy) {
  const R = (v) => Math.round(v * p);
  return (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(ox + x0, oy + y0, R(x + w) - x0, R(y + h) - y0); };
}
function bitmap(px, rows, x, y, d, c) {
  rows.forEach((row, r) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') px(x + i * d, y + r * d, d, d, c); });
}
function bitmapPal(px, rows, pal, x, y) {
  rows.forEach((row, r) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) px(x + i, y + r, 1, 1, c); } });
}

// ------------------------------------------------------------------ tiles (16x16 logical)
function lawnTile(px, alt, seed) {
  px(0, 0, 16, 16, alt ? P.grassB : P.grassA);
  const r = rng(seed);
  for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14); px(x, y, 1, 1, r() < 0.5 ? P.grassHi : P.grassLo); }
  const tx = 2 + Math.floor(r() * 10), ty = 4 + Math.floor(r() * 9);
  px(tx, ty, 1, 2, P.grassLo); px(tx + 1, ty - 1, 1, 3, P.grassDk); px(tx + 2, ty, 1, 2, P.grassLo);
  const k = r();
  if (k < 0.07) { const fx = 3 + Math.floor(r() * 9), fy = 3 + Math.floor(r() * 9); px(fx, fy - 1, 1, 3, '#fff6c8'); px(fx - 1, fy, 3, 1, '#fff6c8'); px(fx, fy, 1, 1, '#ffd23f'); }
  else if (k < 0.12) { const fx = 3 + Math.floor(r() * 9), fy = 3 + Math.floor(r() * 9); px(fx, fy, 2, 2, '#ff9ac0'); px(fx, fy, 1, 1, '#ffd0e2'); }
}
function fenceH(px) { // a run of pickets seen from the front (top and bottom edge of the lawn)
  px(0, 0, 16, 16, P.ground);
  px(0, 14, 16, 2, P.groundDk);
  px(0, 6, 16, 2, P.rail); px(0, 7, 16, 1, P.railDk); px(0, 10, 16, 2, P.rail); px(0, 11, 16, 1, P.railDk);
  for (let k = 0; k < 4; k++) {
    const x = k * 4;
    px(x, 3, 3, 11, P.wood); px(x + 1, 2, 1, 1, P.wood); px(x, 3, 1, 10, P.woodHi); px(x + 2, 3, 1, 11, P.woodDk); px(x, 13, 3, 1, P.woodDk);
    px(x + 1, 6, 1, 1, P.nail); px(x + 1, 10, 1, 1, P.nail);
  }
}
function fenceV(px) { // the fence seen edge-on (left and right edge): a rail with a post cap on every tile
  px(0, 0, 16, 16, P.ground);
  px(10, 0, 1, 16, P.groundDk);
  px(6, 0, 4, 16, P.rail); px(6, 0, 1, 16, P.wood); px(9, 0, 1, 16, P.railDk);
  px(5, 13, 8, 1, P.groundDk); px(12, 6, 1, 7, P.groundDk);
  px(4, 4, 8, 9, P.woodDk); px(4, 4, 8, 7, P.wood); px(4, 4, 8, 1, P.woodHi); px(4, 4, 1, 7, P.woodHi); px(11, 5, 1, 6, P.woodDk);
  px(6, 6, 4, 3, P.woodHi); px(6, 8, 4, 1, P.wood);
}
function fenceCorner(px) {
  px(0, 0, 16, 16, P.ground);
  px(4, 14, 10, 1, P.groundDk); px(13, 5, 1, 9, P.groundDk);
  px(3, 2, 10, 12, P.woodDk); px(3, 2, 10, 9, P.wood); px(3, 2, 10, 1, P.woodHi); px(3, 2, 1, 9, P.woodHi); px(12, 3, 1, 8, P.woodDk);
  px(5, 4, 6, 5, P.woodHi); px(5, 8, 6, 1, P.wood); px(7, 5, 2, 2, '#f0c690');
}
function pathTile(px, seed) { // garden path that replaces the fence when the edges wrap around
  px(0, 0, 16, 16, P.earth);
  const r = rng(seed);
  for (let i = 0; i < 7; i++) { const x = 1 + Math.floor(r() * 14), y = 1 + Math.floor(r() * 14); px(x, y, 1, 1, r() < 0.5 ? P.earthHi : P.earthLo); }
  if (r() < 0.55) {
    const x = 3 + Math.floor(r() * 3), y = 4 + Math.floor(r() * 3), w = 7 + Math.floor(r() * 3), h = 6 + Math.floor(r() * 2);
    px(x, y + 1, w, h, P.earthDk);
    px(x, y, w, h, P.stone); px(x, y, w, 1, P.stoneHi); px(x, y, 1, h, P.stoneHi); px(x + w - 1, y + 1, 1, h - 1, P.stoneDk); px(x + 1, y + h - 1, w - 1, 1, P.stoneDk);
    px(x, y, 1, 1, P.earth); px(x + w - 1, y, 1, 1, P.earth); px(x + w - 1, y + h - 1, 1, 1, P.earthDk); px(x, y + h - 1, 1, 1, P.earthDk);
  } else { const x = 3 + Math.floor(r() * 9), y = 3 + Math.floor(r() * 9); px(x, y, 2, 1, P.earthDk); px(x, y + 1, 1, 1, P.earthDk); }
}
function buildBg(S, wrap) {
  const cv = document.createElement('canvas'); cv.width = S * TC; cv.height = S * TR;
  const c = cv.getContext('2d'), p = S / 16;
  for (let ty = 0; ty < TR; ty++) for (let tx = 0; tx < TC; tx++) {
    const px = mkPx(c, p, tx * S, ty * S);
    const ex = tx === 0 || tx === TC - 1, ey = ty === 0 || ty === TR - 1, seed = (ty * TC + tx) * 7919 + 17;
    if (!ex && !ey) lawnTile(px, (tx + ty) & 1, seed);
    else if (wrap) pathTile(px, seed);
    else if (ex && ey) fenceCorner(px);
    else if (ey) fenceH(px);
    else fenceV(px);
  }
  // a soft shade on the lawn right under the top and left edge, and a bright lip on the far sides
  const e1 = Math.max(1, Math.round(p)), e2 = Math.max(1, Math.round(2 * p));
  c.fillStyle = 'rgba(24,70,14,.22)'; c.fillRect(S, S, S * COLS, e2); c.fillRect(S, S, e1, S * ROWS);
  c.fillStyle = 'rgba(200,255,150,.22)'; c.fillRect(S, S * (TR - 1) - e1, S * COLS, e1); c.fillRect(S * (TC - 1) - e1, S, e1, S * ROWS);
  return cv;
}

// ------------------------------------------------------------------ snake shapes (logical rects for a part that faces right)
const rot = (d, r) => {
  const [x, y, w, h] = r;
  if (d[0] === 1) return r;
  if (d[0] === -1) return [16 - x - w, 16 - y - h, w, h];
  if (d[1] === 1) return [16 - y - h, x, h, w];
  return [y, 16 - x - w, h, w];
};
const HEAD_OUT = [[0, 2, 3, 12], [2, 1, 10, 14], [12, 2, 2, 12], [14, 4, 1, 8]];
const HEAD_FILL = [[0, 3, 3, 10], [3, 2, 9, 12], [12, 3, 1, 10], [13, 5, 1, 6]];
const TAIL_OUT = [[10, 2, 6, 12], [6, 3, 4, 10], [3, 5, 3, 6]];
const TAIL_FILL = [[11, 3, 5, 10], [7, 4, 4, 8], [4, 6, 3, 4]];
const ARM_OUT = { '1,0': [13, 2, 3, 12], '-1,0': [0, 2, 3, 12], '0,1': [2, 13, 12, 3], '0,-1': [2, 0, 12, 3] };
const ARM_FILL = { '1,0': [12, 3, 4, 10], '-1,0': [0, 3, 4, 10], '0,1': [3, 12, 10, 4], '0,-1': [3, 0, 10, 4] };

// ------------------------------------------------------------------ sun-face button and wooden counters (CSS px, drawn at DPR)
function drawSun(cv, mood, pressed) {
  const N = 22, dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = Math.max(8, Math.round((cv.clientWidth || 30) * dpr));
  if (cv.width !== W) { cv.width = W; cv.height = W; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, W);
  const px = mkPx(g, W / N, 0, 0);
  const dim = mood === 'sad' || mood === 'sleep';
  const body = dim ? '#f2c94c' : '#ffd23f', hi = dim ? '#f8dc84' : '#ffe98a', rim = dim ? '#d9962a' : '#f29a16', ray = dim ? '#e8b03a' : '#ffb21e';
  const oy = pressed ? 0.5 : 0, cx = 10.5, cy = 10.5 + oy;
  for (let a = 0; a < 8; a++) {
    const t = a * Math.PI / 4;
    for (let d = 7.8; d < 10; d += 0.9) px(Math.round(cx + Math.cos(t) * d - 0.5), Math.round(cy + Math.sin(t) * d - 0.5), 1, 1, ray);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < 6.0) px(x, y, 1, 1, body); else if (d < 6.9) px(x, y, 1, 1, rim);
  }
  px(7, 6 + oy, 3, 1, hi); px(6, 7 + oy, 1, 2, hi);
  const ink = '#4a2a0a', blush = '#ff9a6a';
  if (mood === 'gasp') {
    px(7, 8 + oy, 2, 2, ink); px(12, 8 + oy, 2, 2, ink);
    px(9, 12 + oy, 3, 3, ink); px(10, 13 + oy, 1, 1, '#c9502a');
  } else if (mood === 'cool') {
    px(6, 8 + oy, 10, 1, '#1a1a22'); px(6, 9 + oy, 4, 2, '#1a1a22'); px(11, 9 + oy, 4, 2, '#1a1a22');
    px(7, 9 + oy, 1, 1, '#7fd0ff'); px(12, 9 + oy, 1, 1, '#7fd0ff');
    px(8, 13 + oy, 1, 1, ink); px(9, 14 + oy, 4, 1, ink); px(13, 13 + oy, 1, 1, ink);
  } else if (mood === 'sleep') {
    px(7, 10 + oy, 3, 1, ink); px(12, 10 + oy, 3, 1, ink);
    px(10, 13 + oy, 2, 1, ink);
    const z = '#3d5a8a';
    px(15, 2, 4, 1, z); px(17, 3, 1, 1, z); px(16, 4, 1, 1, z); px(15, 5, 4, 1, z);
  } else if (mood === 'sad') {
    for (const ex of [7, 12]) { px(ex, 8, 1, 1, ink); px(ex + 2, 8, 1, 1, ink); px(ex + 1, 9, 1, 1, ink); px(ex, 10, 1, 1, ink); px(ex + 2, 10, 1, 1, ink); }
    px(9, 13, 1, 1, ink); px(10, 14, 1, 1, ink); px(11, 13, 1, 1, ink); px(12, 14, 1, 1, ink); px(8, 14, 1, 1, ink);
  } else {
    px(8, 9 + oy, 1, 2, ink); px(12, 9 + oy, 1, 2, ink);
    px(8, 13 + oy, 1, 1, ink); px(9, 14 + oy, 3, 1, ink); px(12, 13 + oy, 1, 1, ink);
    px(6, 12 + oy, 1, 1, blush); px(14, 12 + oy, 1, 1, blush);
  }
}
function drawCounter(cv, value, icon) {
  const W = 32, H = 11, dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(16, Math.round((cv.clientWidth || 78) * dpr)), h = Math.round(w * H / W);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d'), px = mkPx(g, w / W, 0, 0);
  // wooden plank with a burned-in display
  px(0, 0, W, H, '#9a6431'); px(0, 0, W, 1, '#c08447'); px(0, H - 1, W, 1, '#5e3814'); px(0, 0, 1, H, '#b07840'); px(W - 1, 0, 1, H, '#6a4019');
  px(4, 0.5, 8, 0.5, '#86552a'); px(18, H - 1.5, 9, 0.5, '#86552a');
  px(1.5, 1.5, W - 3, H - 3, '#2e1a0c'); px(1.5, 1.5, W - 3, 0.5, '#1d0f06');
  if (icon === 'apple') { bitmap(px, ICON_APPLE, 2.5, 2, 1, '#ff6a55'); px(5.5, 2, 1, 1, '#8fd85a'); px(4.5, 3, 1, 1, '#8fd85a'); px(3.5, 5, 1, 1, '#ffc2b5'); }
  else { bitmap(px, ICON_CROWN, 2.5, 2, 1, '#ffd23f'); px(4.5, 6, 1, 1, '#ff6a55'); px(2.5, 8, 5, 1, '#f29a16'); }
  const s = String(clamp(value | 0, 0, 9999)).padStart(4, ' ');
  for (let i = 0; i < 4; i++) {
    const x0 = 8.75 + i * 5.5, y0 = 2, rows = DIGITS[s[i]];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const on = rows[r][c] === '#';
      px(x0 + c * 0.9 + 0.05, y0 + r + 0.05, 0.8, 0.9, on ? '#ffd23f' : '#4a2c14');
      if (on) px(x0 + c * 0.9 + 0.05, y0 + r + 0.05, 0.8, 0.25, '#fff1a6');
    }
  }
}

// ------------------------------------------------------------------ the app
export default {
  id: 'snake',
  title: 'Grass Snake',
  icon: 'snake',
  size: [456, 480],
  minSize: [250, 300],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const mobile = !!ctx.isMobile;
    const sound = (n) => { if (ctx.sound) try { ctx.sound(n); } catch { /* sound is optional */ } };
    const pref = lsGet(LS_PREF, {}) || {};
    let speed = SPEEDS[pref.speed] ? pref.speed : 'normal';
    let wrap = pref.wrap === true;
    const readBest = () => {
      const raw = lsGet(LS_BEST, {}) || {}, out = {};
      for (const k of Object.keys(SPEEDS)) { const v = Number(raw[k]); if (Number.isFinite(v) && v > 0) out[k] = Math.floor(v); }
      return out;
    };
    let best = readBest();

    root.innerHTML = `
      <div class="sn-menubar" role="menubar">
        <div class="sn-menu" data-m="game"><button class="sn-mtitle" type="button" tabindex="-1"><u>G</u>ame</button>
          <div class="sn-drop" role="menu">
            <button type="button" tabindex="-1" data-a="new">New Game<span>F2</span></button>
            <button type="button" tabindex="-1" data-a="pause"><b class="sn-plabel">Pause</b><span>P</span></button><hr>
            <button type="button" tabindex="-1" data-a="slow" class="radio">Slow</button>
            <button type="button" tabindex="-1" data-a="normal" class="radio">Normal</button>
            <button type="button" tabindex="-1" data-a="fast" class="radio">Fast</button><hr>
            <button type="button" tabindex="-1" data-a="wrap" class="check">Wrap around edges</button><hr>
            <button type="button" tabindex="-1" data-a="best">Best Scores…</button><hr>
            <button type="button" tabindex="-1" data-a="exit">Exit</button>
          </div></div>
        <div class="sn-menu" data-m="help"><button class="sn-mtitle" type="button" tabindex="-1"><u>H</u>elp</button>
          <div class="sn-drop" role="menu">
            <button type="button" tabindex="-1" data-a="howto">How to Play</button><hr>
            <button type="button" tabindex="-1" data-a="about">About Grass Snake</button>
          </div></div>
      </div>
      <div class="sn-stage">
        <div class="sn-frame">
          <div class="sn-head">
            <canvas class="sn-count sn-score" role="img" aria-label="Score"></canvas>
            <button class="sn-sun" type="button" tabindex="-1" aria-label="Pause"><canvas></canvas></button>
            <canvas class="sn-count sn-best" role="img" aria-label="Best score"></canvas>
          </div>
          <div class="sn-boardwrap">
            <canvas class="sn-board" aria-label="Lawn"></canvas>
            <div class="sn-over" hidden></div>
          </div>
        </div>
        <div class="sn-pad"${mobile ? '' : ' hidden'}>
          <button type="button" tabindex="-1" data-d="up" aria-label="Up"><i></i></button>
          <button type="button" tabindex="-1" data-d="left" aria-label="Left"><i></i></button>
          <button type="button" tabindex="-1" data-d="pause" aria-label="Pause"><i></i></button>
          <button type="button" tabindex="-1" data-d="right" aria-label="Right"><i></i></button>
          <button type="button" tabindex="-1" data-d="down" aria-label="Down"><i></i></button>
        </div>
      </div>
      <div class="sn-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.sn-stage'), frameEl = $('.sn-frame'), board = $('.sn-board'), wrapEl = $('.sn-boardwrap'), over = $('.sn-over');
    const sunBtn = $('.sn-sun'), sunCv = $('.sn-sun canvas'), cScore = $('.sn-score'), cBest = $('.sn-best');
    const modal = $('.sn-modal'), menubar = $('.sn-menubar'), pad = $('.sn-pad');
    const g = board.getContext('2d');

    // ---------------------------------------------------------------- state
    let snake = [], dir = DIRS.right, queue = [], apple = null, bonus = null, crash = null, floaters = [];
    let state = 'ready', paused = false, score = 0, eaten = 0, steps = 0, clock = 0, acc = 0;
    let why = '', won = false, newBest = false, panel = false;
    let cs = 22, dpr = 1, bgLayer = null, bgKey = '';
    let raf = 0, last = 0, overT = 0, dingT = 0, disposed = false;
    let focused = false, sunPressed = false, headKey = '', statusKey = '';

    const live = () => state === 'play' && !paused && !disposed;
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const opposite = (a, b) => a[0] === -b[0] && a[1] === -b[1];
    const mood = () => (state === 'over' ? (newBest || won ? 'cool' : 'sad') : paused ? 'sleep' : bonus ? 'gasp' : 'smile');

    function freeCell() {
      const taken = new Uint8Array(COLS * ROWS);
      for (const s of snake) taken[s.y * COLS + s.x] = 1;
      if (apple) taken[apple.y * COLS + apple.x] = 1;
      if (bonus) taken[bonus.y * COLS + bonus.x] = 1;
      const pool = [];
      for (let i = 0; i < taken.length; i++) if (!taken[i]) pool.push(i);
      if (!pool.length) return null;
      const i = pool[Math.floor(Math.random() * pool.length)];
      return { x: i % COLS, y: (i / COLS) | 0 };
    }
    function newGame() {
      clearTimeout(overT); clearTimeout(dingT);
      const cy = ROWS >> 1, cx = (COLS >> 1) - 2;
      snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      dir = DIRS.right; queue = []; score = 0; eaten = 0; steps = 0; clock = 0; acc = 0; last = 0;
      state = 'ready'; paused = false; bonus = null; crash = null; floaters = [];
      why = ''; won = false; newBest = false; panel = false;
      apple = { x: cx + 5, y: cy };
      best = readBest();
      sync();
    }
    function sync() { showOverlay(); drawHead(); draw(); kick(); }

    function goldValue() {
      const left = 1 - clamp((clock - bonus.born) / GOLD_LIFE, 0, 1);
      return Math.max(GOLD_MIN, Math.round((GOLD_MIN + (GOLD_MAX - GOLD_MIN) * left) / 5) * 5);
    }
    function step() {
      if (queue.length) dir = queue.shift();
      const h = snake[0];
      let nx = h.x + dir[0], ny = h.y + dir[1];
      if (wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
      else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return end('fence');
      const grow = !!apple && apple.x === nx && apple.y === ny;
      const lim = snake.length - (grow ? 0 : 1); // the tail tip moves out of the way unless we grow
      for (let i = 0; i < lim; i++) if (snake[i].x === nx && snake[i].y === ny) return end('self');
      snake.unshift({ x: nx, y: ny });
      if (!grow) snake.pop();
      steps++;
      if (grow) {
        score += APPLE_PTS; eaten++;
        floaters.push({ x: nx, y: ny, text: '+' + APPLE_PTS, t0: clock, gold: false });
        sound('click');
        apple = null; apple = freeCell();
        if (!apple) { won = true; return end('full'); }
        if (eaten % GOLD_EVERY === 0 && !bonus) { const c = freeCell(); if (c) bonus = { x: c.x, y: c.y, born: clock }; }
      } else if (bonus && bonus.x === nx && bonus.y === ny) {
        const pts = goldValue();
        score += pts; bonus = null;
        floaters.push({ x: nx, y: ny, text: '+' + pts, t0: clock, gold: true });
        sound('ding');
      }
      drawHead();
    }
    function end(reason) {
      state = 'over'; why = reason; paused = false; queue = [];
      crash = reason === 'full' ? null : { x: snake[0].x, y: snake[0].y, d: dir };
      if (score > (best[speed] || 0)) { best = readBest(); best[speed] = score; lsSet(LS_BEST, best); newBest = true; }
      if (won) sound('ding');
      else { sound('error'); if (newBest) dingT = setTimeout(() => sound('ding'), 420); }
      panel = false;
      overT = setTimeout(() => { panel = true; showOverlay(); }, 520);
      showOverlay(); drawHead();
    }
    function setPaused(v) {
      v = !!v;
      if (state !== 'play' || paused === v) return;
      paused = v; last = 0; queue = [];
      sync();
    }
    function turn(d) {
      if (!modal.hidden || state === 'over') return;
      if (state === 'ready') {
        if (opposite(d, dir)) snake.reverse(); // any arrow may start the run, even the one behind the snake
        dir = d; queue = []; state = 'play'; paused = false; last = 0; acc = SPEEDS[speed].ms * 0.4;
        return sync();
      }
      if (paused) return;
      const prev = queue.length ? queue[queue.length - 1] : dir;
      if (same(d, prev) || opposite(d, prev)) return;
      if (queue.length < 3) queue.push(d); // buffered, so a quick double turn lands on consecutive steps
    }

    // ---------------------------------------------------------------- loop
    function frame(t) {
      raf = 0;
      if (!live()) return;
      const dt = last ? Math.min(250, t - last) : 0; last = t;
      clock += dt; acc += dt;
      const ms = SPEEDS[speed].ms;
      let n = 0;
      while (acc >= ms && state === 'play' && n < 3) { acc -= ms; n++; step(); }
      if (acc > ms) acc = ms;
      if (bonus && clock - bonus.born >= GOLD_LIFE) { bonus = null; drawHead(); }
      if (floaters.length) floaters = floaters.filter((f) => clock - f.t0 < 750);
      draw();
      if (live()) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && live()) { last = 0; raf = requestAnimationFrame(frame); } }

    // ---------------------------------------------------------------- sizing & drawing
    function fit() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      if (sw < 20 || sh < 20) return;
      let aw = sw - CH_X, ah = sh - CH_Y;
      if (mobile) {
        const land = sw > sh * 1.25;
        stage.classList.toggle('sn-land', land);
        if (land) aw -= PAD_SZ; else ah -= PAD_SZ;
      }
      // the header bar (counters + sun) grows with the board on big windows; settle cell size and bar height together
      const cell = (hh) => clamp(Math.floor(Math.min(aw / TC, (ah - (hh - HEAD_H)) / TR)) || MIN_CS, MIN_CS, MAX_CS);
      let headH = HEAD_H;
      for (let pass = 0; pass < 3; pass++) {
        const nh = clamp(Math.round(cell(headH) * 1.7), HEAD_H, 68);
        if (nh === headH) break;
        headH = nh;
      }
      cs = cell(headH);
      frameEl.style.setProperty('--sn-hh', headH + 'px');
      dpr = Math.min(3, window.devicePixelRatio || 1);
      const S = Math.max(1, Math.round(cs * dpr));
      board.style.width = cs * TC + 'px'; board.style.height = cs * TR + 'px';
      if (board.width !== S * TC || board.height !== S * TR) { board.width = S * TC; board.height = S * TR; }
      const key = S + (wrap ? 'w' : 'f');
      if (key !== bgKey) { bgKey = key; bgLayer = buildBg(S, wrap); }
      wrapEl.style.setProperty('--sn-fs', clamp(Math.round(cs * 0.56), 9, 14) + 'px');
      const cw = clamp(Math.floor((cs * TC + 6 - (headH - 6) - 28) / 2), 44, Math.round(headH * 1.95));
      cScore.style.width = cw + 'px'; cBest.style.width = cw + 'px';
      root.classList.toggle('sn-tiny', cs < 14);
      if (mobile) { // the arrow pad grows into whatever room the board leaves, for bigger thumb targets
        const land = stage.classList.contains('sn-land');
        const spare = land ? sw - (CH_X + cs * TC) - 12 : sh - (CH_Y + cs * TR) - 12;
        const ps = clamp(Math.floor(spare), 132, 174);
        pad.style.width = ps + 'px'; pad.style.height = ps + 'px';
      }
      headKey = '';
    }
    const linkTo = (a, b) => { // unit step from cell a to its neighbour b (handles wrapped neighbours)
      let dx = b.x - a.x, dy = b.y - a.y;
      if (dx > 1) dx = -1; else if (dx < -1) dx = 1;
      if (dy > 1) dy = -1; else if (dy < -1) dy = 1;
      return [dx, dy];
    };
    function drawSnake(S, p) {
      const n = snake.length, pal = state === 'over' && !won ? SNAKE_OUCH : SNAKE;
      const parts = [];
      for (let i = 0; i < n; i++) {
        const s = snake[i], out = [], fill = [], links = [];
        let face = null;
        if (i === 0) {
          face = n > 1 ? linkTo(snake[1], s) : dir;
          for (const r of HEAD_OUT) out.push(rot(face, r));
          for (const r of HEAD_FILL) fill.push(rot(face, r));
        } else if (i === n - 1) {
          face = linkTo(s, snake[i - 1]);
          for (const r of TAIL_OUT) out.push(rot(face, r));
          for (const r of TAIL_FILL) fill.push(rot(face, r));
        } else {
          links.push(linkTo(s, snake[i - 1]), linkTo(s, snake[i + 1]));
          out.push([3, 2, 10, 12], [2, 3, 12, 10]); fill.push([4, 3, 8, 10], [3, 4, 10, 8]);
          for (const l of links) { out.push(ARM_OUT[l + '']); fill.push(ARM_FILL[l + '']); }
        }
        parts.push({ s, out, fill, links, face });
      }
      const at = (s, ox, oy) => mkPx(g, p, (s.x + 1) * S + Math.round(ox * p), (s.y + 1) * S + Math.round(oy * p));
      for (const q of parts) { const px = at(q.s, 1, 2); for (const r of q.out) px(r[0], r[1], r[2], r[3], P.shadow); }
      for (const q of parts) { const px = at(q.s, 0, 0); for (const r of q.out) px(r[0], r[1], r[2], r[3], pal.out); }
      for (const q of parts) { const px = at(q.s, 0, 0); for (const r of q.fill) px(r[0], r[1], r[2], r[3], pal.body); }
      for (let i = n - 1; i >= 0; i--) {
        const q = parts[i], px = at(q.s, 0, 0);
        if (i === 0) {
          const f = q.face, R = (x, y, w, h, c) => { const r = rot(f, [x, y, w, h]); px(r[0], r[1], r[2], r[3], c); };
          R(3, 2, 2, 4, pal.collar); R(3, 10, 2, 4, pal.collar);
          R(6, 6, 1, 4, pal.spot);
          R(8, 3, 3, 3, pal.eye); R(8, 10, 3, 3, pal.eye);
          if (state === 'over' && !won) {
            for (const ey of [3, 10]) { R(8, ey, 1, 1, pal.pupil); R(10, ey, 1, 1, pal.pupil); R(9, ey + 1, 1, 1, pal.pupil); R(8, ey + 2, 1, 1, pal.pupil); R(10, ey + 2, 1, 1, pal.pupil); }
          } else {
            R(9, 4, 2, 2, pal.pupil); R(9, 10, 2, 2, pal.pupil);
            if (state === 'ready' ? true : (steps % 6) < 2) { R(15, 7, 2, 2, pal.tongue); R(17, 6, 1, 1, pal.tongue); R(17, 9, 1, 1, pal.tongue); }
          }
          R(13, 6, 1, 1, pal.out); R(13, 9, 1, 1, pal.out);
        } else if (i === n - 1) {
          const f = q.face, R = (x, y, w, h, c) => { const r = rot(f, [x, y, w, h]); px(r[0], r[1], r[2], r[3], c); };
          R(8, 7, 2, 2, pal.hi);
        } else {
          const has = (dx, dy) => q.links.some((l) => l[0] === dx && l[1] === dy);
          const up = has(0, -1), dn = has(0, 1), lf = has(-1, 0), rt = has(1, 0);
          if (!up) px(4, 3, 8, 1, pal.hi); if (!lf) px(3, 4, 1, 8, pal.hi);
          if (!dn) px(4, 12, 8, 1, pal.lo); if (!rt) px(12, 4, 1, 8, pal.lo);
          if (lf) { px(0, 3, 4, 1, pal.hi); px(0, 12, 4, 1, pal.lo); }
          if (rt) { px(12, 3, 4, 1, pal.hi); px(12, 12, 4, 1, pal.lo); }
          if (up) { px(3, 0, 1, 4, pal.hi); px(12, 0, 1, 4, pal.lo); }
          if (dn) { px(3, 12, 1, 4, pal.hi); px(12, 12, 1, 4, pal.lo); }
          if (i % 2) px(7, 7, 2, 2, pal.hi); else px(6, 6, 4, 4, pal.spot);
        }
      }
    }
    function draw() {
      if (!bgLayer || !board.width) return;
      const S = Math.round(cs * dpr), p = S / 16;
      g.imageSmoothingEnabled = false;
      g.drawImage(bgLayer, 0, 0);
      const cell = (x, y, ox, oy) => mkPx(g, p, (x + 1) * S + Math.round(ox * p), (y + 1) * S + Math.round(oy * p));
      const bob = live() && Math.floor(clock / 380) % 2 ? -1 : 0;
      if (apple) {
        cell(apple.x, apple.y, 0, 0)(4, 14, 8, 1, P.shadow);
        bitmapPal(cell(apple.x, apple.y, 0, bob), APPLE, APPLE_PAL, 0, 0);
      }
      if (bonus) {
        const left = GOLD_LIFE - (clock - bonus.born);
        const px = cell(bonus.x, bonus.y, 0, 0);
        if (left > 2000 || Math.floor(clock / 140) % 2 === 0) {
          px(4, 14, 8, 1, P.shadow);
          const pb = cell(bonus.x, bonus.y, 0, -bob - 1);
          bitmapPal(pb, APPLE, GOLD_PAL, 0, 0);
          if (Math.floor(clock / 220) % 2) { pb(1, 4, 1, 3, '#fff'); pb(0, 5, 3, 1, '#fff'); pb(14, 11, 1, 1, '#fff'); }
          else { pb(14, 3, 1, 3, '#fff'); pb(13, 4, 3, 1, '#fff'); pb(1, 11, 1, 1, '#fff'); }
        }
        px(2, 15, 12, 1, P.grassDk); px(2, 15, 12 * clamp(left / GOLD_LIFE, 0, 1), 1, '#ffd23f');
      }
      drawSnake(S, p);
      if (crash) {
        const px = cell(crash.x, crash.y, 4.5 + crash.d[0] * 8, 4.5 + crash.d[1] * 8);
        BURST.forEach((row, r) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== '.') px(i, r, 1, 1, ch === 'o' ? '#ffd23f' : '#ffffff'); } });
      }
      for (const f of floaters) {
        const age = clamp((clock - f.t0) / 750, 0, 1), w = f.text.length * 4 - 1;
        const px = cell(f.x, f.y, 8 - w / 2, -6 - Math.round(age * 8));
        for (let k = 0; k < f.text.length; k++) {
          bitmap(px, SMALL[f.text[k]], k * 4 + 1, 1, 1, '#2a4a12');
          bitmap(px, SMALL[f.text[k]], k * 4, 0, 1, f.gold ? '#ffe98a' : '#ffffff');
        }
      }
    }
    function drawHead() {
      const shown = Math.max(best[speed] || 0, score), m = mood();
      const key = [score, shown, m, sunPressed, paused, state, speed, wrap, snake.length].join('|');
      if (key === headKey) return;
      headKey = key;
      drawCounter(cScore, score, 'apple');
      drawCounter(cBest, shown, 'crown');
      drawSun(sunCv, m, sunPressed);
      sunBtn.setAttribute('aria-label', state === 'play' ? (paused ? 'Resume' : 'Pause') : 'New game');
      sunBtn.title = state === 'play' ? (paused ? 'Resume (P)' : 'Pause (P)') : 'New game (F2)';
      cScore.title = 'Score: ' + score; cBest.title = `Best (${SPEEDS[speed].label}): ${shown}`;
      pad.classList.toggle('sn-paused', paused);
      const st = `${SPEEDS[speed].label} · ${wrap ? 'Open edges' : 'Fenced lawn'} · Length ${snake.length}`;
      if (st !== statusKey) { statusKey = st; if (ctx.setStatus) ctx.setStatus(st); }
    }
    function showOverlay() {
      let cls = '', html = '';
      if (state === 'ready') {
        cls = 'sn-o-ready';
        html = `<div class="sn-sign"><b>Grass Snake</b><span class="sn-blink">${mobile ? 'Swipe or tap an arrow to start' : 'Press any arrow to start'}</span></div>`;
      } else if (state === 'play' && paused) {
        cls = 'sn-o-pause';
        html = `<div class="sn-sign"><b>Paused</b><span>${mobile ? 'Tap to resume' : 'Press P or click to resume'}</span></div>`;
      } else if (state === 'over' && panel) {
        cls = 'sn-o-end';
        const title = won ? 'Lawn complete!' : 'Game over';
        const line = why === 'fence' ? 'Bonked into the fence.' : why === 'self' ? 'Tied yourself in a knot.' : 'Not a blade of grass left to cover.';
        html = `<div class="sn-sign sn-end" role="dialog" aria-label="${title}"><b>${title}</b><span>${line}</span>
          <div class="sn-tally"><span>Score</span><b>${score}</b><span>Best · ${SPEEDS[speed].label}</span><b>${best[speed] || 0}</b></div>
          ${newBest ? '<em class="sn-newbest">New best!</em>' : ''}
          <button type="button" class="xp-btn sn-btn sn-again default">Play again</button></div>`;
      }
      over.className = 'sn-over' + (cls ? ' ' + cls : '');
      over.innerHTML = html;
      over.hidden = !html;
    }

    // ---------------------------------------------------------------- pointer input: swipe, d-pad, overlay, sun
    let swipe = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || (e.target.closest && e.target.closest('button'))) return;
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    stage.addEventListener('pointermove', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up));
      swipe.x = e.clientX; swipe.y = e.clientY; // keep the finger down and swipe again for the next turn
    });
    const swipeEnd = (e) => { if (swipe && e.pointerId === swipe.id) swipe = null; };
    stage.addEventListener('pointerup', swipeEnd);
    stage.addEventListener('pointercancel', swipeEnd);
    stage.addEventListener('contextmenu', (e) => e.preventDefault());

    pad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      const d = b.dataset.d;
      if (d === 'pause') { if (state === 'play') setPaused(!paused); else if (state === 'over') newGame(); }
      else turn(DIRS[d]);
    });
    over.addEventListener('click', (e) => {
      if (e.target.closest('.sn-again')) { sound('click'); newGame(); }
      else if (state === 'play' && paused) setPaused(false);
    });
    sunBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); sunPressed = true; drawHead(); });
    const sunUp = () => { if (sunPressed) { sunPressed = false; drawHead(); } };
    sunBtn.addEventListener('pointerup', sunUp); sunBtn.addEventListener('pointerleave', sunUp); sunBtn.addEventListener('pointercancel', sunUp);
    sunBtn.addEventListener('click', () => { sound('click'); if (state === 'play') setPaused(!paused); else newGame(); });

    // ---------------------------------------------------------------- menus & dialogs
    let openMenu = null;
    function setMenu(m) {
      openMenu = m;
      root.querySelectorAll('.sn-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) { setPaused(true); syncMenu(); }
    }
    function syncMenu() {
      root.querySelectorAll('.sn-drop .radio').forEach((b) => b.classList.toggle('on', b.dataset.a === speed));
      root.querySelector('[data-a="wrap"]').classList.toggle('on', wrap);
      const pb = root.querySelector('[data-a="pause"]');
      pb.classList.toggle('off', state !== 'play');
      pb.querySelector('.sn-plabel').textContent = state === 'play' && paused ? 'Resume' : 'Pause';
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.sn-mtitle');
      if (t) { e.preventDefault(); const m = t.parentElement; setMenu(openMenu === m ? null : m); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.sn-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => {
      const b = e.target.closest('.sn-drop button');
      if (!b) return;
      setMenu(null); action(b.dataset.a);
    });
    const host = () => root.closest('.kz-win') || root; // clicks on our own title bar keep the keyboard
    const outside = (e) => {
      if (openMenu && !openMenu.contains(e.target)) setMenu(null);
      if (!host().contains(e.target)) { focused = false; setPaused(true); }
    };
    document.addEventListener('pointerdown', outside, true);

    const savePref = () => lsSet(LS_PREF, { speed, wrap });
    function action(a) {
      if (a === 'new') newGame();
      else if (a === 'pause') { if (state === 'play') setPaused(!paused); }
      else if (SPEEDS[a]) { speed = a; savePref(); newGame(); }
      else if (a === 'wrap') { wrap = !wrap; savePref(); fit(); newGame(); }
      else if (a === 'best') showBest();
      else if (a === 'exit') { if (ctx.close) ctx.close(); }
      else if (a === 'howto') dialog('How to Play', `<p>Steer the grass snake around the lawn and eat apples. Every apple is worth <b>${APPLE_PTS}</b> points and makes the snake one block longer.</p>
        <ul><li><b>Arrow keys</b> or <b>W A S D</b> to turn. On touch, <b>swipe</b> or use the arrow pad.</li>
        <li>Don't bump into the <b>fence</b> or into <b>yourself</b>.</li>
        <li>A <b>golden apple</b> appears after every ${GOLD_EVERY} apples. It is worth up to <b>${GOLD_MAX}</b> points, fades fast and doesn't make you longer.</li>
        <li><b>P</b> or <b>Space</b> pauses. <b>F2</b> or <b>R</b> starts over.</li>
        <li><b>Wrap around edges</b> swaps the fence for a garden path: slide off one side and come back on the other.</li></ul>`);
      else if (a === 'about') dialog('About Grass Snake', `<p><b>Grass Snake</b> for Kayzee XP.</p><p>Original pixel art and code, drawn in the browser. A fan homage to the classic grid snake puzzle; not affiliated with any phone or operating-system vendor.</p>`);
    }
    function dialog(title, html, buttons = [['OK', () => true]]) {
      setPaused(true);
      modal.innerHTML = `<div class="sn-dlg" role="dialog" aria-label="${title}"><div class="sn-dlg-t">${title}</div><div class="sn-dlg-b xp-scroll">${html}</div><div class="sn-dlg-f"></div></div>`;
      const f = modal.querySelector('.sn-dlg-f');
      buttons.forEach(([label, fn], k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-btn sn-btn' + (k === 0 ? ' default' : ''); b.textContent = label;
        b.addEventListener('click', () => { if (fn() !== false) modal.hidden = true; });
        f.appendChild(b);
      });
      modal.hidden = false;
      f.firstChild.focus({ preventScroll: true });
    }
    function showBest() {
      best = readBest();
      const row = (k) => `<tr><td>${SPEEDS[k].label}</td><td class="t">${best[k] ? best[k] : '—'}</td></tr>`;
      dialog('Best Scores', `<table class="sn-best-t">${row('slow')}${row('normal')}${row('fast')}</table>`,
        [['OK', () => true], ['Reset Scores', () => { lsSet(LS_BEST, {}); best = {}; headKey = ''; drawHead(); showBest(); return false; }]]);
    }
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { modal.hidden = true; e.stopPropagation(); e.preventDefault(); }
      else if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { const b = modal.querySelector('.sn-btn.default'); if (b) b.click(); e.stopPropagation(); }
    });
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) modal.hidden = true; });

    // ---------------------------------------------------------------- keys & focus
    const onKey = (e) => {
      if (!focused || e.ctrlKey || e.metaKey || e.altKey || !modal.hidden) return;
      const t = e.target;
      if (t && t.nodeType === 1 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (KEYS[k]) { e.preventDefault(); if (openMenu) setMenu(null); if (!e.repeat) turn(KEYS[k]); return; }
      if (k === 'F2' || k === 'r') { e.preventDefault(); if (!e.repeat) { setMenu(null); newGame(); } return; }
      if (k === 'Escape') { if (openMenu) setMenu(null); else setPaused(true); return; }
      if (k === 'p' || k === ' ' || k === 'Enter') {
        if (k !== 'p' && t && t.closest && t.closest('button, a')) return; // let a focused button take Space / Enter
        if (k !== 'Enter') e.preventDefault();
        if (e.repeat) return;
        if (state === 'play' && k !== 'Enter') { setMenu(null); setPaused(!paused); }
        else if (state === 'over' && panel && k !== 'p') newGame();
      }
    };
    window.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', () => { focused = true; });
    const onVis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onVis);

    const ro = new ResizeObserver(() => { fit(); draw(); drawHead(); });
    ro.observe(stage);
    fit();
    newGame();

    // test hook (harmless in production): lets the CDP harness read the game state
    Object.defineProperty(root, '_kzSnake', { configurable: true, value: {
      get state() { return state; }, get paused() { return paused; }, get score() { return score; }, get best() { return { ...best }; },
      get speed() { return speed; }, get wrap() { return wrap; }, get dir() { return dir.slice(); }, get queue() { return queue.map((d) => d.slice()); },
      get snake() { return snake.map((s) => [s.x, s.y]); }, get apple() { return apple ? [apple.x, apple.y] : null; },
      get bonus() { return bonus ? [bonus.x, bonus.y] : null; }, get steps() { return steps; }, get eaten() { return eaten; },
      get cs() { return cs; }, get why() { return why; }, get focused() { return focused; }, get running() { return !!raf; },
      cols: COLS, rows: ROWS,
    } });

    return {
      onResize() { fit(); draw(); drawHead(); },
      onFocus() { focused = true; },
      onBlur() { focused = false; setMenu(null); setPaused(true); },
      unmount() {
        disposed = true;
        cancelAnimationFrame(raf); raf = 0;
        clearTimeout(overT); clearTimeout(dingT);
        ro.disconnect();
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('visibilitychange', onVis);
        delete root._kzSnake;
        root.classList.remove('sn-tiny');
        root.innerHTML = '';
      },
    };
  },
};
