// Kayzee XP Control Panel (admin). Plain ES module, no framework.
import { normalizeUrl, toEmbedUrl, detectType, providerName, slugify, spotifyPlaylistId, youtubeId } from './embed.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
};
const FAKE_HOST = 'http://www.kayzee.xp/projects/';

// ------------------------------------------------------------------ sprites (from the site's voxel icon set)
let SPR = null;
async function loadSprites() {
  try {
    const S = await import('/sprites.js');
    const lib = {
      folder: S.buildFolder?.(), doc: S.buildDoc?.(), monitor: S.buildMonitor?.(), about: S.buildMonitor?.(),
      sun: S.buildSun?.(), net: S.buildNet?.(), cd: S.buildCD?.(), envelope: S.buildEnvelope?.(),
    };
    SPR = { lib, sprite2D: S.sprite2D };
  } catch { SPR = null; }
  paintSprites(document);
}
function icon(key, scale = 2) {
  if (!SPR || !SPR.lib[key] || !SPR.sprite2D) return null;
  try { return SPR.sprite2D(SPR.lib[key], scale, { shadow: true, bevel: scale >= 3 }); } catch { return null; }
}
function paintSprites(root) {
  for (const n of $$('[data-sprite]', root)) {
    if (n.firstChild) continue;
    const c = icon(n.dataset.sprite, n.dataset.px ? 3 : 2);
    if (c) n.append(c);
  }
}

// ------------------------------------------------------------------ api
async function api(path, opts = {}) {
  const init = { credentials: 'same-origin', headers: { Accept: 'application/json' }, ...opts };
  if (opts.json !== undefined) {
    init.method = init.method || 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.json);
    delete init.json;
  }
  let r;
  try { r = await fetch(path, init); }
  catch { return { status: 0, data: { error: 'network' } }; }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data: data || {} };
}

// ------------------------------------------------------------------ state
let site = null;          // working copy
let savedJson = '';       // JSON of the last saved/loaded copy
let lastSaved = null;
const isDirty = () => site && JSON.stringify(site) !== savedJson;

function markDirty() {
  const d = isDirty();
  $('#btn-save').disabled = !d;
  $('#cp-title').textContent = d ? 'Control Panel (unsaved changes)' : 'Control Panel';
  document.title = (d ? '* ' : '') + 'Control Panel · Kayzee XP';
  renderStatus();
}

function renderStatus() {
  if (!site) return;
  const n = site.projects.length, vis = site.projects.filter((p) => p.visible !== false).length;
  $('#status').textContent = `${n} project${n === 1 ? '' : 's'}, ${vis} shown on the site`;
  $('#status-right').textContent = isDirty() ? 'Unsaved changes' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Up to date';
  $('#sp-details').innerHTML = '';
  $('#sp-details').append(
    el('b', {}, 'Kayzee XP'), el('br'),
    `${n} project${n === 1 ? '' : 's'} (${n - vis} hidden)`, el('br'),
    isDirty() ? el('span', { style: 'color:#a2400e' }, 'You have unsaved changes.') : 'All changes saved.',
  );
}

// ------------------------------------------------------------------ message box
function msgbox({ title = 'Kayzee XP', text = '', list = null, kind = 'warn', buttons = [{ label: 'OK', value: true, def: true }] }) {
  const modal = $('#mb-modal');
  $('#mb-title').textContent = title;
  const ic = $('#mb-icon');
  ic.className = 'mb-icon ' + (kind === 'error' ? 'err' : kind === 'info' ? 'info' : '');
  ic.textContent = kind === 'error' ? '×' : kind === 'info' ? 'i' : '!';
  const body = $('#mb-text');
  body.innerHTML = '';
  body.append(el('div', {}, text));
  if (list && list.length) body.append(el('ul', {}, list.map((t) => el('li', {}, t))));
  const row = $('#mb-btns');
  row.innerHTML = '';
  return new Promise((resolve) => {
    const done = (v) => { modal.hidden = true; document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(buttons.find((b) => b.cancel)?.value ?? false); } };
    for (const b of buttons) row.append(el('button', { class: 'xpbtn' + (b.def ? ' default' : '') + (b.danger ? ' danger' : ''), type: 'button', onclick: () => done(b.value) }, b.label));
    $('[data-mb="cancel"]', modal).onclick = () => done(buttons.find((b) => b.cancel)?.value ?? false);
    document.addEventListener('keydown', onKey, true);
    modal.hidden = false;
    (row.querySelector('.default') || row.firstChild)?.focus();
  });
}
const confirmBox = (text, okLabel = 'Yes', opts = {}) => msgbox({
  text, ...opts,
  buttons: [{ label: okLabel, value: true, def: !opts.danger, danger: opts.danger }, { label: 'No', value: false, cancel: true, def: !!opts.danger }],
});

