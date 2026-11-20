// Kayzee XP spike — original pixel-art sprite data + voxel models.
// One source of truth: every icon is a voxel volume. The 2D icon (title bar,
// taskbar, dialog) is the orthographic front projection of that same volume.

// ---------------------------------------------------------------- helpers
export class Vox {
  constructor() { this.map = new Map(); }
  set(x, y, z, c) { this.map.set(x + ',' + y + ',' + z, { x, y, z, c }); }
  get(x, y, z) { return this.map.get(x + ',' + y + ',' + z); }
  del(x, y, z) { this.map.delete(x + ',' + y + ',' + z); }
  box(x0, y0, z0, w, h, d, c) {
    for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) this.set(x, y, z, c);
  }
  // rows[0] is the top row. palette: char -> colour or {c, z0, z1}
  sprite(rows, pal, { ox = 0, oy = 0, z0 = 0, z1 = 3 } = {}) {
    const h = rows.length;
    rows.forEach((row, r) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const p = pal[ch];
        if (!p) continue;
        const c = typeof p === 'string' ? p : p.c;
        const a = typeof p === 'string' ? z0 : (p.z0 ?? z0);
        const b = typeof p === 'string' ? z1 : (p.z1 ?? z1);
        for (let z = a; z < b; z++) this.set(ox + i, oy + (h - 1 - r), z, c);
      }
    });
    return this;
  }
  bounds() {
    let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (const v of this.map.values()) {
      mnx = Math.min(mnx, v.x); mny = Math.min(mny, v.y); mnz = Math.min(mnz, v.z);
      mxx = Math.max(mxx, v.x); mxy = Math.max(mxy, v.y); mxz = Math.max(mxz, v.z);
    }
    return { mnx, mny, mnz, mxx, mxy, mxz, w: mxx - mnx + 1, h: mxy - mny + 1, d: mxz - mnz + 1 };
  }
  // drop voxels that are completely enclosed (never visible)
  visible() {
    const out = [];
    for (const v of this.map.values()) {
      const { x, y, z } = v;
      if (this.get(x + 1, y, z) && this.get(x - 1, y, z) && this.get(x, y + 1, z) && this.get(x, y - 1, z) && this.get(x, y, z + 1) && this.get(x, y, z - 1)) continue;
      out.push(v);
    }
    return out;
  }
  // orthographic front view (camera looking down -z): frontmost voxel wins
  front() {
    const b = this.bounds();
    const grid = [];
    for (let r = 0; r < b.h; r++) grid.push(new Array(b.w).fill(null));
    const depth = [];
    for (let r = 0; r < b.h; r++) depth.push(new Array(b.w).fill(-1e9));
    for (const v of this.map.values()) {
      const col = v.x - b.mnx, row = b.mxy - v.y;
      if (v.z > depth[row][col]) { depth[row][col] = v.z; grid[row][col] = v.c; }
    }
    return { w: b.w, h: b.h, grid };
  }
}

// Render the front projection to a canvas (crisp, pixel-doubled, tiny bevel per pixel)
export function sprite2D(vox, scale = 2, { shadow = true, bevel = true } = {}) {
  const f = vox.front();
  const pad = shadow ? Math.max(1, Math.round(scale * 0.75)) : 0;
  const cv = document.createElement('canvas');
  cv.width = f.w * scale + pad; cv.height = f.h * scale + pad;
  const g = cv.getContext('2d');
  if (shadow) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let r = 0; r < f.h; r++) for (let c = 0; c < f.w; c++) if (f.grid[r][c]) g.fillRect(c * scale + pad, r * scale + pad, scale, scale);
  }
  for (let r = 0; r < f.h; r++) for (let c = 0; c < f.w; c++) {
    const col = f.grid[r][c];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(c * scale, r * scale, scale, scale);
    if (bevel && scale >= 3) {
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(c * scale, r * scale, scale, 1);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(c * scale, r * scale + scale - 1, scale, 1);
    }
  }
  cv.className = 'px-icon';
  return cv;
}

// ---------------------------------------------------------------- palettes
const C = {
  outline: '#3b3f47',
};

