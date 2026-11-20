// Kayzee XP apps kit: shared building blocks for the apps-owned windows
// (About, Resume, Projects, Browser, Media, Contact, Notepad, Recycle Bin, Paint).
// Every app root gets the class `kx`; all kit CSS is scoped under `.kx` (only apps-owned roots carry it).
import { ico, iconSVG } from './projects.kit.icons.js';
import { KIT_CSS } from './projects.kit.css.js';

export { ico, iconSVG };

// ------------------------------------------------------------------ DOM
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ------------------------------------------------------------------ CSS + root setup
export function ensureKitCss() {
  if (document.getElementById('kx-kit-css')) return;
  const st = document.createElement('style');
  st.id = 'kx-kit-css';
  st.textContent = KIT_CSS;
  document.head.prepend(st);
}

/** Prepare an app root: kit CSS, `kx` class, focusability. Returns a disposer bag. */
export function setupRoot(root) {
  ensureKitCss();
  root.classList.add('kx');
  if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
  const bag = [];
  bag.on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); bag.push(() => target.removeEventListener(type, fn, opts)); };
  bag.dispose = () => {
    root.querySelectorAll('.kx-menubar').forEach((b) => b.closeMenus && b.closeMenus());
    root.querySelectorAll('.kx-popup').forEach((m) => m.close && m.close());
    while (bag.length) { try { bag.pop()(); } catch (_) { /* ignore */ } }
  };
  return bag;
}

// ------------------------------------------------------------------ menubar
// defs: [{ label: '&File', items: [{ label, action, disabled: bool|fn, checked: fn, shortcut, sep, hidden: fn }] }]
export function menubar(defs, { logo = true } = {}) {
  const bar = h('div', { class: 'kx-menubar', role: 'menubar' });
  let openIdx = -1; let dropdown = null; let tops = [];

  const accel = (label) => {
    const i = label.indexOf('&');
    if (i < 0) return esc(label);
    return esc(label.slice(0, i)) + '<u>' + esc(label[i + 1]) + '</u>' + esc(label.slice(i + 2));
  };
  const plain = (label) => label.replace('&', '');

  function close() {
    if (dropdown) dropdown.remove();
    dropdown = null;
    if (openIdx >= 0 && tops[openIdx]) tops[openIdx].classList.remove('open');
    openIdx = -1;
    document.removeEventListener('pointerdown', outside, true);
  }
  function outside(e) { if (!bar.contains(e.target)) close(); }

  function open(i, focusFirst = false) {
    close();
    const def = defs[i]; if (!def) return;
    openIdx = i;
    const top = tops[i];
    top.classList.add('open');
    dropdown = h('div', { class: 'kx-menu', role: 'menu' });
    const items = [];
    for (const it of def.items) {
      if (it.hidden && (typeof it.hidden === 'function' ? it.hidden() : it.hidden)) continue;
      if (it.sep) { dropdown.append(h('div', { class: 'kx-menu-sep', role: 'separator' })); continue; }
      const dis = typeof it.disabled === 'function' ? it.disabled() : !!it.disabled;
      const chk = typeof it.checked === 'function' ? it.checked() : !!it.checked;
      const b = h('button', {
        class: 'kx-menu-item' + (dis ? ' disabled' : '') + (chk ? ' checked' : ''),
        role: chk !== undefined && it.checked ? 'menuitemcheckbox' : 'menuitem',
        'aria-checked': it.checked ? String(chk) : null,
        'aria-disabled': dis ? 'true' : null,
        tabindex: '-1', type: 'button',
      },
      h('span', { class: 'kx-menu-chk' }),
      h('span', { class: 'kx-menu-label', html: accel(it.label) }),
      h('span', { class: 'kx-menu-key', text: it.shortcut || '' }));
      if (!dis) b.addEventListener('click', (e) => { e.stopPropagation(); close(); it.action && it.action(); });
      b.addEventListener('pointerenter', () => b.focus({ preventScroll: true }));
      dropdown.append(b);
      items.push(b);
    }
    dropdown.addEventListener('keydown', (e) => {
      const idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); const n = (i + 1) % defs.length; open(n, true); tops[n].focus(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); const n = (i - 1 + defs.length) % defs.length; open(n, true); tops[n].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); top.focus(); }
      else if (e.key === 'Tab') close();
    });
    dropdown.style.left = top.offsetLeft + 'px';
    bar.append(dropdown);
    document.addEventListener('pointerdown', outside, true);
    if (focusFirst) items.find((b) => !b.classList.contains('disabled'))?.focus();
  }

  tops = defs.map((def, i) => {
    const t = h('button', { class: 'kx-menubar-item', type: 'button', role: 'menuitem', 'aria-haspopup': 'true', html: accel(def.label), 'aria-label': plain(def.label) });
    t.addEventListener('pointerdown', (e) => { e.preventDefault(); if (openIdx === i) close(); else open(i); t.focus({ preventScroll: true }); });
    t.addEventListener('pointerenter', () => { if (openIdx >= 0 && openIdx !== i) open(i); });
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(i, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); tops[(i + 1) % tops.length].focus(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); tops[(i - 1 + tops.length) % tops.length].focus(); }
      else if (e.key === 'Escape') close();
    });
    bar.append(t);
    return t;
  });
  if (logo) bar.append(h('span', { class: 'kx-menubar-logo', 'aria-hidden': 'true' }, kxLogo()));
  bar.closeMenus = close;
  return bar;
}

