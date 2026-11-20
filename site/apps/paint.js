// Paint: a small, original paint program in XP chrome.
import { h, setupRoot, menubar, statusbar, msgbox, downloadBlob } from './projects.kit.js';

// ------------------------------------------------------------------ original tool icons (SVG, 24 grid)
const TOOL_SVG = {
  pencil: `<path d="M5 19l1.4-4.6L16.6 4.2a1.6 1.6 0 0 1 2.2 0l1 1a1.6 1.6 0 0 1 0 2.2L9.6 17.6z" fill="#ffd23a" stroke="#7a5a00" stroke-width="1"/>
    <path d="M14.8 6l3.2 3.2" stroke="#e0a800" stroke-width="1.2"/><path d="M16.6 4.2l3.2 3.2" stroke="#ff8fb0" stroke-width="2.4"/>
    <path d="M5 19l1.4-4.6 3.2 3.2z" fill="#f3d6a8" stroke="#7a5a00" stroke-width=".8"/><path d="M5 19l.6-2 1.4 1.4z" fill="#333"/>`,
  brush: `<path d="M13.6 10.4l7-7.2c.5-.5 1.3-.5 1.7 0 .4.5.4 1.2-.1 1.7l-7 7.2z" fill="#b5703a" stroke="#5c3412" stroke-width=".9"/>
    <path d="M11.6 11.4l3 3-1 1-3-3z" fill="#c0c6d0" stroke="#59606b" stroke-width=".8"/>
    <path d="M10.6 12.4l3 3c-.6 2.6-2.8 4.6-5.8 4.6-1.8 0-3.2-.4-4.6-1.2 1.6-.6 2.4-1.6 2.8-3.4.4-1.8 2.2-3.4 4.6-3z" fill="#2f6fe0" stroke="#173c86" stroke-width=".9"/>`,
  eraser: `<path d="M3.6 15.6L12.8 6.4a1.6 1.6 0 0 1 2.2 0l4.8 4.8a1.6 1.6 0 0 1 0 2.2l-6.2 6.2H8.2z" fill="#fff" stroke="#59606b" stroke-width="1"/>
    <path d="M3.6 15.6l5.8-5.8 6.6 6.6-3.2 3.2H8.2z" fill="#ff8fb0" stroke="#a83a5e" stroke-width="1"/><path d="M8 19.6h12" stroke="#59606b" stroke-width="1"/>`,
  fill: `<path d="M5.4 11.4l6.4-6.4 7.2 7.2-6.4 6.4a1.6 1.6 0 0 1-2.2 0l-5-5a1.6 1.6 0 0 1 0-2.2z" fill="#e8ecf2" stroke="#4d5f74" stroke-width="1"/>
    <path d="M5.4 11.4h13.4" stroke="#4d5f74" stroke-width=".8"/><path d="M6.4 12.2l5 5 6-5z" fill="#2f9be0" opacity=".85"/>
    <path d="M11.8 5l-2.6-2.6" stroke="#4d5f74" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M20.4 13.6c.9 1.6 1.6 2.8 1.6 3.8a1.6 1.6 0 0 1-3.2 0c0-1 .7-2.2 1.6-3.8z" fill="#2f9be0" stroke="#174f9e" stroke-width=".7"/>`,
  picker: `<path d="M14.6 6.2l3.2 3.2-8.6 8.6-3.6.8.8-3.6z" fill="#dfe8f5" stroke="#4d5f74" stroke-width="1"/>
    <path d="M6.6 15.2l2.2 2.2-2.6 1.6-1.2-1.2z" fill="#e2352a"/>
    <path d="M13.6 5.2l2.6-2.6a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 1 0 2.8l-2.6 2.6z" fill="#3a404c" stroke="#1b1e24" stroke-width=".8"/>`,
  line: `<path d="M4.5 19.5L19.5 4.5" stroke="#1b1e24" stroke-width="2" stroke-linecap="square"/>`,
  rect: `<rect x="4" y="6" width="16" height="12" fill="none" stroke="#1b1e24" stroke-width="1.8"/>`,
  ellipse: `<ellipse cx="12" cy="12" rx="8.4" ry="6.2" fill="none" stroke="#1b1e24" stroke-width="1.8"/>`,
};
const TOOLS = [
  { id: 'pencil', key: 'p', name: 'Pencil', hint: 'Pencil: draws a free-form line one pixel wide.' },
  { id: 'brush', key: 'b', name: 'Brush', hint: 'Brush: paints with the selected brush size.' },
  { id: 'eraser', key: 'e', name: 'Eraser', hint: 'Eraser: paints over the picture with the background colour.' },
  { id: 'fill', key: 'f', name: 'Fill With Colour', hint: 'Fill: floods an area with the drawing colour.' },
  { id: 'picker', key: 'i', name: 'Pick Colour', hint: 'Pick Colour: picks up a colour from the picture.' },
  { id: 'line', key: 'l', name: 'Line', hint: 'Line: draws a straight line. Hold Shift for 45 degree steps.' },
  { id: 'rect', key: 'r', name: 'Rectangle', hint: 'Rectangle: hold Shift for a square. Choose a fill style below.' },
  { id: 'ellipse', key: 'o', name: 'Ellipse', hint: 'Ellipse: hold Shift for a circle. Choose a fill style below.' },
];
const SIZES = { brush: [2, 4, 7, 11], eraser: [4, 8, 12, 18], line: [1, 2, 3, 5] };
const PALETTE = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#0a5be0', '#3a9a3a', '#6b4423', '#1d2b4c',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#8cbcff', '#9be37a', '#f8a24a', '#ece9d8',
];