// ---------------------------------------------------------------- My Projects: yellow folder with a sheet inside
export function buildFolder() {
  const rows = [
    '..KKKKKKK.............',
    '.KyyyyyyyK............',
    'KyyyyyyyyyKKKKKKKKKK..',
    'KyyyyyyyyyyyyyyyyyyyK.',
    'KyyyWWWWWWWWWWWWWWyyK.',
    'KyyWWwwwwwwwwwwwwWWyK.',
    'KyyWWWWWWWWWWWWWWWWyK.',
    'BBBBBBBBBBBBBBBBBBBBBB',
    'BLLLLLLLLLLLLLLLLLLLLB',
    'BLYYYYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYYYYoB',
    'BYYYYYYYYYYYYYYYYYYooB',
    'BooooooooooooooooooooB',
    '.BBBBBBBBBBBBBBBBBBBB.',
  ];
  const pal = {
    K: { c: '#7a5408', z0: 0, z1: 2 }, y: { c: '#e5a823', z0: 0, z1: 2 },
    W: { c: '#fbfbf6', z0: 0, z1: 3 }, w: { c: '#9fb4da', z0: 0, z1: 3 },
    B: { c: '#7a5408', z0: 0, z1: 4 }, L: { c: '#ffe58a', z0: 0, z1: 4 },
    Y: { c: '#fbcd3f', z0: 0, z1: 4 }, o: { c: '#e09a17', z0: 0, z1: 4 },
  };
  return new Vox().sprite(rows, pal);
}

// ---------------------------------------------------------------- My Music: CD + music note
export function buildCD() {
  const v = new Vox();
  const W = 22, cx = 10.5, cy = 10.5;
  const rows = [];
  for (let y = 0; y < W; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let ch = '.';
      if (r > 11.0) ch = '.';
      else if (r > 10.0) ch = 'K';
      else if (r < 1.6) ch = '.';
      else if (r < 2.6) ch = 'H';
      else if (r < 3.8) ch = 'h';
      else {
        const s = Math.cos(2 * (a + 0.75));
        if (s > 0.62) ch = r < 5.4 ? 'c' : r < 6.8 ? 'g' : r < 8.2 ? 'y' : 'p';
        else if (s > 0.30) ch = 'S';
        else ch = (r > 9.2) ? 'e' : 's';
      }
      row += ch;
    }
    rows.push(row);
  }
  v.sprite(rows, {
    K: '#6b7380', H: '#8a919b', h: '#eef2f6', S: '#f7f9fb', s: '#d9dee5', e: '#bfc6cf',
    c: '#8fe6f2', g: '#d3f58a', y: '#fbe58c', p: '#f6b0dd',
  }, { z0: 0, z1: 2 });
  const note = [ // beamed pair of eighth notes
    '....NNNNNNNNN',
    '....NnnnnnnNN',
    '....NN.....NN',
    '....N......NN',
    '....N.......N',
    '....N.......N',
    '....N.......N',
    '....N.......N',
    '..NNN.....NNN',
    '.NnNN....NnNN',
    'NNNNN...NNNNN',
    'NNNN....NNNN.',
    '.NN......NN..',
  ];
  v.sprite(note, { N: '#141418', n: '#6a6a86' }, { ox: -6, oy: 10, z0: 2, z1: 5 });
  return v;
}

// ---------------------------------------------------------------- My Resume: page with photo, lines, red badge
export function buildDoc() {
  const rows = [
    'KKKKKKKKKKKKK.....',
    'KWWWWWWWWWWWKK....',
    'KWWWWWWWWWWWKfK...',
    'KWWHHHWWWWWWKffK..',
    'KWHHssHWbbbbKfffK.',
    'KWHsssHWWWWWKKKKKK',
    'KWWsssWWllllllllWK',
    'KWDDDDDWWWWWWWWWWK',
    'KWDDDDDWllllllWWWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWbbbbbbbbWWWWWWWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWllllllllllllllWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWllllllllllllWWWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWbbbbbbbWWWWWWWWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWlllllllllWWrrrWK',
    'KWWWWWWWWWWWrrrrrK',
    'KWllllllllWWWrrrWK',
    'KWWWWWWWWWWWWRWRWK',
    'KKKKKKKKKKKKKKKKKK',
  ];
  const pal = {
    K: '#4f5663', W: '#fbfbf8', f: '#cfd5de',
    H: { c: '#35231a', z0: 0, z1: 3 }, s: { c: '#efc29a', z0: 0, z1: 3 }, D: { c: '#2f63d6', z0: 0, z1: 3 },
    b: '#2f5fc8', l: '#98a3b5',
    r: { c: '#e0402e', z0: 0, z1: 3 }, R: { c: '#b32c20', z0: 0, z1: 3 },
  };
  return new Vox().sprite(rows, pal, { z0: 0, z1: 2 });
}

