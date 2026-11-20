// One cursor language for the whole site: white pixel art with a black outline and a soft drop shadow,
// drawn on a 16-pixel grid at 2x (32 CSS px) with a 4x image for HiDPI. Native CSS cursors: zero render lag.
// installCursors() also rewrites keyword cursors in app stylesheets (pointer, text, grab…) to the matching white one.

const K = '#0b0b0d', W = '#ffffff', G = '#9aa0aa', S = '#e0aa3e', s = '#b9852a';

// ---------------------------------------------------------------- hand-drawn sprites (rows, top first)
const ARROW = [
  'K...........',
  'KK..........',
  'KWK.........',
  'KWWK........',
  'KWWWK.......',
  'KWWWWK......',
  'KWWWWWK.....',
  'KWWWWWWK....',
  'KWWWWWWWK...',
  'KWWWWWWWWK..',
  'KWWWWWKKKKK.',
  'KWWKWWK.....',
  'KWK.KWWK....',
  'KK..KWWK....',
  'K....KWWK...',
  '......KK....',
];
const HOURGLASS_SMALL = [
  'KKKKKKKKK',
  'KGGGGGGGK',
  '.KWWWWWK.',
  '.KSSSSSK.',
  '..KsSSK..',
  '...KSK...',
  '...KWK...',
  '..KWSWK..',
  '.KWWSWWK.',
  '.KSSSSsK.',
  'KGGGGGGGK',
  'KKKKKKKKK',
];
const HOURGLASS = [
  'KKKKKKKKKKKK',
  'KGGGGGGGGGGK',
  '.KWWWWWWWWK.',
  '.KSSSSSSSsK.',
  '..KSSSSSsK..',
  '...KSSSsK...',
  '....KSSK....',
  '.....KK.....',
  '....KWWK....',
  '...KWWSWK...',
  '..KWWWSWWK..',
  '.KWWWSSSWWK.',
  '.KSSSSSSSsK.',
  'KGGGGGGGGGGK',
  'KKKKKKKKKKKK',
];
const HAND = [
  '.....KK.........',
  '....KWWK........',
  '....KWWK........',
  '....KWWK........',
  '....KWWKKK......',
  '....KWWKWWKKK...',
  '....KWWKWWKWWKK.',
  '.KK.KWWKWWKWWKWK',
  'KWWKKWWWWWWWWKWK',
  'KWWWKWWWWWWWWWWK',
  '.KWWWWWWWWWWWWWK',
  '..KWWWWWWWWWWWWK',
  '..KWWWWWWWWWWWK.',
  '...KWWWWWWWWWWK.',
  '....KWWWWWWWWK..',
  '.....KKKKKKKKK..',
];
const GRAB = [
  '......KK........',
  '...KK.KWK.KK....',
  '..KWWKKWKKWWK...',
  '..KWWKWWKKWWK...',
  '...KWWKWWKWWK.KK',
  '...KWWKWWKWWKKWK',
  '.KK.KWWWWWWWWKWK',
  'KWWKKWWWWWWWWWWK',
  'KWWWKWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '..KWWWWWWWWWWWK.',
  '...KWWWWWWWWWK..',
  '....KWWWWWWWK...',
  '.....KKKKKKK....',
];
const GRABBING = [
  '................',
  '................',
  '................',
  '....KK.KK.KK....',
  '...KWWKWWKWWKK..',
  '...KWWKWWKWWKWK.',
  '.KKKWWWWWWWWWWK.',
  'KWWKWWWWWWWWWWK.',
  'KWWWWWWWWWWWWWK.',
  '.KWWWWWWWWWWWWK.',
  '..KWWWWWWWWWWK..',
  '...KWWWWWWWWWK..',
  '....KWWWWWWWK...',
  '.....KKKKKKK....',
];