// ------------------------------------------------------------------ balloon
let balloonT = 0;
function balloon(title, text, isError = false) {
  const b = $('#balloon');
  $('#balloon-title').textContent = title;
  $('#balloon-text').textContent = text;
  b.classList.toggle('error', isError);
  b.hidden = false;
  // Point the balloon's tail at the Save button.
  const tb = $('.toolbar').getBoundingClientRect(), sv = $('#btn-save').getBoundingClientRect();
  const cx = sv.left + sv.width / 2 - tb.left;
  const left = Math.max(8, Math.min(cx - 40, tb.width - b.offsetWidth - 8));
  b.style.left = left + 'px';
  b.style.right = 'auto';
  b.style.setProperty('--ax', Math.max(10, cx - left - 10) + 'px');
  clearTimeout(balloonT);
  balloonT = setTimeout(() => { b.hidden = true; }, isError ? 6000 : 3500);
}
$('#balloon')?.addEventListener('click', () => { $('#balloon').hidden = true; });

// ------------------------------------------------------------------ logon
function showLogon(message = '') {
  $('#cp').hidden = true;
  $('#logon').hidden = false;
  $('#logon-err').textContent = message;
  $('#pw').value = '';
  setTimeout(() => $('#pw').focus(), 30);
}

$('#logon-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ok = $('#logon-ok');
  ok.disabled = true;
  $('#logon-err').textContent = '';
  const { status, data } = await api('/api/admin/login', { json: { password: $('#pw').value } });
  ok.disabled = false;
  if (status === 200) { $('#pw').value = ''; return openPanel(); }
  const msg = status === 401 ? 'The password is incorrect. Please retype your password.'
    : status === 429 ? `Too many attempts. Try again in ${Math.ceil((data.retryAfter || 60) / 60)} minute(s).`
    : status === 503 ? 'Admin is not set up yet: add ADMIN_PASSWORD and SESSION_SECRET to the Vercel environment.'
    : status === 0 ? 'Could not reach the server. Check your connection.'
    : 'Log on failed. Please try again.';
  $('#logon-err').textContent = msg;
  $('#pw').select();
});

async function logoff() {
  if (isDirty() && !(await confirmBox('You have unsaved changes. Log off anyway and lose them?', 'Log off', { title: 'Log Off Kayzee XP' }))) return;
  await api('/api/admin/logout', { method: 'POST', json: {} });
  site = null; savedJson = '';
  markDirty();
  showLogon();
}
$('#btn-logoff').addEventListener('click', logoff);
$('#cap-close').addEventListener('click', logoff);

// ------------------------------------------------------------------ panel
async function openPanel() {
  const { status, data } = await api('/api/admin/site');
  if (status === 401) return showLogon();
  if (status !== 200) return showLogon('Could not load the site data. Please try again.');
  site = normalizeLocal(data);
  savedJson = JSON.stringify(site);
  $('#logon').hidden = true;
  $('#cp').hidden = false;
  fillSettings();
  renderList();
  markDirty();
  refreshTab();
}

function normalizeLocal(d) {
  const s = d.settings || {};
  return {
    settings: {
      displayName: s.displayName || '', nickname: s.nickname || '', role: s.role || '', location: s.location || '',
      about: s.about || '', contactEmail: s.contactEmail || '', linkedin: s.linkedin || '',
      resumePdfUrl: s.resumePdfUrl || '', spotifyPlaylist: s.spotifyPlaylist || '',
      guestbookAuto: s.guestbookAuto === true,
    },
    projects: (d.projects || []).map((p) => ({
      id: p.id || '', title: p.title || '', category: p.category || '', year: p.year || '', description: p.description || '',
      url: p.url || '', type: p.type || 'page', cover: p.cover || '', visible: p.visible !== false,
    })),
  };
}