// ---------------------------------------------------------------- Contact Me: envelope with heart seal
export function buildEnvelope() {
  const W = 22, H = 15, ax = 10.5, ay = 8.0;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      let ch = 'E';
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) ch = 'K';
      else {
        // flap edge: line from (0,0) to apex and from (W-1,0) to apex
        const t = Math.abs(x - ax) / ax;          // 0 at centre, 1 at side
        const flapY = ay * (1 - t);              // flap edge height at this x
        if (Math.abs(y - flapY) < 0.75) ch = 'V';
        else if (y < flapY) ch = 'e';
        else {
          // lower folds from bottom corners toward the apex (faint)
          const lowY = (H - 1) - (H - 1 - ay) * (1 - t) * 0.9;
          if (Math.abs(y - lowY) < 0.55 && y > ay + 1) ch = 'v';
        }
      }
      row += ch;
    }
    rows.push(row);
  }
  const v = new Vox().sprite(rows, {
    K: '#3f4d6b', E: '#fbf7ec', e: '#ece4cf', V: '#a99f88', v: '#d9d0ba',
  }, { z0: 0, z1: 3 });
  const heart = [
    '.RR.RR.',
    'RrRRRRR',
    'RrRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ];
  v.sprite(heart, { R: '#e3392f', r: '#ff8a7a' }, { ox: 7, oy: 4, z0: 3, z1: 4 });
  return v;
}

// ---------------------------------------------------------------- About Me: CRT monitor on a desktop unit (true 3D)
export function buildMonitor() {
  const v = new Vox();
  const BZ = '#e6dfcd', BZs = '#cfc6b0', BZd = '#b3a98f', OUT = '#6e6656';
  // front bezel sprite 20 x 16 (rows top->bottom)
  const scr = [
    'kkkkkkkkkkkkkkkk',
    'kSggSSSSSSSSSSSk',
    'kSgSSSSHHHHSSSSk',
    'kSSSSSHHHHHHSSSk',
    'kSSSSSHFFFFHSSSk',
    'kSSSSSFoFFoFSSSk',
    'kSSSSSFFFFFFSSSk',
    'kSSSSSSFmmFSSSSk',
    'kSSSSTTTFFTTTSSk',
    'kSSSTTTTTTTTTTSk',
    'kkkkkkkkkkkkkkkk',
  ];
  const front = [];
  for (let r = 0; r < 16; r++) {
    let row = '';
    for (let c = 0; c < 20; c++) {
      let ch = 'B';
      if (r === 0 || c === 0 || r === 15 || c === 19) ch = 'K';
      else if (c === 18 || r === 14) ch = 'b';
      if (r >= 1 && r <= 11 && c >= 2 && c <= 17) { const s = scr[r - 1]; if (s) ch = s[c - 2]; }
      if (r === 13 && c === 16) ch = 'G';
      if (r === 13 && c >= 3 && c <= 7 && c % 2 === 1) ch = 'd';
      row += ch;
    }
    front.push(row);
  }
  const pal = {
    K: OUT, B: BZ, b: BZs, d: BZd, G: { c: '#3fe06a', z0: 0, z1: 4 },
    k: { c: '#1b2436', z0: 0, z1: 2 },
    S: { c: '#2457c9', z0: 0, z1: 2 }, g: { c: '#7fb0ff', z0: 0, z1: 2 },
    H: { c: '#2a1a12', z0: 0, z1: 2 }, F: { c: '#f1c39b', z0: 0, z1: 2 }, o: { c: '#1a1a1a', z0: 0, z1: 2 },
    m: { c: '#b5473a', z0: 0, z1: 2 }, T: { c: '#ffffff', z0: 0, z1: 2 },
  };
  // monitor sits on top of the desktop unit: front sprite y from 6..21
  v.sprite(front, pal, { ox: 1, oy: 6, z0: 0, z1: 3 });
  // CRT back case (tapered)
  v.box(3, 8, -7, 16, 12, 7, BZs);
  v.box(5, 10, -11, 12, 8, 4, BZd);
  // neck
  v.box(7, 5, -6, 8, 1, 6, BZd);
  // desktop unit: 22 wide, 5 tall, 15 deep
  v.box(0, 0, -11, 22, 5, 14, BZ);
  v.box(0, 0, -11, 22, 1, 14, BZd);           // bottom shade
  for (let x = 0; x < 22; x++) v.set(x, 4, 2, BZs); // top front lip
  // front details of desktop unit
  for (let x = 3; x < 12; x++) v.set(x, 2, 2, '#2c2a26'); // drive slot
  v.set(17, 2, 2, '#3fe06a'); v.set(19, 2, 2, '#e8b23a');
  for (let x = 13; x < 16; x++) v.set(x, 2, 2, BZd);
  return v;
}

