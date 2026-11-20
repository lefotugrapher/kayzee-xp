// Inbox Zero: an original paddle-and-ball game for Kayzee XP with an office / comms theme.
// The bricks are unread emails, the paddle is a little keyboard "Reply" bar and the ball is a
// cursor-blue ball. All art is drawn procedurally here (no external assets), physics runs on a
// fixed timestep so the game plays the same at any frame rate.

// ------------------------------------------------------------------ levels (add more freely)
// 12 columns per row, any number of rows (up to 14).
//   .  empty            a b c d  normal mail (four colours, 1 hit)
//   U  urgent (2 hits)  n        newsletter (1 hit, worth less)
//   #  out of office (steel, never breaks)
//   C R S L  normal mail with a paperclip that drops Coffee / Reply-All / Snooze / extra Life
const LEVELS = [
  { name: 'Monday, 9:01', map: [
    '............',
    '.aaaaaaaaaa.',
    '.bbbCbbbbbb.',
    '.ccccccRccc.',
    '.ddSddddddd.',
    '.nnnnnnnnnn.',
  ] },
  { name: 'Press Release Day', map: [
    '.....UU.....',
    '....aaaa....',
    '...bbCbbb...',
    '..cccccccc..',
    '.ddRddddSdd.',
    'nnnnnnnnnnnn',
  ] },
  { name: 'Reply-All Storm', map: [
    'a.a.a.a.a.a.',
    '.b.b.b.b.b.b',
    'U.R.U.U.R.U.',
    '.c.c.c.c.c.c',
    'd.d.S.d.d.L.',
    '.n.n.n.n.n.n',
    'a.a.a.a.a.a.',
  ] },
  { name: 'Newsletter Season', map: [
    'nnnnnnnnnnnn',
    'n..........n',
    'n.UUUUUUUU.n',
    'n.UaaCaaaU.n',
    'n.UUUUUUUU.n',
    'n..........n',
    'nnn#nSRn#nnn',
  ] },
  { name: 'Out of Office', map: [
    'aaaaaaaaaaaa',
    'bbbbCbbLbbbb',
    '............',
    '##..####..##',
    'cccccccccccc',
    'dUdUdSdUdUdd',
    '............',
    '.##.#..#.##.',
    'nnnnnRnnnnnn',
  ] },
  { name: 'Crisis Comms', map: [
    'UUUUUUUUUUUU',
    'aRaaaaaaaaCa',
    'bbbbbbbbbbbb',
    '#..#....#..#',
    'UcUcUcUcUcUc',
    'ddSdddddLddd',
    'U.U.U..U.U.U',
    'n#nnnnnnnn#n',
  ] },
];

// ------------------------------------------------------------------ constants (logical pixels)
const W = 239, H = 300, WALL = 4, TOP = 13;
const COLS = 12, MAX_ROWS = 14, BW = 18, BH = 10, CW = 19, CH = 11, X0 = 6, Y0 = 20;
const PY = 276, PH = 7, PW = 40, PW_WIDE = 62;
const BR = 3, CAP_W = 16, CAP_H = 9;
const DT = 1 / 120, MINV = 0.24, KEY_SPEED = 270, CAP_FALL = 58;
const T_COFFEE = 15, T_SNOOZE = 10, SNOOZE_MUL = 0.6, MAX_BALLS = 9, MAX_LIVES = 5, MAX_MULT = 8;
const LS_BEST = 'kayzee-inbox-best', LS_SND = 'kayzee-inbox-sound';

const NORMAL = ['cream', 'manila', 'sky', 'mint'];
const KIND = {
  a: { look: 'cream', hp: 1, pts: 10 }, b: { look: 'manila', hp: 1, pts: 10 },
  c: { look: 'sky', hp: 1, pts: 10 }, d: { look: 'mint', hp: 1, pts: 10 },
  U: { look: 'urgent', hp: 2, pts: 30 }, n: { look: 'news', hp: 1, pts: 5 },
  '#': { look: 'steel', hp: 1, pts: 0, solid: true },
};
const DROP = { C: 'coffee', R: 'reply', S: 'snooze', L: 'life' };
const CAPS = ['coffee', 'reply', 'snooze', 'life'];

// ------------------------------------------------------------------ palette (original)
const LOOK = {
  cream: { body: '#fffdf0', hi: '#ffffff', lo: '#dcd6bd', line: '#7c97c9', edge: '#44598a', bit: '#f4efd8' },
  manila: { body: '#ffd96a', hi: '#fff0b4', lo: '#d9a630', line: '#a87412', edge: '#6e4a08', bit: '#ffd96a' },
  sky: { body: '#8fc7ff', hi: '#cfe7ff', lo: '#5a98dc', line: '#2f66b4', edge: '#1c3f7c', bit: '#8fc7ff' },
  mint: { body: '#a4e592', hi: '#d6f7cb', lo: '#6cbb58', line: '#3d8a2c', edge: '#245a18', bit: '#a4e592' },
  urgent: { body: '#e9513a', hi: '#ff8f76', lo: '#b53222', line: '#8e2012', edge: '#5e140a', bit: '#e9513a' },
  hurt: { body: '#f29a86', hi: '#ffc6b8', lo: '#cf6c58', line: '#a8402e', edge: '#7a2416', bit: '#f29a86' },
  news: { body: '#d5d8de', hi: '#f1f2f5', lo: '#a6abb5', line: '#7d838f', edge: '#555b68', bit: '#c3c7cf' },
  steel: { body: '#aeb6c1', hi: '#e6eaef', lo: '#78818f', line: '#4a525e', edge: '#343a44', bit: '#aeb6c1' },
};
const CAPC = {
  coffee: { a: '#9a6230', hi: '#c98e54', lo: '#6c4019', edge: '#3c2109', label: 'Coffee' },
  reply: { a: '#6b5bdc', hi: '#a094f2', lo: '#4636a8', edge: '#221a66', label: 'Reply-All' },
  snooze: { a: '#2a9db0', hi: '#74d0de', lo: '#17707f', edge: '#0a3d47', label: 'Snooze' },
  life: { a: '#dc4a92', hi: '#f595c3', lo: '#a52a68', edge: '#5c1238', label: 'Extra life' },
};
const BALL = { a: '#2a6fe0', hi: '#a9ceff', lo: '#1a4fb0', edge: '#0f2f78' };
const BALL_Z = { a: '#7f74e6', hi: '#cfc9ff', lo: '#5448b8', edge: '#2b2372' };