// ---------------------------------------------------------------- generated shapes: white mask + auto black outline
function fromMask(w, h, inside, extra) {
  const m = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inside(x, y);
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const e = extra && extra(x, y);
      if (e) { r += e; continue; }
      if (m(x, y)) { r += 'W'; continue; }
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && m(x + dx, y + dy)) { edge = true; break; }
      r += edge ? 'K' : '.';
    }
    rows.push(r);
  }
  return rows;
}
// vertical double-headed arrow, centred on a 16 grid (2-px shaft)
function nsMask(x, y) {
  const c = 7.5, dx = Math.abs(x - c);
  if (y >= 1 && y <= 4) return dx <= (y - 1) + 0.5;
  if (y >= 11 && y <= 14) return dx <= (14 - y) + 0.5;
  return y > 4 && y < 11 && dx <= 0.5;
}
const NS = fromMask(16, 16, nsMask);
const EW = fromMask(16, 16, (x, y) => nsMask(y, x));
const NWSE = [
  'KKKKKK......',
  'KWWWWK......',
  'KWWWK.......',
  'KWWWWK......',
  'KWKWWWK.....',
  'KK.KWWWK....',
  '....KWWWK.KK',
  '.....KWWWKWK',
  '......KWWWWK',
  '.......KWWWK',
  '......KWWWWK',
  '......KKKKKK',
];
const NESW = NWSE.map((r) => r.split('').reverse().join(''));
function moveMask(x, y) { // four short heads on thin shafts
  const c = 7.5, dx = Math.abs(x - c), dy = Math.abs(y - c);
  const head = (u, v) => (v >= 1 && v <= 3 && u <= (v - 1) + 0.5) || (v >= 12 && v <= 14 && u <= (14 - v) + 0.5);
  return head(dx, y) || head(dy, x) || (dx <= 0.5 && y > 3 && y < 12) || (dy <= 0.5 && x > 3 && x < 12);
}
const MOVE = fromMask(16, 16, moveMask);
const IBEAM = fromMask(9, 18, (x, y) => (x === 4 && y >= 2 && y <= 15) || ((y === 1 || y === 16) && x >= 1 && x <= 7 && x !== 4));
const CROSS = fromMask(17, 17, (x, y) => { const c = 8; return (x === c && Math.abs(y - c) >= 2 && Math.abs(y - c) <= 7) || (y === c && Math.abs(x - c) >= 2 && Math.abs(x - c) <= 7) || (x === c && y === c); });
const ZOOM_IN = [
  '....KKKKK.......',
  '..KKWWWWWKK.....',
  '.KWWWWWWWWWK....',
  '.KWWWWKWWWWK....',
  'KWWWWWKWWWWWK...',
  'KWWWWWKWWWWWK...',
  'KWWKKKKKKKWWK...',
  'KWWWWWKWWWWWK...',
  'KWWWWWKWWWWWK...',
  '.KWWWWKWWWWK....',
  '.KWWWWWWWWWKK...',
  '..KKWWWWWKKKKK..',
  '....KKKKK.KKKKK.',
  '...........KKKKK',
  '............KKKK',
  '.............KK.',
];
const ZOOM_OUT = ZOOM_IN.map((r, y) => (y >= 3 && y <= 9 && y !== 6 ? r.slice(0, 6) + 'W' + r.slice(7) : r));
const BUSY = (() => { // arrow with a small hourglass at its lower right
  const w = 22, rows = [];
  for (let y = 0; y < 16; y++) {
    const a = (ARROW[y] || '').padEnd(w, '.').split('');
    const hy = y - 4;
    if (hy >= 0 && hy < HOURGLASS_SMALL.length) HOURGLASS_SMALL[hy].split('').forEach((ch, i) => { if (ch !== '.') a[12 + i] = ch; });
    rows.push(a.join(''));
  }
  return rows;
})();

// ---------------------------------------------------------------- rasterise
const PAL = { K, W, G, S, s };
function draw(rows, scale) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement('canvas');
  cv.width = (w + 1) * scale; cv.height = (h + 1) * scale;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.30)';           // soft drop shadow, one sprite pixel down-right
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') g.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale); });
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = PAL[r[x]]; if (!c) continue; g.fillStyle = c; g.fillRect(x * scale, y * scale, scale, scale); } });
  return cv.toDataURL('image/png');
}

