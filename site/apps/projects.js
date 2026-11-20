// My Projects: an Explorer window listing visible projects, grouped by category.
import {
  h, setupRoot, menubar, toolbar, statusbar, sideBox, addressbar, msgbox, popupMenu, iconSVG,
  thumbEl, detectType, visibleProjects, openProject, plural,
} from './projects.kit.js';

const TYPE_LABEL = { page: 'Web page', video: 'Video', image: 'Picture' };
const TYPE_ICON = { page: 'web', video: 'video', image: 'image' };
const OPENS_IN = { page: 'Opens in Kayzee Explorer', video: 'Opens in Media Player', image: 'Opens in the picture viewer' };

export default {
  id: 'projects',
  title: 'My Projects',
  icon: 'projects',
  size: [780, 520],
  minSize: [400, 300],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let all = [];            // visible projects
    let loc = null;          // null = all (grouped) | category name
    let view = 'tiles';      // tiles | list
    let query = '';
    let selId = null;
    let loaded = false;
    const back = []; const fwd = [];

    // ---------------------------------------------------------------- chrome
    const menus = menubar([
      { label: '&File', items: [
        { label: '&Open', shortcut: 'Enter', disabled: () => !sel(), action: () => openSel() },
        { sep: true },
        { label: '&Close', action: () => ctx.close() },
      ] },
      { label: '&Edit', items: [
        { label: '&Find a Project...', shortcut: 'Ctrl+F', action: () => toggleSearch(true) },
      ] },
      { label: '&View', items: [
        { label: 'T&iles', checked: () => view === 'tiles', action: () => setView('tiles') },
        { label: '&List', checked: () => view === 'list', action: () => setView('list') },
        { sep: true },
        { label: '&Back', shortcut: 'Alt+Left', disabled: () => !back.length, action: () => goBack() },
        { label: '&Forward', shortcut: 'Alt+Right', disabled: () => !fwd.length, action: () => goFwd() },
        { label: '&Up One Level', shortcut: 'Backspace', disabled: () => loc === null, action: () => go(null) },
        { sep: true },
        { label: '&Refresh', shortcut: 'F5', action: () => render() },
      ] },
      { label: 'F&avorites', items: [
        { label: 'My Resume', action: () => ctx.openApp('resume') },
        { label: 'Contact Me', action: () => ctx.openApp('contact') },
        { sep: true },
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ label: '', hidden: () => !all[i], dynamic: i })),
      ].map((it) => (it.dynamic !== undefined ? {
        get label() { return all[it.dynamic] ? all[it.dynamic].title : ''; },
        hidden: it.hidden, action: () => all[it.dynamic] && openProject(ctx, all[it.dynamic]),
      } : it)) },
      { label: '&Tools', items: [
        { label: '&Folder Options...', action: () => msgbox(root, { title: 'Folder Options', icon: 'info32', text: 'Everything in this folder is already arranged just right.' }) },
      ] },
      { label: '&Help', items: [
        { label: '&About My Projects', action: () => msgbox(root, { title: 'About My Projects', icon: 'info32', text: 'Double-click a project to open it.\nPages open in Kayzee Explorer, videos and pictures in Media Player.' }) },
      ] },
    ]);
    const tools = toolbar([
      { id: 'back', icon: 'back', label: 'Back', action: () => goBack(), arrow: true },
      { id: 'fwd', icon: 'forward', title: 'Forward', action: () => goFwd(), arrow: true },
      { id: 'up', icon: 'up', title: 'Up', action: () => go(null) },
      '|',
      { id: 'search', icon: 'search', label: 'Search', action: () => toggleSearch() },
      '|',
      { id: 'views', icon: 'views', title: 'Views', arrow: true, action: () => popupMenu(root, tools.btns.views, [
        { label: 'Tiles', checked: view === 'tiles', action: () => setView('tiles') },
        { label: 'List', checked: view === 'list', action: () => setView('list') },
      ]) },
    ]);
    const addr = addressbar({ icon: 'folder', value: 'My Projects', onGo: () => render() });

    const searchInput = h('input', { class: 'xp-input pj-search-input', type: 'search', placeholder: 'Type a project name, category or year', 'aria-label': 'Search projects', spellcheck: 'false' });
    const searchClear = h('button', { class: 'xp-btn pj-search-clear', type: 'button', text: 'Clear' });
    const searchRow = h('div', { class: 'pj-search', hidden: true },
      h('span', { html: iconSVG('search', 16) }), h('label', { text: 'Search projects:' }), searchInput, searchClear);

    const boxTasks = sideBox({ title: 'Project Tasks', items: [] });
    const boxPlaces = sideBox({ title: 'Other Places', items: [
      { icon: 'doc', label: 'My Resume', action: () => ctx.openApp('resume') },
      { icon: 'mail', label: 'Contact Me', action: () => ctx.openApp('contact') },
      { icon: 'person', label: 'About Me', action: () => ctx.openApp('about') },
    ] });
    const boxDetails = sideBox({ title: 'Details', body: h('div') });
    const side = h('aside', { class: 'kx-sidepane', 'aria-label': 'Tasks and details' }, boxTasks, boxPlaces, boxDetails);
    const main = h('div', { class: 'kx-main pj-main', role: 'listbox', tabindex: '0', 'aria-label': 'Projects' });
    const status = statusbar([{ text: 'Loading...', flex: true }, { text: '', width: 150 }]);
    root.append(menus, tools, addr, searchRow, h('div', { class: 'kx-explorer-body' }, side, main), status);

    // ---------------------------------------------------------------- helpers
    const sel = () => all.find((p) => p.id === selId) || null;
    function shown() {
      const q = query.trim().toLowerCase();
      return all.filter((p) => (loc === null || (p.category || 'Other') === loc)
        && (!q || [p.title, p.category, p.year, p.description].join(' ').toLowerCase().includes(q)));
    }
    function groups(list) {
      const m = new Map();
      for (const p of list) { const c = p.category || 'Other'; if (!m.has(c)) m.set(c, []); m.get(c).push(p); }
      return m;
    }
    function locLabel() { return loc ? `My Projects\\${loc}` : 'My Projects'; }

    // ---------------------------------------------------------------- navigation
    function go(next, record = true) {
      if (next === loc) return;
      if (record) { back.push(loc); fwd.length = 0; }
      loc = next; selId = null;
      render();
    }
    function goBack() { if (!back.length) return; fwd.push(loc); loc = back.pop(); selId = null; render(); }
    function goFwd() { if (!fwd.length) return; back.push(loc); loc = fwd.pop(); selId = null; render(); }
    function setView(v) { view = v; render(); main.focus({ preventScroll: true }); }
    function toggleSearch(force) {
      const on = force !== undefined ? force : searchRow.hidden;
      searchRow.hidden = !on;
      tools.btns.search.classList.toggle('pressed', on);
      if (on) { searchInput.focus(); searchInput.select(); } else { query = ''; searchInput.value = ''; render(); }
    }
    bag.on(searchInput, 'input', () => { query = searchInput.value; render(); });
    bag.on(searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); toggleSearch(false); main.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); const f = shown()[0]; if (f) { select(f.id); main.focus(); } }
    });
    bag.on(searchClear, 'click', () => { searchInput.value = ''; query = ''; render(); searchInput.focus(); });

    // ---------------------------------------------------------------- render
    function itemEl(p) {
      const t = detectType(p);
      const isSel = p.id === selId;
      const common = { class: 'pj-item' + (isSel ? ' sel' : ''), role: 'option', 'aria-selected': String(isSel), 'data-id': p.id, title: p.description || p.title };
      if (view === 'list') {
        return h('div', { ...common, class: common.class + ' pj-row' },
          h('span', { class: 'pj-c pj-c-name' }, h('span', { html: iconSVG(TYPE_ICON[t], 16) }), h('span', { class: 'pj-name', text: p.title })),
          h('span', { class: 'pj-c', text: p.category || 'Other' }),
          h('span', { class: 'pj-c', text: p.year || '' }),
          h('span', { class: 'pj-c', text: TYPE_LABEL[t] }));
      }
      return h('div', { ...common, class: common.class + ' pj-tile' },
        h('span', { class: 'pj-frame' }, thumbEl(p, 96, 72), h('span', { class: 'pj-badge', html: iconSVG(TYPE_ICON[t], 16) })),
        h('span', { class: 'pj-meta' },
          h('span', { class: 'pj-name', text: p.title }),
          h('span', { class: 'pj-sub', text: [p.category || 'Other', p.year].filter(Boolean).join(' · ') }),
          h('span', { class: 'pj-sub', text: TYPE_LABEL[t] })));
    }
    function render() {
      tools.btns.back.disabled = !back.length;
      tools.btns.fwd.disabled = !fwd.length;
      tools.btns.up.disabled = loc === null;
      tools.btns.back.setIcon(back.length ? 'back' : 'backOff');
      tools.btns.fwd.setIcon(fwd.length ? 'forward' : 'forwardOff');
      addr.set(locLabel(), loc ? 'folderOpen' : 'folder');
      ctx.setTitle(loc || 'My Projects');
      main.textContent = '';
      main.classList.toggle('pj-listmode', view === 'list');
      if (!loaded) { main.append(h('p', { class: 'pj-empty', text: 'Loading projects...' })); renderSide(); return; }
      const list = shown();
      if (!list.find((p) => p.id === selId)) selId = null;
      if (!list.length) {
        main.append(h('p', { class: 'pj-empty', text: query ? `No projects match "${query.trim()}".` : 'This folder is empty.' }));
      } else if (view === 'list') {
        main.append(h('div', { class: 'pj-head', role: 'presentation' },
          ...['Name', 'Category', 'Year', 'Type'].map((c) => h('span', { class: 'pj-c', text: c }))));
        [...groups(list).values()].flat().forEach((p) => main.append(itemEl(p)));
      } else {
        for (const [cat, items] of groups(list)) {
          const head = loc === null
            ? h('button', { class: 'pj-group', type: 'button', title: `Open the ${cat} folder` }, h('span', { text: cat }), h('span', { class: 'pj-count', text: `(${items.length})` }))
            : h('div', { class: 'pj-group static' }, h('span', { text: cat }));
          if (loc === null) head.addEventListener('click', () => go(cat));
          main.append(head, h('div', { class: 'pj-tiles' }, items.map(itemEl)));
        }
      }
      status.set(0, selId ? '1 object selected' : `${list.length} ${plural(list.length, 'object', 'objects')}`);
      status.set(1, query ? 'Search results' : (loc ? loc : 'My Projects'));
      renderSide();
    }
    function renderSide() {
      const p = sel();
      const t = p ? detectType(p) : null;
      boxTasks.setItems([
        { icon: 'open', label: p ? `Open "${p.title}"` : 'Open project', disabled: !p, action: () => openSel() },
        view === 'tiles' ? { icon: 'list', label: 'View as list', action: () => setView('list') } : { icon: 'tiles', label: 'View as tiles', action: () => setView('tiles') },
        { icon: 'search', label: searchRow.hidden ? 'Search projects' : 'Close search', action: () => toggleSearch() },
        loc ? { icon: 'up', label: 'Show all projects', action: () => go(null) } : null,
      ].filter(Boolean));
      const body = h('div', { class: 'pj-details' });
      if (p) {
        body.append(
          h('b', { class: 'pj-d-title', text: p.title }),
          h('span', { class: 'pj-d-line', text: [p.category, p.year].filter(Boolean).join(' · ') }),
          p.description ? h('p', { class: 'pj-d-desc', text: p.description }) : null,
          h('span', { class: 'pj-d-line dim', text: `${TYPE_LABEL[t]}. ${OPENS_IN[t]}.` }));
      } else {
        const n = loaded ? shown().length : 0;
        body.append(
          h('b', { class: 'pj-d-title', text: loc || 'My Projects' }),
          h('span', { class: 'pj-d-line', text: loaded ? `${n} ${plural(n, 'project', 'projects')}` : 'Loading...' }),
          h('p', { class: 'pj-d-desc', text: 'Select a project to see its details. Double-click to open it.' }));
      }
      boxDetails.setBody(body);
    }

    // ---------------------------------------------------------------- selection + keyboard
    function select(id, scroll = true) {
      selId = id;
      main.querySelectorAll('.pj-item').forEach((el) => {
        const on = el.dataset.id === id;
        el.classList.toggle('sel', on); el.setAttribute('aria-selected', String(on));
        if (on) { main.setAttribute('aria-activedescendant', 'pj-' + id); el.id = 'pj-' + id; if (scroll) el.scrollIntoView({ block: 'nearest' }); }
      });
      const p = sel();
      status.set(0, p ? '1 object selected' : `${shown().length} objects`);
      renderSide();
    }
    function openSel() { const p = sel(); if (p) { ctx.sound && ctx.sound('open'); openProject(ctx, p); } }

    let lastTap = { id: null, t: 0 };
    bag.on(main, 'click', (e) => {
      const it = e.target.closest('.pj-item');
      if (!it) { if (e.target === main || e.target.classList.contains('pj-tiles')) select(null, false); return; }
      const id = it.dataset.id;
      // touch: a second tap on the selected item opens it
      if (ctx.isMobile && selId === id && performance.now() - lastTap.t > 250) { select(id, false); openSel(); return; }
      lastTap = { id, t: performance.now() };
      select(id, false);
    });
    bag.on(main, 'dblclick', (e) => { const it = e.target.closest('.pj-item'); if (it) { select(it.dataset.id, false); openSel(); } });
    bag.on(main, 'keydown', (e) => {
      const items = [...main.querySelectorAll('.pj-item')];
      if (!items.length) return;
      const idx = items.findIndex((el) => el.dataset.id === selId);
      const cur = items[idx];
      let next = null;
      if (e.key === 'Enter') { e.preventDefault(); openSel(); return; }
      if (e.key === 'ArrowRight') next = items[Math.min(items.length - 1, idx + 1)];
      else if (e.key === 'ArrowLeft') next = items[Math.max(0, idx - 1)];
      else if (e.key === 'Home') next = items[0];
      else if (e.key === 'End') next = items[items.length - 1];
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!cur) next = items[0];
        else {
          const down = e.key === 'ArrowDown';
          const r = cur.getBoundingClientRect();
          const cands = items.filter((el) => { const q = el.getBoundingClientRect(); return down ? q.top > r.top + 4 : q.top < r.top - 4; });
          if (cands.length) {
            const row = down ? Math.min(...cands.map((el) => el.getBoundingClientRect().top)) : Math.max(...cands.map((el) => el.getBoundingClientRect().top));
            const inRow = cands.filter((el) => Math.abs(el.getBoundingClientRect().top - row) < 4);
            next = inRow.reduce((a, b) => (Math.abs(b.getBoundingClientRect().left - r.left) < Math.abs(a.getBoundingClientRect().left - r.left) ? b : a));
          }
        }
      } else if (e.key === 'Backspace') { e.preventDefault(); go(null); return; }
      if (next) { e.preventDefault(); select(next.dataset.id); }
    });
    bag.on(main, 'focus', () => { if (!selId && main.matches(':focus-visible')) { const f = main.querySelector('.pj-item'); if (f) select(f.dataset.id); } });
    bag.on(main, 'contextmenu', (e) => {
      const it = e.target.closest('.pj-item');
      e.preventDefault();
      if (it) {
        select(it.dataset.id, false);
        popupMenu(root, { x: e.clientX, y: e.clientY }, [{ label: 'Open', bold: true, action: () => openSel() }, { sep: true }, { label: 'Properties', action: () => props() }]);
      } else {
        popupMenu(root, { x: e.clientX, y: e.clientY }, [
          { label: 'Tiles', checked: view === 'tiles', action: () => setView('tiles') },
          { label: 'List', checked: view === 'list', action: () => setView('list') },
          { sep: true }, { label: 'Refresh', action: () => render() },
        ]);
      }
    });
    function props() {
      const p = sel(); if (!p) return;
      const t = detectType(p);
      msgbox(root, { title: `${p.title} Properties`, icon: null, text: `${p.title}\n\nType: ${TYPE_LABEL[t]}\nCategory: ${p.category || 'Other'}\nYear: ${p.year || '-'}\n\n${p.description || ''}` });
    }
    bag.on(root, 'keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleSearch(true); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goFwd(); }
      else if (e.key === 'F5') { e.preventDefault(); render(); }
    });

    // ---------------------------------------------------------------- data
    let alive = true;
    render();
    ctx.site.then((site) => {
      if (!alive) return;
      all = visibleProjects(site);
      loaded = true;
      if (ctx.args && ctx.args.category && all.some((p) => p.category === ctx.args.category)) loc = ctx.args.category;
      render();
    }).catch(() => { loaded = true; render(); status.set(0, 'Could not load projects'); });

    return {
      unmount() { alive = false; bag.dispose(); },
      onFocus() {},
    };
  },
};
