// Kayzee XP: "My Music" (owner: music). Explorer-style playlist window that drives the
// official Spotify embed through Spotify's iFrame API. The compact Spotify player stays
// visible inside the window at all times; our transport bar just sends it commands.

const DEFAULT_PLAYLIST = '6rmbRweMbmm9Ne6DOQiwm6';
const IFRAME_API = 'https://open.spotify.com/embed/iframe-api/v1';
const EMBED_ALLOW = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
const API_TIMEOUT = 12000;
const HINT_DELAY = 4000;

// ------------------------------------------------------------------ helpers (exported for tests)
// Accepts a playlist URL (any locale path), a spotify: URI, a pasted <iframe> embed code, or a bare id.
export function parsePlaylistId(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  const m = s.match(/playlist(?:\/|:|%3A)([A-Za-z0-9]{22})/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  return null;
}

const trackId = (uri) => (typeof uri === 'string' ? (uri.match(/track[:/]([A-Za-z0-9]{22})/) || [])[1] : null) || null;

export function fmtTime(ms) {
  if (!(ms >= 0) || !isFinite(ms)) return '-:--';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function fmtTotal(ms) {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}

function validPlaylist(d) {
  return d && Array.isArray(d.tracks) && d.tracks.length > 0 && d.tracks.every((t) => t && typeof t.title === 'string');
}

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

async function loadPlaylist(id) {
  try {
    const d = await fetchJSON('/api/spotify?playlist=' + encodeURIComponent(id));
    if (validPlaylist(d)) return d;
  } catch (_) { /* fall through to the snapshot */ }
  try {
    const d = await fetchJSON('/data/playlist-snapshot.json');
    if (validPlaylist(d)) return d;
  } catch (_) { /* no list: the official embed still works */ }
  return null;
}

// One loader for the whole page. Resolves with Spotify's IFrameAPI object.
let apiPromise = null;
function loadIFrameAPI() {
  if (window.__kzSpotifyIFrameAPI) return Promise.resolve(window.__kzSpotifyIFrameAPI);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const done = (api) => { window.__kzSpotifyIFrameAPI = api; resolve(api); };
    window.onSpotifyIframeApiReady = done;
    const s = document.createElement('script');
    s.src = window.__KZ_SPOTIFY_API_URL || IFRAME_API; // override exists only for the dev harness
    s.async = true;
    s.onerror = () => reject(new Error('Spotify iFrame API failed to load'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('Spotify iFrame API timed out')), API_TIMEOUT);
  });
  apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

// Only one Spotify controller may exist globally.
let activeInstance = null;

// ------------------------------------------------------------------ original inline icons
const SVG = {
  back: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><defs><radialGradient id="mu-gb" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#b9f0a4"/><stop offset=".45" stop-color="#4fbf3a"/><stop offset="1" stop-color="#23801b"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#mu-gb)" stroke="#1d6a16"/><path d="M13.6 6.8 8.4 12l5.2 5.2M8.8 12h7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fwd: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><defs><radialGradient id="mu-gf" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#b9f0a4"/><stop offset=".45" stop-color="#4fbf3a"/><stop offset="1" stop-color="#23801b"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#mu-gf)" stroke="#1d6a16"/><path d="M10.4 6.8 15.6 12l-5.2 5.2M15.2 12H7.8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><defs><radialGradient id="mu-lens" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#bfe0ff"/><stop offset="1" stop-color="#6aa8e8"/></radialGradient></defs><path d="m14.6 14.6 6 6" stroke="#6b4a1e" stroke-width="3.4" stroke-linecap="round"/><path d="m14.6 14.6 6 6" stroke="#b07a35" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.5" cy="9.5" r="6.6" fill="url(#mu-lens)" stroke="#3a5e8c" stroke-width="1.8"/><path d="M6.4 8.2a3.6 3.6 0 0 1 3-2.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  files: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M2.5 6.5h7l1.6 2h10.4v11.5h-19z" fill="#e7b83b" stroke="#9a6d12"/><path d="M2.5 10h19v10h-19z" fill="#f8d66a" stroke="#9a6d12"/><path d="M3.5 11h17" stroke="#fff3c4"/><circle cx="16.8" cy="16.3" r="2" fill="#2f63c8"/><path d="M18.6 16.3V11.6l-2.8.8" fill="none" stroke="#2f63c8" stroke-width="1.3"/></svg>`,
  views: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" fill="#fff" stroke="#4a6ea8"/><rect x="3" y="4" width="18" height="3.4" fill="#5b8fdc"/><path d="M5.5 10.5h3M10.5 10.5h8M5.5 13.5h3M10.5 13.5h8M5.5 16.5h3M10.5 16.5h8" stroke="#6d86b0" stroke-width="1.5"/></svg>`,
  go: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x=".5" y=".5" width="15" height="15" rx="2.5" fill="#3cae2f" stroke="#1d6a16"/><path d="M4 8h7M8 4.6 11.4 8 8 11.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ext: `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M5 2.5H2.5v7h7V7" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1.5h3.5V5M10.5 1.5 5.5 6.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  prev: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3h2v10H3zM14 3v10L6 8z" fill="currentColor"/></svg>`,
  next: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11 3h2v10h-2zM2 3v10l8-5z" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z" fill="currentColor"/></svg>`,
  info: `<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><circle cx="7" cy="7" r="6.3" fill="#2f6fd6" stroke="#1b4c9e"/><path d="M7 6v4.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="7" cy="3.9" r="1" fill="#fff"/></svg>`,
  shuffle: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 4.5h3l6 7h3M1.5 11.5h3l6-7h3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12 2.5 2.2 2-2.2 2M12 9.5l2.2 2-2.2 2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

const COLS = [
  { key: 'idx', label: '#', cls: 'c-num' },
  { key: 'title', label: 'Title', cls: 'c-title' },
  { key: 'artists', label: 'Artist', cls: 'c-artist' },
  { key: 'ms', label: 'Duration', short: 'Time', cls: 'c-dur' },
  { key: null, label: 'Link', cls: 'c-link' },
];

const MENUS = {
  File: [
    { id: 'play', label: 'Play', hint: 'Enter' },
    { id: 'playall', label: 'Play All' },
    { id: 'shuffle', label: 'Shuffle', check: true },
    '-',
    { id: 'spotify', label: 'Listen on Spotify' },
    '-',
    { id: 'close', label: 'Close' },
  ],
  Edit: [{ id: 'find', label: 'Find in Playlist...', hint: 'Ctrl+F' }],
  View: [
    { id: 'pane', label: 'Music Tasks Pane', check: true },
    '-',
    { id: 'sort:idx', label: 'Sort by #', radio: 'sort' },
    { id: 'sort:title', label: 'Sort by Title', radio: 'sort' },
    { id: 'sort:artists', label: 'Sort by Artist', radio: 'sort' },
    { id: 'sort:ms', label: 'Sort by Duration', radio: 'sort' },
  ],
  Favorites: [{ id: 'spotify', label: 'My Shazam Tracks on Spotify' }],
  Tools: [{ id: 'noop', label: 'Folder Options...', disabled: true }],
  Help: [{ id: 'about-previews', label: 'Why do songs stop after 30 seconds?' }],
};

// ------------------------------------------------------------------ app
export default {
  id: 'music',
  title: 'My Music',
  icon: 'music',
  size: [740, 600],
  minSize: [440, 440],
  single: true,
  resizable: true,

  mount(root, ctx) {
    const st = {
      dead: false,
      playlistId: DEFAULT_PLAYLIST,
      data: null,           // {name, owner, cover, tracks}
      tracks: [],           // [{idx, title, artists, ms, uri}]
      view: [],             // track idx in display order (sorted + filtered)
      sortKey: 'idx', sortDir: 1,
      filter: '', lastFilter: '',
      sel: -1,              // selected track idx
      cur: -1,              // loaded/playing track idx
      playing: false, buffering: false,
      pos: 0, dur: 0,
      lastPos: 0, lastDur: 0,
      switching: false,
      seeking: false,
      shuffle: false,
      pane: false,
      preview: false,
      mode: 'loading',      // 'loading' | 'api' | 'fallback'
      ctrl: null,
      timers: new Set(),
      offs: [],
    };
    const later = (fn, ms) => { const t = setTimeout(() => { st.timers.delete(t); if (!st.dead) fn(); }, ms); st.timers.add(t); return t; };
    const clear = (t) => { if (t) { clearTimeout(t); st.timers.delete(t); } };
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); st.offs.push(() => el.removeEventListener(ev, fn, opt)); };
    const icon = (key, px) => { try { const el = ctx.icon && ctx.icon(key, px); if (el) { el.classList.add('mu-sprite'); el.style.width = px + 'px'; el.style.height = 'auto'; } return el; } catch (_) { return null; } };
    const status = (s) => { try { ctx.setStatus && ctx.setStatus(s); } catch (_) { /* optional */ } };

    root.classList.add('app-music');
    if (ctx.isMobile) root.classList.add('is-mobile');
    root.innerHTML = `
      <div class="xp-menubar mu-menubar" role="menubar">
        ${Object.keys(MENUS).map((m) => `<button class="mu-menu" role="menuitem" aria-haspopup="true" data-menu="${m}">${m}</button>`).join('')}
        <span class="mu-brand" aria-hidden="true"></span>
      </div>
      <div class="xp-toolbar mu-toolbar" role="toolbar">
        <button class="xp-tool mu-tool" data-act="back" disabled title="Back">${SVG.back}<span class="lbl">Back</span><span class="dd" aria-hidden="true"></span></button>
        <button class="xp-tool mu-tool icon-only" data-act="fwd" disabled title="Forward">${SVG.fwd}<span class="dd" aria-hidden="true"></span></button>
        <span class="mu-sep"></span>
        <button class="xp-tool mu-tool" data-act="search" title="Search this playlist">${SVG.search}<span class="lbl">Search</span></button>
        <button class="xp-tool mu-tool" data-act="files" title="Show Music Tasks">${SVG.files}<span class="lbl">Files</span></button>
        <span class="mu-sep"></span>
        <button class="xp-tool mu-tool icon-only" data-act="views" title="Views">${SVG.views}<span class="dd" aria-hidden="true"></span></button>
      </div>
      <div class="mu-findbar" hidden>
        <label>Search for: <input class="xp-input mu-find" type="search" placeholder="Song or artist" spellcheck="false" autocomplete="off"></label>
        <span class="mu-findcount"></span>
        <button class="xp-btn mu-findclose" title="Close search">Close</button>
      </div>
      <div class="xp-addressbar mu-address">
        <span class="mu-addr-lbl">Address</span>
        <div class="mu-addr-box"><span class="mu-addr-ico"></span><span class="mu-addr-txt">My Music</span><span class="mu-addr-dd" aria-hidden="true"></span></div>
        <button class="mu-go" title="Go">${SVG.go}<span>Go</span></button>
      </div>
      <div class="mu-main">
        <aside class="xp-sidepane mu-pane" hidden>
          <div class="xp-sidepane-box mu-pbox">
            <div class="mu-pbox-h">Music Tasks</div>
            <div class="mu-pbox-b">
              <button class="mu-plink" data-act="playall">${SVG.play}<span>Play all</span></button>
              <button class="mu-plink" data-act="shuffle">${SVG.shuffle}<span class="mu-shuf-lbl">Shuffle play</span></button>
              <a class="mu-plink mu-spotify-link" target="_blank" rel="noopener noreferrer">${SVG.ext}<span>Listen on Spotify</span></a>
            </div>
          </div>
          <div class="xp-sidepane-box mu-pbox">
            <div class="mu-pbox-h">Details</div>
            <div class="mu-pbox-b mu-details"></div>
          </div>
        </aside>
        <section class="mu-content">
          <header class="mu-head">
            <div class="mu-cover"></div>
            <div class="mu-head-txt">
              <div class="mu-kind">Playlist</div>
              <h1 class="mu-name">My Shazam Tracks</h1>
              <div class="mu-meta"><span class="mu-owner">!Kshitiz</span><span class="mu-count"></span></div>
              <div class="mu-desc">Songs I Shazamed out in the wild, then kept on repeat.</div>
              <a class="xp-btn mu-listen mu-spotify-link" target="_blank" rel="noopener noreferrer" title="Open My Shazam Tracks on open.spotify.com"><span class="mu-listen-ico"></span>Listen on Spotify</a>
            </div>
          </header>
          <div class="mu-tablewrap xp-scroll" tabindex="0" aria-label="Tracks">
            <table class="xp-listview mu-table" role="grid" aria-rowcount="0">
              <colgroup>${COLS.map((c) => `<col class="${c.cls}">`).join('')}</colgroup>
              <thead><tr>${COLS.map((c) => `<th class="${c.cls}${c.key ? ' sortable' : ''}" ${c.key ? `data-sort="${c.key}" aria-sort="none"` : ''} scope="col"><span class="lbl">${c.short ? `<span class="full">${c.label}</span><span class="short">${c.short}</span>` : c.label}</span></th>`).join('')}</tr></thead>
              <tbody></tbody>
            </table>
            <div class="mu-empty" hidden></div>
          </div>
        </section>
      </div>
      <div class="mu-dock">
        <div class="xp-groupbox mu-group">
          <span class="mu-group-cap">Spotify player</span>
          <span class="mu-group-note" hidden>${SVG.info}<span class="full">Playing 30-second previews · log in to Spotify for full songs</span><span class="short">30-sec previews · log in for full songs</span></span>
          <div class="mu-embed"><div class="mu-embed-slot"></div><div class="mu-embed-wait">Loading the Spotify player...</div></div>
        </div>
        <div class="mu-balloon" role="status" hidden><button class="mu-balloon-x" aria-label="Dismiss">×</button><b class="mu-balloon-t"></b><span class="mu-balloon-m"></span></div>
      </div>
      <div class="mu-transport">
        <div class="mu-seekrow">
          <span class="mu-side mu-el-s">0:00</span>
          <div class="mu-seek" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
            <div class="mu-seek-groove"><div class="mu-seek-fill"></div></div><div class="mu-seek-thumb"></div>
          </div>
          <span class="mu-side mu-tot-s">-:--</span>
        </div>
        <div class="mu-tp-row">
          <div class="mu-now">
            <div class="mu-now-art"></div>
            <div class="mu-now-txt"><div class="mu-now-title">Nothing playing</div><div class="mu-now-artist">Double-click a song to play it</div></div>
          </div>
          <div class="mu-ctrls">
            <button class="mu-tbtn mu-prev" title="Previous" aria-label="Previous">${SVG.prev}</button>
            <button class="mu-tbtn mu-play" title="Play" aria-label="Play">${SVG.play}</button>
            <button class="mu-tbtn mu-next" title="Next" aria-label="Next">${SVG.next}</button>
          </div>
          <div class="mu-time"><span class="mu-el">0:00</span> / <span class="mu-tot">0:00</span></div>
        </div>
      </div>
      <div class="mu-dropdown" role="menu" hidden></div>`;

    const $ = (s) => root.querySelector(s);
    const els = {
      tbody: $('tbody'), table: $('.mu-table'), wrap: $('.mu-tablewrap'), empty: $('.mu-empty'),
      thead: $('thead'), cover: $('.mu-cover'), name: $('.mu-name'), owner: $('.mu-owner'), count: $('.mu-count'),
      details: $('.mu-details'), pane: $('.mu-pane'), find: $('.mu-find'), findbar: $('.mu-findbar'), findcount: $('.mu-findcount'),
      slot: $('.mu-embed-slot'), embed: $('.mu-embed'), wait: $('.mu-embed-wait'), note: $('.mu-group-note'), cap: $('.mu-group-cap'),
      balloon: $('.mu-balloon'), seek: $('.mu-seek'), fill: $('.mu-seek-fill'), thumb: $('.mu-seek-thumb'),
      nowArt: $('.mu-now-art'), nowTitle: $('.mu-now-title'), nowArtist: $('.mu-now-artist'),
      el: $('.mu-el'), tot: $('.mu-tot'), elS: $('.mu-el-s'), totS: $('.mu-tot-s'), play: $('.mu-play'), prev: $('.mu-prev'), next: $('.mu-next'),
      back: $('[data-act="back"]'), fwd: $('[data-act="fwd"]'), dropdown: $('.mu-dropdown'),
    };

    // sprites from core (keeps the icon language consistent)
    const addrIco = icon('music', 16); if (addrIco) $('.mu-addr-ico').appendChild(addrIco);
    const listenIco = icon('music', 16); if (listenIco) $('.mu-listen-ico').appendChild(listenIco);
    const brand = icon('sun', 22); if (brand) $('.mu-brand').appendChild(brand);

    // ---------------------------------------------------------------- header
    const playlistUrl = () => `https://open.spotify.com/playlist/${st.playlistId}`;
    function setCover(el, src, px) {
      el.textContent = '';
      const fallback = () => { el.textContent = ''; const i = icon('music', Math.round(px * 0.6)); if (i) el.appendChild(i); el.classList.add('no-art'); };
      if (!src) return fallback();
      const img = new Image();
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.decoding = 'async';
      img.onerror = fallback;
      img.src = src;
      el.classList.remove('no-art');
      el.appendChild(img);
    }
    function renderHeader() {
      const d = st.data;
      root.querySelectorAll('.mu-spotify-link').forEach((a) => { a.href = playlistUrl(); });
      els.name.textContent = (d && d.name) || 'My Shazam Tracks';
      els.owner.textContent = (d && d.owner) || '!Kshitiz';
      const total = st.tracks.reduce((a, t) => a + (t.ms || 0), 0);
      els.count.textContent = st.tracks.length ? `${st.tracks.length} songs, ${fmtTotal(total)}` : '';
      setCover(els.cover, d && d.cover, 96);
      setCover(els.nowArt, d && d.cover, 34);
      els.details.innerHTML = '';
      const b = document.createElement('b'); b.textContent = els.name.textContent;
      const p1 = document.createElement('div'); p1.textContent = 'Playlist by ' + els.owner.textContent;
      const p2 = document.createElement('div'); p2.textContent = els.count.textContent || 'Track list unavailable';
      els.details.append(b, p1, p2);
    }

    // ---------------------------------------------------------------- table
    let rowEls = [];
    function buildRows() {
      els.tbody.textContent = '';
      rowEls = st.tracks.map((t) => {
        const tr = document.createElement('tr');
        tr.dataset.i = t.idx;
        tr.setAttribute('role', 'row');
        tr.setAttribute('aria-selected', 'false');
        const num = document.createElement('td'); num.className = 'c-num';
        num.innerHTML = `<span class="n">${t.idx + 1}</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>`;
        const ti = document.createElement('td'); ti.className = 'c-title'; ti.title = t.title;
        const tt = document.createElement('span'); tt.className = 'tt'; tt.textContent = t.title;
        const ta = document.createElement('span'); ta.className = 'ta'; ta.textContent = t.artists;
        ti.append(tt, ta);
        const ar = document.createElement('td'); ar.className = 'c-artist'; ar.textContent = t.artists; ar.title = t.artists;
        const du = document.createElement('td'); du.className = 'c-dur'; du.textContent = fmtTime(t.ms);
        const li = document.createElement('td'); li.className = 'c-link';
        const id = trackId(t.uri);
        if (id) {
          const a = document.createElement('a');
          a.className = 'mu-rowlink'; a.href = `https://open.spotify.com/track/${id}`;
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.title = 'Open in Spotify'; a.setAttribute('aria-label', `Open ${t.title} in Spotify`);
          a.innerHTML = SVG.ext;
          li.appendChild(a);
        }
        tr.append(num, ti, ar, du, li);
        return tr;
      });
    }
    function computeView() {
      const q = st.filter.trim().toLowerCase();
      let v = st.tracks.filter((t) => !q || t.title.toLowerCase().includes(q) || t.artists.toLowerCase().includes(q));
      const k = st.sortKey, dir = st.sortDir;
      v.sort((a, b) => {
        let c;
        if (k === 'idx' || k === 'ms') c = (a[k] || 0) - (b[k] || 0);
        else c = String(a[k]).localeCompare(String(b[k]), undefined, { sensitivity: 'base', numeric: true });
        return (c || a.idx - b.idx) * dir;
      });
      st.view = v.map((t) => t.idx);
    }
    function renderTable() {
      computeView();
      const frag = document.createDocumentFragment();
      st.view.forEach((i) => frag.appendChild(rowEls[i]));
      els.tbody.textContent = '';
      els.tbody.appendChild(frag);
      els.table.setAttribute('aria-rowcount', String(st.view.length));
      els.thead.querySelectorAll('th[data-sort]').forEach((th) => {
        const active = th.dataset.sort === st.sortKey;
        th.classList.toggle('sorted', active);
        th.classList.toggle('desc', active && st.sortDir < 0);
        th.setAttribute('aria-sort', active ? (st.sortDir > 0 ? 'ascending' : 'descending') : 'none');
      });
      root.querySelectorAll('col').forEach((c, n) => c.classList.toggle('sorted', COLS[n].key === st.sortKey));
      const q = st.filter.trim();
      if (!st.tracks.length) {
        // nothing to list; the official embed below still plays the playlist
        els.empty.hidden = false;
        els.empty.textContent = st.mode === 'loading' && !st.data ? 'Loading songs...' : 'The song list could not be loaded right now. You can still play the whole playlist with the Spotify player below.';
      } else if (q && !st.view.length) {
        els.empty.hidden = false;
        els.empty.textContent = `No songs match "${q}".`;
      } else els.empty.hidden = true;
      els.findcount.textContent = q ? `${st.view.length} of ${st.tracks.length}` : '';
      els.back.disabled = !q;
      els.fwd.disabled = !!q || !st.lastFilter;
      updateStatus();
      paintRows();
    }
    function paintRows() {
      rowEls.forEach((tr, i) => {
        const sel = i === st.sel, cur = i === st.cur;
        tr.classList.toggle('sel', sel);
        tr.setAttribute('aria-selected', String(sel));
        tr.classList.toggle('cur', cur);
        tr.classList.toggle('is-playing', cur && st.playing);
      });
    }
    function select(i, scroll) {
      st.sel = i;
      paintRows();
      if (scroll && rowEls[i]) {
        const tr = rowEls[i], w = els.wrap, headH = els.thead.offsetHeight;
        const top = tr.offsetTop, bot = top + tr.offsetHeight;
        if (top - headH < w.scrollTop) w.scrollTop = top - headH;
        else if (bot > w.scrollTop + w.clientHeight) w.scrollTop = bot - w.clientHeight;
      }
    }
    function updateStatus() {
      if (!st.tracks.length) return status(st.mode === 'loading' ? 'Loading...' : 'Spotify player');
      const t = st.tracks[st.cur];
      if (t && st.playing) return status(`Playing: ${t.title} (${t.artists})`);
      const q = st.filter.trim();
      status(q ? `${st.view.length} of ${st.tracks.length} songs match "${q}"` : `${st.tracks.length} songs`);
    }

    // ---------------------------------------------------------------- transport + playback
    let hintTimer = null;
    function showBalloon(title, msg, ms) {
      els.balloon.querySelector('.mu-balloon-t').textContent = title;
      els.balloon.querySelector('.mu-balloon-m').textContent = msg;
      els.balloon.hidden = false;
      clear(showBalloon.t);
      if (ms) showBalloon.t = later(() => { els.balloon.hidden = true; }, ms);
    }
    const hideBalloon = () => { els.balloon.hidden = true; };
    function armAutoplayHint() {
      clear(hintTimer);
      hintTimer = later(() => {
        if (!st.playing) showBalloon('Press play on the Spotify player', 'Your browser held back autoplay. One tap on the green player starts it, and these controls take over from there.');
      }, HINT_DELAY);
    }
    function setPreview(on) {
      if (st.preview === on) return;
      st.preview = on;
      els.note.hidden = !on;
      els.note.title = 'Spotify plays full songs when you are logged in to Spotify in this browser.';
    }

    function renderNow() {
      const t = st.tracks[st.cur];
      if (t) { els.nowTitle.textContent = t.title; els.nowArtist.textContent = t.artists; els.nowTitle.title = t.title; }
      else if (!st.tracks.length && st.mode !== 'loading') { els.nowTitle.textContent = (st.data && st.data.name) || 'My Shazam Tracks'; els.nowArtist.textContent = 'Spotify playlist'; }
      const dur = st.dur || (t && t.ms) || 0;
      els.tot.textContent = els.totS.textContent = dur ? fmtTime(dur) : '-:--';
      renderPos();
      els.play.innerHTML = st.playing ? SVG.pause : SVG.play;
      els.play.title = st.playing ? 'Pause' : 'Play';
      els.play.setAttribute('aria-label', els.play.title);
      els.play.classList.toggle('on', st.playing);
      const canWalk = st.mode === 'api' && st.tracks.length > 0;
      els.prev.disabled = !canWalk;
      els.next.disabled = !canWalk;
      els.play.disabled = st.mode === 'loading';
      root.classList.toggle('is-playing', st.playing);
    }
    function renderPos(posOverride) {
      const dur = st.dur || (st.tracks[st.cur] && st.tracks[st.cur].ms) || 0;
      const pos = posOverride != null ? posOverride : st.pos;
      const f = dur ? Math.min(1, Math.max(0, pos / dur)) : 0;
      els.fill.style.width = (f * 100).toFixed(2) + '%';
      els.thumb.style.left = (f * 100).toFixed(2) + '%';
      els.el.textContent = els.elS.textContent = fmtTime(pos);
      els.seek.setAttribute('aria-valuemax', String(Math.round(dur / 1000)));
      els.seek.setAttribute('aria-valuenow', String(Math.round(pos / 1000)));
      els.seek.setAttribute('aria-valuetext', `${fmtTime(pos)} of ${fmtTime(dur)}`);
    }

    function playIdx(i) {
      const t = st.tracks[i];
      if (!t) return;
      hideBalloon();
      if (st.mode === 'fallback') {
        // plain embed: swap it to the chosen song; the visitor presses play on it
        const id = trackId(t.uri);
        if (id && fallbackFrame) fallbackFrame.src = `https://open.spotify.com/embed/track/${id}?utm_source=generator`;
        st.cur = i; st.pos = 0; st.dur = t.ms;
        select(i, true); renderNow(); updateStatus();
        showBalloon('Press play on the Spotify player', `"${t.title}" is loaded in the player below.`, 7000);
        return;
      }
      if (!st.ctrl) return;
      if (i === st.cur && st.loadedUri === t.uri) {
        st.ctrl.seek(0);
        st.ctrl.play();
      } else {
        st.cur = i;
        st.pos = 0; st.dur = 0; st.lastPos = 0; st.lastDur = 0;
        st.switching = true;
        clear(st.switchT); st.switchT = later(() => { st.switching = false; }, 6000);
        st.loadedUri = t.uri;
        st.ctrl.loadUri(t.uri);
        st.ctrl.play();
      }
      armAutoplayHint();
      select(i, true);
      renderNow();
      updateStatus();
    }
    function step(dir, auto) {
      if (!st.tracks.length) return;
      const order = st.view.length ? st.view : st.tracks.map((t) => t.idx);
      let i;
      if (st.shuffle && order.length > 1) {
        do { i = order[Math.floor(Math.random() * order.length)]; } while (i === st.cur);
      } else {
        const at = order.indexOf(st.cur);
        if (at < 0) i = order[dir > 0 ? 0 : order.length - 1];
        else {
          const n = at + dir;
          if (n >= order.length || n < 0) { if (auto) return; i = order[(n + order.length) % order.length]; }
          else i = order[n];
        }
      }
      playIdx(i);
    }
    function prev() {
      if (st.mode === 'api' && st.cur >= 0 && st.pos > 3000) { st.ctrl.seek(0); st.pos = 0; renderPos(); return; }
      step(-1);
    }
    function togglePlay() {
      if (st.mode === 'fallback') {
        showBalloon('Press play on the Spotify player', 'Use the green play button in the player below.', 6000);
        return;
      }
      if (!st.ctrl) return;
      if (st.cur < 0 && st.tracks.length) {
        // first press: start the selected song, or the first one in the list
        return playIdx(st.sel >= 0 ? st.sel : (st.view[0] ?? 0));
      }
      if (!st.playing) armAutoplayHint();
      st.ctrl.togglePlay();
    }

    function onPlayback(e) {
      const d = e && e.data;
      if (!d || st.dead) return;
      if (st.switching) {
        // ignore stale updates from the previous song until the new one reports in
        if (d.position > 2500 || (d.duration && st.tracks[st.cur] && Math.abs(d.duration - st.tracks[st.cur].ms) > 2000 && !(d.duration <= 31000))) return;
        st.switching = false;
      }
      const wasPlaying = st.playing;
      const ended = d.isPaused && wasPlaying && st.lastDur > 0 && st.lastPos >= st.lastDur - 1500;
      st.playing = !d.isPaused;
      st.buffering = !!d.isBuffering;
      if (d.duration > 0) st.dur = d.duration;
      if (!st.seeking && d.position >= 0) st.pos = d.position;
      st.lastPos = st.pos; st.lastDur = st.dur;
      if (st.playing) { clear(hintTimer); if (!els.balloon.hidden && /Press play/.test(els.balloon.textContent)) hideBalloon(); }
      const t = st.tracks[st.cur];
      if (st.playing && d.duration > 0 && d.duration <= 31000 && t && t.ms > 40000) setPreview(true);
      if (wasPlaying !== st.playing) { paintRows(); updateStatus(); }
      renderNow();
      if (ended && st.mode === 'api') later(() => step(1, true), 400);
    }

    // seek bar (pointer + keyboard)
    function seekFrac(ev) {
      const r = els.seek.getBoundingClientRect();
      return Math.min(1, Math.max(0, (ev.clientX - r.left) / (r.width || 1)));
    }
    let seekPid = null;
    on(els.seek, 'pointerdown', (ev) => {
      if (st.mode !== 'api' || st.cur < 0 || !(st.dur || st.tracks[st.cur])) return;
      seekPid = ev.pointerId;
      try { els.seek.setPointerCapture(ev.pointerId); } catch (_) { /* fine */ }
      st.seeking = true;
      els.seek.classList.add('drag');
      renderPos(seekFrac(ev) * (st.dur || st.tracks[st.cur].ms));
      ev.preventDefault();
    });
    on(els.seek, 'pointermove', (ev) => {
      if (!st.seeking || ev.pointerId !== seekPid) return;
      renderPos(seekFrac(ev) * (st.dur || st.tracks[st.cur].ms));
    });
    const endSeek = (ev) => {
      if (!st.seeking || ev.pointerId !== seekPid) return;
      const dur = st.dur || st.tracks[st.cur].ms;
      const ms = seekFrac(ev) * dur;
      st.seeking = false; seekPid = null;
      els.seek.classList.remove('drag');
      st.pos = ms; renderPos();
      st.ctrl && st.ctrl.seek(Math.max(0, ms / 1000));
    };
    on(els.seek, 'pointerup', endSeek);
    on(els.seek, 'pointercancel', (ev) => { if (ev.pointerId === seekPid) { st.seeking = false; els.seek.classList.remove('drag'); renderPos(); } });
    on(els.seek, 'keydown', (ev) => {
      if (st.mode !== 'api' || st.cur < 0) return;
      const d = { ArrowLeft: -5000, ArrowRight: 5000, ArrowDown: -5000, ArrowUp: 5000, PageDown: -30000, PageUp: 30000 }[ev.key];
      if (ev.key === 'Home' || ev.key === 'End' || d) {
        const dur = st.dur || st.tracks[st.cur].ms;
        st.pos = ev.key === 'Home' ? 0 : ev.key === 'End' ? Math.max(0, dur - 1000) : Math.min(dur, Math.max(0, st.pos + d));
        renderPos(); st.ctrl.seek(st.pos / 1000);
        ev.preventDefault();
      }
    });

    on(els.play, 'click', () => { try { ctx.sound && ctx.sound('click'); } catch (_) { /* optional */ } togglePlay(); });
    on(els.prev, 'click', prev);
    on(els.next, 'click', () => step(1));
    on(els.balloon.querySelector('.mu-balloon-x'), 'click', hideBalloon);

    // ---------------------------------------------------------------- table interaction
    on(els.thead, 'click', (ev) => {
      const th = ev.target.closest('th[data-sort]');
      if (!th) return;
      sortBy(th.dataset.sort);
    });
    function sortBy(k, dir) {
      if (dir) st.sortDir = dir;
      else st.sortDir = st.sortKey === k ? -st.sortDir : 1;
      st.sortKey = k;
      renderTable();
    }
    const rowIdx = (ev) => { const tr = ev.target.closest('tr[data-i]'); return tr ? Number(tr.dataset.i) : -1; };
    on(els.tbody, 'click', (ev) => {
      if (ev.target.closest('a')) return;
      const i = rowIdx(ev);
      if (i < 0) return;
      els.wrap.focus({ preventScroll: true });
      if (ctx.isMobile || ev.pointerType === 'touch') { select(i); playIdx(i); return; }
      select(i);
    });
    on(els.tbody, 'dblclick', (ev) => {
      if (ev.target.closest('a')) return;
      const i = rowIdx(ev);
      if (i >= 0 && !ctx.isMobile) playIdx(i);
    });
    on(els.wrap, 'keydown', (ev) => {
      if (ev.target !== els.wrap) return;
      const v = st.view;
      if (!v.length) return;
      const at = v.indexOf(st.sel);
      const page = Math.max(1, Math.floor(els.wrap.clientHeight / 24) - 1);
      let n = null;
      switch (ev.key) {
        case 'ArrowDown': n = at < 0 ? 0 : Math.min(v.length - 1, at + 1); break;
        case 'ArrowUp': n = at < 0 ? 0 : Math.max(0, at - 1); break;
        case 'PageDown': n = Math.min(v.length - 1, Math.max(0, at) + page); break;
        case 'PageUp': n = Math.max(0, at - page); break;
        case 'Home': n = 0; break;
        case 'End': n = v.length - 1; break;
        case 'Enter': if (st.sel >= 0) playIdx(st.sel); else playIdx(v[0]); ev.preventDefault(); return;
        default: return;
      }
      ev.preventDefault();
      select(v[n], true);
    });
    on(root, 'keydown', (ev) => {
      const typing = ev.target.closest && ev.target.closest('input, textarea, select');
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') { ev.preventDefault(); openFind(); return; }
      if (ev.key === 'Escape') { if (!els.dropdown.hidden) closeMenu(); else if (!els.balloon.hidden) hideBalloon(); return; }
      if (typing) return;
      if (ev.key === ' ' && !ev.target.closest('button, a, [role="slider"]')) { ev.preventDefault(); togglePlay(); }
    });

    // ---------------------------------------------------------------- search + toolbar
    function openFind() {
      els.findbar.hidden = false;
      root.querySelector('[data-act="search"]').classList.add('on');
      els.find.focus();
      els.find.select();
    }
    function closeFind() {
      if (st.filter) st.lastFilter = st.filter;
      st.filter = ''; els.find.value = '';
      els.findbar.hidden = true;
      root.querySelector('[data-act="search"]').classList.remove('on');
      renderTable();
    }
    on(els.find, 'input', () => { st.filter = els.find.value; renderTable(); });
    on(els.find, 'keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); if (st.view.length) { select(st.view[0], true); playIdx(st.view[0]); } }
      if (ev.key === 'Escape') { ev.stopPropagation(); closeFind(); els.wrap.focus(); }
      if (ev.key === 'ArrowDown' && st.view.length) { ev.preventDefault(); select(st.view[0], true); els.wrap.focus(); }
    });
    on($('.mu-findclose'), 'click', closeFind);
    function setPane(onOff) {
      st.pane = onOff;
      els.pane.hidden = !onOff;
      root.querySelector('[data-act="files"]').classList.toggle('on', onOff);
    }
    function toggleShuffle() {
      st.shuffle = !st.shuffle;
      root.querySelector('.mu-shuf-lbl').textContent = st.shuffle ? 'Shuffle: on' : 'Shuffle play';
      root.querySelectorAll('[data-act="shuffle"]').forEach((b) => b.classList.toggle('on', st.shuffle));
    }
    // opened from the boombox in the room (or /?open=music&shuffle): start on a random track
    let wantShuffle = !!(ctx.args && ctx.args.shuffle);
    function shufflePlay() {
      if (st.dead) return;
      if (!st.ready || !st.tracks.length) { wantShuffle = true; return; }
      wantShuffle = false;
      if (!st.shuffle) toggleShuffle();
      playAll();
    }
    const onShuffleAsk = () => shufflePlay();
    addEventListener('kz-music-shuffle', onShuffleAsk);
    function playAll() {
      if (!st.tracks.length) return togglePlay();
      const order = st.view.length ? st.view : st.tracks.map((t) => t.idx);
      playIdx(st.shuffle ? order[Math.floor(Math.random() * order.length)] : order[0]);
    }
    function doAction(act) {
      switch (act) {
        case 'back': if (st.filter) { st.lastFilter = st.filter; st.filter = ''; els.find.value = ''; renderTable(); } break;
        case 'fwd': if (st.lastFilter) { st.filter = st.lastFilter; els.find.value = st.filter; els.findbar.hidden = false; root.querySelector('[data-act="search"]').classList.add('on'); renderTable(); } break;
        case 'search': if (els.findbar.hidden) openFind(); else closeFind(); break;
        case 'find': openFind(); break;
        case 'files': case 'pane': setPane(!st.pane); break;
        case 'views': openMenu('View', root.querySelector('[data-act="views"]')); break;
        case 'play': if (st.sel >= 0) playIdx(st.sel); else togglePlay(); break;
        case 'playall': playAll(); break;
        case 'shuffle': toggleShuffle(); break;
        case 'spotify': window.open(playlistUrl(), '_blank', 'noopener,noreferrer'); break;
        case 'close': try { ctx.close && ctx.close(); } catch (_) { /* optional */ } break;
        case 'about-previews':
          showBalloon('About previews', 'Spotify plays full songs here if you are logged in to Spotify in this browser. Otherwise it plays a 30-second preview of each one.', 9000);
          break;
        default:
          if (act && act.startsWith('sort:')) sortBy(act.slice(5), 1);
      }
    }
    on(root.querySelector('.mu-toolbar'), 'click', (ev) => { const b = ev.target.closest('[data-act]'); if (b && !b.disabled) doAction(b.dataset.act); });
    on(els.pane, 'click', (ev) => { const b = ev.target.closest('button[data-act]'); if (b) doAction(b.dataset.act); });
    on($('.mu-go'), 'click', () => { if (st.filter) closeFind(); els.wrap.scrollTop = 0; els.wrap.focus(); });

    // ---------------------------------------------------------------- menus
    let menuOpen = null;
    function openMenu(name, anchor) {
      menuOpen = name;
      root.querySelectorAll('.mu-menu').forEach((b) => b.classList.toggle('open', b.dataset.menu === name));
      const dd = els.dropdown;
      dd.textContent = '';
      for (const it of MENUS[name]) {
        if (it === '-') { const s = document.createElement('div'); s.className = 'mu-dd-sep'; dd.appendChild(s); continue; }
        const b = document.createElement('button');
        b.className = 'mu-dd-item'; b.setAttribute('role', 'menuitem'); b.dataset.act = it.id;
        if (it.disabled) b.disabled = true;
        let checked = false;
        if (it.check) checked = it.id === 'shuffle' ? st.shuffle : it.id === 'pane' ? st.pane : false;
        if (it.radio) checked = it.id === 'sort:' + st.sortKey;
        b.innerHTML = `<span class="mk">${checked ? (it.radio ? '•' : '✓') : ''}</span><span class="tx"></span><span class="hk"></span>`;
        b.querySelector('.tx').textContent = it.label;
        b.querySelector('.hk').textContent = it.hint || '';
        dd.appendChild(b);
      }
      dd.hidden = false;
      const r = root.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      const scale = r.width / (root.offsetWidth || r.width) || 1; // windows can be scaled in 3D
      let left = (a.left - r.left) / scale, top = (a.bottom - r.top) / scale;
      left = Math.max(0, Math.min(left, root.clientWidth - dd.offsetWidth - 2));
      dd.style.left = left + 'px'; dd.style.top = top + 'px';
    }
    function closeMenu() {
      menuOpen = null;
      els.dropdown.hidden = true;
      root.querySelectorAll('.mu-menu.open').forEach((b) => b.classList.remove('open'));
    }
    on(root.querySelector('.mu-menubar'), 'click', (ev) => {
      const b = ev.target.closest('.mu-menu');
      if (!b) return;
      if (menuOpen === b.dataset.menu) closeMenu(); else openMenu(b.dataset.menu, b);
    });
    on(root.querySelector('.mu-menubar'), 'mouseover', (ev) => {
      const b = ev.target.closest('.mu-menu');
      if (b && menuOpen && menuOpen !== b.dataset.menu) openMenu(b.dataset.menu, b);
    });
    on(els.dropdown, 'click', (ev) => {
      const b = ev.target.closest('.mu-dd-item');
      if (!b || b.disabled) return;
      closeMenu();
      doAction(b.dataset.act);
    });
    on(document, 'pointerdown', (ev) => {
      if (!menuOpen) return;
      if (els.dropdown.contains(ev.target) || ev.target.closest('.mu-menu') || ev.target.closest('[data-act="views"]')) return;
      closeMenu();
    }, true);

    // ---------------------------------------------------------------- responsive
    function layout(w, h) {
      w = w || root.clientWidth; h = h || root.clientHeight;
      if (!w || !h) return;
      root.classList.toggle('is-narrow', w < 600 || ctx.isMobile);
      root.classList.toggle('is-tiny', w < 470);
      root.classList.toggle('is-short', h < 520);
      root.classList.toggle('is-wide', w >= 960);
    }
    let ro = null;
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => layout()); ro.observe(root); }
    layout();

    // ---------------------------------------------------------------- Spotify player
    let fallbackFrame = null;
    function markIframe(f) {
      if (!f) return;
      f.classList.add('xp-iframe');
      f.title = 'Spotify player';
      try { f.loading = 'eager'; } catch (_) { /* fine */ }
    }
    function useFallback(why) {
      if (st.dead || st.mode === 'fallback') return;
      if (why) console.warn('[music] Spotify iFrame API unavailable, using the plain embed:', why.message || why);
      st.mode = 'fallback';
      root.classList.add('is-fallback');
      if (st.ctrl) { try { st.ctrl.destroy(); } catch (_) { /* gone */ } st.ctrl = null; }
      els.embed.textContent = '';
      const f = document.createElement('iframe');
      f.src = `https://open.spotify.com/embed/playlist/${st.playlistId}?utm_source=generator`;
      f.width = '100%'; f.height = '152';
      f.setAttribute('frameborder', '0');
      f.setAttribute('allow', EMBED_ALLOW);
      markIframe(f);
      els.embed.appendChild(f);
      fallbackFrame = f;
      els.cap.textContent = 'Spotify player';
      renderNow();
    }
    function createController(IFrameAPI) {
      if (st.dead) return;
      if (activeInstance && activeInstance !== instance) { try { activeInstance.destroy(); } catch (_) { /* gone */ } }
      activeInstance = instance;
      const first = st.tracks[0];
      const uri = first && first.uri ? first.uri : `spotify:playlist:${st.playlistId}`;
      if (first && first.uri) { st.cur = 0; st.loadedUri = first.uri; }
      let created = false;
      try {
        IFrameAPI.createController(els.slot, { uri, width: '100%', height: 80 }, (ctrl) => {
          created = true;
          if (st.dead) { try { ctrl.destroy(); } catch (_) { /* gone */ } return; }
          st.ctrl = ctrl;
          st.mode = 'api';
          root.classList.remove('is-fallback');
          markIframe(ctrl.iframeElement || els.embed.querySelector('iframe'));
          ctrl.addListener('ready', () => { st.ready = true; els.wait.hidden = true; root.classList.add('is-ready'); if (wantShuffle) setTimeout(shufflePlay, 250); });
          ctrl.addListener('playback_update', onPlayback);
          ctrl.addListener('playback_started', () => { st.switching = false; });
          ctrl.addListener('error', (e) => {
            const d = (e && e.data) || {};
            console.warn('[music] Spotify player:', d.message || d.code || 'error');
            if (d.recoverable === false && st.cur >= 0) showBalloon('This song is not available', 'Skipping to the next one.', 4000), later(() => step(1, true), 900);
          });
          later(() => { els.wait.hidden = true; }, 8000);
          renderNow(); paintRows();
        });
      } catch (err) {
        return useFallback(err);
      }
      if (!created) later(() => { if (!st.ctrl && st.mode !== 'fallback') useFallback(new Error('controller callback never fired')); }, 8000);
    }

    const instance = {
      destroy() {
        if (st.ctrl) { try { st.ctrl.destroy(); } catch (_) { /* gone */ } st.ctrl = null; }
        if (activeInstance === instance) activeInstance = null;
      },
    };

    // ---------------------------------------------------------------- boot
    renderHeader();
    renderTable();
    renderNow();
    root.dataset.state = 'loading';
    (async () => {
      let site = null;
      try { site = await ctx.site; } catch (_) { /* use defaults */ }
      st.playlistId = parsePlaylistId(site && site.settings && site.settings.spotifyPlaylist) || DEFAULT_PLAYLIST;
      const apiP = loadIFrameAPI();
      apiP.catch(() => {}); // handled below
      const data = await loadPlaylist(st.playlistId);
      if (st.dead) return;
      st.data = data;
      st.tracks = data ? data.tracks.map((t, idx) => ({ idx, title: t.title, artists: t.artists || '', ms: Number(t.ms) || 0, uri: t.uri || '' })) : [];
      buildRows();
      renderHeader();
      try {
        const api = await apiP;
        if (st.dead) return;
        createController(api);
      } catch (err) {
        useFallback(err);
      }
      renderTable();
      renderNow();
      root.dataset.state = st.mode;
    })();

    // debug handle for the dev harness (non-enumerable, no globals)
    Object.defineProperty(root, '_music', { value: { st, playIdx, togglePlay, step }, configurable: true });

    return {
      onResize(w, h) { layout(w, h); },
      onBlur() { root.classList.add('is-blurred'); closeMenu(); },
      onFocus() { root.classList.remove('is-blurred'); },
      unmount() {
        removeEventListener('kz-music-shuffle', onShuffleAsk);
        st.dead = true;
        instance.destroy();
        st.timers.forEach((t) => clearTimeout(t)); st.timers.clear();
        st.offs.forEach((f) => f()); st.offs = [];
        if (ro) ro.disconnect();
        if (fallbackFrame) { fallbackFrame.src = 'about:blank'; fallbackFrame.remove(); fallbackFrame = null; }
        root.textContent = '';
      },
    };
  },
};
