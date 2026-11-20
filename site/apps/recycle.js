// Recycle Bin: an Explorer window with a few joke files. They open in Notepad.
import { h, setupRoot, menubar, toolbar, statusbar, sideBox, addressbar, msgbox, popupMenu, iconSVG, plural } from './projects.kit.js';

const BMP_NOISE = 'BM6\u00a0\u00a0\u00a0\u00a06\u00a0\u00a0(\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00ff\u00ff\u00ff\u00fe\u00fe\u00fc\u00ff\u00b0\u00b0\u00ff\u00ffjj\u00fd\u00f0\u00f0\u00ff\u00ff\u00ff\u00e0\u00e0';

export const FILES = [
  {
    name: 'cv_final_FINAL_v7.doc', icon: 'doc', type: 'Document', size: '48 KB', from: 'C:\\My Documents', deleted: '14/09/2026 23:58',
    text: `cv_final_FINAL_v7.doc
=====================

Version history (abridged)

v1  Wrote a CV.
v2  Moved my name two pixels to the left.
v3  Replaced "hard-working" with "results-driven".
v4  Replaced "results-driven" with "hard-working".
v5  Exported it as cv_final.pdf
v6  Found a typo in "attention to detial".
v7  Final. Actually final. Final final.

This one never got sent.
The properly final version lives in My Resume on the desktop.
`,
  },
  {
    name: 'my first logo (2013).bmp', icon: 'bmp', type: 'Bitmap Image', size: '1.2 MB', from: 'C:\\My Pictures', deleted: '02/03/2025 10:12',
    text: `${BMP_NOISE}${BMP_NOISE}

[Notepad can't show pictures, which is probably for the best.]

For the record: this was the very first LéFotugrapher logo, 2013.
It had a lens flare, a drop shadow, a bevel, an outer glow
and three different fonts. Possibly four.

Taste has improved since. The lens flare is at peace now.
`,
  },
  {
    name: 'excuses_for_late_assignment.txt', icon: 'txt', type: 'Text Document', size: '1 KB', from: 'C:\\My Documents\\College', deleted: '28/04/2025 08:41',
    text: `Excuses for a late assignment (draft)
-------------------------------------

1. The drone needed charging.
2. The drone needed charging again.
3. I was colour grading the footage and lost track of time.
4. My laptop picked tonight to install updates.
5. I was busy writing a press release about the assignment.

Status: deleted, never used.
Turns out it's quicker to just hand the thing in.
`,
  },
];