// small original "kayzee" mark for the menubar corner: a voxel hill-and-sun tile
export function kxLogo(px = 22) {
  const c = document.createElement('canvas');
  const s = 2; c.width = 11 * s; c.height = 11 * s;
  c.style.width = px + 'px'; c.style.height = px + 'px';
  const g = c.getContext('2d');
  const rows = [
    'ooooooooooo',
    'obbbbbbbbbo',
    'obbbbbyybbo',
    'obbbbyyyybo',
    'obwwbbyybbo',
    'obbbbbbbbbo',
    'obbbbbbgggo',
    'obbgggggGGo',
    'ogggggGGGGo',
    'oGGGGGGGGGo',
    'ooooooooooo',
  ];
  const pal = { o: '#2c4f8a', b: '#5ea6f5', w: '#ffffff', y: '#ffcf2e', g: '#55b83c', G: '#3a9a2c' };
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!pal[ch]) return;
    g.fillStyle = pal[ch]; g.fillRect(x * s, y * s, s, s);
    if (ch !== 'o') { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x * s, y * s, s, 1); }
  }));
  c.className = 'px-icon';
  return c;
}

// ------------------------------------------------------------------ popup menu (context menus, toolbar drop-downs)
// items like menubar items. Positions under `anchor` (or at {x,y} client coords) inside `root`.
export function popupMenu(root, anchor, items) {
  root.querySelectorAll(':scope > .kx-popup').forEach((m) => m.close());
  const menu = h('div', { class: 'kx-menu kx-popup', role: 'menu' });
  const btns = [];
  const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = (e) => { if (!menu.contains(e.target)) close(); };
  menu.close = close;
  for (const it of items) {
    if (it.sep) { menu.append(h('div', { class: 'kx-menu-sep', role: 'separator' })); continue; }
    const dis = typeof it.disabled === 'function' ? it.disabled() : !!it.disabled;
    const chk = typeof it.checked === 'function' ? it.checked() : !!it.checked;
    const b = h('button', { class: 'kx-menu-item' + (dis ? ' disabled' : '') + (chk ? ' checked' : '') + (it.bold ? ' bold' : ''), type: 'button', role: 'menuitem', tabindex: '-1' },
      h('span', { class: 'kx-menu-chk' }), h('span', { class: 'kx-menu-label', text: it.label.replace('&', '') }), h('span', { class: 'kx-menu-key', text: it.shortcut || '' }));
    if (!dis) b.addEventListener('click', () => { close(); it.action && it.action(); });
    b.addEventListener('pointerenter', () => b.focus({ preventScroll: true }));
    menu.append(b); btns.push(b);
  }
  menu.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(); anchor && anchor.focus && anchor.focus(); }
  });
  root.append(menu);
  const rr = root.getBoundingClientRect();
  const sc = rr.width / (root.offsetWidth || rr.width) || 1;
  let x, y;
  if (anchor && anchor.getBoundingClientRect) { const ar = anchor.getBoundingClientRect(); x = (ar.left - rr.left) / sc; y = (ar.bottom - rr.top) / sc; }
  else { x = (anchor.x - rr.left) / sc; y = (anchor.y - rr.top) / sc; }
  x = Math.max(2, Math.min(x, root.offsetWidth - menu.offsetWidth - 2));
  if (y + menu.offsetHeight > root.offsetHeight - 2) y = Math.max(2, y - menu.offsetHeight - (anchor && anchor.offsetHeight ? anchor.offsetHeight : 0));
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  requestAnimationFrame(() => btns.find((b) => !b.classList.contains('disabled'))?.focus({ preventScroll: true }));
  return menu;
}