// 3x5 pixel font, 5 rows of 3 bits per glyph
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001',
  5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', '.': '000000000000010',
  ':': '000010000010000', x: '000101010101000',
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }

// ------------------------------------------------------------------ pixel painters
// px(x, y, w, h, colour) in logical pixels; edges snap to device pixels so art stays crisp at any scale.
function pxFor(g, s, ox = 0, oy = 0) {
  const R = (v) => Math.round(v * s);
  return (x, y, w, h, c) => { g.fillStyle = c; const x0 = R(x), y0 = R(y); g.fillRect(ox + x0, oy + y0, R(x + w) - x0, R(y + h) - y0); };
}
function sprite(wL, hL, s, draw) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(wL * s)); cv.height = Math.max(1, Math.round(hL * s));
  draw(pxFor(cv.getContext('2d'), s));
  return cv;
}
function text(px, str, x, y, c) {
  for (let i = 0; i < str.length; i++) {
    const gl = FONT[str[i]];
    if (gl) for (let k = 0; k < 15; k++) if (gl[k] === '1') px(x + i * 4 + (k % 3), y + ((k / 3) | 0), 1, 1, c);
  }
}
const textW = (str) => str.length * 4 - 1;

function drawFrame(px, w, h, k) {
  // rounded 1px outline + body + top highlight + bottom shade
  px(1, 0, w - 2, 1, k.edge); px(1, h - 1, w - 2, 1, k.edge); px(0, 1, 1, h - 2, k.edge); px(w - 1, 1, 1, h - 2, k.edge);
  px(1, 1, w - 2, h - 2, k.body); px(1, 1, w - 2, 1, k.hi); px(1, h - 2, w - 2, 1, k.lo);
}
function drawEnvelope(px, k) {
  drawFrame(px, BW, BH, k);
  for (let i = 0; i < 8; i++) { const y = 1 + Math.round(i * 0.55); px(1 + i, y, 1, 1, k.line); px(16 - i, y, 1, 1, k.line); }
}
function drawClip(px) {
  // paperclip: this email carries an attachment (a power-up)
  const c = '#3f4a63', s = '#eef1f6';
  px(12, 1, 3, 7, s);
  px(13, 1, 1, 1, c); px(12, 2, 1, 5, c); px(14, 2, 1, 4, c); px(13, 7, 1, 1, c);
}
function drawBrick(px, look) {
  const k = LOOK[look];
  if (look === 'news') {
    drawFrame(px, BW, BH, k);
    px(3, 3, 7, 1, k.line); px(3, 5, 9, 1, k.line); px(3, 7, 5, 1, k.line); px(13, 3, 3, 3, '#9097a4'); px(13, 3, 3, 1, '#b4bac5');
  } else if (look === 'steel') {
    drawFrame(px, BW, BH, k);
    px(1, 1, 1, 8, k.hi); px(16, 1, 1, 8, k.lo);
    text(px, 'OOO', 4, 3, k.line);
  } else if (look === 'urgent' || look === 'hurt') {
    drawEnvelope(px, k);
    px(8, 2, 2, 4, '#fff'); px(8, 7, 2, 1, '#fff');
    if (look === 'hurt') { // torn open after the first hit
      const z = k.edge;
      px(3, 1, 1, 2, z); px(4, 3, 1, 2, z); px(3, 5, 1, 2, z); px(4, 7, 1, 2, z);
      px(14, 1, 1, 2, z); px(13, 3, 1, 2, z); px(14, 5, 1, 2, z); px(13, 7, 1, 2, z);
    }
  } else drawEnvelope(px, k);
}
function drawCapsule(px, type) {
  const k = CAPC[type], w = CAP_W, h = CAP_H, i = '#ffffff';
  px(2, 0, w - 4, 1, k.edge); px(2, h - 1, w - 4, 1, k.edge); px(0, 2, 1, h - 4, k.edge); px(w - 1, 2, 1, h - 4, k.edge);
  px(1, 1, 1, 1, k.edge); px(w - 2, 1, 1, 1, k.edge); px(1, h - 2, 1, 1, k.edge); px(w - 2, h - 2, 1, 1, k.edge);
  px(2, 1, w - 4, h - 2, k.a); px(1, 2, 1, h - 4, k.a); px(w - 2, 2, 1, h - 4, k.a);
  px(2, 1, w - 4, 1, k.hi); px(1, 2, 1, 1, k.hi); px(2, h - 2, w - 4, 1, k.lo); px(w - 2, h - 3, 1, 1, k.lo);
  if (type === 'coffee') { // a cup with steam
    px(6, 2, 1, 1, i); px(8, 2, 1, 1, i); px(5, 3, 5, 3, i); px(10, 3, 2, 1, i); px(11, 4, 1, 1, i); px(10, 5, 1, 1, i); px(4, 6, 7, 1, i);
  } else if (type === 'reply') { // double "reply" chevrons
    for (let n = 0; n < 2; n++) { const x = 4 + n * 4; px(x + 2, 2, 1, 1, i); px(x + 1, 3, 1, 1, i); px(x, 4, 1, 1, i); px(x + 1, 5, 1, 1, i); px(x + 2, 6, 1, 1, i); }
    px(10, 4, 3, 1, i);
  } else if (type === 'snooze') {
    text(px, 'ZZ', 5, 2, i);
  } else { // a heart
    px(5, 2, 2, 1, i); px(9, 2, 2, 1, i); px(5, 3, 6, 2, i); px(6, 5, 4, 1, i); px(7, 6, 2, 1, i);
  }
}
function drawBall(px, k) {
  px(2, 0, 3, 1, k.edge); px(2, 6, 3, 1, k.edge); px(0, 2, 1, 3, k.edge); px(6, 2, 1, 3, k.edge);
  px(1, 1, 1, 1, k.edge); px(5, 1, 1, 1, k.edge); px(1, 5, 1, 1, k.edge); px(5, 5, 1, 1, k.edge);
  px(2, 1, 3, 5, k.a); px(1, 2, 5, 3, k.a);
  px(4, 5, 1, 1, k.lo); px(5, 4, 1, 1, k.lo); px(5, 3, 1, 1, k.lo); px(3, 5, 1, 1, k.lo);
  px(2, 1, 2, 1, k.hi); px(1, 2, 1, 2, k.hi); px(2, 2, 1, 1, '#ffffff');
}
function drawPaddle(px, w, coffee) {
  const edge = '#4a4636', cap = coffee ? '#a0642c' : '#2a6fe0', capHi = coffee ? '#d49a5c' : '#86b6ff', capLo = coffee ? '#6c4019' : '#1a4fb0';
  px(1, 0, w - 2, 1, edge); px(1, PH - 1, w - 2, 1, edge); px(0, 1, 1, PH - 2, edge); px(w - 1, 1, 1, PH - 2, edge);
  px(1, 1, w - 2, PH - 2, '#e6e2d2'); px(1, 1, w - 2, 1, '#ffffff'); px(1, PH - 2, w - 2, 1, '#b6b19c');
  // end caps with little arrows
  px(1, 1, 6, PH - 2, cap); px(w - 7, 1, 6, PH - 2, cap);
  px(1, 1, 6, 1, capHi); px(w - 7, 1, 6, 1, capHi); px(1, PH - 2, 6, 1, capLo); px(w - 7, PH - 2, 6, 1, capLo);
  px(2, 3, 1, 1, '#fff'); px(3, 2, 1, 3, '#fff'); px(4, 3, 2, 1, '#fff');
  px(w - 3, 3, 1, 1, '#fff'); px(w - 4, 2, 1, 3, '#fff'); px(w - 6, 3, 2, 1, '#fff');
  // keys and a space bar
  for (let x = 9; x <= w - 11; x += 3) px(x, 2, 2, 1, '#8f8b7a');
  if (w > 30) px(13, 4, w - 26, 1, '#8f8b7a');
}
function drawBackground(px) {
  px(0, 0, W, H, '#f6f8fc');
  // zebra rows, like an inbox list
  for (let r = 0; r < 15; r++) if (r % 2) px(WALL, Y0 - 1 + r * CH, W - WALL * 2, CH, '#ecf1f9');
  px(WALL, Y0 - 1 + 15 * CH, W - WALL * 2, 1, '#e3e9f4');
  // column header (the ceiling)
  px(0, 0, W, TOP, '#dfe7f5'); px(0, 0, W, 1, '#ffffff'); px(0, TOP - 1, W, 1, '#9fb1d1');
  const ink = '#7386aa', sep = '#b7c5de';
  text(px, 'FROM', 8, 4, ink); px(46, 2, 1, 8, sep); text(px, 'SUBJECT', 52, 4, ink);
  px(158, 2, 1, 8, sep); text(px, 'RECEIVED', 164, 4, ink);
  px(202, 5, 5, 1, ink); px(203, 6, 3, 1, ink); px(204, 7, 1, 1, ink);
  // side walls
  for (const x of [0, W - WALL]) { px(x, TOP, WALL, H - TOP, '#b9c9e6'); px(x, TOP, 1, H - TOP, '#e9effa'); px(x + WALL - 1, TOP, 1, H - TOP, '#8ea2c8'); }
  // the "missed" line under the reply bar
  for (let x = WALL + 2; x < W - WALL - 2; x += 6) px(x, PY + PH + 5, 3, 1, '#c9d4e8');
}