// tabs
const TABS = ['projects', 'settings', 'links', 'guestbook', 'visits'];
let currentTab = 'projects';
function selectTab(which) {
  if (which !== currentTab) $('#balloon').hidden = true;
  currentTab = which;
  for (const t of TABS) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === which));
    $(`#pane-${t}`).hidden = t !== which;
  }
  $(`#tab-${which}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  refreshTab();
}
// Links, guestbook and visits are live data: reload them every time their tab is shown.
function refreshTab() {
  if (!site) return;
  if (currentTab === 'links') loadLinks();
  else if (currentTab === 'guestbook') loadGuestbook();
  else if (currentTab === 'visits') loadVisits();
}
for (const t of TABS) $(`#tab-${t}`).addEventListener('click', () => selectTab(t));
for (const t of ['settings', 'links', 'guestbook', 'visits']) $(`#sp-${t}`).addEventListener('click', () => selectTab(t));

// ------------------------------------------------------------------ settings form
const SETTINGS_KEYS = ['displayName', 'nickname', 'role', 'location', 'about', 'contactEmail', 'linkedin', 'resumePdfUrl', 'spotifyPlaylist'];
function fillSettings() {
  const f = $('#settings-form');
  for (const k of SETTINGS_KEYS) f.elements[k].value = site.settings[k] || '';
  $('#gb-auto').checked = site.settings.guestbookAuto === true;
  spotifyHint();
}
function spotifyHint() {
  const v = $('#settings-form').elements.spotifyPlaylist.value.trim();
  const id = spotifyPlaylistId(v);
  const h = $('#sp-hint');
  h.textContent = !v ? 'No playlist: the Media Player will use the saved snapshot.' : id ? `Playlist found: ${id}` : 'That does not look like a Spotify playlist link or embed code.';
  h.style.color = v && !id ? '#b0250d' : '';
}
$('#settings-form').addEventListener('input', (e) => {
  const k = e.target.name;
  if (!SETTINGS_KEYS.includes(k)) return;
  site.settings[k] = e.target.value;
  if (k === 'spotifyPlaylist') spotifyHint();
  markDirty();
});
$('#settings-form').addEventListener('submit', (e) => e.preventDefault());

// ------------------------------------------------------------------ project list
function thumbFor(p) {
  const box = el('div', { class: 'thumb', 'aria-hidden': 'true' });
  const fallback = () => { box.innerHTML = ''; const c = icon(p.type === 'video' ? 'cd' : p.type === 'image' ? 'doc' : 'folder'); if (c) box.append(c); };
  let src = p.cover || (p.type === 'image' ? p.url : '');
  const yt = !src && youtubeId(p.url);
  if (yt) src = `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`;
  if (src) {
    const img = el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', style: 'width:100%;height:100%;object-fit:cover' });
    img.addEventListener('error', fallback, { once: true });
    box.append(img);
  } else fallback();
  return box;
}

function renderList() {
  const ul = $('#plist');
  ul.innerHTML = '';
  $('#plist-empty').hidden = site.projects.length > 0;
  ul.hidden = site.projects.length === 0;
  const cats = new Set();
  site.projects.forEach((p, i) => {
    if (p.category) cats.add(p.category);
    const vis = el('input', { type: 'checkbox', 'aria-label': `Show ${p.title} on the site` });
    vis.checked = p.visible !== false;
    vis.addEventListener('change', () => { p.visible = vis.checked; li.classList.toggle('hidden-p', !p.visible); markDirty(); });
    const li = el('li', { class: 'prow' + (p.visible === false ? ' hidden-p' : ''), dataset: { i } },
      el('button', { class: 'grip', type: 'button', title: 'Drag to reorder', 'aria-label': `Reorder ${p.title}` }, '⋮⋮'),
      thumbFor(p),
      el('div', { class: 'p-main' },
        el('div', { class: 'p-title' }, p.title || '(untitled)'),
        el('div', { class: 'p-meta' },
          el('span', { class: 'tag ' + p.type }, p.type),
          [p.category, p.year, providerName(p.url)].filter(Boolean).join(' · ')),
        el('div', { class: 'p-addr' }, FAKE_HOST + p.id)),
      el('label', { class: 'p-vis' }, vis, 'Visible'),
      el('div', { class: 'p-acts' },
        el('button', { class: 'xpbtn small', type: 'button', title: 'Move up', 'aria-label': `Move ${p.title} up`, disabled: i === 0, onclick: () => move(i, i - 1) }, '▲'),
        el('button', { class: 'xpbtn small', type: 'button', title: 'Move down', 'aria-label': `Move ${p.title} down`, disabled: i === site.projects.length - 1, onclick: () => move(i, i + 1) }, '▼'),
        el('button', { class: 'xpbtn small edit', type: 'button', onclick: () => openProject(i) }, 'Edit…'),
        el('button', { class: 'xpbtn small danger', type: 'button', title: 'Delete', 'aria-label': `Delete ${p.title}`, onclick: () => del(i) }, '✕')),
    );
    ul.append(li);
  });
  const dl = $('#cat-list');
  dl.innerHTML = '';
  for (const c of [...cats].sort()) dl.append(el('option', { value: c }));
  renderStatus();
}

function move(from, to) {
  if (to < 0 || to >= site.projects.length || from === to) return;
  const [p] = site.projects.splice(from, 1);
  site.projects.splice(to, 0, p);
  renderList();
  markDirty();
  $$('#plist .prow')[to]?.querySelector(to < from ? '[title="Move up"]' : '[title="Move down"]')?.focus();
}

async function del(i) {
  const p = site.projects[i];
  const ok = await confirmBox(`Are you sure you want to delete "${p.title}"? It disappears from the site when you press Save.`, 'Delete', { title: 'Confirm Project Delete', danger: true });
  if (!ok) return;
  site.projects.splice(i, 1);
  renderList();
  markDirty();
}

// Drag to reorder (pointer events: mouse + touch)
$('#plist').addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('.grip');
  if (!grip || e.button > 0) return;
  e.preventDefault();
  const li = grip.closest('.prow');
  const ul = $('#plist');
  const from = Number(li.dataset.i);
  const startY = e.clientY;
  li.classList.add('dragging');
  grip.setPointerCapture(e.pointerId);
  let to = from;
  const rows = $$('.prow', ul);
  const mids = rows.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
  const h = li.getBoundingClientRect().height;
  const onMove = (ev) => {
    const dy = ev.clientY - startY;
    li.style.transform = `translateY(${dy}px)`;
    const y = mids[from] + dy;
    to = from;
    while (to < rows.length - 1 && y > mids[to + 1]) to++;
    while (to > 0 && y < mids[to - 1]) to--;
    rows.forEach((r, k) => {
      if (k === from) return;
      const shift = from < to && k > from && k <= to ? -h : from > to && k < from && k >= to ? h : 0;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
      r.style.transition = 'transform .12s';
    });
  };
  const onUp = () => {
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    grip.removeEventListener('pointercancel', onUp);
    rows.forEach((r) => { r.style.transform = ''; r.style.transition = ''; });
    li.classList.remove('dragging');
    if (to !== from) move(from, to);
  };
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onUp);
});