// ---------------------------------------------------------------- Games: arcade joystick (true 3D, original)
export function buildJoystick() {
  const v = new Vox();
  const base = '#2e3139', top = '#474b55', stripe = '#f08a24';
  v.box(-8, 0, -6, 16, 3, 12, base);
  v.box(-8, 2, -6, 16, 1, 12, top);
  for (let x = -8; x < 8; x++) v.set(x, 1, 5, stripe);
  // buttons
  v.box(3, 3, 1, 3, 1, 3, '#f6c431'); v.box(3, 3, -4, 3, 1, 3, '#3b80ea');
  v.box(-7, 3, 2, 2, 1, 2, '#e2392b');
  // stick
  v.box(-2, 3, -1, 2, 8, 2, '#a9b0b9');
  v.box(-3, 3, -2, 4, 1, 4, '#1c1e23');
  // ball
  const cx = -1, cy = 13, cz = 0, R = 3.4;
  for (let x = -5; x <= 3; x++) for (let y = 9; y <= 17; y++) for (let z = -4; z <= 4; z++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
    if (d <= R) {
      const hi = (x + 0.5 - cx) * -0.5 + (y + 0.5 - cy) * 0.7 + (z + 0.5 - cz) * 0.5;
      v.set(x, y, z, hi > 2.2 ? '#ff9a8c' : '#e2392b');
    }
  }
  return v;
}

// ---------------------------------------------------------------- Recycle Bin (true 3D, hollow, tapered)
export function buildBin() {
  const v = new Vox();
  const WH = '#eef0ea', RIB = '#d7dbd1', IN = '#a9afa4', G = '#3fb64e', Gd = '#2b8c3a';
  const H = 24;
  const hwAt = (y) => Math.round(7 + (y / (H - 1)) * 2.2); // 7 at base, 9 at top
  for (let y = 0; y < H; y++) {
    const hw = hwAt(y);
    const rib = (y === 8 || y === 15);
    for (let x = -hw; x < hw; x++) for (let z = -hw; z < hw; z++) {
      const edge = x === -hw || x === hw - 1 || z === -hw || z === hw - 1;
      if (y === 0 || edge) v.set(x, y, z, rib ? RIB : WH);
      else if (y > 0 && (x === -hw + 1 || x === hw - 2 || z === -hw + 1 || z === hw - 2) && y > H - 4) v.set(x, y, z, IN);
    }
    if (rib) { // band sticking out by one
      for (let x = -hw - 1; x < hw + 1; x++) for (let z = -hw - 1; z < hw + 1; z++) {
        if (x === -hw - 1 || x === hw || z === -hw - 1 || z === hw) v.set(x, y, z, RIB);
      }
    }
  }
  // top rim (2 rows sticking out)
  for (let y = H; y < H + 2; y++) {
    const hw = hwAt(H - 1) + 1;
    for (let x = -hw; x < hw; x++) for (let z = -hw; z < hw; z++) {
      if (x === -hw || x === hw - 1 || z === -hw || z === hw - 1 || x === -hw + 1 || x === hw - 2 || z === -hw + 1 || z === hw - 2) v.set(x, y, z, y === H ? RIB : WH);
    }
  }
  // recycle symbol on the front face (z = hw-1 at each row)
  const sym = [
    '......GG......',
    '.....GGGG.....',
    '....GGddGG....',
    '...GGd..GGG...',
    '..GGd....GGd..',
    '.GGGGG...GGd..',
    '..GGG.....GGd.',
    '...G......GGd.',
    '.G.........G..',
    'GGd.....GGGGGG',
    'GGd......GGGG.',
    '.GGGGGG..GGG..',
    '..GGGGGG.GG...',
    '.........G....',
  ];
  const sh = sym.length;
  sym.forEach((row, r) => {
    const y = 4 + (sh - 1 - r) + 2;
    const hw = hwAt(y);
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const x = -7 + i;
      v.set(x, y, hw - 1, ch === 'd' ? Gd : G);
      v.set(x, y, hw, ch === 'd' ? Gd : G); // embossed by one voxel
    }
  });
  // crumpled paper poking out of the top
  const paper = ['#fbfbf4', '#e3e6df', '#f4edcf', '#ffffff'];
  const blobs = [[-3, 23, -2, 3.2], [2, 24, 1, 2.8], [-1, 25, 3, 2.4], [4, 22, -3, 2.6]];
  blobs.forEach(([bx, by, bz, br], k) => {
    for (let x = Math.floor(bx - br); x <= bx + br; x++) for (let y = Math.floor(by - br); y <= by + br; y++) for (let z = Math.floor(bz - br); z <= bz + br; z++) {
      if (Math.hypot(x - bx, y - by, z - bz) <= br) {
        if (Math.abs(x) < 8 && Math.abs(z) < 8) v.set(x, y, z, paper[(x * 7 + y * 3 + z * 5 + k + 999) % 4]);
      }
    }
  });
  return v;
}