const svg = (inner, px = 18) => `<svg viewBox="0 0 24 24" width="${px}" height="${px}" aria-hidden="true">${inner}</svg>`;

function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''); }

export default {
  id: 'paint',
  title: 'untitled - Paint',
  icon: 'paint',
  size: [720, 520],
  minSize: [360, 300],
  single: false,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let tool = 'pencil'; let prevTool = 'pencil';
    let primary = '#000000'; let secondary = '#ffffff';
    const size = { brush: 4, eraser: 8, line: 1 };
    let shapeStyle = 0; // 0 outline, 1 outline + fill, 2 fill only
    const undo = []; const redo = [];
    let dirty = false;

    // ---------------------------------------------------------------- DOM
    const menus = menubar([
      { label: '&File', items: [
        { label: '&New', shortcut: 'Ctrl+N', action: () => newImage() },
        { label: 'Save &As PNG...', shortcut: 'Ctrl+S', action: () => save() },
        { sep: true },
        { label: 'E&xit', action: () => ctx.close() },
      ] },
      { label: '&Edit', items: [
        { label: '&Undo', shortcut: 'Ctrl+Z', disabled: () => !undo.length, action: () => doUndo() },
        { label: '&Repeat', shortcut: 'Ctrl+Y', disabled: () => !redo.length, action: () => doRedo() },
        { sep: true },
        { label: 'C&lear Image', shortcut: 'Ctrl+Shift+N', action: () => clearImage() },
      ] },
      { label: '&View', items: [
        { label: '&Tool Box', checked: () => !toolbox.hidden, action: () => { toolbox.hidden = !toolbox.hidden; } },
        { label: '&Colour Box', checked: () => !colorbox.hidden, action: () => { colorbox.hidden = !colorbox.hidden; } },
        { label: '&Status Bar', checked: () => !status.hidden, action: () => { status.hidden = !status.hidden; } },
      ] },
      { label: '&Image', items: [
        { label: '&Invert Colours', shortcut: 'Ctrl+I', action: () => invert() },
        { label: '&Clear Image', action: () => clearImage() },
      ] },
      { label: '&Help', items: [
        { label: '&About Paint', action: () => msgbox(root, { title: 'About Paint', icon: 'info32', text: 'Paint, version 1.0\n\nLeft-click paints with the foreground colour,\nright-click with the background colour.\nDouble-click a colour to change it.' }) },
      ] },
    ], { logo: false });

    const toolBtns = {};
    const toolGrid = h('div', { class: 'pt-tools', role: 'toolbar', 'aria-label': 'Tools' });
    for (const t of TOOLS) {
      const b = h('button', { class: 'pt-tool', type: 'button', title: `${t.name} (${t.key.toUpperCase()})`, 'aria-label': t.name, 'aria-pressed': 'false', html: svg(TOOL_SVG[t.id]) });
      b.addEventListener('click', () => setTool(t.id));
      toolBtns[t.id] = b; toolGrid.append(b);
    }
    const opts = h('div', { class: 'pt-opts', 'aria-label': 'Tool options' });
    const toolbox = h('div', { class: 'pt-toolbox' }, toolGrid, opts);

    const canvas = h('canvas', { class: 'pt-canvas', width: '400', height: '300' });
    const overlay = h('canvas', { class: 'pt-overlay', width: '400', height: '300', 'aria-label': 'Drawing canvas', role: 'img' });
    const sheet = h('div', { class: 'pt-sheet' }, canvas, overlay);
    const work = h('div', { class: 'pt-work' }, sheet);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const og = overlay.getContext('2d');
    const store = document.createElement('canvas'); store.width = 1; store.height = 1;
    const sg = store.getContext('2d');

    const swPrimary = h('span', { class: 'pt-sw-primary', title: 'Foreground colour' });
    const swSecondary = h('span', { class: 'pt-sw-secondary', title: 'Background colour' });
    const swatches = h('div', { class: 'pt-current', 'aria-hidden': 'true' }, swSecondary, swPrimary);
    const palEl = h('div', { class: 'pt-palette', role: 'listbox', 'aria-label': 'Colours' });
    const picker = h('input', { type: 'color', class: 'pt-picker', tabindex: '-1', 'aria-hidden': 'true' });
    let editIdx = -1;
    function renderPalette() {
      palEl.textContent = '';
      PALETTE.forEach((c, i) => {
        const b = h('button', { class: 'pt-swatch', type: 'button', style: { background: c }, title: `${c} (left: foreground, right: background, double-click: edit)`, 'aria-label': `Colour ${c}` });
        b.addEventListener('click', () => setColor('primary', c));
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); setColor('secondary', c); });
        b.addEventListener('dblclick', () => { editIdx = i; picker.value = c; picker.click(); });
        palEl.append(b);
      });
    }
    bag.on(picker, 'input', () => { if (editIdx >= 0) { PALETTE[editIdx] = picker.value; renderPalette(); setColor('primary', picker.value); } });
    const colorbox = h('div', { class: 'pt-colorbox' }, swatches, palEl, picker);
    const status = statusbar([{ text: '', flex: true }, { text: '', width: 90 }, { text: '', width: 90 }]);
    root.append(menus, h('div', { class: 'pt-body' }, toolbox, work), colorbox, status);

    // ---------------------------------------------------------------- state helpers
    function setTool(id) {
      if (id !== 'picker') prevTool = id;
      tool = id;
      Object.entries(toolBtns).forEach(([k, b]) => { b.classList.toggle('on', k === id); b.setAttribute('aria-pressed', String(k === id)); });
      root.dataset.tool = id;
      status.set(0, TOOLS.find((t) => t.id === id).hint);
      renderOpts();
    }
    function setColor(which, c) {
      if (which === 'primary') primary = c; else secondary = c;
      swPrimary.style.background = primary; swSecondary.style.background = secondary;
    }
    function renderOpts() {
      opts.textContent = '';
      if (SIZES[tool]) {
        for (const s of SIZES[tool]) {
          const b = h('button', { class: 'pt-opt' + (size[tool] === s ? ' on' : ''), type: 'button', 'aria-label': `Size ${s}`, title: `Size ${s}` });
          const mark = h('span', { class: 'pt-mark pt-mark-' + tool });
          if (tool === 'line') mark.style.height = s + 'px';
          else { const d = Math.min(14, Math.max(2, Math.round(s * (tool === 'eraser' ? 0.7 : 1)))); mark.style.width = d + 'px'; mark.style.height = d + 'px'; }
          b.append(mark);
          b.addEventListener('click', () => { size[tool] = s; renderOpts(); });
          opts.append(b);
        }
      } else if (tool === 'rect' || tool === 'ellipse') {
        ['Outline', 'Outline and fill', 'Fill only'].forEach((label, i) => {
          const b = h('button', { class: 'pt-opt pt-style' + (shapeStyle === i ? ' on' : ''), type: 'button', title: label, 'aria-label': label },
            h('span', { class: 'pt-style-' + i + (tool === 'ellipse' ? ' round' : '') }));
          b.addEventListener('click', () => { shapeStyle = i; renderOpts(); });
          opts.append(b);
        });
      }
    }
    function title() { ctx.setTitle('untitled - Paint'); }

    // ---------------------------------------------------------------- canvas sizing (keeps the drawing)
    function ensureStore(w, hh) {
      if (store.width >= w && store.height >= hh) return;
      const nw = Math.max(store.width, w), nh = Math.max(store.height, hh);
      const tmp = document.createElement('canvas'); tmp.width = store.width; tmp.height = store.height;
      tmp.getContext('2d').drawImage(store, 0, 0);
      store.width = nw; store.height = nh;
      sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, nw, nh);
      sg.drawImage(tmp, 0, 0);
    }
    function commitToStore() { ensureStore(canvas.width, canvas.height); sg.drawImage(canvas, 0, 0); }
    let fitted = false;
    function fitCanvas() {
      const W = Math.max(40, Math.floor(work.clientWidth - 10));
      const H = Math.max(40, Math.floor(work.clientHeight - 10));
      if (fitted && W === canvas.width && H === canvas.height) return;
      if (fitted) commitToStore();
      ensureStore(W, H);
      canvas.width = W; canvas.height = H; overlay.width = W; overlay.height = H;
      g.imageSmoothingEnabled = false;
      g.drawImage(store, 0, 0);
      fitted = true;
      status.set(2, `${W} × ${H}`);
    }

    // ---------------------------------------------------------------- history
    function snapshot() {
      undo.push(g.getImageData(0, 0, canvas.width, canvas.height));
      if (undo.length > 30) undo.shift();
      redo.length = 0;
      dirty = true;
    }
    function restore(img) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.putImageData(img, 0, 0);
      // keep the backing store in sync for the area the snapshot covers
      ensureStore(img.width, img.height);
      sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, img.width, img.height);
      sg.putImageData(img, 0, 0);
    }
    function doUndo() { if (!undo.length) return; redo.push(g.getImageData(0, 0, canvas.width, canvas.height)); restore(undo.pop()); }
    function doRedo() { if (!redo.length) return; undo.push(g.getImageData(0, 0, canvas.width, canvas.height)); restore(redo.pop()); }

    // ---------------------------------------------------------------- image actions
    function blank() {
      store.width = canvas.width; store.height = canvas.height;
      sg.fillStyle = '#ffffff'; sg.fillRect(0, 0, store.width, store.height);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, canvas.width, canvas.height);
    }
    async function newImage() {
      if (dirty) {
        const r = await msgbox(root, { title: 'Paint', icon: 'warn32', text: 'Save changes to untitled?', buttons: ['Yes', 'No', 'Cancel'] });
        if (r === 0) save(); else if (r !== 1) return;
      }
      blank(); undo.length = 0; redo.length = 0; dirty = false; title();
    }
    function clearImage() { snapshot(); g.fillStyle = secondary; g.fillRect(0, 0, canvas.width, canvas.height); commitToStore(); }
    function invert() {
      snapshot();
      const d = g.getImageData(0, 0, canvas.width, canvas.height); const a = d.data;
      for (let i = 0; i < a.length; i += 4) { a[i] = 255 - a[i]; a[i + 1] = 255 - a[i + 1]; a[i + 2] = 255 - a[i + 2]; }
      g.putImageData(d, 0, 0);
      commitToStore();
    }
    function save() {
      canvas.toBlob((b) => { if (b) { downloadBlob(b, 'untitled.png'); dirty = false; status.set(0, 'Saved untitled.png to your Downloads'); } }, 'image/png');
    }

    // ---------------------------------------------------------------- drawing primitives
    function pixelLine(x0, y0, x1, y1, color) {
      g.fillStyle = color;
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 20000; n++) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function brushSeg(x0, y0, x1, y1, color, w) {
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x0 + 0.5, y0 + 0.5); g.lineTo(x1 + 0.5, y1 + 0.5); g.stroke();
      if (x0 === x1 && y0 === y1) { g.beginPath(); g.arc(x0 + 0.5, y0 + 0.5, w / 2, 0, Math.PI * 2); g.fill(); }
    }
    function eraseSeg(x0, y0, x1, y1, color, s) {
      g.fillStyle = color;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (s / 3)));
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (x1 - x0) * (i / steps), y = y0 + (y1 - y0) * (i / steps);
        g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      }
    }
    function shape(c2, kind, a, b, stroke, fillC, lw) {
      let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
      c2.lineWidth = lw; c2.strokeStyle = stroke; c2.fillStyle = fillC;
      if (kind === 'line') {
        c2.lineCap = 'round';
        c2.beginPath(); c2.moveTo(x0 + 0.5, y0 + 0.5); c2.lineTo(x1 + 0.5, y1 + 0.5); c2.stroke();
        return;
      }
      const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), hh = Math.abs(y1 - y0);
      c2.beginPath();
      if (kind === 'rect') c2.rect(x + 0.5, y + 0.5, w, hh);
      else c2.ellipse(x + w / 2 + 0.5, y + hh / 2 + 0.5, Math.max(0.5, w / 2), Math.max(0.5, hh / 2), 0, 0, Math.PI * 2);
      if (shapeStyle >= 1) c2.fill();
      if (shapeStyle <= 1) c2.stroke();
    }
    function floodFill(sx, sy, hex) {
      const W = canvas.width, H = canvas.height;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
      const img = g.getImageData(0, 0, W, H); const d = img.data;
      const [fr, fg, fb] = hexToRgba(hex);
      const i0 = (sy * W + sx) * 4;
      const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      if (tr === fr && tg === fg && tb === fb && ta === 255) return;
      const tol = 40;
      const match = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) + Math.abs(d[i + 3] - ta) <= tol;
      const seen = new Uint8Array(W * H);
      const stack = [sx, sy];
      while (stack.length) {
        const y = stack.pop(); let x = stack.pop();
        let i = y * W + x;
        while (x >= 0 && !seen[i] && match(i * 4)) { x--; i--; }
        x++; i++;
        let up = false, down = false;
        while (x < W && !seen[i] && match(i * 4)) {
          const p = i * 4; d[p] = fr; d[p + 1] = fg; d[p + 2] = fb; d[p + 3] = 255; seen[i] = 1;
          if (y > 0) { const j = i - W; if (!seen[j] && match(j * 4)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
          if (y < H - 1) { const j = i + W; if (!seen[j] && match(j * 4)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false; }
          x++; i++;
        }
      }
      g.putImageData(img, 0, 0);
    }

    // ---------------------------------------------------------------- pointer
    let stroke = null;
    function pos(e) {
      const r = overlay.getBoundingClientRect();
      return {
        x: Math.floor((e.clientX - r.left) * (overlay.width / r.width)),
        y: Math.floor((e.clientY - r.top) * (overlay.height / r.height)),
      };
    }
    function constrain(a, b, kind) {
      const dx = b.x - a.x, dy = b.y - a.y;
      if (kind === 'line') {
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        return { x: Math.round(a.x + Math.cos(ang) * len), y: Math.round(a.y + Math.sin(ang) * len) };
      }
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: a.x + Math.sign(dx || 1) * m, y: a.y + Math.sign(dy || 1) * m };
    }
    bag.on(overlay, 'contextmenu', (e) => e.preventDefault());
    bag.on(overlay, 'pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      root.focus({ preventScroll: true });
      const p = pos(e);
      const right = e.button === 2;
      const fg = right ? secondary : primary, bgc = right ? primary : secondary;
      if (tool === 'picker') {
        const d = g.getImageData(Math.max(0, Math.min(canvas.width - 1, p.x)), Math.max(0, Math.min(canvas.height - 1, p.y)), 1, 1).data;
        setColor(right ? 'secondary' : 'primary', rgbToHex(d[0], d[1], d[2]));
        setTool(prevTool);
        return;
      }
      snapshot();
      if (tool === 'fill') { floodFill(p.x, p.y, fg); commitToStore(); return; }
      overlay.setPointerCapture(e.pointerId);
      stroke = { id: e.pointerId, start: p, last: p, fg, bgc, right };
      if (tool === 'pencil') pixelLine(p.x, p.y, p.x, p.y, fg);
      else if (tool === 'brush') brushSeg(p.x, p.y, p.x, p.y, fg, size.brush);
      else if (tool === 'eraser') eraseSeg(p.x, p.y, p.x, p.y, right ? primary : secondary, size.eraser);
    });
    bag.on(overlay, 'pointermove', (e) => {
      const p = pos(e);
      status.set(1, p.x >= 0 && p.y >= 0 && p.x < canvas.width && p.y < canvas.height ? `${p.x}, ${p.y}` : '');
      if (tool === 'eraser' && !stroke) drawEraserCursor(p);
      if (!stroke || stroke.id !== e.pointerId) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) {
        const q = pos(ev);
        const l = stroke.last;
        if (tool === 'pencil') pixelLine(l.x, l.y, q.x, q.y, stroke.fg);
        else if (tool === 'brush') brushSeg(l.x, l.y, q.x, q.y, stroke.fg, size.brush);
        else if (tool === 'eraser') { eraseSeg(l.x, l.y, q.x, q.y, stroke.right ? primary : secondary, size.eraser); drawEraserCursor(q); }
        stroke.last = q;
      }
      if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
        const end = e.shiftKey ? constrain(stroke.start, p, tool) : p;
        og.clearRect(0, 0, overlay.width, overlay.height);
        shape(og, tool, stroke.start, end, stroke.fg, tool === 'line' ? stroke.fg : (shapeStyle === 2 ? stroke.fg : stroke.bgc), tool === 'line' ? size.line : 1);
        status.set(2, `${Math.abs(end.x - stroke.start.x)} × ${Math.abs(end.y - stroke.start.y)}`);
      }
    });
    const endStroke = (e) => {
      if (!stroke || stroke.id !== e.pointerId) return;
      if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
        const p = pos(e);
        const end = e.shiftKey ? constrain(stroke.start, p, tool) : p;
        og.clearRect(0, 0, overlay.width, overlay.height);
        shape(g, tool, stroke.start, end, stroke.fg, tool === 'line' ? stroke.fg : (shapeStyle === 2 ? stroke.fg : stroke.bgc), tool === 'line' ? size.line : 1);
        status.set(2, `${canvas.width} × ${canvas.height}`);
      }
      stroke = null;
      commitToStore();
    };
    bag.on(overlay, 'pointerup', endStroke);
    bag.on(overlay, 'pointercancel', endStroke);
    bag.on(overlay, 'pointerleave', () => { if (!stroke) { og.clearRect(0, 0, overlay.width, overlay.height); status.set(1, ''); } });
    function drawEraserCursor(p) {
      og.clearRect(0, 0, overlay.width, overlay.height);
      const s = size.eraser;
      og.fillStyle = secondary; og.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      og.strokeStyle = '#000'; og.lineWidth = 1; og.strokeRect(Math.round(p.x - s / 2) + 0.5, Math.round(p.y - s / 2) + 0.5, s - 1, s - 1);
    }

    // ---------------------------------------------------------------- keys
    bag.on(root, 'keydown', (e) => {
      if (e.target.closest && e.target.closest('input')) return;
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
      else if (mod && k === 's') { e.preventDefault(); save(); }
      else if (mod && k === 'n' && e.shiftKey) { e.preventDefault(); clearImage(); }
      else if (mod && k === 'n') { e.preventDefault(); newImage(); }
      else if (mod && k === 'i') { e.preventDefault(); invert(); }
      else if (!mod && !e.altKey) { const t = TOOLS.find((x) => x.key === k); if (t) { e.preventDefault(); setTool(t.id); } }
    });

    // ---------------------------------------------------------------- start
    renderPalette();
    setColor('primary', primary); setColor('secondary', secondary);
    setTool('pencil');
    const ro = new ResizeObserver(() => fitCanvas());
    ro.observe(work);
    bag.push(() => ro.disconnect());
    requestAnimationFrame(() => { fitCanvas(); if (!undo.length && !dirty) blank(); });
    fitCanvas(); blank();

    return {
      unmount() { bag.dispose(); },
      onResize() { fitCanvas(); },
    };
  },
};