// ------------------------------------------------------------------ project dialog
const pdModal = $('#pd-modal');
const pdForm = $('#pd-form');
let pd = { index: -1, slugTouched: false, prefill: {}, lastLookup: '', previewUrl: '' };

function uniqueSlug(base, exceptIndex) {
  const taken = new Set(site.projects.filter((_, k) => k !== exceptIndex).map((p) => p.id));
  let s = base || 'project', n = 2;
  while (taken.has(s)) s = `${base}-${n++}`;
  return s;
}

function openProject(index = -1) {
  const p = index >= 0 ? site.projects[index] : { id: '', title: '', category: '', year: String(new Date().getFullYear()), description: '', url: '', type: '', cover: '', visible: true };
  pd = { index, slugTouched: index >= 0, prefill: {}, lastLookup: index >= 0 ? normalizeUrl(p.url) : '', previewUrl: '' };
  $('#pd-title').textContent = index >= 0 ? `Edit project: ${p.title}` : 'Add project';
  const f = pdForm.elements;
  f.url.value = p.url; f.title.value = p.title; f.category.value = p.category; f.year.value = p.year;
  f.description.value = p.description; f.cover.value = p.cover; f.id.value = p.id;
  f.type.value = index >= 0 ? p.type : ''; f.visible.checked = p.visible !== false;
  $('#pd-err').textContent = '';
  pdModal.hidden = false;
  paintSprites(pdModal);
  updateDetect();
  updateAddr();
  updatePreview(true);
  setTimeout(() => (index >= 0 ? f.title : f.url).focus(), 30);
}
function closeProject(force = false) {
  if (!force && pdModal.hidden) return;
  pdModal.hidden = true;
  $('#pd-pv').innerHTML = '<p class="pv-empty">Preview appears here.</p>';
}
$$('[data-close]', pdModal).forEach((b) => b.addEventListener('click', () => closeProject()));
pdModal.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#mb-modal').hidden) closeProject(); });

function effType() {
  const f = pdForm.elements;
  return f.type.value || detectType(f.url.value);
}
function updateDetect() {
  const raw = pdForm.elements.url.value.trim();
  const d = $('#pd-detect');
  d.classList.remove('warn');
  if (!raw) { d.textContent = ''; return; }
  const u = normalizeUrl(raw);
  if (!u) { d.textContent = 'That is not a link or embed code we can use (it must start with http:// or https://).'; d.classList.add('warn'); return; }
  const fromIframe = /<iframe/i.test(raw);
  const over = pdForm.elements.type.value;
  d.textContent = `${fromIframe ? 'Embed code found. ' : ''}Detected: ${providerName(u)} ${detectType(u)}${over && over !== detectType(u) ? ` (shown as ${over})` : ''}`;
}
function updateAddr() {
  const f = pdForm.elements;
  if (!pd.slugTouched) f.id.value = uniqueSlug(slugify(f.title.value), pd.index);
  $('#pd-addr').textContent = FAKE_HOST + (slugify(f.id.value) || '');
}
function updatePreview(force = false) {
  const f = pdForm.elements;
  const embed = toEmbedUrl(f.url.value);
  const type = effType();
  const key = embed + '|' + type;
  if (!force && key === pd.previewUrl) return;
  pd.previewUrl = key;
  const pv = $('#pd-pv');
  pv.innerHTML = '';
  if (!embed) { pv.append(el('p', { class: 'pv-empty' }, 'Preview appears here.')); return; }
  if (type === 'image') {
    pv.append(el('img', { src: embed, alt: 'Preview', referrerpolicy: 'no-referrer' }));
  } else if (type === 'video' && /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(embed)) {
    pv.append(el('video', { src: embed, controls: true, preload: 'metadata', playsinline: true }));
  } else {
    pv.append(el('iframe', {
      src: embed, title: 'Preview', loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin',
      allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
      sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation',
      allowfullscreen: true,
    }));
  }
}