// ---------------------------------------------------------------- Cursor: chunky pixel arrow (original drawing)
export function buildCursor() {
  const rows = [
    'K............',
    'KK...........',
    'KWK..........',
    'KWWK.........',
    'KWWWK........',
    'KWWWWK.......',
    'KWWWWWK......',
    'KWWWWWWK.....',
    'KWWWWWWWK....',
    'KWWWWWWWWK...',
    'KWWWWWWWWWK..',
    'KWWWWWWWWWWK.',
    'KWWWWWWKKKKKK',
    'KWWWKWWK.....',
    'KWWK.KWWK....',
    'KWK..KWWK....',
    'KK....KWWK...',
    'K.....KWWK...',
    '.......KWWK..',
    '.......KWWK..',
    '........KK...',
  ];
  return new Vox().sprite(rows, { K: '#121214', W: '#f7f7f3' }, { z0: 0, z1: 4 });
}

// ---------------------------------------------------------------- tiny 2D-only sprites (tray / start)
export function buildSun() {
  const rows = [
    '....o.o....',
    '.o...o...o.',
    '..o.YYY.o..',
    '...YYYYY...',
    'o.YYyYYYY.o',
    '.oYYYYYYYo.',
    'o.YYYYYYY.o',
    '...YYYYY...',
    '..o.YYY.o..',
    '.o...o...o.',
    '....o.o....',
  ];
  return new Vox().sprite(rows, { o: '#ffb21e', Y: '#ffd93a', y: '#fff6b0' }, { z0: 0, z1: 1 });
}
export function buildSpeaker() {
  const rows = [
    '.....K.....',
    '....KK..W..',
    '..KKWK...W.',
    'KKWWWK.W.W.',
    'KWWWWK..W.W',
    'KWWWWK..W.W',
    'KKWWWK.W.W.',
    '..KKWK...W.',
    '....KK..W..',
    '.....K.....',
  ];
  return new Vox().sprite(rows, { K: '#1c2c55', W: '#ffffff' }, { z0: 0, z1: 1 });
}
export function buildNet() {
  const rows = [
    '.KKKKKKK...',
    '.KbbbbbK...',
    '.KbbbbbK...',
    '.KKKKKKK...',
    '...KKK.KKKK',
    '..KKKKKKbbK',
    '.......KbbK',
    '.......KKKK',
    '......KKKKK',
  ];
  return new Vox().sprite(rows, { K: '#21345e', b: '#8fd0ff' }, { z0: 0, z1: 1 });
}

// ---------------------------------------------------------------- 2D-only sprites for the shell + apps (original drawings)
// grid helper: f(x, y) -> palette char or '.'
function gen(w, h, f) {
  const rows = [];
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) r += f(x, y) || '.'; rows.push(r); }
  return rows;
}
const flat = (rows, pal) => new Vox().sprite(rows, pal, { z0: 0, z1: 1 });

// plain yellow folder (no sheet)
export function buildFolderPlain() {
  const rows = [
    '..KKKKKK..........',
    '.KyyyyyyK.........',
    'KyyyyyyyyKKKKKKKK.',
    'KyyyyyyyyyyyyyyyyK',
    'BBBBBBBBBBBBBBBBBB',
    'BLLLLLLLLLLLLLLLLB',
    'BYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYYB',
    'BYYYYYYYYYYYYYYYoB',
    'BYYYYYYYYYYYYYYooB',
    'BooooooooooooooooB',
    '.BBBBBBBBBBBBBBBB.',
  ];
  return flat(rows, { K: '#7a5408', y: '#e5a823', B: '#7a5408', L: '#ffe58a', Y: '#fbcd3f', o: '#e09a17' });
}