export default {
  id: 'recycle',
  title: 'Recycle Bin',
  icon: 'recycle',
  size: [660, 450],
  minSize: [380, 280],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let files = FILES.slice();
    let selName = null;
    let view = 'tiles';

    const menus = menubar([
      { label: '&File', items: [
        { label: '&Open', shortcut: 'Enter', disabled: () => !sel(), action: () => openSel() },
        { label: '&Delete', shortcut: 'Del', disabled: () => !sel(), action: () => delSel() },
        { sep: true },
        { label: 'Empty Recycle &Bin', disabled: () => !files.length, action: () => empty() },
        { sep: true },
        { label: '&Close', action: () => ctx.close() },
      ] },
      { label: '&Edit', items: [
        { label: '&Restore All Items', disabled: () => !files.length, action: () => restore() },
      ] },
      { label: '&View', items: [
        { label: 'T&iles', checked: () => view === 'tiles', action: () => setView('tiles') },
        { label: '&Details', checked: () => view === 'list', action: () => setView('list') },
      ] },
      { label: '&Help', items: [
        { label: '&About Recycle Bin', action: () => msgbox(root, { title: 'Recycle Bin', icon: 'info32', text: 'Things that didn\'t make the cut.\nDouble-click a file to have a look.' }) },
      ] },
    ]);
    const tools = toolbar([
      { id: 'back', icon: 'backOff', label: 'Back', arrow: true, disabled: true },
      { id: 'fwd', icon: 'forwardOff', title: 'Forward', arrow: true, disabled: true },
      { id: 'up', icon: 'up', title: 'Up', disabled: true },
      '|',
      { id: 'empty', icon: 'bin', label: 'Empty Recycle Bin', action: () => empty() },
      '|',
      { id: 'views', icon: 'views', title: 'Views', arrow: true, action: () => popupMenu(root, tools.btns.views, [
        { label: 'Tiles', checked: view === 'tiles', action: () => setView('tiles') },
        { label: 'Details', checked: view === 'list', action: () => setView('list') },
      ]) },
    ]);
    const addr = addressbar({ icon: 'bin', value: 'Recycle Bin' });
    const boxTasks = sideBox({ title: 'Recycle Bin Tasks', items: [] });
    const boxPlaces = sideBox({ title: 'Other Places', items: [
      { icon: 'folder', label: 'My Projects', action: () => ctx.openApp('projects') },
      { icon: 'doc', label: 'My Resume', action: () => ctx.openApp('resume') },
      { icon: 'mail', label: 'Contact Me', action: () => ctx.openApp('contact') },
    ] });
    const boxDetails = sideBox({ title: 'Details', body: h('div') });
    const side = h('aside', { class: 'kx-sidepane' }, boxTasks, boxPlaces, boxDetails);
    const main = h('div', { class: 'kx-main rb-main', role: 'listbox', tabindex: '0', 'aria-label': 'Deleted files' });
    const status = statusbar([{ text: '', flex: true }, { text: '', width: 120 }]);
    root.append(menus, tools, addr, h('div', { class: 'kx-explorer-body' }, side, main), status);

    const sel = () => files.find((f) => f.name === selName) || null;
    function setView(v) { view = v; render(); main.focus({ preventScroll: true }); }
    function render() {
      main.textContent = '';
      main.classList.toggle('rb-listmode', view === 'list');
      tools.btns.empty.disabled = !files.length;
      if (!files.length) {
        main.append(h('div', { class: 'rb-empty' }, h('span', { html: iconSVG('bin', 48) }), h('p', { text: 'The Recycle Bin is empty. Very tidy.' })));
      } else if (view === 'list') {
        main.append(h('div', { class: 'rb-head' }, ['Name', 'Original Location', 'Date Deleted', 'Size'].map((c) => h('span', { class: 'rb-c', text: c }))));
        files.forEach((f) => main.append(h('div', { class: 'rb-item rb-row' + (f.name === selName ? ' sel' : ''), role: 'option', 'aria-selected': String(f.name === selName), 'data-name': f.name },
          h('span', { class: 'rb-c' }, h('span', { html: iconSVG(f.icon, 16) }), h('span', { class: 'rb-name', text: f.name })),
          h('span', { class: 'rb-c', text: f.from }), h('span', { class: 'rb-c', text: f.deleted }), h('span', { class: 'rb-c', text: f.size }))));
      } else {
        const wrap = h('div', { class: 'rb-tiles' });
        files.forEach((f) => wrap.append(h('div', { class: 'rb-item rb-tile' + (f.name === selName ? ' sel' : ''), role: 'option', 'aria-selected': String(f.name === selName), 'data-name': f.name },
          h('span', { class: 'rb-ico', html: iconSVG(f.icon, 48) }),
          h('span', { class: 'rb-meta' }, h('span', { class: 'rb-name', text: f.name }), h('span', { class: 'rb-sub', text: f.type }), h('span', { class: 'rb-sub', text: f.size })))));
        main.append(wrap);
      }
      status.set(0, selName ? '1 object selected' : `${files.length} ${plural(files.length, 'object', 'objects')}`);
      status.set(1, sel() ? sel().size : '');
      renderSide();
    }
    function renderSide() {
      const f = sel();
      boxTasks.setItems([
        { icon: 'bin', label: 'Empty the Recycle Bin', disabled: !files.length, action: () => empty() },
        { icon: 'restore', label: f ? 'Restore this item' : 'Restore all items', disabled: !files.length, action: () => restore() },
      ]);
      const body = h('div', { class: 'rb-details' });
      if (f) body.append(h('b', { text: f.name }), h('span', { text: f.type }), h('span', { text: `Deleted: ${f.deleted}` }), h('span', { text: `Size: ${f.size}` }));
      else body.append(h('b', { text: 'Recycle Bin' }), h('span', { text: 'System Folder' }), h('span', { text: `${files.length} ${plural(files.length, 'item', 'items')}` }));
      boxDetails.setBody(body);
    }
    function select(name) {
      selName = name;
      main.querySelectorAll('.rb-item').forEach((el) => { const on = el.dataset.name === name; el.classList.toggle('sel', on); el.setAttribute('aria-selected', String(on)); });
      status.set(0, name ? '1 object selected' : `${files.length} objects`);
      status.set(1, sel() ? sel().size : '');
      renderSide();
    }
    function openSel() {
      const f = sel(); if (!f) return;
      ctx.openApp('notepad', { file: { name: f.name, text: f.text } });
    }
    async function delSel() {
      const f = sel(); if (!f) return;
      const r = await msgbox(root, { title: 'Confirm File Delete', icon: 'warn32', text: `Are you sure you want to permanently delete '${f.name}'?`, buttons: ['Yes', 'No'] });
      if (r !== 0) return;
      files = files.filter((x) => x !== f); selName = null;
      ctx.sound && ctx.sound('click');
      render();
    }
    async function empty() {
      if (!files.length) return;
      const r = await msgbox(root, { title: 'Confirm Multiple File Delete', icon: 'warn32', text: `Are you sure you want to permanently delete these ${files.length} ${plural(files.length, 'item', 'items')}?`, buttons: ['Yes', 'No'] });
      if (r !== 0) return;
      files = []; selName = null;
      ctx.sound && ctx.sound('click');
      render();
    }
    function restore() {
      msgbox(root, { title: 'Recycle Bin', icon: 'info32', text: 'These files have been through enough.\nThey\'re staying in the bin.' });
    }

    let lastTap = 0;
    bag.on(main, 'click', (e) => {
      const it = e.target.closest('.rb-item');
      if (!it) { select(null); return; }
      if (ctx.isMobile && selName === it.dataset.name && performance.now() - lastTap > 250) { openSel(); return; }
      lastTap = performance.now();
      select(it.dataset.name);
    });
    bag.on(main, 'dblclick', (e) => { const it = e.target.closest('.rb-item'); if (it) { select(it.dataset.name); openSel(); } });
    bag.on(main, 'contextmenu', (e) => {
      e.preventDefault();
      const it = e.target.closest('.rb-item');
      if (it) {
        select(it.dataset.name);
        popupMenu(root, { x: e.clientX, y: e.clientY }, [{ label: 'Open', bold: true, action: () => openSel() }, { label: 'Restore', action: () => restore() }, { sep: true }, { label: 'Delete', action: () => delSel() }]);
      } else popupMenu(root, { x: e.clientX, y: e.clientY }, [{ label: 'Empty Recycle Bin', disabled: !files.length, action: () => empty() }]);
    });
    bag.on(main, 'keydown', (e) => {
      const names = files.map((f) => f.name);
      const i = names.indexOf(selName);
      if (e.key === 'Enter') { e.preventDefault(); openSel(); }
      else if (e.key === 'Delete') { e.preventDefault(); delSel(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); if (names.length) select(names[Math.min(names.length - 1, i + 1)]); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); if (names.length) select(names[Math.max(0, i - 1)]); }
    });
    bag.on(main, 'focus', () => { if (!selName && files.length && main.matches(':focus-visible')) select(files[0].name); });

    render();
    addr.set('Recycle Bin', 'bin');
    return { unmount() { bag.dispose(); } };
  },
};