let lookupT = 0;
async function lookup() {
  const f = pdForm.elements;
  const url = normalizeUrl(f.url.value);
  if (!url || url === pd.lastLookup) return;
  pd.lastLookup = url;
  const d = $('#pd-detect');
  const base = d.textContent;
  d.textContent = base + ' · reading details…';
  const { status, data } = await api('/api/admin/oembed?url=' + encodeURIComponent(url));
  if (normalizeUrl(f.url.value) !== url) return; // user moved on
  updateDetect();
  if (status === 401) { closeProject(true); return showLogon('Your session ended. Please log on again.'); }
  if (status !== 200) return;
  // Prefill only empty fields, or fields that still hold our previous prefill.
  const fill = (name, val) => {
    if (!val) return;
    const cur = f[name].value.trim();
    if (!cur || cur === pd.prefill[name]) { f[name].value = val; pd.prefill[name] = val; }
  };
  fill('title', data.title);
  fill('cover', data.thumbnail);
  fill('description', data.description);
  if (data.warning) { d.textContent += ' · ' + data.warning; d.classList.add('warn'); }
  else if (data.title) d.textContent += ' · details filled in';
  updateAddr();
}

pdForm.addEventListener('input', (e) => {
  const n = e.target.name;
  if (n === 'url') {
    updateDetect();
    updatePreview();
    clearTimeout(lookupT);
    lookupT = setTimeout(lookup, 600);
  } else if (n === 'title') updateAddr();
  else if (n === 'id') { pd.slugTouched = e.target.value.trim() !== ''; updateAddr(); }
});
pdForm.elements.url.addEventListener('paste', () => setTimeout(() => { clearTimeout(lookupT); updateDetect(); updatePreview(); lookup(); }, 0));
pdForm.elements.url.addEventListener('blur', () => {
  const v = pdForm.elements.url.value.trim();
  if (/<iframe/i.test(v)) { const u = normalizeUrl(v); if (u) pdForm.elements.url.value = u; }
});
pdForm.elements.type.addEventListener('change', () => { updateDetect(); updatePreview(); });

pdForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = pdForm.elements;
  const errs = [];
  const url = toEmbedUrl(f.url.value);
  if (!url) errs.push('Paste a link (http/https) or an <iframe> embed code.');
  const title = f.title.value.trim();
  if (!title) errs.push('Give the project a title.');
  const coverRaw = f.cover.value.trim();
  const cover = coverRaw ? normalizeUrl(coverRaw) : '';
  if (coverRaw && !cover) errs.push('The cover image must be an http(s) link.');
  if (errs.length) { $('#pd-err').textContent = errs.join(' '); return; }
  const id = uniqueSlug(slugify(f.id.value) || slugify(title), pd.index);
  const p = {
    id, title, category: f.category.value.trim(), year: f.year.value.trim(), description: f.description.value.trim(),
    url, type: f.type.value || detectType(url), cover, visible: f.visible.checked,
  };
  if (pd.index >= 0) site.projects[pd.index] = p;
  else site.projects.unshift(p);
  closeProject(true);
  selectTab('projects');
  renderList();
  markDirty();
  balloon(pd.index >= 0 ? 'Project updated' : 'Project added', 'Press Save to put it on the site.');
});

$('#btn-add').addEventListener('click', () => openProject(-1));
$('#sp-add').addEventListener('click', () => { selectTab('projects'); openProject(-1); });

// ------------------------------------------------------------------ visitors: shared bits
const dateTime = (ts) => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dateOnly = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Common failures of the live-data calls. Returns true when the call worked. */
function liveOk({ status, data }, errEl) {
  if (errEl) errEl.textContent = '';
  if (status === 200) return true;
  if (status === 401) { isDirty() ? reauth() : showLogon('Your session ended. Please log on again.'); return false; }
  const msg = data.error === 'storage_not_configured' ? 'Storage is not connected yet: add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) to this project.'
    : status === 0 ? 'Could not reach the server. Check your connection.'
    : (data.errors && data.errors.join(' ')) || 'The server could not do that. Try again in a moment.';
  if (errEl) errEl.textContent = msg;
  else msgbox({ title: 'Kayzee XP', text: msg, kind: 'error' });
  return false;
}