// Notepad: spiral-bound pad, ruled lines
export function buildNotepad() {
  const rows = [
    '.K.K.K.K.K.K.K.',
    'KSKSKSKSKSKSKSK',
    'KBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBK',
    'KWWWWWWWWWWWWWK',
    'KWllllllllllWWK',
    'KWWWWWWWWWWWWWK',
    'KWllllllllWWWWK',
    'KWWWWWWWWWWWWWK',
    'KWlllllllllllWK',
    'KWWWWWWWWWWWWWK',
    'KWllllllWWWWWWK',
    'KWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWfK',
    'KKKKKKKKKKKKKKK',
  ];
  return flat(rows, { K: '#3e4654', S: '#c9ced6', B: '#3d7be0', W: '#fdfdf6', l: '#8aa0c8', f: '#d9dccf' });
}

// Paint: artist palette + brush
export function buildPaint() {
  const W = 17, H = 15, cx = 7.8, cy = 8.2;
  const dots = [[4, 6, 'r'], [7, 4, 'y'], [11, 5, 'g'], [3, 10, 'b'], [12, 9, 'p']];
  const rows = gen(W, H, (x, y) => {
    // brush handle: diagonal from top-right
    const bx = x - 15.5, by = y - 0.5, along = (bx * -0.7 + by * 0.7), perp = Math.abs(bx * 0.7 + by * 0.7);
    if (along > 0 && along < 8.5 && perp < 1.0) return along < 2.2 ? 'm' : along < 6.6 ? 'H' : 'T';
    const dx = (x - cx) / 7.6, dy = (y - cy) / 6.2, r = dx * dx + dy * dy;
    if (r > 1) return '.';
    if (Math.hypot(x - 10.2, y - 11.2) < 1.6) return '.'; // thumb hole
    for (const [px, py, c] of dots) if (Math.hypot(x - px, y - py) < 1.25) return c;
    return r > 0.78 ? 'K' : 'w';
  });
  return flat(rows, { K: '#8b5a2b', w: '#e8c48e', r: '#e3392f', y: '#ffd23a', g: '#3fb64e', b: '#2f6fe0', p: '#c04fd8', H: '#c98a3a', m: '#bfc4cc', T: '#2b2b30' });
}

// Kayzee Explorer: globe with a gold orbit
export function buildBrowser() {
  const S = 17, c = 8;
  const rows = gen(S, S, (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    const ring = Math.abs((dx * 0.85 + dy * 0.53) ** 2 / 64 + (-dx * 0.53 + dy * 0.85) ** 2 / 6.5 - 1) < 0.22;
    if (ring && !(r < 6.6 && (-dx * 0.53 + dy * 0.85) < 0)) return 'o';
    if (r > 6.9) return '.';
    if (r > 6.0) return 'K';
    const land = Math.sin(x * 0.9 + 1.3) + Math.cos(y * 1.1 - 0.4) + Math.sin((x + y) * 0.6) > 0.95;
    if (land) return (dx + dy < -3) ? 'G' : 'g';
    return (dx + dy < -4) ? 'B' : 'b';
  });
  return flat(rows, { K: '#173a8a', b: '#2f78e6', B: '#79b4ff', g: '#3fae4a', G: '#8fe07a', o: '#ffbe2e' });
}

// Media Player: disc-shaped badge with a play triangle
export function buildMedia() {
  const S = 16, c = 7.5;
  const rows = gen(S, S, (x, y) => {
    const r = Math.hypot(x - c, y - c);
    if (r > 7.6) return '.';
    if (r > 6.7) return 'K';
    const px = x - 5.5, py = y - c;
    if (px >= 0 && px <= 6 && Math.abs(py) <= (6 - px) * 0.62) return 'W';
    return (x + y < 11) ? 'O' : 'o';
  });
  return flat(rows, { K: '#8a3c08', O: '#ffb347', o: '#f0801c', W: '#ffffff' });
}

// Mines: spiked mine with a glint
export function buildMines() {
  const S = 15, c = 7;
  const rows = gen(S, S, (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if ((dx === 0 || dy === 0) && r <= 7) return 'K';
    if (Math.abs(dx) === Math.abs(dy) && r <= 6.0) return 'K';
    if (r <= 4.6) return (x === 5 && y === 5) || (x === 5 && y === 4) || (x === 4 && y === 5) ? 'W' : 'K';
    return '.';
  });
  return flat(rows, { K: '#18191d', W: '#ffffff' });
}