// ------------------------------------------------------------------ toolbar
// items: [{ id, icon, label, title, action, disabled, arrow }, '|', ...]
export function toolbar(items, { big = true, cls = '' } = {}) {
  const el = h('div', { class: 'kx-toolbar' + (big ? ' big' : '') + (cls ? ' ' + cls : ''), role: 'toolbar' });
  const btns = {};
  for (const it of items) {
    if (it === '|') { el.append(h('span', { class: 'kx-tool-sep', 'aria-hidden': 'true' })); continue; }
    if (it instanceof Node) { el.append(it); continue; }
    const b = h('button', {
      class: 'kx-tool' + (it.label ? ' has-label' : '') + (it.cls ? ' ' + it.cls : ''), type: 'button',
      title: it.title || (it.label ? null : it.id), 'aria-label': it.title || it.label || it.id,
    },
    it.icon ? h('span', { class: 'kx-tool-ico', html: iconSVG(it.icon, big ? 24 : 16) }) : null,
    it.label ? h('span', { class: 'kx-tool-label', text: it.label }) : null,
    it.arrow ? h('span', { class: 'kx-tool-arrow', 'aria-hidden': 'true' }) : null);
    if (it.action) b.addEventListener('click', (e) => { if (!b.disabled) it.action(e); });
    if (it.disabled) b.disabled = true;
    btns[it.id] = b;
    b.setIcon = (name) => { b.querySelector('.kx-tool-ico').innerHTML = iconSVG(name, big ? 24 : 16); };
    el.append(b);
  }
  el.btns = btns;
  return el;
}

// ------------------------------------------------------------------ status bar
export function statusbar(parts = [{ text: 'Ready', flex: true }]) {
  const el = h('div', { class: 'kx-statusbar', role: 'status' });
  el.parts = parts.map((p) => {
    const s = h('span', { class: 'kx-status-part' + (p.flex ? ' flex' : ''), style: p.width ? { width: p.width + 'px' } : null });
    if (p.text) s.textContent = p.text;
    if (p.node) s.append(p.node);
    el.append(s);
    return s;
  });
  el.set = (i, text) => { if (el.parts[i]) el.parts[i].textContent = text; };
  return el;
}

// ------------------------------------------------------------------ explorer side pane
// box({ title, items:[{icon,label,action,disabled}], body: Node, special })
export function sideBox({ title, items, body, special = false, open = true }) {
  const box = h('section', { class: 'kx-sidepane-box' + (special ? ' special' : '') + (open ? '' : ' collapsed') });
  const bodyId = 'kxsb' + Math.random().toString(36).slice(2, 8);
  const head = h('button', { class: 'kx-sidepane-head', type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId },
    h('span', { class: 'kx-sidepane-title', text: title }),
    h('span', { class: 'kx-sidepane-chev', 'aria-hidden': 'true' }));
  const content = h('div', { class: 'kx-sidepane-body', id: bodyId });
  head.addEventListener('click', () => {
    const c = box.classList.toggle('collapsed');
    head.setAttribute('aria-expanded', String(!c));
  });
  box.append(head, content);
  box.setItems = (list) => {
    content.textContent = '';
    for (const it of list) {
      const a = h('button', { class: 'kx-sidepane-link' + (it.disabled ? ' disabled' : ''), type: 'button', disabled: it.disabled || null },
        it.icon ? h('span', { class: 'kx-sidepane-ico', html: iconSVG(it.icon, 16) }) : null,
        h('span', { text: it.label }));
      if (it.action) a.addEventListener('click', it.action);
      content.append(a);
    }
  };
  box.setBody = (node) => { content.textContent = ''; content.append(node); };
  if (items) box.setItems(items);
  if (body) box.setBody(body);
  return box;
}