// ------------------------------------------------------------------ recruiter links
// The room (the page recruiters land on) lives on its own address in production.
const LINK_ORIGIN = location.hostname === 'kayzee-xp.vercel.app' ? 'https://kayzee-room.vercel.app' : location.origin;
const linkUrl = (slug) => `${LINK_ORIGIN}/hi/${slug}`;
const NOTE_MAX = 26;
const OPEN_FIXED = [['', 'Nothing, just the desktop'], ['resume', 'My Resume'], ['projects', 'My Projects'], ['contact', 'Contact Me'], ['about', 'About Me'], ['music', 'My Music'], ['guestbook', 'Guestbook']];
const lkForm = $('#lk-form');
let links = [];
let linkStats = new Map(); // slug -> { opens, lastTs, zoomed }
let noteTouched = false;

function defaultNote(company) {
  for (const t of [`hi ${company} team :)`, `hi ${company} :)`]) if (t.length <= NOTE_MAX) return t;
  return 'hi there :)';
}
function openLabel(open) {
  const fixed = OPEN_FIXED.find(([v]) => v === open);
  if (fixed) return open ? fixed[1] : '';
  const id = String(open || '').replace(/^project:/, '');
  return site?.projects.find((p) => p.id === id)?.title || id;
}
function fillOpenSelect() {
  const sel = lkForm.elements.open;
  const keep = sel.value;
  sel.innerHTML = '';
  for (const [value, label] of OPEN_FIXED) sel.append(el('option', { value }, label));
  const shown = (site?.projects || []).filter((p) => p.visible !== false && p.id);
  if (shown.length) sel.append(el('optgroup', { label: 'One of my projects' }, shown.map((p) => el('option', { value: `project:${p.id}` }, p.title || p.id))));
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : '';
}
function noteCount() {
  $('#lk-note-n').textContent = `${lkForm.elements.note.value.length} / ${NOTE_MAX}`;
}
lkForm.addEventListener('input', (e) => {
  const f = lkForm.elements;
  if (e.target === f.note) noteTouched = f.note.value.trim() !== '';
  else if (e.target === f.company && !noteTouched) f.note.value = f.company.value.trim() ? defaultNote(f.company.value.trim().replace(/\s+/g, ' ')) : '';
  noteCount();
  $('#lk-err').textContent = '';
});
lkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = lkForm.elements;
  const company = f.company.value.trim();
  if (!company) { $('#lk-err').textContent = 'Type the company name.'; f.company.focus(); return; }
  const btn = $('#lk-create');
  btn.disabled = true;
  const r = await api('/api/admin/visitors?kind=links', { json: { company, note: f.note.value.trim(), open: f.open.value } });
  btn.disabled = false;
  if (!liveOk(r, $('#lk-err'))) return;
  links = r.data.links || [];
  f.company.value = ''; f.note.value = ''; f.open.value = '';
  noteTouched = false;
  noteCount();
  renderLinks();
  const copied = await copyText(linkUrl(r.data.link.slug));
  balloon('Link created', copied ? 'It is on your clipboard, ready to paste.' : 'Press Copy link to grab it.');
});

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const t = el('textarea', { style: 'position:fixed;left:-999px;top:0', readonly: true });
  t.value = text;
  document.body.append(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}

function renderLinks() {
  const ul = $('#lk-list');
  ul.innerHTML = '';
  ul.hidden = links.length === 0;
  $('#lk-empty').hidden = links.length > 0;
  for (const l of links) {
    const st = linkStats.get(l.slug);
    const copy = el('button', { class: 'xpbtn default', type: 'button' }, 'Copy link');
    copy.addEventListener('click', async () => {
      copy.textContent = (await copyText(linkUrl(l.slug))) ? 'Copied' : 'Select it by hand';
      setTimeout(() => { copy.textContent = 'Copy link'; }, 1600);
    });
    const first = openLabel(l.open);
    ul.append(el('li', { class: 'vrow' },
      el('div', { class: 'v-main' },
        el('div', { class: 'v-title' }, l.company),
        el('span', { class: 'v-url' }, linkUrl(l.slug)),
        el('div', { class: 'v-meta' }, [`Sticky note: "${l.note}"`, first ? `Opens first: ${first}` : '', l.created ? `Made ${dateOnly(l.created)}` : ''].filter(Boolean).join(' · '))),
      el('div', { class: 'v-acts' },
        el('span', { class: 'v-stat' + (st ? '' : ' none') }, st ? `Opened ${plural(st.opens, 'time')} · last ${dateTime(st.lastTs)}` : 'Not opened yet'),
        copy,
        el('button', { class: 'xpbtn danger', type: 'button', title: 'Delete', 'aria-label': `Delete the link for ${l.company}`, onclick: () => deleteLink(l) }, '✕')),
    ));
  }
}
async function deleteLink(l) {
  const ok = await confirmBox(`Delete the link for "${l.company}"? Anyone who opens it afterwards gets the normal site with no greeting. Visits already recorded stay in the Visits tab.`, 'Delete', { title: 'Confirm Link Delete', danger: true });
  if (!ok) return;
  const r = await api('/api/admin/visitors?kind=links&slug=' + encodeURIComponent(l.slug), { method: 'DELETE' });
  if (r.status === 404) return loadLinks();
  if (!liveOk(r)) return;
  links = r.data.links || [];
  renderLinks();
}
async function loadLinks() {
  fillOpenSelect();
  noteCount();
  const [a, b] = await Promise.all([api('/api/admin/visitors?kind=links'), api('/api/admin/visitors?kind=visits&summary=1')]);
  if (!liveOk(a, $('#lk-load-err'))) return;
  links = a.data.links || [];
  linkStats = new Map(b.status === 200 ? (b.data.summary?.byLink || []).map((x) => [x.slug, x]) : []);
  renderLinks();
}
$('#lk-refresh').addEventListener('click', loadLinks);