// ------------------------------------------------------------------ the app
export default {
  id: 'inbox',
  title: 'Inbox Zero',
  icon: 'inbox',
  size: [490, 687],
  minSize: [264, 400],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const mobile = !!ctx.isMobile;
    root.classList.toggle('ib-touch', mobile);
    root.innerHTML = `
      <div class="ib-menubar" role="menubar">
        <div class="ib-menu" data-m="game"><button class="ib-mtitle" type="button"><u>G</u>ame</button>
          <div class="ib-drop" role="menu">
            <button data-a="new">New game<span>F2</span></button>
            <button data-a="pause" class="check">Pause<span>P</span></button><hr>
            <button data-a="sound" class="check">Sound</button><hr>
            <button data-a="exit">Exit</button>
          </div></div>
        <div class="ib-menu" data-m="help"><button class="ib-mtitle" type="button"><u>H</u>elp</button>
          <div class="ib-drop" role="menu">
            <button data-a="howto">How to play</button><hr>
            <button data-a="about">About Inbox Zero</button>
          </div></div>
      </div>
      <div class="ib-hud">
        <div class="ib-cell ib-unread"><canvas class="ib-ico" aria-hidden="true"></canvas><span>Unread</span><b class="ib-n-unread">0</b></div>
        <div class="ib-cell ib-score"><span>Score</span><b class="ib-n-score">0</b><i class="ib-combo"></i></div>
        <div class="ib-cell ib-lives" role="img" aria-label="Lives"></div>
      </div>
      <div class="ib-stage">
        <div class="ib-screen">
          <canvas class="ib-cv" aria-label="Inbox Zero playfield"></canvas>
          <div class="ib-card" hidden><b></b><span></span></div>
        </div>
        <div class="ib-pad" aria-hidden="true">◄ drag here ►</div>
      </div>
      <div class="ib-status xp-statusbar"><span class="xp-status-cell ib-s-level"></span><span class="xp-status-cell ib-s-best"></span></div>
      <div class="ib-modal" hidden></div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.ib-stage'), screen = $('.ib-screen'), cv = $('.ib-cv'), cardEl = $('.ib-card');
    const menubar = $('.ib-menubar'), modal = $('.ib-modal');
    const elUnread = $('.ib-n-unread'), elScore = $('.ib-n-score'), elCombo = $('.ib-combo'), elLives = $('.ib-lives');
    const elLevel = $('.ib-s-level'), elBest = $('.ib-s-best'), ico = $('.ib-ico');
    const g = cv.getContext('2d');

    // ---------------------------------------------------------------- state
    let level = 0, score = 0, lives = 3, combo = 0, speed = 0, speedBase = 0, speedMax = 0;
    let best = Math.max(0, +lsGet(LS_BEST, 0) || 0), newBest = false;
    let soundOn = lsGet(LS_SND, true) !== false;
    let state = 'ready'; // ready | play | clear | over | won
    let paused = false, fresh = true, stateAt = 0, clearT = 0;
    let bricks = [], grid = [], left = 0;
    let balls = [], caps = [], parts = [], pops = [];
    let padX = W / 2, padW = PW;
    const fx = { coffee: 0, snooze: 0 };
    const keys = { l: false, r: false };
    let target = null; // pointer-driven paddle centre (logical x)
    let S = 1, spr = null, sprKey = 0, px = null;
    let raf = 0, last = 0, acc = 0, disposed = false, lastClick = 0, idleSig = NaN;

    function snd(name) {
      if (!soundOn || !ctx.sound) return;
      if (name === 'click') { const t = performance.now(); if (t - lastClick < 45) return; lastClick = t; }
      try { ctx.sound(name); } catch { /* synth may be unavailable */ }
    }
    function commitBest() { if (score > best) { best = score; newBest = true; lsSet(LS_BEST, best); } }

    // ---------------------------------------------------------------- level setup
    function loadLevel(n) {
      level = n;
      const def = LEVELS[n];
      bricks = []; grid = []; left = 0;
      def.map.slice(0, MAX_ROWS).forEach((row, r) => {
        const line = [];
        for (let c = 0; c < COLS; c++) {
          const ch = row[c] || '.';
          let k = KIND[ch], drop = null;
          if (DROP[ch]) { // an attachment takes the colour of the mail next to it
            const near = 'abcd'.includes(row[c - 1]) ? row[c - 1] : 'abcd'.includes(row[c + 1]) ? row[c + 1] : 'abcd'[r % 4];
            k = KIND[near]; drop = DROP[ch];
          }
          if (!k) { line.push(null); continue; }
          const b = { c, r, x: X0 + c * CW, y: Y0 + r * CH, look: k.look, hp: k.hp, pts: k.pts, solid: !!k.solid, drop, flash: 0 };
          bricks.push(b); line.push(b);
          if (!b.solid) left++;
        }
        grid.push(line);
      });
      speedBase = 132 + 9 * n; speedMax = speedBase * 1.55; speed = speedBase;
      caps = []; parts = []; pops = [];
      fx.coffee = 0; fx.snooze = 0; padW = PW; combo = 0;
      fresh = true;
      holdBall();
      setState('ready');
    }
    function holdBall() {
      balls = [{ x: padX, y: PY - BR - 0.5, ox: padX, oy: PY - BR - 0.5, dx: 0, dy: -1, idle: 0 }];
    }
    function newGame() {
      commitBest();
      score = 0; lives = 3; newBest = false; paused = false; padX = W / 2; target = null;
      loadLevel(0);
      kick();
    }
    function setState(s) {
      state = s; stateAt = performance.now(); idleSig = NaN;
      if (s === 'over' || s === 'won') paused = false;
      syncCard(); syncStatus();
    }
    function syncStatus() {
      const t = `Level ${level + 1} of ${LEVELS.length} · ${LEVELS[level].name}`;
      elLevel.textContent = t; elBest.textContent = `Best ${Math.max(best, score)}`;
    }
    function syncCard() {
      const go = mobile ? 'Tap to send the ball' : 'Click or press Space to send';
      let t = '', s = '';
      if (paused) { t = 'Paused'; s = mobile ? 'Tap to carry on' : 'Press P or click to carry on'; }
      else if (state === 'ready') {
        if (fresh) { t = LEVELS[level].name; s = `Level ${level + 1} of ${LEVELS.length} · ${go}`; }
        else { t = 'Missed one.'; s = `${lives} ${lives === 1 ? 'life' : 'lives'} left · ${go}`; }
      } else if (state === 'clear') {
        t = 'Inbox zero!';
        s = `Level bonus +${100 * (level + 1)}` + (level + 1 < LEVELS.length ? ` · next: ${LEVELS[level + 1].name}` : '');
      } else if (state === 'over') {
        t = 'Mailbox full'; s = `Score ${score}${newBest ? ' · new best!' : ` · best ${best}`} · ${mobile ? 'tap' : 'click or F2'} for a new game`;
      } else if (state === 'won') {
        t = 'Inbox zero. All of it.'; s = `Score ${score}${newBest ? ' · new best!' : ` · best ${best}`} · ${mobile ? 'tap' : 'click'} to play again`;
      }
      cardEl.hidden = !t;
      cardEl.firstElementChild.textContent = t; cardEl.lastElementChild.textContent = s;
      cardEl.dataset.kind = paused ? 'paused' : state;
      stage.classList.toggle('ib-live', !paused && (state === 'ready' || state === 'play'));
    }

    // ---------------------------------------------------------------- game rules
    const multNow = () => Math.min(MAX_MULT, 1 + combo);
    function addPop(x, y, str, c) { if (pops.length < 24) pops.push({ x, y, str, c, t: 0 }); }
    function burst(b, n) {
      const k = LOOK[b.look];
      for (let i = 0; i < n && parts.length < 160; i++) {
        parts.push({ x: b.x + 2 + Math.random() * (BW - 4), y: b.y + 2 + Math.random() * (BH - 4), vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 70, c: i % 3 ? k.bit : k.line, t: 0, life: 0.35 + Math.random() * 0.3 });
      }
    }
    function hitBrick(b, ball) {
      if (b.solid) { b.flash = 0.14; snd('click'); return; }
      ball.idle = 0;
      b.hp--;
      if (b.hp > 0) { b.flash = 0.16; b.look = 'hurt'; score += 5; burst(b, 3); snd('click'); return; }
      grid[b.r][b.c] = null; b.dead = true; left--;
      const m = multNow(), pts = b.pts * m;
      score += pts; combo++;
      addPop(b.x + BW / 2, b.y + 2, '+' + pts, m > 1 ? '#c2410c' : '#3c5a96');
      burst(b, 7);
      speed = Math.min(speedMax, speed + 0.5);
      let drop = b.drop;
      if (!drop && left > 0 && Math.random() < 0.07) drop = CAPS[(Math.random() * 3) | 0];
      if (drop && left > 0) caps.push({ type: drop, x: b.x + 1, y: b.y, oy: b.y });
      snd('click');
      if (left === 0) levelClear();
    }
    function levelClear() {
      const bonus = 100 * (level + 1);
      score += bonus; commitBest();
      balls = []; caps = []; fx.coffee = 0; fx.snooze = 0; combo = 0;
      const cols = ['#ffd96a', '#8fc7ff', '#a4e592', '#e9513a', '#ffffff', '#6b5bdc'];
      for (let i = 0; i < 70; i++) parts.push({ x: WALL + Math.random() * (W - WALL * 2), y: TOP + Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 60, c: cols[i % cols.length], t: 0, life: 0.9 + Math.random() * 0.9 });
      clearT = 2.2;
      setState('clear');
      snd('ding');
    }
    function nextLevel() {
      if (level + 1 < LEVELS.length) loadLevel(level + 1);
      else { commitBest(); setState('won'); }
    }
    function loseLife() {
      lives--; combo = 0; caps = []; fx.coffee = 0; fx.snooze = 0;
      snd('error');
      if (lives <= 0) { lives = 0; balls = []; commitBest(); setState('over'); return; }
      speed = (speed + speedBase) / 2; fresh = false;
      holdBall(); setState('ready');
    }
    function launch() {
      if (state !== 'ready' || paused || !balls.length) return;
      const a = (0.12 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1);
      const b = balls[0]; b.dx = Math.sin(a); b.dy = -Math.cos(a); b.idle = 0;
      fresh = false; combo = 0;
      setState('play'); snd('click');
    }
    function collect(type) {
      addPop(padX, PY - 8, type === 'life' ? '+1' : CAPC[type].label.replace('-', ' ').toUpperCase().slice(0, 9), CAPC[type].lo);
      score += 25;
      if (type === 'coffee') fx.coffee = T_COFFEE;
      else if (type === 'snooze') fx.snooze = T_SNOOZE;
      else if (type === 'life') { if (lives < MAX_LIVES) lives++; else score += 225; }
      else if (type === 'reply') {
        const add = [];
        for (const b of balls) {
          if (balls.length + add.length + 2 > MAX_BALLS) break;
          const a = Math.atan2(b.dy, b.dx);
          for (const da of [-0.42, 0.42]) add.push(fixDir({ x: b.x, y: b.y, ox: b.x, oy: b.y, dx: Math.cos(a + da), dy: Math.sin(a + da), idle: 0 }));
        }
        balls.push(...add);
      }
      snd('ding');
    }
    function fixDir(b) {
      // never let a ball go (nearly) horizontal
      if (Math.abs(b.dy) < MINV) { b.dy = (b.dy < 0 ? -1 : 1) * MINV; b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - MINV * MINV); }
      else { const l = Math.hypot(b.dx, b.dy) || 1; b.dx /= l; b.dy /= l; }
      return b;
    }

    // ---------------------------------------------------------------- physics (fixed timestep)
    function stepBall(b, v) {
      b.ox = b.x; b.oy = b.y;
      let nx = b.x + b.dx * v * DT, ny = b.y + b.dy * v * DT;
      if (nx < WALL + BR) { nx = WALL + BR; b.dx = Math.abs(b.dx); }
      else if (nx > W - WALL - BR) { nx = W - WALL - BR; b.dx = -Math.abs(b.dx); }
      if (ny < TOP + BR) { ny = TOP + BR; b.dy = Math.abs(b.dy); }
      // emails: only the closest overlapping tile reacts, so seams between tiles behave
      const c0 = Math.max(0, Math.floor((nx - BR - X0) / CW)), c1 = Math.min(COLS - 1, Math.floor((nx + BR - X0) / CW));
      const r0 = Math.max(0, Math.floor((ny - BR - Y0) / CH)), r1 = Math.min(grid.length - 1, Math.floor((ny + BR - Y0) / CH));
      let hit = null, hd = BR * BR, hx = 0, hy = 0;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const k = grid[r][c]; if (!k) continue;
        const ex = nx - clamp(nx, k.x, k.x + BW), ey = ny - clamp(ny, k.y, k.y + BH), d = ex * ex + ey * ey;
        if (d < hd) { hd = d; hit = k; hx = ex; hy = ey; }
      }
      if (hit) {
        if (hx === 0 && hy === 0) { // centre ended up inside the tile: decide from where it came
          if (b.x < hit.x) hx = -1; else if (b.x > hit.x + BW) hx = 1; else hy = b.y < hit.y + BH / 2 ? -1 : 1;
          if (hx) nx = hx > 0 ? hit.x + BW + BR : hit.x - BR; else ny = hy > 0 ? hit.y + BH + BR : hit.y - BR;
        } else {
          const d = Math.sqrt(hd) || 1, push = BR - d + 0.01;
          nx += (hx / d) * push; ny += (hy / d) * push;
        }
        if (Math.abs(hx) > Math.abs(hy)) b.dx = (hx > 0 ? 1 : -1) * Math.abs(b.dx);
        else b.dy = (hy > 0 ? 1 : -1) * Math.abs(b.dy);
        hitBrick(hit, b);
      }
      // the reply bar: the bounce angle depends on where the ball lands
      const half = padW / 2;
      if (b.dy > 0 && ny + BR >= PY && b.y + BR <= PY + 3 && nx >= padX - half - BR && nx <= padX + half + BR) {
        const t = clamp((nx - padX) / half, -1, 1), a = t * 1.08;
        b.dx = Math.sin(a); b.dy = -Math.cos(a); ny = PY - BR;
        b.idle = 0; combo = 0;
        speed = Math.min(speedMax, speed + 1.5);
        snd('click');
      }
      // anti-stall: a ball that has not touched mail or the bar for a while gets a small nudge
      b.idle += DT;
      if (b.idle > 7) { const a = Math.atan2(b.dy, b.dx) + (Math.random() < 0.5 ? -0.22 : 0.22); b.dx = Math.cos(a); b.dy = Math.sin(a); b.idle = 4; }
      fixDir(b);
      b.x = nx; b.y = ny;
      return ny - BR <= H + 4;
    }
    function step() {
      const live = state === 'ready' || state === 'play';
      if (live) {
        const want = fx.coffee > 0 ? PW_WIDE : PW;
        padW += clamp(want - padW, -140 * DT, 140 * DT);
        const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
        if (dir) { padX += dir * KEY_SPEED * DT; target = null; }
        else if (target !== null) padX = target;
        padX = clamp(padX, WALL + padW / 2, W - WALL - padW / 2);
      }
      if (state === 'ready' && balls[0]) { const b = balls[0]; b.x = b.ox = padX; b.y = b.oy = PY - BR - 0.5; }
      if (state === 'play') {
        if (fx.coffee > 0) fx.coffee = Math.max(0, fx.coffee - DT);
        if (fx.snooze > 0) fx.snooze = Math.max(0, fx.snooze - DT);
        const v = speed * (fx.snooze > 0 ? SNOOZE_MUL : 1);
        for (let i = balls.length - 1; i >= 0 && state === 'play'; i--) if (!stepBall(balls[i], v)) balls.splice(i, 1);
        if (state === 'play') {
          const pl = padX - padW / 2, pr = padX + padW / 2;
          for (let i = caps.length - 1; i >= 0; i--) {
            const c = caps[i]; c.oy = c.y; c.y += CAP_FALL * DT;
            if (c.y + CAP_H >= PY && c.y <= PY + PH && c.x + CAP_W >= pl && c.x <= pr) { caps.splice(i, 1); collect(c.type); }
            else if (c.y > H + 2) caps.splice(i, 1);
          }
          if (!balls.length) loseLife();
        }
      } else if (state === 'clear') {
        clearT -= DT;
        if (clearT <= 0) nextLevel();
      }
      for (const b of bricks) if (b.flash > 0) b.flash -= DT;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += DT;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += 260 * DT; p.x += p.vx * DT; p.y += p.vy * DT;
      }
      for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += DT; p.y -= 16 * DT; if (p.t > 0.8) pops.splice(i, 1); }
    }

    // ---------------------------------------------------------------- sizing & drawing
    function buildSprites() {
      const s = S, o = { bg: sprite(W, H, s, drawBackground) };
      for (const k of Object.keys(LOOK)) o[k] = sprite(BW, BH, s, (p) => drawBrick(p, k));
      for (const k of NORMAL) o[k + '+'] = sprite(BW, BH, s, (p) => { drawBrick(p, k); drawClip(p); });
      for (const k of CAPS) o['cap_' + k] = sprite(CAP_W, CAP_H, s, (p) => drawCapsule(p, k));
      o.ball = sprite(7, 7, s, (p) => drawBall(p, BALL));
      o.ballZ = sprite(7, 7, s, (p) => drawBall(p, BALL_Z));
      spr = o;
    }
    function fit() {
      const sw = stage.clientWidth - 12, sh = stage.clientHeight - 12;
      if (sw < 8 || sh < 8) return;
      const sc = Math.min(sw / W, sh / H);
      const cssW = Math.max(40, Math.floor(W * sc)), cssH = Math.round(cssW * H / W);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const bw = clamp(Math.round(cssW * dpr), W, W * 5), bh = Math.round(bw * H / W);
      screen.style.width = cssW + 'px'; screen.style.height = cssH + 'px';
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      S = bw / W; px = pxFor(g, S);
      if (sprKey !== bw) { sprKey = bw; buildSprites(); drawIco(dpr); }
    }
    function drawIco(dpr) {
      const k = Math.max(1, Math.round(dpr));
      ico.width = BW * k; ico.height = BH * k;
      drawBrick(pxFor(ico.getContext('2d'), k), 'cream');
    }
    const R = (v) => Math.round(v * S);
    function render(a) {
      if (!spr) return;
      g.imageSmoothingEnabled = false;
      g.drawImage(spr.bg, 0, 0);
      for (const b of bricks) {
        if (b.dead) continue;
        const im = b.drop && spr[b.look + '+'] ? spr[b.look + '+'] : spr[b.look];
        const x = R(b.x), y = R(b.y);
        g.drawImage(im, x, y);
        if (b.flash > 0) { g.globalAlpha = Math.min(0.7, b.flash * 6); g.fillStyle = '#fff'; g.fillRect(x, y, im.width, im.height); g.globalAlpha = 1; }
      }
      for (const c of caps) g.drawImage(spr['cap_' + c.type], R(c.x), R(c.oy + (c.y - c.oy) * a));
      const pw = Math.round(padW);
      drawPaddle(pxFor(g, S, R(padX - pw / 2), R(PY)), pw, fx.coffee > 0);
      const bs = fx.snooze > 0 ? spr.ballZ : spr.ball;
      for (const b of balls) g.drawImage(bs, R(b.ox + (b.x - b.ox) * a - 3.5), R(b.oy + (b.y - b.oy) * a - 3.5));
      for (const p of parts) px(p.x, p.y, 2, 2, p.c);
      for (const p of pops) {
        const x = clamp(Math.round(p.x - textW(p.str) / 2), WALL + 1, W - WALL - 1 - textW(p.str)), y = Math.round(p.y);
        text(px, p.str, x + 1, y + 1, 'rgba(255,255,255,.85)'); text(px, p.str, x, y, p.c);
      }
      // running power-up timers, bottom-left
      let tx = WALL + 3;
      for (const [k, max] of [['coffee', T_COFFEE], ['snooze', T_SNOOZE]]) {
        if (fx[k] <= 0) continue;
        g.drawImage(spr['cap_' + k], R(tx), R(H - 12));
        px(tx + 18, H - 9, 22, 3, '#c3cde0'); px(tx + 18, H - 9, Math.ceil(22 * fx[k] / max), 3, CAPC[k].a);
        tx += 46;
      }
    }
    let hudKey = '';
    function hud() {
      const m = state === 'play' ? multNow() : 1;
      const key = `${left}|${score}|${lives}|${m}|${best}`;
      if (key === hudKey) return;
      hudKey = key;
      elUnread.textContent = left; elScore.textContent = score;
      elCombo.textContent = m > 1 ? `×${m}` : '';
      if (elLives.childElementCount !== lives) elLives.innerHTML = '<i class="ib-life"></i>'.repeat(lives);
      elLives.setAttribute('aria-label', `Lives: ${lives}`);
      elBest.textContent = `Best ${Math.max(best, score)}`;
    }
    const redraw = () => { idleSig = NaN; render(1); hud(); };

    // ---------------------------------------------------------------- loop
    const wantsLoop = () => !paused && (state === 'ready' || state === 'play' || state === 'clear' || parts.length > 0 || pops.length > 0);
    function frame(now) {
      raf = 0;
      if (disposed) return;
      let d = (now - last) / 1000; last = now;
      if (!(d > 0)) d = 0; else if (d > 0.1) d = 0.1;
      if (!paused) {
        acc += d;
        let n = 0;
        while (acc >= DT && n < 24) { step(); acc -= DT; n++; }
        if (n === 24) acc = 0;
      }
      // while the ball just sits on a still bar there is nothing new to paint
      const sig = state === 'ready' && !parts.length && !pops.length ? padX * 1000 + padW : NaN;
      if (sig !== idleSig) { render(paused ? 1 : acc / DT); hud(); }
      idleSig = sig;
      if (wantsLoop()) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !disposed && wantsLoop()) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (!raf) redraw(); }
    function setPaused(v) {
      v = !!v;
      if (v && !(state === 'ready' || state === 'play' || state === 'clear')) return;
      if (paused === v) return;
      paused = v; keys.l = keys.r = false;
      syncCard();
      if (paused) { if (raf) { cancelAnimationFrame(raf); raf = 0; } redraw(); } else { acc = 0; kick(); }
    }
    function primary() {
      if (!modal.hidden) return;
      if (paused) return setPaused(false);
      if (state === 'ready') launch();
      else if ((state === 'over' || state === 'won') && performance.now() - stateAt > 700) newGame();
    }

    // ---------------------------------------------------------------- input
    let focused = false, touchId = null, touchLaunch = false;
    function setFocus(v) { focused = v; if (!v) { keys.l = keys.r = false; } }
    const logicalX = (e) => { const r = cv.getBoundingClientRect(); return r.width ? ((e.clientX - r.left) / r.width) * W : W / 2; };
    function onStageDown(e) {
      setFocus(true);
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        e.preventDefault();
        target = logicalX(e);
        primary();
        return;
      }
      if (touchId !== null) return;
      touchId = e.pointerId; touchLaunch = false;
      if (paused || state === 'over' || state === 'won') { primary(); return; }
      target = logicalX(e);
      touchLaunch = state === 'ready';
    }
    function onMove(e) {
      if (e.pointerType === 'mouse') { if (focused && !paused) target = logicalX(e); }
      else if (e.pointerId === touchId && !paused) target = logicalX(e);
    }
    function onUp(e) {
      if (e.pointerId !== touchId) return;
      touchId = null;
      if (touchLaunch && e.type === 'pointerup' && state === 'ready' && !paused) launch();
      touchLaunch = false;
    }
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    const onKeyDown = (e) => {
      if (!focused || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!modal.hidden) return;
      const k = e.key;
      if (k === 'F2') { e.preventDefault(); autoPaused = false; setMenu(null, true); newGame(); }
      else if (k === 'Escape') { if (openMenu) setMenu(null); }
      else if (k === 'p' || k === 'P') { e.preventDefault(); if (openMenu) { autoPaused = false; setMenu(null, true); } else setPaused(!paused); }
      else if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) primary(); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); keys.l = true; }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); keys.r = true; }
    };
    const onKeyUp = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = false;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const onVis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', onVis);
    root.addEventListener('pointerdown', () => setFocus(true));

    // ---------------------------------------------------------------- menus & dialogs
    // An open menu holds the game; closing it without choosing anything lets it carry on.
    let openMenu = null, autoPaused = false;
    function setMenu(m, keep) {
      const was = openMenu;
      openMenu = m;
      root.querySelectorAll('.ib-menu').forEach((el) => el.classList.toggle('open', el === m));
      if (m) {
        if (!was && !paused) { setPaused(true); autoPaused = paused; }
        root.querySelector('[data-a="pause"]').classList.toggle('on', paused && !autoPaused);
        root.querySelector('[data-a="sound"]').classList.toggle('on', soundOn);
      } else if (was && autoPaused && !keep) { autoPaused = false; setPaused(false); }
    }
    menubar.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.ib-mtitle');
      if (t) { e.preventDefault(); const m = t.parentElement; setMenu(openMenu === m ? null : m); }
    });
    menubar.addEventListener('pointerover', (e) => {
      const t = e.target.closest('.ib-mtitle');
      if (t && openMenu && openMenu !== t.parentElement) setMenu(t.parentElement);
    });
    menubar.addEventListener('click', (e) => {
      const b = e.target.closest('.ib-drop button');
      if (!b) return;
      setMenu(null, true); action(b.dataset.a);
    });
    const outside = (e) => { if (openMenu && !openMenu.contains(e.target)) setMenu(null); if (!root.contains(e.target)) setFocus(false); };
    document.addEventListener('pointerdown', outside, true);

    function action(a) {
      const held = autoPaused; autoPaused = false;
      if (a === 'new') newGame();
      else if (a === 'pause') { if (!held) setPaused(!paused); }
      else if (a === 'sound') { soundOn = !soundOn; lsSet(LS_SND, soundOn); if (soundOn) snd('click'); if (held) setPaused(false); }
      else if (a === 'exit') { if (ctx.close) ctx.close(); }
      else if (a === 'howto') {
        dialog('How to play', `<p>The inbox is full. Bounce the cursor ball off your <b>Reply bar</b> and clear every unread email to reach <b>Inbox zero</b>.</p>
          <ul><li><b>Move</b> with the mouse, by dragging on touch, or with <b>← →</b>.</li>
          <li><b>Send the ball</b> with a click, a tap or <b>Space</b>. Where it lands on the bar sets the angle.</li>
          <li><b>P</b> pauses, <b>F2</b> starts over.</li>
          <li>Normal mail takes one hit. Red <b>urgent</b> mail takes two. Grey newsletters are worth less. Steel <b>out of office</b> blocks never break.</li>
          <li>Clear several emails before the ball returns to the bar to build a <b>combo</b> multiplier.</li>
          <li>Emails with a paperclip drop a capsule:</li></ul>
          <div class="ib-legend">
            <span><i data-cap="coffee"></i>Coffee: wider bar, 15 s</span><span><i data-cap="reply"></i>Reply-All: three balls</span>
            <span><i data-cap="snooze"></i>Snooze: slow ball, 10 s</span><span><i data-cap="life"></i>Extra life</span>
          </div>`);
        modal.querySelectorAll('[data-cap]').forEach((el) => {
          const c = sprite(CAP_W, CAP_H, 2, (p) => drawCapsule(p, el.dataset.cap));
          c.className = 'ib-capico'; el.replaceWith(c);
        });
      } else if (a === 'about') {
        dialog('About Inbox Zero', `<p><b>Inbox Zero</b> for Kayzee XP.</p><p>Original art and code. ${LEVELS.length} levels of unread mail.</p><p>Best score: <b>${Math.max(best, score)}</b></p>`);
      }
    }
    function dialog(title, html) {
      setPaused(true);
      modal.innerHTML = `<div class="ib-dlg" role="dialog" aria-label="${title}"><div class="ib-dlg-t">${title}</div><div class="ib-dlg-b xp-scroll">${html}</div><div class="ib-dlg-f"><button type="button" class="xp-btn ib-btn default">OK</button></div></div>`;
      const ok = modal.querySelector('.ib-btn');
      ok.addEventListener('click', () => { modal.hidden = true; });
      modal.hidden = false;
      ok.focus({ preventScroll: true });
    }
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { modal.hidden = true; e.preventDefault(); e.stopPropagation(); }
    });
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) modal.hidden = true; });

    // ---------------------------------------------------------------- start
    const ro = new ResizeObserver(() => { fit(); redraw(); });
    ro.observe(stage);
    fit();
    loadLevel(0);
    kick();

    // test hook (harmless in production): lets the CDP harness inspect and fast-forward the game
    Object.defineProperty(root, '_kzInbox', { configurable: true, value: {
      W, H, PY, DT, levels: LEVELS.map((l) => ({ name: l.name, rows: l.map.length, ok: l.map.every((r) => r.length === COLS) })),
      get state() { return state; }, get paused() { return paused; }, get score() { return score; }, get lives() { return lives; },
      get level() { return level; }, get left() { return left; }, get combo() { return combo; }, get speed() { return speed; },
      get best() { return best; }, get running() { return !!raf; }, get scale() { return S; },
      get balls() { return balls.map((b) => ({ x: b.x, y: b.y, dx: b.dx, dy: b.dy })); },
      get paddle() { return { x: padX, w: padW }; },
      get caps() { return caps.map((c) => ({ ...c })); },
      get fx() { return { ...fx }; },
      get bricks() { return bricks.filter((b) => !b.dead).map((b) => ({ c: b.c, r: b.r, x: b.x, y: b.y, look: b.look, hp: b.hp, solid: b.solid, drop: b.drop })); },
      step(n = 1, quiet) { for (let i = 0; i < n; i++) step(); if (!quiet) redraw(); },
      moveTo(x) { target = x; },
      aim(x, y, dx, dy) { if (balls[0]) { const b = balls[0]; b.x = b.ox = x; b.y = b.oy = y; b.dx = dx; b.dy = dy; fixDir(b); } },
      spawn(type, x, y) { caps.push({ type, x, y, oy: y }); },
      clearAll(keep = 0) { // remove breakable mail until `keep` are left
        for (const b of bricks) { if (left <= keep) break; if (b.solid || b.dead) continue; b.dead = true; grid[b.r][b.c] = null; left--; }
        if (left === 0 && state === 'play') levelClear();
        redraw();
      },
      setLevel(n) { loadLevel(clamp(n | 0, 0, LEVELS.length - 1)); kick(); },
      setLives(n) { lives = n; redraw(); },
      toClient(x, y) { const r = cv.getBoundingClientRect(); return { x: r.left + (x / W) * r.width, y: r.top + (y / H) * r.height }; },
      launch, newGame, setPaused,
    } });

    return {
      onResize() { fit(); redraw(); },
      onFocus() { setFocus(true); },
      onBlur() { setFocus(false); autoPaused = false; setMenu(null, true); setPaused(true); },
      unmount() {
        disposed = true;
        commitBest();
        if (raf) cancelAnimationFrame(raf); raf = 0;
        ro.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('pointerdown', outside, true);
        delete root._kzInbox;
        root.classList.remove('ib-touch');
        root.innerHTML = '';
      },
    };
  },
};