// ------------------------------------------------------------------ address bar
export function addressbar({ icon = 'folder', value = '', editable = false, onGo, label = 'Address' } = {}) {
  const icoEl = h('span', { class: 'kx-address-ico', html: iconSVG(icon, 16) });
  const input = h('input', {
    class: 'kx-address-input', type: 'text', value, spellcheck: 'false', autocomplete: 'off',
    'aria-label': label, readonly: editable ? null : true,
  });
  const go = h('button', { class: 'kx-address-go', type: 'button', 'aria-label': 'Go' }, h('span', { html: iconSVG('go', 16) }), h('span', { text: 'Go' }));
  const field = h('div', { class: 'kx-address-field' }, icoEl, input, h('span', { class: 'kx-address-drop', 'aria-hidden': 'true' }));
  const el = h('div', { class: 'kx-addressbar' }, h('label', { class: 'kx-address-label', text: label }), field, go);
  const fire = () => onGo && onGo(input.value.trim());
  go.addEventListener('click', fire);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fire(); } });
  if (editable) input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
  el.input = input;
  el.set = (v, iconName) => { input.value = v; if (iconName) icoEl.innerHTML = iconSVG(iconName, 16); };
  return el;
}

// ------------------------------------------------------------------ message box (modal within the app root)
// returns Promise<buttonIndex | -1 (closed)>
export function msgbox(root, { title = 'Kayzee XP', text = '', html = null, icon = 'info32', buttons = ['OK'], defaultIndex = 0, sound } = {}) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const shield = h('div', { class: 'kx-modal-shield' });
    const btnEls = buttons.map((b, i) => h('button', { class: 'xp-btn' + (i === defaultIndex ? ' default' : ''), type: 'button', text: b }));
    const closeBtn = h('button', { class: 'kx-dlg-close', type: 'button', 'aria-label': 'Close' });
    const titleId = 'kxdt' + Math.random().toString(36).slice(2, 8);
    const msg = h('div', { class: 'kx-dlg-text' });
    if (html) msg.innerHTML = html; else msg.textContent = text;
    const dlg = h('div', { class: 'kx-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div', { class: 'kx-dlg-title' }, h('span', { id: titleId, text: title }), closeBtn),
      h('div', { class: 'kx-dlg-body' }, icon ? h('span', { class: 'kx-dlg-ico', html: iconSVG(icon, 32) }) : null, msg),
      h('div', { class: 'kx-dlg-btns' }, btnEls));
    shield.append(dlg);
    root.append(shield);
    const done = (i) => { shield.remove(); try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (_) { /* */ } resolve(i); };
    btnEls.forEach((b, i) => b.addEventListener('click', () => done(i)));
    closeBtn.addEventListener('click', () => done(-1));
    shield.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(-1); }
      if (e.key === 'Tab') { // trap focus
        const f = [...btnEls, closeBtn]; const idx = f.indexOf(document.activeElement);
        e.preventDefault(); f[(idx + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    shield.addEventListener('pointerdown', (e) => { if (e.target === shield) { dlg.classList.remove('flash'); void dlg.offsetWidth; dlg.classList.add('flash'); } });
    if (sound) try { sound(); } catch (_) { /* */ }
    requestAnimationFrame(() => btnEls[defaultIndex]?.focus({ preventScroll: true }));
  });
}

// ------------------------------------------------------------------ balloon tip (yellow, pointing at an element)
export function balloon(root, anchor, { title = '', text = '', icon = 'info32', timeout = 6000 } = {}) {
  root.querySelectorAll(':scope .kx-balloon').forEach((b) => b.remove());
  const close = h('button', { class: 'kx-balloon-x', type: 'button', 'aria-label': 'Close tip' });
  const b = h('div', { class: 'kx-balloon', role: 'alert' },
    close,
    title ? h('div', { class: 'kx-balloon-title' }, icon ? h('span', { html: iconSVG(icon, 16) }) : null, h('b', { text: title })) : null,
    h('div', { class: 'kx-balloon-text', text }));
  root.append(b);
  const rr = root.getBoundingClientRect();
  const ar = anchor ? anchor.getBoundingClientRect() : { left: rr.left + rr.width / 2, top: rr.top + rr.height / 2, width: 0, height: 0, bottom: rr.top + rr.height / 2 };
  const scale = rr.width / (root.offsetWidth || rr.width) || 1; // in case the window is CSS-scaled
  const bw = b.offsetWidth; const bh = b.offsetHeight;
  let x = (ar.left - rr.left) / scale + Math.min(28, (ar.width / scale) / 2) - 22;
  let y = (ar.bottom - rr.top) / scale + 10;
  let below = true;
  if (y + bh > root.offsetHeight - 4) { y = (ar.top - rr.top) / scale - bh - 10; below = false; }
  x = Math.max(4, Math.min(x, root.offsetWidth - bw - 4));
  b.style.left = x + 'px'; b.style.top = Math.max(4, y) + 'px';
  b.classList.add(below ? 'below' : 'above');
  const tail = Math.max(12, Math.min(bw - 24, (ar.left - rr.left) / scale + Math.min(28, ar.width / scale / 2) - x - 6));
  b.style.setProperty('--tail', tail + 'px');
  let t = 0;
  const kill = () => { clearTimeout(t); b.remove(); };
  close.addEventListener('click', kill);
  if (timeout) t = setTimeout(kill, timeout);
  b.kill = kill;
  return b;
}