// ------------------------------------------------------------------ guestbook
let gbEntries = [];
const gbState = (e) => (e.ok ? 'shown' : e.hidden ? 'hid' : 'wait');
function renderGuestbook() {
  const ul = $('#gb-list');
  ul.innerHTML = '';
  ul.hidden = gbEntries.length === 0;
  $('#gb-empty').hidden = gbEntries.length > 0;
  const waiting = gbEntries.filter((e) => gbState(e) === 'wait').length;
  const n = $('#tab-guestbook-n');
  n.hidden = waiting === 0;
  n.textContent = String(waiting);
  n.title = `${plural(waiting, 'entry', 'entries')} waiting for approval`;
  const sorted = [...gbEntries].sort((a, b) => (gbState(b) === 'wait') - (gbState(a) === 'wait') || b.ts - a.ts);
  for (const e of sorted) {
    const st = gbState(e);
    const act = (label, action, cls = '') => el('button', { class: 'xpbtn' + cls, type: 'button', onclick: () => moderate(e, action) }, label);
    ul.append(el('li', { class: 'vrow' + (st === 'wait' ? ' new' : st === 'hid' ? ' off' : '') },
      el('div', { class: 'v-main' },
        el('div', { class: 'v-title' },
          el('span', { class: 'tag ' + st }, st === 'wait' ? 'Waiting' : st === 'shown' ? 'On the site' : 'Hidden'),
          e.name, e.from ? `, ${e.from}` : ''),
        el('p', { class: 'v-msg' }, e.msg),
        el('div', { class: 'v-meta' }, dateTime(e.ts))),
      el('div', { class: 'v-acts' },
        e.ok ? act('Hide', 'hide') : act('Approve', 'approve', ' default'),
        st === 'wait' ? act('Hide', 'hide') : null,
        act('Delete', 'delete', ' danger')),
    ));
  }
}
async function moderate(e, action) {
  if (action === 'delete' && !(await confirmBox(`Delete the entry from "${e.name}" for good?`, 'Delete', { title: 'Confirm Entry Delete', danger: true }))) return;
  const r = await api('/api/admin/visitors?kind=guestbook', { json: { id: e.id, action } });
  if (r.status === 404) return loadGuestbook();
  if (!liveOk(r)) return;
  gbEntries = r.data.entries || [];
  renderGuestbook();
}
async function loadGuestbook() {
  const r = await api('/api/admin/visitors?kind=guestbook');
  if (!liveOk(r, $('#gb-load-err'))) return;
  gbEntries = r.data.entries || [];
  renderGuestbook();
}
$('#gb-refresh').addEventListener('click', loadGuestbook);
$('#gb-auto').addEventListener('change', (e) => {
  if (!site) return;
  site.settings.guestbookAuto = e.target.checked;
  markDirty();
  if (isDirty()) balloon('Not saved yet', 'Press Save to apply the guestbook setting.');
});