const DEFS = {
  arrow: [ARROW, 0, 0, 'default'],
  busy: [BUSY, 0, 0, 'progress'],
  wait: [HOURGLASS, 6, 7, 'wait'],
  hand: [HAND, 5, 0, 'pointer'],
  text: [IBEAM, 4, 9, 'text'],
  cross: [CROSS, 8, 8, 'crosshair'],
  grab: [GRAB, 8, 7, 'grab'],
  grabbing: [GRABBING, 8, 8, 'grabbing'],
  zoomin: [ZOOM_IN, 6, 6, 'zoom-in'],
  zoomout: [ZOOM_OUT, 6, 6, 'zoom-out'],
  ns: [NS, 7, 7, 'ns-resize'],
  ew: [EW, 7, 7, 'ew-resize'],
  nwse: [NWSE, 6, 6, 'nwse-resize'],
  nesw: [NESW, 6, 6, 'nesw-resize'],
  move: [MOVE, 7, 7, 'move'],
};
const KEYWORD = {
  default: 'arrow', auto: 'arrow', pointer: 'hand', text: 'text', 'vertical-text': 'text', crosshair: 'cross', cell: 'cross',
  grab: 'grab', grabbing: 'grabbing', 'zoom-in': 'zoomin', 'zoom-out': 'zoomout', progress: 'busy', wait: 'wait',
  'ns-resize': 'ns', 'n-resize': 'ns', 's-resize': 'ns', 'row-resize': 'ns',
  'ew-resize': 'ew', 'e-resize': 'ew', 'w-resize': 'ew', 'col-resize': 'ew',
  'nwse-resize': 'nwse', 'nw-resize': 'nwse', 'se-resize': 'nwse', 'nesw-resize': 'nesw', 'ne-resize': 'nesw', 'sw-resize': 'nesw',
  move: 'move', 'all-scroll': 'move', 'not-allowed': 'arrow', 'no-drop': 'arrow', help: 'arrow', 'context-menu': 'arrow', alias: 'arrow', copy: 'arrow',
};

export const CURSOR = {};
let installed = false;
export function installCursors() {
  if (installed) return CURSOR;
  installed = true;
  const hasSet = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('cursor', 'image-set(url("data:,") 1x) 0 0, auto');
  for (const [k, [rows, hx, hy, kw]] of Object.entries(DEFS)) {
    const u1 = draw(rows, 2), u2 = draw(rows, 4);
    const x = hx * 2, y = hy * 2;
    CURSOR[k] = hasSet ? `image-set(url("${u1}") 1x, url("${u2}") 2x) ${x} ${y}, ${kw}` : `url("${u1}") ${x} ${y}, ${kw}`;
  }
  const C = CURSOR;
  const css = `
    html, body { cursor: ${C.arrow}; }
    a[href], area[href], [role="link"], .xp-link { cursor: ${C.hand}; }
    input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=color]):not([type=file]):not([type=image]),
    textarea, [contenteditable=""], [contenteditable="true"] { cursor: ${C.text}; }
    input:disabled, textarea:disabled { cursor: ${C.arrow}; }
    .kz-grip.n, .kz-grip.s { cursor: ${C.ns}; } .kz-grip.e, .kz-grip.w { cursor: ${C.ew}; }
    .kz-grip.nw, .kz-grip.se { cursor: ${C.nwse}; } .kz-grip.ne, .kz-grip.sw { cursor: ${C.nesw}; }
    html.kz-busy, html.kz-busy * { cursor: ${C.busy} !important; }
    html.kz-wait, html.kz-wait * { cursor: ${C.wait} !important; }`;
  const st = document.createElement('style');
  st.id = 'kz-cursors';
  st.textContent = css;
  document.head.appendChild(st);
  // keyword cursors in other stylesheets (apps, kits) -> the white set; re-run whenever a stylesheet appears
  const seen = new WeakSet();
  const fixRules = (rules) => {
    for (const r of rules) {
      if (r.cssRules && r.cssRules.length && !r.style) { fixRules(r.cssRules); continue; }
      if (!r.style) continue;
      const v = r.style.getPropertyValue('cursor');
      if (v) {
        const kw = v.trim().toLowerCase();
        const key = KEYWORD[kw];
        if (key) r.style.setProperty('cursor', C[key], r.style.getPropertyPriority('cursor'));
      }
      if (r.cssRules && r.cssRules.length) fixRules(r.cssRules);
    }
  };
  const scan = () => {
    for (const sh of document.styleSheets) {
      if (sh.ownerNode === st) continue;
      let rules; try { rules = sh.cssRules; } catch (_) { continue; } // cross-origin
      if (!rules) continue;
      const n = rules.length;
      if (seen.has(sh) && sh.__kzN === n) continue;
      seen.add(sh); sh.__kzN = n;
      fixRules(rules);
    }
  };
  scan();
  let q = 0;
  const later = () => { if (!q) q = requestAnimationFrame(() => { q = 0; scan(); }); };
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeName === 'LINK') n.addEventListener('load', later, { once: true });
      if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') later();
    }
    for (const m of ms) { const t = m.target; if (t && (t.nodeName === 'STYLE' || (t.parentNode && t.parentNode.nodeName === 'STYLE'))) later(); }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  addEventListener('load', later);
  return CURSOR;
}