// ------------------------------------------------------------------ misc utils
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Accept a plain URL or a pasted <iframe ... src="..."> snippet; return the URL. */
export function embedSrc(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i) || s.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
  let u = m ? m[1] : s;
  u = u.replace(/&amp;/g, '&');
  if (u.startsWith('//')) u = 'https:' + u;
  return u;
}

export function detectType(p) {
  if (p.type === 'page' || p.type === 'video' || p.type === 'image') return p.type;
  const u = embedSrc(p.url).toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|\.(mp4|webm|mov|m4v)(\?|#|$)/.test(u)) return 'video';
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/.test(u)) return 'image';
  return 'page';
}

export function fakeUrl(id) { return id ? `http://www.kayzee.xp/projects/${id}` : 'http://www.kayzee.xp/'; }

export function visibleProjects(site) {
  return ((site && site.projects) || []).filter((p) => p && p.visible !== false && p.id);
}

export function openProject(ctx, p) {
  const t = detectType(p);
  if (t === 'video') ctx.openApp('media', { projectId: p.id });
  else if (t === 'image') ctx.openApp('media', { projectId: p.id, mode: 'image' });
  else ctx.openApp('browser', { projectId: p.id });
}

export function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

// ------------------------------------------------------------------ generated project thumbnail
const THUMB_PALETTES = [
  ['#2a6fe0', '#73b4ff', '#ffd23a'], // luna blue
  ['#2e9a3a', '#9be37a', '#fff2a8'], // hill green
  ['#d8572a', '#ffb067', '#fff1d6'], // sunset
  ['#6a4fc8', '#b8a6ff', '#ffe0f4'], // violet
  ['#0f8f8a', '#7fe0d6', '#f4fff0'], // teal
  ['#c23b62', '#ff94b2', '#fff0d0'], // berry
];