// ------------------------------------------------------------------ visits
const APP_LABELS = {
  about: 'About Me', resume: 'Resume', projects: 'Projects', browser: 'Explorer', media: 'Media Player', contact: 'Contact', music: 'Music',
  notepad: 'Notepad', recycle: 'Recycle Bin', paint: 'Paint', mines: 'Mines', solitaire: 'Solitaire', pinball: 'Pinball', guestbook: 'Guestbook',
  games: 'Games', welcome: 'Welcome', display: 'Display', lightbox: 'Photo viewer', fastlane: 'Fast lane', 'cv-download': 'CV download',
};
let regionNames = null;
try { regionNames = new Intl.DisplayNames([], { type: 'region' }); } catch { regionNames = null; }
function country(code) {
  if (!code) return '';
  try { return regionNames?.of(code) || code; } catch { return code; }
}
function duration(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
function appLabel(id) {
  if (id.startsWith('project:')) return 'Project: ' + (site?.projects.find((p) => p.id === id.slice(8))?.title || id.slice(8));
  return APP_LABELS[id] || id;
}
const dim = (text = '–') => el('span', { class: 'dim' }, text);
function renderVisits(visits, summary) {
  const total = summary.total || 0;
  $('#vs-total').textContent = String(total);
  $('#vs-last7').textContent = String(summary.last7 || 0);
  $('#vs-zoom').textContent = total ? `${Math.round(((summary.zoomed || 0) / total) * 100)}%` : '–';
  $('#vs-zoom-sub').textContent = total ? `got to the computer (${summary.zoomed || 0} of ${total})` : 'got to the computer';
  const body = $('#vs-table tbody');
  body.innerHTML = '';
  $('#vs-wrap').hidden = visits.length === 0;
  $('#vs-empty').hidden = visits.length > 0;
  $('#vs-clear').disabled = visits.length === 0;
  for (const v of visits) {
    const size = v.w && v.h ? `${v.w}×${v.h}` : '';
    const device = [v.dev, size].filter(Boolean).join(' · ');
    const apps = Array.isArray(v.apps) ? v.apps.map(appLabel) : [];
    body.append(el('tr', {},
      el('td', {}, dateTime(v.ts)),
      el('td', { class: 'who' }, v.link ? el('b', { title: `/hi/${v.link}` }, v.company || v.link) : dim('direct')),
      el('td', {}, device || dim()),
      el('td', { title: v.country || '' }, country(v.country) || dim()),
      el('td', {}, v.ref || dim()),
      el('td', {}, v.zoomed ? el('span', { class: 'yes' }, 'Yes') : dim('No'), v.fast ? ' (fast lane)' : ''),
      el('td', {}, v.secs ? duration(v.secs) : dim()),
      el('td', { class: 'wrap' }, apps.length ? apps.join(', ') : dim('nothing')),
    ));
  }
}
async function loadVisits() {
  const r = await api('/api/admin/visitors?kind=visits');
  if (!liveOk(r, $('#vs-load-err'))) return;
  renderVisits(r.data.visits || [], r.data.summary || {});
}
$('#vs-refresh').addEventListener('click', loadVisits);
$('#vs-clear').addEventListener('click', async () => {
  const ok = await confirmBox('Clear the whole visits list? The numbers start again from zero and this cannot be undone.', 'Clear', { title: 'Confirm Clear Visits', danger: true });
  if (!ok) return;
  const r = await api('/api/admin/visitors?kind=visits', { method: 'DELETE' });
  if (!liveOk(r)) return;
  loadVisits();
});

// ------------------------------------------------------------------ save
let saving = false;
async function save() {
  if (!site || saving || !isDirty()) return;
  saving = true;
  const btn = $('#btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const { status, data } = await api('/api/admin/site', { method: 'PUT', json: site });
  saving = false;
  btn.textContent = 'Save';
  if (status === 200 && data.site) {
    site = normalizeLocal(data.site);
    savedJson = JSON.stringify(site);
    lastSaved = new Date();
    fillSettingsIfIdle();
    renderList();
    markDirty();
    balloon('Saved', 'Your changes are live. Visitors see them within about 30 seconds.');
    return;
  }
  markDirty();
  if (status === 401) { await msgbox({ title: 'Session ended', text: 'You were logged off. Log on again, then press Save (your changes are kept in this tab).', kind: 'info' }); return reauth(); }
  if (status === 400) return msgbox({ title: 'Cannot save', text: 'Please fix these and press Save again:', list: data.errors || [], kind: 'error' });
  balloon('Not saved', data.message || 'The server could not save. Try again in a moment.', true);
}
function fillSettingsIfIdle() {
  const f = $('#settings-form');
  if (!f.contains(document.activeElement)) fillSettings();
}
// keep unsaved work across a re-login
async function reauth() {
  const keep = site, keptSaved = savedJson;
  showLogon('Your session ended. Please log on again.');
  const form = $('#logon-form');
  const once = () => {
    const iv = setInterval(() => {
      if (!$('#cp').hidden) { clearInterval(iv); site = keep; savedJson = keptSaved; fillSettings(); renderList(); markDirty(); }
    }, 200);
    setTimeout(() => clearInterval(iv), 15000);
  };
  form.addEventListener('submit', once, { once: true });
}
$('#btn-save').addEventListener('click', save);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (pdModal.hidden) save(); }
});
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

// ------------------------------------------------------------------ boot
(async function boot() {
  loadSprites();
  const { status, data } = await api('/api/admin/session');
  if (status === 200 && data.authenticated) return openPanel();
  showLogon(status === 200 && data.configured === false ? 'Admin is not set up yet: add ADMIN_PASSWORD and SESSION_SECRET to the Vercel environment.' : '');
})();