// Solitaire: two fanned cards
export function buildSolitaire() {
  const rows = [
    'KKKKKKKKK.......',
    'KbBbBbBbK.......',
    'KBbBbBbBK.......',
    'KbBbKKKKKKKKKK..',
    'KBbBKWWWWWWWWK..',
    'KbBbKWrWWWWWWK..',
    'KBbBKWWWrrWrrK..',
    'KbBbKWWrrrrrrrK.',
    'KBbBKWWrrrrrrrK.',
    'KbBbKWWWrrrrrWK.',
    'KKKKKWWWWrrrWWK.',
    '....KWWWWWrWWWK.',
    '....KWWWWWWWWWK.',
    '....KWWWWWWWrWK.',
    '....KKKKKKKKKKK.',
  ];
  return flat(rows, { K: '#30343c', b: '#2456c9', B: '#5a8cf0', W: '#fdfdf8', r: '#d8302a' });
}

// Pinball: chrome ball in front of a star bumper
export function buildPinball() {
  const S = 16;
  const rows = gen(S, S, (x, y) => {
    const bx = x - 9.5, by = y - 9.5, br = Math.hypot(bx, by);
    if (br <= 5.6) return br > 4.8 ? 'K' : (bx + by < -3 ? 'W' : bx + by < 1 ? 's' : 'S');
    const sx = x - 5, sy = y - 5, a = Math.atan2(sy, sx), sr = Math.hypot(sx, sy);
    const lim = 2.2 + 2.6 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3);
    if (sr <= lim) return sr > lim - 1 ? 'R' : 'y';
    return '.';
  });
  return flat(rows, { K: '#3c424c', W: '#ffffff', s: '#d6dbe2', S: '#9aa3ae', R: '#d8302a', y: '#ffd23a' });
}

// voxel portrait for the login / Start menu tile (original, not a likeness)
export function buildAvatar() {
  const rows = [
    'ssssssssssssssss',
    'ssssshhhhhhsssss',
    'sssshhhhhhhhhsss',
    'ssshhhhhhhhhhhss',
    'ssshhFFFFFFFhhss',
    'ssshFFFFFFFFFhss',
    'ssshFeeFFFeeFhss',
    'sssFFkFFFFFkFFss',
    'sssFFFFFnFFFFFss',
    'ssssFFFFnnFFFsss',
    'ssssFbFmmmFbFsss',
    'sssssbbbbbbbssss',
    'sssscccFFFcccsss',
    'ssccccccWcccccss',
    'scccccccWccccccs',
    'ccccccccWccccccc',
  ];
  return flat(rows, { s: '#8ec3f5', h: '#1d1410', F: '#c98d62', e: '#3a2618', k: '#1a1a1a', n: '#a8714a', m: '#8a3b2e', b: '#3b2a20', c: '#f4f4f0', W: '#c9ccd2' });
}

// boot / login logo: a window frame opening onto the hill (four panes: sky, cloud, hill, grass)
export function buildLogo() {
  const W = 22, H = 20;
  const rows = gen(W, H, (x, y) => {
    const frame = x === 0 || y === 0 || x === W - 1 || y === H - 1 || x === 10 || x === 11 || y === 9 || y === 10;
    if (frame) return (x === 0 || y === 0) ? 'F' : 'f';
    const top = y < 9, left = x < 10;
    if (top) {
      const cl = left ? Math.hypot((x - 5) / 3.2, (y - 5) / 1.6) < 1 || Math.hypot((x - 3.2) / 2, (y - 4) / 1.4) < 1
                      : Math.hypot((x - 16) / 3.4, (y - 4.2) / 1.5) < 1 || Math.hypot((x - 17.8) / 2, (y - 3.2) / 1.3) < 1;
      if (!left && Math.hypot(x - 18.4, y - 6.4) < 1.8) return 'Y';
      if (cl) return 'c';
      return y < 3 ? 'B' : y < 6 ? 'b' : 'l';
    }
    const hill = 12.5 + 2.6 * Math.cos((x - 6) / 6.5);
    if (y < hill) return y < 13 ? 'l' : 'b';
    return (x * 7 + y * 3) % 5 === 0 ? 'G' : (y > 16 ? 'g' : 'q');
  });
  return flat(rows, { F: '#f7f3e6', f: '#d9d1b8', B: '#1d5ccf', b: '#3f86e6', l: '#86b8ef', c: '#ffffff', Y: '#ffd23a', g: '#2f7d22', q: '#4a9f22', G: '#8fd04a' });
}