/** Draws a crisp, original "voxel card" preview for a project. Returns a canvas (CSS size w x h). */
export function projectThumb(p, w = 120, h = 90, type = detectType(p)) {
  const dpr = Math.min(2, window.devicePixelRatio || 1) || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const hs = hash(p.id || p.title || 'x');
  const [c1, c2, c3] = THUMB_PALETTES[(hs >>> 16) % THUMB_PALETTES.length];

  // background: sky gradient + voxel hill
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, c1); bg.addColorStop(1, c2);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const vs = Math.max(3, Math.round(w / 30)); // voxel size
  for (let x = 0; x < w; x += vs) {
    const hy = h * 0.72 - Math.sin((x / w) * Math.PI * 1.1 + (hs % 7)) * h * 0.1;
    for (let y = Math.floor(hy / vs) * vs; y < h; y += vs) {
      g.fillStyle = (Math.floor(x / vs) + Math.floor(y / vs)) % 2 ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.10)';
      g.fillRect(x, y, vs, vs);
    }
  }
  // sun / accent voxel cluster
  g.fillStyle = c3;
  const sx = w * 0.88, sy = h * 0.13;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.abs(dx) + Math.abs(dy) < 2) g.fillRect(sx + dx * vs, sy + dy * vs, vs, vs);

  // the card itself (a mini page / player / picture)
  const cw = w * 0.7, ch = h * 0.66, cx = w * 0.09, cy = h * 0.17;
  g.fillStyle = 'rgba(0,0,40,.25)'; g.fillRect(cx + 3, cy + 3, cw, ch);
  g.fillStyle = '#fff'; g.fillRect(cx, cy, cw, ch);
  const bar = Math.max(6, h * 0.09);
  const tb = g.createLinearGradient(0, cy, 0, cy + bar);
  if (type === 'video') { tb.addColorStop(0, '#5a6274'); tb.addColorStop(1, '#232733'); }
  else { tb.addColorStop(0, '#4aa0ff'); tb.addColorStop(1, '#0a5be0'); }
  g.fillStyle = tb; g.fillRect(cx, cy, cw, bar);
  g.fillStyle = '#f26d3d'; g.fillRect(cx + cw - bar * 0.9, cy + bar * 0.18, bar * 0.64, bar * 0.64);

  const inner = { x: cx + 4, y: cy + bar + 4, w: cw - 8, h: ch - bar - 8 };
  if (type === 'video') {
    g.fillStyle = '#14161d'; g.fillRect(inner.x, inner.y, inner.w, inner.h);
    g.fillStyle = '#fff';
    const r = Math.min(inner.w, inner.h) * 0.22, mx = inner.x + inner.w / 2, my = inner.y + inner.h / 2;
    g.beginPath(); g.moveTo(mx - r * 0.7, my - r); g.lineTo(mx + r, my); g.lineTo(mx - r * 0.7, my + r); g.closePath(); g.fill();
  } else if (type === 'image') {
    const ig = g.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    ig.addColorStop(0, '#9fd3ff'); ig.addColorStop(1, '#e8f6ff');
    g.fillStyle = ig; g.fillRect(inner.x, inner.y, inner.w, inner.h);
    g.fillStyle = '#4caf3a';
    g.beginPath(); g.moveTo(inner.x, inner.y + inner.h); g.lineTo(inner.x + inner.w * 0.35, inner.y + inner.h * 0.45);
    g.lineTo(inner.x + inner.w * 0.6, inner.y + inner.h * 0.75); g.lineTo(inner.x + inner.w * 0.75, inner.y + inner.h * 0.6);
    g.lineTo(inner.x + inner.w, inner.y + inner.h); g.closePath(); g.fill();
    g.fillStyle = '#ffcf2e'; g.beginPath(); g.arc(inner.x + inner.w * 0.78, inner.y + inner.h * 0.3, inner.h * 0.12, 0, Math.PI * 2); g.fill();
  } else {
    // title text inside the page (wraps; long words are cut with an ellipsis)
    const title = String(p.title || 'Untitled');
    g.fillStyle = '#1b2a4a';
    const fs = Math.max(8, Math.round(h * 0.115));
    g.font = `bold ${fs}px Tahoma, Verdana, sans-serif`;
    g.textBaseline = 'top';
    const fit = (t) => { if (g.measureText(t).width <= inner.w) return t; while (t.length > 1 && g.measureText(t + '…').width > inner.w) t = t.slice(0, -1); return t + '…'; };
    const words = title.split(/\s+/); const lines = []; let line = '';
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (g.measureText(t).width > inner.w && line) { lines.push(line); line = wd; } else line = t;
    }
    if (line) lines.push(line);
    const lh = fs * 1.18;
    const maxLines = Math.max(1, Math.min(3, Math.floor((inner.h * 0.78) / lh)));
    lines.slice(0, maxLines).forEach((ln, i) => {
      let t = ln;
      if (i === maxLines - 1 && lines.length > maxLines) t = fit(ln + ' ' + lines[i + 1]);
      g.fillText(fit(t), inner.x, inner.y + i * lh);
    });
    const used = Math.min(lines.length, maxLines) * lh + 3;
    // abstract content lines
    g.fillStyle = '#cfd6e2';
    for (let i = 0; i < 3; i++) {
      const ly = inner.y + used + i * Math.max(3, h * 0.045);
      if (ly + 2 > inner.y + inner.h) break;
      g.fillRect(inner.x, ly, inner.w * (i === 2 ? 0.55 : 0.92), Math.max(1.5, h * 0.022));
    }
  }
  // category badge voxel strip at the bottom-right
  g.fillStyle = c3;
  g.fillRect(cx + cw + vs, cy + ch - vs * 3, vs * 3, vs * 3);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(cx + cw + vs, cy + ch - vs, vs * 3, vs);
  return c;
}

/** Thumbnail element: cover <img> with fallback to the generated canvas. */
export function thumbEl(p, w, hgt) {
  const wrap = h('span', { class: 'kx-thumb', style: { width: w + 'px', height: hgt + 'px' } });
  const gen = () => { wrap.textContent = ''; wrap.append(projectThumb(p, w, hgt)); };
  if (p.cover) {
    const img = h('img', { src: p.cover, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', gen, { once: true });
    wrap.append(img);
  } else gen();
  return wrap;
}

// ------------------------------------------------------------------ shared text for joke files / notepad docs
export function plural(n, one, many) { return n === 1 ? one : many; }
