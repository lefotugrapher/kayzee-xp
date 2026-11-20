// Kayzee Explorer: a period web browser that shows project pages in an iframe behind a fake address.
// The real embed URL is never shown in the UI: the address bar and status bar only ever show kayzee.xp URLs.
import {
  h, setupRoot, menubar, toolbar, statusbar, addressbar, msgbox, popupMenu, iconSVG,
  embedSrc, fakeUrl, visibleProjects, detectType, openProject, thumbEl,
} from './projects.kit.js';

const HOME_URL = 'http://www.kayzee.xp/';
const LOAD_TIMEOUT = 15000;

function parseAddress(raw, projects) {
  let s = String(raw || '').trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (s === 'kayzee.xp' || s === 'kayzee.xp/projects' || s === 'kayzee.xp/index.html' || s === 'home' || s === 'about:home') return { kind: 'home' };
  const m = s.match(/^kayzee\.xp\/projects\/([a-z0-9._-]+)$/);
  if (m && projects.some((p) => p.id === m[1])) return { kind: 'project', id: m[1] };
  return { kind: 'error', address: String(raw || '').trim() };
}

export default {
  id: 'browser',
  title: 'Kayzee Explorer',
  icon: 'browser',
  size: [880, 600],
  minSize: [420, 300],
  single: false,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let projects = [];
    let loaded = false;
    const hist = []; let hi = -1;   // history entries + index
    let loading = false; let loadTimer = 0;
    let frame = null;

    // ---------------------------------------------------------------- chrome
    const menus = menubar([
      { label: '&File', items: [
        { label: '&New Window', shortcut: 'Ctrl+N', action: () => ctx.openApp('browser', {}) },
        { sep: true },
        { label: '&Close', action: () => ctx.close() },
      ] },
      { label: '&Edit', items: [
        { label: '&Copy Address', action: () => copyAddress() },
        { label: '&Find on This Page...', disabled: true },
      ] },
      { label: '&View', items: [
        { label: '&Stop', shortcut: 'Esc', disabled: () => !loading, action: () => stop() },
        { label: '&Refresh', shortcut: 'F5', action: () => refresh() },
        { sep: true },
        { label: 'Status &Bar', checked: () => !status.hidden, action: () => { status.hidden = !status.hidden; } },
      ] },
      { label: 'F&avorites', items: [
        { label: 'Projects home', action: () => nav({ kind: 'home' }) },
        { sep: true },
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({
          get label() { return projects[i] ? projects[i].title : ''; },
          hidden: () => !projects[i],
          action: () => projects[i] && openFromHere(projects[i]),
        })),
      ] },
      { label: '&Tools', items: [
        { label: 'Internet &Options...', action: () => msgbox(root, { title: 'Internet Options', icon: 'info32', text: 'Your connection to kayzee.xp is excellent.\nNo settings needed.' }) },
      ] },
      { label: '&Help', items: [
        { label: '&About Kayzee Explorer', action: () => msgbox(root, { title: 'About Kayzee Explorer', icon: 'info32', text: 'Kayzee Explorer, version 1.0\n\nBrowses the projects on www.kayzee.xp.\nThe rest of the internet is out of office today.' }) },
      ] },
    ], { logo: false });
    const throbber = h('span', { class: 'br-throbber', 'aria-hidden': 'true', html: throbberSVG() });
    menus.append(throbber);

    const tools = toolbar([
      { id: 'back', icon: 'back', label: 'Back', title: 'Back', action: () => go(-1) },
      { id: 'backList', cls: 'br-drop', title: 'Recent pages', arrow: true, action: () => histMenu(-1) },
      { id: 'fwd', icon: 'forward', title: 'Forward', action: () => go(1) },
      { id: 'fwdList', cls: 'br-drop', title: 'Next pages', arrow: true, action: () => histMenu(1) },
      { id: 'stop', icon: 'stop', title: 'Stop', action: () => stop() },
      { id: 'refresh', icon: 'refresh', title: 'Refresh', action: () => refresh() },
      { id: 'home', icon: 'home', title: 'Home', action: () => nav({ kind: 'home' }) },
      '|',
      { id: 'projects', icon: 'folder', label: 'My Projects', action: () => ctx.openApp('projects') },
    ]);
    const addr = addressbar({ icon: 'web', value: HOME_URL, editable: true, onGo: (v) => goAddress(v) });
    const view = h('div', { class: 'br-view' });
    const zone = h('span', { class: 'br-zone' });
    const prog = h('span', { class: 'br-prog', hidden: true }, h('span'));
    const status = statusbar([{ text: 'Done', flex: true }, { node: prog, width: 116 }, { node: zone, width: 150 }]);
    root.append(menus, tools, addr, view, status);

    // ---------------------------------------------------------------- history
    const cur = () => hist[hi] || null;
    const projectOf = (e) => (e && e.kind === 'project' ? projects.find((p) => p.id === e.id) : null);
    function urlOf(e) {
      if (!e) return HOME_URL;
      if (e.kind === 'project') return fakeUrl(e.id);
      if (e.kind === 'error') return e.address;
      return HOME_URL;
    }
    function titleOf(e) {
      if (!e) return 'Projects home';
      if (e.kind === 'project') return projectOf(e)?.title || 'Project';
      if (e.kind === 'error') return 'Cannot find server';
      return 'Projects home';
    }
    function nav(e, push = true) {
      if (push) { hist.splice(hi + 1); hist.push(e); hi = hist.length - 1; }
      show(e);
    }
    function go(d) { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; show(hist[hi]); }
    function histMenu(dir) {
      const items = [];
      if (dir < 0) for (let i = hi - 1; i >= 0 && items.length < 9; i--) items.push({ i });
      else for (let i = hi + 1; i < hist.length && items.length < 9; i++) items.push({ i });
      if (!items.length) return;
      popupMenu(root, dir < 0 ? tools.btns.backList : tools.btns.fwdList, items.map(({ i }) => ({ label: titleOf(hist[i]), action: () => { hi = i; show(hist[i]); } })));
    }
    function goAddress(v) {
      if (!v) return;
      const e = parseAddress(v, projects);
      if (e.kind === 'project') {
        const p = projectOf(e);
        if (p && detectType(p) !== 'page') { openProject(ctx, p); addr.set(urlOf(cur())); return; }
      }
      nav(e);
    }
    function openFromHere(p) {
      if (detectType(p) !== 'page') { openProject(ctx, p); return; }
      nav({ kind: 'project', id: p.id });
    }
    function refresh() { const e = cur(); if (e) show(e); }
    function stop() {
      if (!loading) return;
      finishLoading(true);
      if (frame && !frame._loaded) { // nothing arrived yet: show the stopped page
        frame.remove(); frame = null;
        view.append(stoppedPage());
      }
    }
    function copyAddress() {
      const u = urlOf(cur());
      if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => setStatus('Address copied')).catch(() => {});
    }

    // ---------------------------------------------------------------- loading state
    function setStatus(t) { status.set(0, t); }
    function startLoading(u) {
      loading = true;
      root.classList.add('br-loading');
      prog.hidden = false;
      setStatus(`Opening page ${u}...`);
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => finishLoading(), LOAD_TIMEOUT);
      updateButtons();
    }
    function finishLoading(stopped = false) {
      loading = false;
      clearTimeout(loadTimer);
      root.classList.remove('br-loading');
      prog.hidden = true;
      view.querySelector('.br-loader')?.remove();
      setStatus(stopped ? 'Stopped' : 'Done');
      updateButtons();
    }
    function updateButtons() {
      const canB = hi > 0, canF = hi < hist.length - 1;
      tools.btns.back.disabled = !canB; tools.btns.backList.disabled = !canB;
      tools.btns.fwd.disabled = !canF; tools.btns.fwdList.disabled = !canF;
      tools.btns.back.setIcon(canB ? 'back' : 'backOff');
      tools.btns.fwd.setIcon(canF ? 'forward' : 'forwardOff');
      tools.btns.stop.disabled = !loading;
    }
    function setZone(internet) {
      zone.innerHTML = internet ? `${iconSVG('globe', 16)}<span>Internet</span>` : `${iconSVG('computer', 16)}<span>Kayzee XP</span>`;
    }

    // ---------------------------------------------------------------- pages
    function show(e) {
      finishLoading();
      if (frame) { frame.remove(); frame = null; }
      view.textContent = '';
      addr.set(urlOf(e), e.kind === 'project' ? 'web' : 'computer');
      ctx.setTitle(`${titleOf(e)} - Kayzee Explorer`);
      if (e.kind === 'project') {
        const p = projectOf(e);
        if (!p) { view.append(errorPage(urlOf(e))); setZone(false); setStatus('Done'); updateButtons(); return; }
        setZone(true);
        const src = embedSrc(p.url);
        frame = h('iframe', {
          class: 'xp-iframe br-frame', title: p.title, src,
          allow: 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write',
          allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', loading: 'eager',
        });
        frame._loaded = false;
        frame.addEventListener('load', () => { if (frame) frame._loaded = true; finishLoading(); });
        view.append(frame, loaderEl(p));
        startLoading(urlOf(e));
      } else if (e.kind === 'error') {
        setZone(false);
        flashLoad(() => view.append(errorPage(e.address)));
      } else {
        setZone(false);
        flashLoad(() => view.append(homePage()));
      }
      updateButtons();
    }
    // in-app pages "load" for a beat so the throbber feels alive
    function flashLoad(render) {
      startLoading(urlOf(cur()));
      render();
      loadTimer = setTimeout(() => finishLoading(), 280);
    }
    function loaderEl(p) {
      return h('div', { class: 'br-loader' },
        h('div', { class: 'br-loader-card' },
          h('span', { class: 'br-loader-globe', html: throbberSVG() }),
          h('div', {}, h('b', { text: `Opening ${p.title}` }), h('span', { text: fakeUrl(p.id) }))));
    }
    function link(text, onClick, statusText) {
      const a = h('a', { href: '#', class: 'br-link', text });
      a.addEventListener('click', (ev) => { ev.preventDefault(); onClick(); });
      a.addEventListener('mouseenter', () => setStatus(statusText));
      a.addEventListener('mouseleave', () => setStatus(loading ? status.parts[0].textContent : 'Done'));
      a.addEventListener('focus', () => setStatus(statusText));
      return a;
    }
    function homePage() {
      const list = projects;
      const page = h('div', { class: 'br-page br-home' });
      page.append(
        h('header', { class: 'br-home-head' },
          h('div', { class: 'br-home-mark', html: throbberSVG() }),
          h('div', {}, h('h1', { text: 'Projects home' }), h('p', { text: 'Campaign, event and brand work by Kshitiz Mittal. Pick a project to open it here.' }))));
      const grid = h('div', { class: 'br-cards' });
      if (!loaded) grid.append(h('p', { class: 'br-muted', text: 'Loading projects...' }));
      else if (!list.length) grid.append(h('p', { class: 'br-muted', text: 'No projects are published yet. Check back soon.' }));
      for (const p of list) {
        const t = detectType(p);
        const card = h('article', { class: 'br-card' });
        const open = () => openFromHere(p);
        const th = h('button', { class: 'br-card-thumb', type: 'button', 'aria-label': `Open ${p.title}` }, thumbEl(p, 132, 99));
        th.addEventListener('click', open);
        th.addEventListener('mouseenter', () => setStatus(fakeUrl(p.id)));
        th.addEventListener('mouseleave', () => setStatus('Done'));
        card.append(th, h('div', { class: 'br-card-body' },
          h('h2', {}, link(p.title, open, fakeUrl(p.id))),
          h('p', { class: 'br-card-meta', text: [p.category, p.year, t === 'page' ? null : (t === 'video' ? 'Video' : 'Picture')].filter(Boolean).join(' · ') }),
          p.description ? h('p', { class: 'br-card-desc', text: p.description }) : null));
        grid.append(card);
      }
      page.append(h('h2', { class: 'br-sec', text: 'Featured projects' }), grid,
        h('h2', { class: 'br-sec', text: 'Elsewhere on this desktop' }),
        h('p', { class: 'br-quick' },
          link('My Resume', () => ctx.openApp('resume'), 'Open My Resume'), ' · ',
          link('About Me', () => ctx.openApp('about'), 'Open About Me'), ' · ',
          link('Contact Me', () => ctx.openApp('contact'), 'Open Mail')),
        h('footer', { class: 'br-foot', text: 'www.kayzee.xp · Best viewed with Kayzee Explorer at any resolution' }));
      return page;
    }
    function errorPage(address) {
      const page = h('div', { class: 'br-page br-error' });
      page.append(
        h('div', { class: 'br-err-head' }, h('span', { class: 'br-err-ico', html: errorPageIcon() }), h('h1', { text: 'This page cannot be displayed' })),
        h('p', { text: 'The page you asked for isn\'t on the kayzee.xp network. Kayzee Explorer can only show pages on www.kayzee.xp.' }),
        h('p', { class: 'br-err-addr' }, h('span', { text: 'Address: ' }), h('code', { text: address || '(blank)' })),
        h('hr'),
        h('p', { text: 'Please try the following:' }),
        h('ul', {},
          h('li', {}, 'Click the ', link('Home', () => nav({ kind: 'home' }), HOME_URL), ' button to see every project.'),
          h('li', {}, 'Check the address for typing mistakes. Project pages look like ', h('code', { text: 'www.kayzee.xp/projects/…' }), '.'),
          h('li', {}, 'Click the ', link('Back', () => go(-1), 'Go back'), ' button to try another link.'),
          h('li', {}, 'Looking for the person behind all this? Try ', link('Contact Me', () => ctx.openApp('contact'), 'Open Mail'), '.')),
        h('p', { class: 'br-err-small', text: 'Cannot find server · Kayzee Explorer' }));
      return page;
    }
    function stoppedPage() {
      const page = h('div', { class: 'br-page br-error' });
      page.append(
        h('div', { class: 'br-err-head' }, h('span', { class: 'br-err-ico', html: iconSVG('stop', 32) }), h('h1', { text: 'Navigation was stopped' })),
        h('p', {}, 'The page didn\'t finish loading. ', link('Refresh', () => refresh(), 'Refresh this page'), ' to try again.'));
      return page;
    }

    // ---------------------------------------------------------------- keys
    bag.on(root, 'keydown', (e) => {
      if (e.key === 'Escape' && loading) { e.preventDefault(); stop(); }
      else if (e.key === 'F5') { e.preventDefault(); refresh(); }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.altKey && e.key === 'Home') { e.preventDefault(); nav({ kind: 'home' }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); addr.input.focus(); addr.input.select(); }
    });

    // ---------------------------------------------------------------- start
    let alive = true;
    const first = ctx.args && ctx.args.projectId ? { kind: 'project', id: ctx.args.projectId } : { kind: 'home' };
    updateButtons();
    setZone(false);
    hist.push(first); hi = 0;
    if (first.kind === 'home') show(first);
    else { addr.set(fakeUrl(first.id), 'web'); startLoading(fakeUrl(first.id)); }
    ctx.site.then((site) => {
      if (!alive) return;
      projects = visibleProjects(site);
      loaded = true;
      show(cur());
    }).catch(() => { loaded = true; if (alive) show(cur()); });

    return {
      unmount() { alive = false; clearTimeout(loadTimer); bag.dispose(); },
      onArgs(a) { if (a && a.projectId) nav({ kind: 'project', id: a.projectId }); },
    };
  },
};

