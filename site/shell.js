// Kayzee XP shell (core): boot -> login -> desktop, taskbar, Start menu, tray, context menus, balloon tips,
// and the small programs core owns (Welcome dialog, Games folder, error box, Display Properties).
import { APPS } from './apps/index.js';
import { iconCanvas } from './lib/icons.js';
import { paintLogo, paintAvatar } from './lib/boot.js';

const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const NAMES = {
  about: 'About Me', resume: 'My Resume', projects: 'My Projects', music: 'My Music', contact: 'Contact Me',
  games: 'Games', recycle: 'Recycle Bin', notepad: 'Notepad', paint: 'Paint', browser: 'Kayzee Explorer',
  media: 'Media Player', mines: 'Mines', solitaire: 'Solitaire', pinball: 'Pinball',
};

export function createShell(stage, wm) {
  const S = stage.sound;
  const mobile = !!stage.mobile;
  let desktopCb = null;

  // ================================================================== core programs
  wm.register({
    id: 'welcome', title: 'Welcome to Kayzee XP', icon: 'about', size: 'auto', position: 'hero', dialog: true,
    resizable: false, maximizable: true, single: true,
    mount(root, ctx) {
      root.innerHTML = `<div class="body">
        <div class="msg">
          <span class="bigicon"></span>
          <div class="msgtext">
            <p class="lead">Hi, I'm Kshitiz — PR, content &amp; brand storytelling.<br>Want to see my résumé?</p>
            <p class="role"><b>Kshitiz Mittal</b> ("Kayzee")<br>PR &amp; Communications · Content &amp; Social Media · Brand Storytelling</p>
          </div>
        </div>
        <div class="row">
          <label class="chk" role="checkbox" tabindex="0"><span class="box"></span>Show this at startup</label>
          <div class="btns">
            <button class="xpbtn default hover" id="btn-resume">Open résumé</button>
            <button class="xpbtn" id="btn-projects">Show me projects</button>
          </div>
        </div>
      </div>`;
      root.querySelector('.bigicon').appendChild(iconCanvas('resume', 3, { shadow: true, bevel: true }));
      const chk = root.querySelector('.chk');
      const sync = () => { const on = store.get('kz.welcome', '1') !== '0'; chk.classList.toggle('off', !on); chk.setAttribute('aria-checked', String(on)); };
      sync();
      const toggle = () => { store.set('kz.welcome', store.get('kz.welcome', '1') === '0' ? '1' : '0'); sync(); ctx.sound('click'); };
      chk.addEventListener('click', toggle);
      chk.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
      const btnR = root.querySelector('#btn-resume');
      // the hero frame shows the button hovered under the 3D cursor; real hover takes over on the first pointer move
      const unhover = () => { btnR.classList.remove('hover'); removeEventListener('pointermove', unhover); };
      addEventListener('pointermove', unhover);
      btnR.addEventListener('click', () => ctx.openApp('resume'));
      root.querySelector('#btn-projects').addEventListener('click', () => ctx.openApp('projects'));
      return { unmount() { removeEventListener('pointermove', unhover); } };
    },
  });

  wm.register({
    id: 'error', title: 'Kayzee XP', icon: 'error', size: 'auto', width: 430, dialog: true, resizable: false,
    noMaximize: true, noMinimize: true, single: false,
    mount(root, ctx) {
      const a = ctx.args || {};
      root.innerHTML = `<div class="kz-dialog">
        <div class="kz-dialog-msg"><span class="kz-dialog-ico"></span><div><p>${esc(a.message || 'Something went wrong.')}</p>${a.detail ? `<p class="kz-dialog-detail">${esc(a.detail)}</p>` : ''}</div></div>
        <div class="kz-dialog-btns"><button class="xp-btn default" type="button">OK</button></div></div>`;
      root.querySelector('.kz-dialog-ico').appendChild(iconCanvas('error', 2, { shadow: true }));
      const ok = root.querySelector('button');
      ok.addEventListener('click', () => ctx.close());
      setTimeout(() => ok.focus({ preventScroll: true }), 60);
    },
  });

  // Run box: type a program name, or one of a few secrets
  function runCommand(raw) {
    const x = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!x) return false;
    const alias = { cv: 'resume', 'my resume': 'resume', work: 'projects', portfolio: 'projects', 'my projects': 'projects', spotify: 'music', play: 'games',
                    email: 'contact', mail: 'contact', sign: 'guestbook', me: 'about', kayzee: 'about', bin: 'recycle', draw: 'paint', notes: 'notepad' };
    const id = alias[x] || x;
    if (x === 'hire' || x === 'hire me' || x === 'hire kayzee') { openApp('contact'); setTimeout(() => balloon('Excellent choice', 'The form is open. Say hello.'), 500); return true; }
    if (APPS.includes(id) || GAMES.some((g) => g.id === id) || id === 'games' || id === 'welcome') { if (id !== 'browser' && id !== 'media') { openApp(id); return true; } }
    if (x === 'help' || x === '?') { balloon('Things to try', 'hire · cv · work · games · music · guestbook · coffee · night · sunset · day · time · sudo'); return true; }
    if (x === 'coffee') { balloon('Coffee', "Brewing… out of beans. Type 'hire' and I will buy my own."); return true; }
    if (x === 'hello' || x === 'hi' || x === 'hey') { balloon('Hello!', 'Thanks for looking around. The guestbook is in the Start menu.'); return true; }
    if (x === 'time' || x === 'date') { balloon('Right now', new Date().toLocaleString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + '. A fine time to schedule an interview.'); return true; }
    if (x === 'day' || x === 'sunset' || x === 'night') { stage.setTimeOfDay(x); return true; }
    if (x.startsWith('sudo')) { wm.showError('Access is denied.', 'Nice try. Only Kayzee has admin rights here.'); return true; }
    if (x === 'logoff' || x === 'log off') { logOff(); return true; }
    if (x === 'shutdown' || x === 'exit') { turnOff(); return true; }
    wm.showError(`Kayzee XP cannot find '${raw.trim().slice(0, 40)}'. Make sure you typed the name correctly, and then try again.`, "Type 'help' to see what works.");
    return false;
  }
  wm.register({
    id: 'run', title: 'Run', icon: 'folder', size: 'auto', width: 380, dialog: true, resizable: false, noMaximize: true, noMinimize: true, single: true,
    mount(root, ctx) {
      root.innerHTML = `<div class="kz-dialog">
        <div class="kz-dialog-msg"><span class="kz-dialog-ico"></span><div><p>Type the name of a program, a folder, or a secret, and Kayzee XP will open it for you.</p></div></div>
        <form style="display:flex;gap:8px;align-items:center;margin-top:14px"><label for="kz-run-in">Open:</label><input id="kz-run-in" class="xp-input" style="flex:1;min-width:0" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="try: help"></form>
        <div class="kz-dialog-btns" style="justify-content:flex-end"><button class="xp-btn default" type="button" data-a="ok">OK</button><button class="xp-btn" type="button" data-a="cancel">Cancel</button></div></div>`;
      root.querySelector('.kz-dialog-ico').appendChild(iconCanvas('folder', 2, { shadow: true }));
      const input = root.querySelector('input');
      const go = () => { const v = input.value; if (!v.trim()) return; ctx.sound('click'); ctx.close(); runCommand(v); };
      root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); go(); });
      root.querySelector('[data-a=ok]').addEventListener('click', go);
      root.querySelector('[data-a=cancel]').addEventListener('click', () => ctx.close());
      setTimeout(() => input.focus({ preventScroll: true }), 80);
    },
  });
  // the old cheat code, typed on the desktop
  {
    const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let buf = [];
    addEventListener('keydown', (e) => {
      if (!desktopOn || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable) { buf = []; return; }
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); buf = buf.slice(-CODE.length);
      if (CODE.every((k, i) => buf[i] === k)) { buf = []; S.play('ding'); balloon('Cheat enabled', 'Recruiter mode: résumé opened, coffee refilled.', () => openApp('contact')); openApp('resume'); }
    });
  }

  const GAMES = [
    { id: 'mines', name: 'Mines', desc: 'Clear the field without stepping on a mine.' },
    { id: 'solitaire', name: 'Solitaire', desc: 'The classic patience card game.' },
    { id: 'pinball', name: 'Pinball', desc: 'Flippers, bumpers and one silver ball.' },
    { id: 'snake', name: 'Grass Snake', desc: 'Eat apples, grow longer, mind the fence.' },
    { id: 'inbox', name: 'Inbox Zero', desc: 'Break through a wall of unread email.' },
    { id: 'reversi', name: 'Reversi', desc: 'Flip discs and out-think the computer.' },
    { id: 'typer', name: 'Headline Rush', desc: 'Type the falling headlines before deadline.' },
  ];
  wm.register({
    id: 'games', title: 'Games', icon: 'games', size: [600, 360], minSize: [360, 220], statusBar: true, single: true,
    mount(root, ctx) {
      root.classList.add('kz-explorer');
      root.innerHTML = `
        <div class="xp-toolbar">
          <button class="xp-tool" disabled><span class="kz-arrow back"></span>Back</button>
          <button class="xp-tool" disabled><span class="kz-arrow fwd"></span></button>
          <span class="xp-sep"></span>
          <button class="xp-tool" data-act="up" title="Up to the desktop"><span class="kz-up"></span>Up</button>
        </div>
        <div class="xp-addressbar"><span class="xp-addr-label">Address</span><div class="xp-addr-field"><span class="ai"></span><input value="Desktop › Games" readonly aria-label="Address"></div></div>
        <div class="kz-ex-main">
          <aside class="xp-sidepane xp-scroll">
            <div class="xp-sidepane-box special"><h3>Game Tasks</h3><div class="xp-sidepane-body links"></div></div>
            <div class="xp-sidepane-box"><h3>Other Places</h3><div class="xp-sidepane-body places"></div></div>
            <div class="xp-sidepane-box"><h3>Details</h3><div class="xp-sidepane-body"><p><b>Games</b></p><p>File Folder</p><p>${GAMES.length} games, all original.</p></div></div>
          </aside>
          <div class="kz-ex-view xp-scroll" role="listbox" aria-label="Games"></div>
        </div>`;
      root.querySelector('.kz-up').appendChild(ctx.icon('folder', 24));
      root.querySelector('.ai').appendChild(ctx.icon('games', 16));
      root.querySelector('[data-act="up"]').addEventListener('click', () => ctx.close());
      const links = root.querySelector('.links'), places = root.querySelector('.places'), view = root.querySelector('.kz-ex-view');
      let sel = null;
      const status = () => ctx.setStatus(sel ? GAMES.find((g) => g.id === sel).desc : `${GAMES.length} objects`);
      GAMES.forEach((g) => {
        const a = h('button', 'xp-link'); a.type = 'button'; a.append(ctx.icon(g.id, 16), document.createTextNode(`Play ${g.name}`));
        a.addEventListener('click', () => ctx.openApp(g.id));
        links.appendChild(a);
        const it = h('button', 'kz-ex-item'); it.type = 'button'; it.setAttribute('role', 'option'); it.dataset.id = g.id;
        it.append(ctx.icon(g.id, 40), h('span', 'kz-ex-label', g.name));
        it.addEventListener('click', () => { sel = g.id; view.querySelectorAll('.kz-ex-item').forEach((x) => x.classList.toggle('sel', x === it)); status(); });
        it.addEventListener('dblclick', () => ctx.openApp(g.id));
        it.addEventListener('keydown', (e) => { if (e.key === 'Enter') ctx.openApp(g.id); });
        if (mobile) it.addEventListener('click', () => { if (it.dataset.armed) ctx.openApp(g.id); it.dataset.armed = '1'; });
        view.appendChild(it);
      });
      [['projects', 'My Projects'], ['music', 'My Music'], ['recycle', 'Recycle Bin']].forEach(([id, n]) => {
        const a = h('button', 'xp-link'); a.type = 'button'; a.append(ctx.icon(id, 16), document.createTextNode(n));
        a.addEventListener('click', () => ctx.openApp(id)); places.appendChild(a);
      });
      view.addEventListener('pointerdown', (e) => { if (e.target === view) { sel = null; view.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); status(); } });
      status();
    },
  });

  wm.register({
    id: 'display', title: 'Display Properties', icon: 'about', size: 'auto', width: 380, dialog: true, resizable: false,
    noMaximize: true, single: true,
    mount(root, ctx) {
      const fx = effects.get();
      const cur = stage.getTimeOfDay();
      root.innerHTML = `<div class="kz-dialog kz-props">
        <fieldset class="xp-groupbox"><legend>Time of day</legend>
          <div class="tod-row">
            ${[['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']].map(([v, l]) => `<label class="tod-opt"><span class="tod-sw tod-${v}"></span><span class="xp-check"><input type="radio" name="tod" value="${v}" ${cur === v ? 'checked' : ''}>${l}</span></label>`).join('')}
          </div>
        </fieldset>
        <fieldset class="xp-groupbox"><legend>Effects</legend>
          <label class="xp-check"><input type="checkbox" name="grain" ${fx.grain ? 'checked' : ''}>Film grain</label><br>
          <label class="xp-check" style="margin-top:6px"><input type="checkbox" name="crt" ${fx.crt ? 'checked' : ''}>CRT scan lines</label>
        </fieldset>
        <div class="kz-dialog-btns"><button class="xp-btn default" data-b="ok">OK</button><button class="xp-btn" data-b="cancel">Cancel</button><button class="xp-btn" data-b="apply">Apply</button></div>
      </div>`;
      const apply = () => {
        const v = root.querySelector('input[name=tod]:checked');
        if (v) stage.setTimeOfDay(v.value);
        effects.set({ grain: root.querySelector('[name=grain]').checked, crt: root.querySelector('[name=crt]').checked });
      };
      root.querySelector('[data-b=ok]').addEventListener('click', () => { apply(); ctx.close(); });
      root.querySelector('[data-b=cancel]').addEventListener('click', () => ctx.close());
      root.querySelector('[data-b=apply]').addEventListener('click', apply);
    },
  });

  // ================================================================== effects (persisted)
  const effects = {
    get() { try { return { grain: true, crt: false, ...JSON.parse(store.get('kz.fx', '{}')) }; } catch (_) { return { grain: true, crt: false }; } },
    set(v) { const n = { ...effects.get(), ...v }; store.set('kz.fx', JSON.stringify(n)); stage.setEffects(n); syncFx(); },
  };
  stage.setEffects(effects.get());

  // ================================================================== menus (Start menu, context menus, flyouts)
  const openMenus = [];
  function closeMenus(depth = 0) {
    while (openMenus.length > depth) { const m = openMenus.pop(); m.el.remove(); m.onClose && m.onClose(); }
  }
  // items: { label, icon, bold, action, submenu: [...], radio, checked, disabled } | 'sep'
  function menu(items, x, y, { depth = 0, anchor = null, onClose } = {}) {
    closeMenus(depth);
    const el = h('div', 'kz-menu kz-ctx');
    el.setAttribute('role', 'menu');
    items.forEach((it) => {
      if (it === 'sep') { el.appendChild(h('div', 'kz-ctx-sep')); return; }
      const b = h('button', 'kz-ctx-item' + (it.bold ? ' bold' : '') + (it.submenu ? ' has-sub' : ''));
      b.type = 'button'; b.setAttribute('role', it.radio ? 'menuitemradio' : 'menuitem');
      if (it.disabled) b.disabled = true;
      const mark = h('span', 'kz-ctx-mark' + (it.checked ? (it.radio ? ' radio' : ' check') : ''));
      if (it.icon) mark.appendChild(stage.icon(it.icon, 16));
      b.append(mark, h('span', 'kz-ctx-label', it.label));
      if (it.radio) b.setAttribute('aria-checked', String(!!it.checked));
      if (it.submenu) {
        const open = () => { const r = b.getBoundingClientRect(); menu(it.submenu, r.right - 3, r.top - 3, { depth: depth + 1, anchor: b }); };
        b.addEventListener('pointerenter', () => { if (!mobile) open(); });
        b.addEventListener('click', (e) => { e.stopPropagation(); open(); });
      } else {
        b.addEventListener('pointerenter', () => closeMenus(depth + 1));
        b.addEventListener('click', (e) => { e.stopPropagation(); S.play('click'); closeMenus(0); it.action && it.action(); });
      }
      el.appendChild(b);
    });
    document.body.appendChild(el);
    const r = el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight - 40;
    let px = x, py = y;
    if (px + r.width > W) px = anchor ? anchor.getBoundingClientRect().left - r.width + 3 : W - r.width - 2;
    if (py + r.height > H) py = Math.max(2, H - r.height);
    el.style.left = Math.max(0, Math.round(px)) + 'px'; el.style.top = Math.round(py) + 'px';
    openMenus.push({ el, onClose });
    const first = el.querySelector('.kz-ctx-item:not(:disabled)');
    if (first && depth === 0 && !mobile) first.focus({ preventScroll: true });
    el.addEventListener('keydown', (e) => {
      const list = [...el.querySelectorAll('.kz-ctx-item:not(:disabled)')];
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'ArrowRight' && document.activeElement.classList.contains('has-sub')) document.activeElement.click();
      else if (e.key === 'ArrowLeft' && depth > 0) { closeMenus(depth); anchor && anchor.focus(); }
    });
    return el;
  }
  addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.kz-menu, #start')) return;
    closeMenus(0); closeStart();
  }, true);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (openMenus.length) { closeMenus(0); }
    if (startOpen) closeStart(true);
    closePopups();
  });

  // ================================================================== taskbar
  const bar = document.getElementById('taskbar');
  bar.innerHTML = `
    <button id="start" type="button" aria-haspopup="menu" aria-expanded="false"><span class="sicon"></span><span>start</span></button>
    <div class="tasks" role="list"></div>
    <div class="tray">
      <button class="tico" type="button" data-t="tod" aria-label="Time of day"></button>
      <button class="tico" type="button" data-t="fx" aria-label="Visual effects"></button>
      <button class="tico" type="button" data-t="net" aria-label="Network"></button>
      <button class="tico" type="button" data-t="vol" aria-label="Volume"></button>
      <span class="clock" tabindex="0"></span>
    </div>`;
  bar.querySelector('.sicon').appendChild(iconCanvas('sun', 2, { shadow: true }));
  const trayIcon = (k, key) => bar.querySelector(`[data-t="${k}"]`).appendChild(iconCanvas(key, 2, { shadow: false }));
  trayIcon('fx', 'fx'); trayIcon('net', 'net'); trayIcon('vol', 'speaker');
  const tasks = bar.querySelector('.tasks');
  const taskBtns = new Map();
  function syncTask(win) {
    const b = taskBtns.get(win);
    if (!b) return;
    b.querySelector('.tt').textContent = win.title;
    b.title = win.title;
    b.classList.toggle('active', wm.active() === win && win.shown);
    b.setAttribute('aria-pressed', String(wm.active() === win && win.shown));
  }
  wm.on('open', (win) => {
    if (win.id === 'error') return; // XP shows message boxes without their own button: keep the bar tidy
    const b = h('button', 'task');
    b.type = 'button'; b.setAttribute('role', 'listitem');
    const ic = h('span', 'ticon16'); ic.appendChild(iconCanvas(win.def.icon || win.id, 2, { shadow: true }));
    b.append(ic, h('span', 'tt', win.title));
    b.addEventListener('click', () => {
      S.play('click');
      if (!win.shown) win.restore();
      else if (wm.active() === win) win.minimize();
      else wm.focus(win);
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      menu([
        { label: 'Restore', disabled: win.shown && win.state !== 'max', action: () => (win.shown ? win.unmaximize() : win.restore()) },
        { label: 'Minimise', disabled: !win.shown || win.def.noMinimize, action: () => win.minimize() },
        { label: 'Maximise', disabled: win.state === 'max' || !win.canMax, action: () => { win.shown || win.restore(); win.maximize(); } },
        'sep',
        { label: 'Close', bold: true, action: () => win.close() },
      ], e.clientX, e.clientY - 120);
    });
    tasks.appendChild(b);
    taskBtns.set(win, b);
    syncAll();
  });
  wm.on('closing', (win) => { const b = taskBtns.get(win); if (b) { b.remove(); taskBtns.delete(win); } });
  wm.on('close', (win) => { const b = taskBtns.get(win); if (b) { b.remove(); taskBtns.delete(win); } });
  const syncAll = () => taskBtns.forEach((_, w) => syncTask(w));
  wm.on('focus', syncAll); wm.on('title', syncTask); wm.on('state', syncAll);
  wm.setTaskRect((win) => { const b = taskBtns.get(win); return b ? b.getBoundingClientRect() : null; });

  // clock
  const clock = bar.querySelector('.clock');
  const tickClock = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    clock.title = d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    setTimeout(tickClock, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20);
  };
  tickClock();

  // ================================================================== tray: popovers + tooltips
  const popups = new Set();
  function closePopups(except) { popups.forEach((p) => { if (p !== except) { p.el.remove(); popups.delete(p); p.btn.classList.remove('on'); } }); }
  function popup(btn, build) {
    const was = [...popups].find((p) => p.btn === btn);
    closePopups();
    if (was) return;
    const el = h('div', 'kz-popup');
    build(el);
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect(), pr = el.getBoundingClientRect();
    el.style.left = Math.round(Math.min(innerWidth - pr.width - 4, Math.max(4, r.left + r.width / 2 - pr.width / 2))) + 'px';
    el.style.bottom = (innerHeight - r.top + 6) + 'px';
    btn.classList.add('on');
    popups.add({ el, btn });
  }
  addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('.kz-popup, .tray .tico'))) closePopups(); }, true);
  const volBtn = bar.querySelector('[data-t="vol"]');
  volBtn.addEventListener('click', () => popup(volBtn, (el) => {
    el.classList.add('kz-volume');
    el.innerHTML = `<div class="vol-title">Volume</div>
      <div class="vol-track"><input type="range" min="0" max="100" step="1" aria-label="Volume" class="vol-range"></div>
      <label class="xp-check vol-mute"><input type="checkbox">Mute</label>`;
    const r = el.querySelector('.vol-range'), m = el.querySelector('input[type=checkbox]');
    r.value = Math.round(S.getVolume() * 100); m.checked = S.isMuted();
    r.addEventListener('input', () => S.setVolume(r.value / 100));
    r.addEventListener('change', () => S.play('ding'));
    m.addEventListener('change', () => { S.setMuted(m.checked); if (!m.checked) S.play('click'); });
  }));
  const syncVol = () => volBtn.classList.toggle('muted', S.isMuted() || S.getVolume() === 0);
  S.onChange(syncVol); syncVol();
  const todBtn = bar.querySelector('[data-t="tod"]');
  const TOD_ICON = { day: 'sun', sunset: 'sunset', night: 'moon' };
  const TOD_NAME = { day: 'Day', sunset: 'Sunset', night: 'Night' };
  function syncTod(name = stage.getTimeOfDay ? stage.getTimeOfDay() : 'day') {
    todBtn.replaceChildren(iconCanvas(TOD_ICON[name] || 'sun', 2, { shadow: false }));
    syncChooser();
  }
  (stage.todListeners || (stage.todListeners = [])).push(syncTod);
  todBtn.addEventListener('click', () => popup(todBtn, (el) => {
    el.classList.add('kz-fxpop');
    const cur = stage.getTimeOfDay();
    el.innerHTML = `<div class="vol-title">Time of day</div>` + ['day', 'sunset', 'night'].map((v) =>
      `<label class="xp-check tod-radio"><input type="radio" name="tod-tray" value="${v}" ${cur === v ? 'checked' : ''}><span class="tp-ico"></span>${TOD_NAME[v]}</label>`).join('');
    el.querySelectorAll('.tod-radio').forEach((l, i) => l.querySelector('.tp-ico').appendChild(iconCanvas(TOD_ICON[['day', 'sunset', 'night'][i]], 1, { shadow: false })));
    el.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { S.play('click'); stage.setTimeOfDay(i.value); }));
  }));
  const fxBtn = bar.querySelector('[data-t="fx"]');
  function syncFx() { const f = effects.get(); fxBtn.classList.toggle('dim', !f.grain && !f.crt); }
  syncFx();
  fxBtn.addEventListener('click', () => popup(fxBtn, (el) => {
    el.classList.add('kz-fxpop');
    const f = effects.get();
    el.innerHTML = `<div class="vol-title">Visual effects</div>
      <label class="xp-check"><input type="checkbox" name="grain" ${f.grain ? 'checked' : ''}>Film grain</label>
      <label class="xp-check"><input type="checkbox" name="crt" ${f.crt ? 'checked' : ''}>CRT scan lines</label>`;
    el.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { S.play('click'); effects.set({ [i.name]: i.checked }); }));
  }));
  // tooltips (XP yellow)
  let tipEl = null, tipT = 0;
  function tip(target, text) {
    target.addEventListener('pointerenter', () => {
      clearTimeout(tipT);
      tipT = setTimeout(() => {
        tipEl && tipEl.remove();
        tipEl = h('div', 'kz-tip'); tipEl.textContent = typeof text === 'function' ? text() : text;
        document.body.appendChild(tipEl);
        const r = target.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
        tipEl.style.left = Math.round(Math.min(innerWidth - tr.width - 4, Math.max(4, r.left + r.width / 2 - tr.width / 2))) + 'px';
        tipEl.style.top = Math.round(r.top - tr.height - 6) + 'px';
      }, 450);
    });
    const hide = () => { clearTimeout(tipT); tipEl && tipEl.remove(); tipEl = null; };
    target.addEventListener('pointerleave', hide); target.addEventListener('pointerdown', hide);
  }
  tip(bar.querySelector('[data-t="net"]'), 'Kayzee Net is connected\nSpeed: 56 kbps of pure nostalgia\nSignal: excellent, weather permitting');
  tip(volBtn, () => (S.isMuted() ? 'Volume: muted' : `Volume: ${Math.round(S.getVolume() * 100)}%`));
  tip(fxBtn, 'Visual effects: film grain and CRT scan lines');
  tip(todBtn, () => `Time of day: ${TOD_NAME[stage.getTimeOfDay()] || 'Day'}`);
  tip(clock, () => clock.title);
  bar.querySelector('[data-t="net"]').addEventListener('click', () => S.play('ding'));

  // ================================================================== Start menu
  const startBtn = bar.querySelector('#start');
  let startEl = null, startOpen = false;
  function buildStart() {
    const el = h('div', 'kz-menu kz-start');
    el.setAttribute('role', 'menu');
    el.innerHTML = `
      <div class="sm-head"><span class="sm-pic"></span><span class="sm-name">Kshitiz Mittal</span></div>
      <div class="sm-cols">
        <div class="sm-left"></div>
        <div class="sm-right"></div>
      </div>
      <div class="sm-foot">
        <button type="button" class="sm-off" data-a="logoff"><span></span>Log Off</button>
        <button type="button" class="sm-off" data-a="turnoff"><span></span>Turn Off</button>
      </div>`;
    const pic = el.querySelector('.sm-pic'); paintAvatar(pic, 3);
    const left = el.querySelector('.sm-left'), right = el.querySelector('.sm-right');
    const item = (parent, id, label, sub, big, iconKey) => {
      const b = h('button', 'sm-item' + (big ? ' big' : ''));
      b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.app = id;
      b.appendChild(stage.icon(iconKey || id, big ? 32 : 24));
      const t = h('span', 'sm-text'); t.appendChild(h('span', 'sm-label', label));
      if (sub) t.appendChild(h('span', 'sm-sub', sub));
      b.appendChild(t);
      b.addEventListener('click', () => { const r = b.getBoundingClientRect(); closeStart(); openApp(id, undefined, { fromRect: r }); });
      parent.appendChild(b);
      return b;
    };
    item(left, 'projects', 'My Projects', 'Campaigns, shoots and brands', true);
    item(left, 'resume', 'My Resume', 'Experience, skills, education', true);
    item(left, 'contact', 'Contact Me', 'Send me a message', true);
    item(left, 'music', 'My Music', 'What I play while I edit', true);
    item(right, 'about', 'About Me');
    const g = item(right, 'games', 'Games');
    g.classList.add('has-sub');
    g.replaceWith(g.cloneNode(true));
    const games = right.querySelector('[data-app="games"]');
    const openGames = () => {
      const r = games.getBoundingClientRect();
      const m = menu(GAMES.map((x) => ({ label: x.name, icon: x.id, action: () => openApp(x.id, undefined, { fromRect: r }) })).concat(['sep', { label: 'Open Games folder', icon: 'folder', action: () => openApp('games', undefined, { fromRect: r }) }]),
        mobile ? r.left + 20 : r.right - 2, mobile ? r.bottom - 4 : r.top, { depth: 0, anchor: games });
      m.classList.add('sm-fly');
    };
    games.addEventListener('pointerenter', () => { if (!mobile) openGames(); });
    games.addEventListener('click', (e) => { e.stopPropagation(); openGames(); });
    right.appendChild(h('div', 'sm-sep'));
    item(right, 'paint', 'Paint');
    item(right, 'notepad', 'Notepad');
    item(right, 'guestbook', 'Guestbook', undefined, false, 'notepad');
    right.appendChild(h('div', 'sm-sep'));
    item(right, 'recycle', 'Recycle Bin');
    item(right, 'run', 'Run...', undefined, false, 'folder');
    right.querySelectorAll('.sm-item:not(.has-sub)').forEach((b) => b.addEventListener('pointerenter', () => closeMenus(0)));
    const [lo, to] = el.querySelectorAll('.sm-off span');
    lo.appendChild(iconCanvas('logoff', 2, { shadow: false })); to.appendChild(iconCanvas('power', 2, { shadow: false }));
    el.querySelector('[data-a=logoff]').addEventListener('click', () => { closeStart(); logOff(); });
    el.querySelector('[data-a=turnoff]').addEventListener('click', () => { closeStart(); turnOff(); });
    el.addEventListener('keydown', (e) => {
      const list = [...el.querySelectorAll('.sm-item, .sm-off')];
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    });
    return el;
  }
  function openStart() {
    if (startOpen) return;
    closePopups(); closeMenus(0);
    if (!startEl) startEl = buildStart();
    document.body.appendChild(startEl);
    startOpen = true;
    startBtn.classList.add('open'); startBtn.setAttribute('aria-expanded', 'true');
    S.play('click');
    if (!mobile) startEl.querySelector('.sm-item').focus({ preventScroll: true });
  }
  function closeStart(refocus) {
    if (!startOpen) return;
    startOpen = false;
    startEl.remove(); closeMenus(0);
    startBtn.classList.remove('open'); startBtn.setAttribute('aria-expanded', 'false');
    if (refocus) startBtn.focus({ preventScroll: true });
  }
  startBtn.addEventListener('click', () => (startOpen ? closeStart() : openStart()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.ctrlKey && desktopOn) { e.preventDefault(); startOpen ? closeStart() : openStart(); } });

  // when the site runs on the CRT in the room page (same origin), tell the room what happens and take its requests
  const framed = (() => { try { return window.parent !== window && window.parent.location.origin === location.origin; } catch (_) { return false; } })();
  function tellParent(m) { if (framed) { try { window.parent.postMessage(m, location.origin); } catch (_) { /* not our parent */ } } }
  function openApp(id, args, opts = {}) {
    closeBalloon();
    tellParent({ kz: 'app', id: id === 'browser' && args && args.projectId ? 'project:' + args.projectId : id });
    return wm.open(id, args, opts);
  }
  addEventListener('message', (e) => {
    const d = e.data;
    if (e.origin !== location.origin || !d || d.kz !== 'open' || typeof d.id !== 'string' || !desktopOn) return;
    if (!APPS.includes(d.id) && !['games', 'welcome'].includes(d.id)) return;
    openApp(d.id, d.args || undefined);
    if (d.id === 'music' && d.args && d.args.shuffle) setTimeout(() => dispatchEvent(new CustomEvent('kz-music-shuffle')), 300);
  });

  // ================================================================== desktop hooks
  stage.handlers.openIcon = (app, from) => openApp(app, undefined, { from });
  stage.handlers.desktopClick = () => { closeMenus(0); closeStart(); closePopups(); };
  stage.handlers.desktopMenu = (x, y) => {
    const tod = stage.getTimeOfDay();
    menu([
      { label: 'Arrange Icons', action: () => stage.arrangeIcons && stage.arrangeIcons() },
      { label: 'Refresh', action: () => stage.refreshDesktop && stage.refreshDesktop() },
      'sep',
      { label: 'Time of Day', submenu: [['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']].map(([v, l]) => ({ label: l, radio: true, checked: tod === v, action: () => stage.setTimeOfDay(v) })) },
      'sep',
      { label: 'Properties', action: () => openApp('display') },
    ], x, y);
  };
  stage.handlers.iconMenu = (app, x, y, open) => {
    menu([{ label: 'Open', bold: true, action: open }, 'sep', { label: 'Properties', action: () => openApp('display') }], x, y);
  };

  // ================================================================== balloon tip
  let balloonEl = null, balloonT = 0;
  function closeBalloon() { clearTimeout(balloonT); if (balloonEl) { balloonEl.remove(); balloonEl = null; } }
  function balloon(title, text, onClick) {
    closeBalloon();
    const el = h('div', 'kz-balloon'); el.setAttribute('role', 'status');
    const head = h('div', 'bl-head'); const ic = h('span', 'bl-ico'); ic.appendChild(iconCanvas('info', 1, { shadow: false }));
    const x = h('button', 'bl-x'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    head.append(ic, h('b', null, title), x);
    el.append(head, h('div', 'bl-text', text));
    x.addEventListener('click', (e) => { e.stopPropagation(); closeBalloon(); });
    el.addEventListener('click', () => { closeBalloon(); onClick && onClick(); });
    document.body.appendChild(el);
    const tray = bar.querySelector('.tray').getBoundingClientRect();
    el.style.right = Math.max(6, Math.round(innerWidth - (tray.left + 60))) + 'px';
    balloonEl = el;
    S.play('balloon');
    balloonT = setTimeout(closeBalloon, 12000);
  }

  // ================================================================== screens: boot / login / shutdown / direct
  const boot = document.getElementById('kz-boot');
  const login = document.getElementById('kz-login');
  const direct = document.getElementById('kz-direct');
  let desktopOn = false;
  const showScreen = (el) => { el.classList.add('on'); el.classList.remove('fade'); };
  const hideScreen = (el, fade) => new Promise((res) => {
    if (!el.classList.contains('on') && !document.documentElement.classList.contains('kz-mode-' + el.id.slice(3))) return res();
    if (!fade) { el.classList.remove('on', 'fade'); document.documentElement.classList.remove('kz-mode-' + el.id.slice(3)); return res(); }
    el.classList.add('on', 'fade');
    document.documentElement.classList.remove('kz-mode-' + el.id.slice(3));
    setTimeout(() => { el.classList.remove('on', 'fade'); res(); }, 620);
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const html = document.documentElement;
  const welcomeScr = document.getElementById('kz-welcome');
  // boot: ~6.5 s like an old laptop, ~1 s of black, then the Welcome (login) screen. Click / any key skips.
  async function runBoot() {
    html.classList.remove('kz-mode-login', 'kz-mode-direct');
    html.classList.add('kz-wait');
    boot.classList.remove('dark');
    showScreen(boot);
    const first = !runBoot.ran; runBoot.ran = true;
    const BOOT_MS = 6500;
    const left = first ? BOOT_MS - performance.now() : BOOT_MS; // the first boot also covered the download
    const ac = new AbortController();
    const skipped = await new Promise((res) => {
      if (window.__kzSkip) return res(true);
      addEventListener('pointerdown', () => res(true), { signal: ac.signal });
      addEventListener('keydown', () => res(true), { signal: ac.signal });
      setTimeout(() => res(false), Math.max(600, left));
    });
    ac.abort();
    window.__kzSkip = false;
    store.set('kz.seen', '1');
    if (!skipped) { boot.classList.add('dark'); await sleep(1000); }
    login.classList.add('fade-in');
    showScreen(login);
    await hideScreen(boot, skipped);
    setTimeout(() => login.classList.remove('fade-in'), 500);
    await runLogin();
  }
  function syncChooser() {
    const cur = stage.getTimeOfDay ? stage.getTimeOfDay() : 'day';
    document.querySelectorAll('.tod-pick').forEach((b) => { const on = b.dataset.tod === cur; b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); b.tabIndex = on ? 0 : -1; });
  }
  document.querySelectorAll('.tod-pick').forEach((b, i, all) => {
    b.addEventListener('click', () => { S.unlock(); S.play('click'); stage.setTimeOfDay(b.dataset.tod); syncChooser(); });
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault(); const n = all[(i + d + all.length) % all.length]; n.focus(); n.click();
    });
  });
  function runLogin() {
    return new Promise((res) => {
      showScreen(login);
      html.classList.remove('kz-mode-boot', 'kz-wait');
      syncChooser();
      const tile = document.getElementById('kz-user');
      tile.focus({ preventScroll: true });
      const go = async () => {
        tile.removeEventListener('click', go);
        tile.classList.add('busy');
        S.unlock();
        S.play('startup');
        // XP-style "welcome" while the personal settings load (hourglass), then the desktop
        html.classList.add('kz-wait');
        welcomeScr.classList.add('fade-in');
        showScreen(welcomeScr);
        await sleep(350);
        hideScreen(login, false);
        tile.classList.remove('busy');
        await sleep(1150);
        desktopCb.showDesktop();
        enterDesktop();
        html.classList.remove('kz-wait');
        welcomeScr.classList.remove('fade-in');
        await hideScreen(welcomeScr, true);
        res();
      };
      tile.addEventListener('click', go);
      const off = document.getElementById('kz-login-off');
      off.onclick = () => { tile.removeEventListener('click', go); turnOff(true); };
    });
  }
  let balloonShown = false;
  function enterDesktop({ deep } = {}) {
    desktopOn = true;
    bar.classList.add('on');
    document.documentElement.classList.add('kz-desktop');
    if (!deep && store.get('kz.welcome', '1') !== '0' && !wm.list().some((w) => w.id === 'welcome')) wm.openInternal('welcome', { silent: true });
    if (!deep && !balloonShown) {
      balloonShown = true;
      setTimeout(() => {
        if (!desktopOn) return;
        balloon('Welcome to Kayzee XP', mobile ? 'Tap My Resume twice to see my CV.' : 'Double-click My Resume to see my CV.', () => openApp('resume'));
      }, 1600);
    }
  }
  function leaveDesktop() {
    desktopOn = false;
    closeStart(); closeMenus(0); closePopups(); closeBalloon();
    wm.closeAll();
    bar.classList.remove('on');
    document.documentElement.classList.remove('kz-desktop');
  }
  async function logOff() {
    S.play('close');
    showScreen(login);
    login.classList.add('fade-in');
    await sleep(450);
    login.classList.remove('fade-in');
    leaveDesktop();
    desktopCb.hideDesktop();
    await runLogin();
  }
  async function turnOff(fromLogin) {
    S.play('shutdown');
    let scr = document.getElementById('kz-off');
    if (!scr) {
      scr = h('div', 'kz-screen'); scr.id = 'kz-off';
      scr.innerHTML = `<div class="off-saving"><div class="kz-logo small"></div><div class="wordmark"><span class="wm-name">Kayzee</span><span class="wm-xp">xp</span></div><p>Kayzee XP is shutting down…</p></div>
        <div class="off-safe"><p>It's now safe to close this tab.</p><button class="xp-btn" type="button">Restart</button></div>`;
      document.body.appendChild(scr);
      paintLogo(scr.querySelector('.kz-logo'), 4);
      scr.querySelector('button').addEventListener('click', async () => {
        scr.classList.remove('on', 'safe');
        await runBoot();
      });
    }
    scr.classList.remove('safe');
    showScreen(scr);
    if (!fromLogin) { leaveDesktop(); }
    desktopCb.hideDesktop();
    login.classList.remove('on');
    document.documentElement.classList.remove('kz-mode-login');
    await sleep(1700);
    scr.classList.add('safe');
    scr.querySelector('button').focus({ preventScroll: true });
  }

  // deep links: /?open=<id> or /?open=project:<id>
  function deepLinkTarget() {
    const v = params.get('open');
    if (!v) return null;
    const m = /^project:(.+)$/.exec(v);
    if (m) return { id: 'browser', args: { projectId: m[1] } };
    const id = v.toLowerCase();
    return { id, args: id === 'music' && params.has('shuffle') ? { shuffle: true } : undefined };
  }

  return {
    async start(cb) {
      desktopCb = cb;
      const mode = window.__kzMode || 'boot';
      if (mode === 'direct') {
        const target = deepLinkTarget();
        cb.showDesktop();
        store.set('kz.seen', '1');
        enterDesktop({ deep: !!target });
        html.classList.remove('kz-wait');
        await hideScreen(direct, true);
        tellParent({ kz: 'ready' });
        if (target) {
          if (!APPS.includes(target.id) && !['games', 'welcome', 'display', 'run'].includes(target.id)) wm.showError(`Kayzee XP cannot find '${target.id}'. Make sure you typed the name correctly, and then try again.`, 'Check the link you followed.');
          else openApp(target.id, target.args);
        }
        return;
      }
      if (mode === 'login') { await runLogin(); return; }
      await runBoot();
    },
    menu, balloon, openStart, closeStart, logOff, turnOff,
  };
}