export function buildErrorIcon() {
  const S = 16, c = 7.5;
  const rows = gen(S, S, (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if (r > 7.6) return '.';
    if (r > 6.8) return 'K';
    if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 1.0 && r < 4.6) return 'W';
    return (dx + dy < -3) ? 'r' : 'R';
  });
  return flat(rows, { K: '#8c1208', R: '#e0402e', r: '#ff8a72', W: '#ffffff' });
}
export function buildInfoIcon() {
  const S = 16, c = 7.5;
  const rows = gen(S, S, (x, y) => {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if (r > 7.6) return '.';
    if (r > 6.8) return 'K';
    if ((x === 7 || x === 8) && (y === 3 || y === 4)) return 'W';
    if ((x === 7 || x === 8) && y >= 6 && y <= 11) return 'W';
    if (y === 11 && (x === 6 || x === 9)) return 'W';
    if (y === 6 && x === 6) return 'W';
    return (dx + dy < -3) ? 'l' : 'B';
  });
  return flat(rows, { K: '#0b3a9a', B: '#2f72e6', l: '#7fb0ff', W: '#ffffff' });
}
export function buildPower() {
  const S = 16, c = 7.5;
  const rows = gen(S, S, (x, y) => {
    if (x === 0 || y === 0 || x === S - 1 || y === S - 1) return 'K';
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy);
    if ((x === 7 || x === 8) && y >= 3 && y <= 8) return 'W';
    if (r > 3.6 && r < 5.2 && !(dy < -1 && Math.abs(dx) < 2.6)) return 'W';
    return (x + y < 14) ? 'r' : 'R';
  });
  return flat(rows, { K: '#7d1608', R: '#d23c1c', r: '#f07a50', W: '#ffffff' });
}
export function buildLogoff() {
  const S = 16;
  const rows = gen(S, S, (x, y) => {
    if (x === 0 || y === 0 || x === S - 1 || y === S - 1) return 'K';
    if (x >= 3 && x <= 8 && y >= 3 && y <= 12 && (x === 3 || y === 3 || y === 12)) return 'W'; // door frame
    if (y >= 7 && y <= 8 && x >= 6 && x <= 11) return 'W';                                  // arrow shaft
    if (Math.abs(y - 7.5) <= (13 - x) - 0.5 && x >= 10 && x <= 13) return 'W';                // arrow head
    return (x + y < 14) ? 'y' : 'Y';
  });
  return flat(rows, { K: '#8a5a00', Y: '#e8a316', y: '#ffd05a', W: '#ffffff' });
}
// tray: effects (sparkle over a mini screen)
export function buildFx() {
  const rows = [
    '......Y....',
    '.....YWY...',
    '.KKKKKYKKK.',
    '.KbbbbbbbK.',
    '.KbBbbbBbK.',
    '.KbbbbbbbK.',
    '.KbbBbbbbK.',
    '.KKKKKKKKK.',
    '....KKK....',
    '..KKKKKKK..',
  ];
  return flat(rows, { K: '#1c2c55', b: '#8fd0ff', B: '#ffffff', Y: '#ffd23a', W: '#ffffff' });
}

// time-of-day picks: sun over the horizon, crescent moon with stars
export function buildSunset() {
  const rows = [
    '.....o.....',
    '..o.....o..',
    '....YYY....',
    '.o.YYYYY.o.',
    '..YYyYYYY..',
    'oYYYYYYYYYo',
    'GGGGGGGGGGG',
    'gGgGgGgGgGg',
    'ggggggggggg',
  ];
  return new Vox().sprite(rows, { o: '#ff8a2e', Y: '#ffb43a', y: '#ffe7a0', G: '#4a9f22', g: '#2f7d22' }, { z0: 0, z1: 1 });
}
export function buildMoon() {
  const rows = [
    '...MMMM...s',
    '..MMMm....',
    '.MMMm...s.',
    'MMMm......',
    'MMMm......',
    'MMMm.....s',
    'MMMMm.....',
    '.MMMMmm...',
    '..MMMMMMM.',
    '...MMMMM..',
  ];
  return new Vox().sprite(rows, { M: '#f4f1d6', m: '#cfcaa8', s: '#bcd2ff' }, { z0: 0, z1: 1 });
}

// icon from plain data ({ rows: 16 strings, palette }), used by games that ship their own apps/<id>.icon.js
export function buildFromRows(icon) { return flat(icon.rows, icon.palette); }