// Original animated throbber: a voxel globe with an orbiting comet (animates while .br-loading).
let svgId = 0;
function throbberSVG() {
  const u = 'brg' + (++svgId);
  return `<svg viewBox="0 0 32 32" width="30" height="30" class="br-throb-svg">
    <defs><radialGradient id="${u}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#c8ecff"/><stop offset=".55" stop-color="#3c8fe0"/><stop offset="1" stop-color="#174f9e"/></radialGradient></defs>
    <circle cx="16" cy="16" r="10" fill="url(#${u})" stroke="#123f80" stroke-width=".9"/>
    <g fill="#55b83c" stroke="#2a7a20" stroke-width=".5">
      <rect x="9" y="10" width="4" height="3"/><rect x="11" y="13" width="3" height="3"/><rect x="17" y="9" width="4" height="2.6"/>
      <rect x="16" y="17" width="5" height="3"/><rect x="18" y="20" width="2.6" height="2.4"/><rect x="8" y="17" width="3" height="2.4"/>
    </g>
    <ellipse cx="13" cy="11" rx="5" ry="2.6" fill="#fff" opacity=".35"/>
    <g class="br-orbit"><ellipse cx="16" cy="16" rx="14.4" ry="5.4" fill="none" stroke="#ffcf2e" stroke-width="1.1" stroke-dasharray="2 2.2" opacity=".85" transform="rotate(-24 16 16)"/>
    <circle cx="29" cy="10.6" r="2.2" fill="#ffcf2e" stroke="#c48a00" stroke-width=".6"/></g>
  </svg>`;
}
function errorPageIcon() {
  const u = 'bre' + (++svgId);
  return `<svg viewBox="0 0 40 40" width="40" height="40"><defs><linearGradient id="${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe4ec"/></linearGradient></defs>
    <path d="M7 3h18l8 8v25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="url(#${u})" stroke="#6d7a8f"/><path d="M25 3v7a1 1 0 0 0 1 1h7" fill="#dfe6f2" stroke="#6d7a8f"/>
    <path d="M11 15h14M11 19h12M11 23h9" stroke="#9aa6bb" stroke-width="1.2"/>
    <circle cx="27" cy="28" r="8.4" fill="#e3461f" stroke="#a52a0c"/><path d="M23.6 24.6l6.8 6.8M30.4 24.6l-6.8 6.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}
