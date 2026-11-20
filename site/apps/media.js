// Media Player: plays video projects (YouTube / Vimeo embeds, direct video files, other embeds)
// and shows picture projects in a zoomable viewer.
import { h, setupRoot, menubar, toolbar, msgbox, iconSVG, embedSrc, detectType, visibleProjects } from './projects.kit.js';

export function resolveMedia(rawUrl, mode) {
  const url = embedSrc(rawUrl);
  if (mode === 'image') return { kind: 'image', src: url };
  let m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) {
    const t = url.match(/[?&](?:t|start)=(\d+)/);
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1${t ? '&start=' + t[1] : ''}` };
  }
  m = url.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([0-9a-f]+))?/);
  if (m) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}?dnt=1${m[2] ? '&h=' + m[2] : ''}` };
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return { kind: 'file', src: url };
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url)) return { kind: 'image', src: url };
  return { kind: 'frame', src: url };
}

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export default {
  id: 'media',
  title: 'Media Player',
  icon: 'media',
  size: [720, 500],
  minSize: [360, 280],
  single: false,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    const args = ctx.args || {};
    let list = [];          // projects of the same family (videos or pictures) for prev/next
    let current = null;     // { title, sub, kind, src, id }
    let video = null; let frame = null; let img = null;
    let zoom = 0;           // 0 = fit (pictures)
    let alive = true;

    // ---------------------------------------------------------------- chrome
    const menus = menubar([
      { label: '&File', items: [
        { label: '&Previous', disabled: () => list.length < 2, action: () => step(-1) },
        { label: '&Next', disabled: () => list.length < 2, action: () => step(1) },
        { sep: true },
        { label: '&Close', action: () => ctx.close() },
      ] },
      { label: '&View', items: [
        { label: '&Full Screen', shortcut: 'F', action: () => fullscreen() },
        { sep: true },
        { label: '&Best Fit', hidden: () => current?.kind !== 'image', checked: () => zoom === 0, action: () => setZoom(0) },
        { label: '&Actual Size', hidden: () => current?.kind !== 'image', checked: () => zoom === 1, action: () => setZoom(1) },
      ] },
      { label: '&Play', items: [
        { label: '&Play/Pause', shortcut: 'Space', disabled: () => !video, action: () => toggle() },
        { label: '&Stop', disabled: () => !video, action: () => stopPlay() },
        { sep: true },
        { label: '&Mute', checked: () => !!(video && video.muted), disabled: () => !video, action: () => mute() },
      ] },
      { label: '&Help', items: [
        { label: '&About Media Player', action: () => msgbox(root, { title: 'About Media Player', icon: 'info32', text: 'Media Player, version 1.0\n\nPlays Kshitiz\'s video work and shows his pictures.' }) },
      ] },
    ], { logo: false });

    const titleEl = h('span', { class: 'mp-np-title', text: 'Media Player' });
    const subEl = h('span', { class: 'mp-np-sub', text: '' });
    const nowPlaying = h('div', { class: 'mp-np' }, h('span', { class: 'mp-np-ico', html: iconSVG('video', 16) }), h('div', { class: 'mp-np-text' }, titleEl, subEl));
    const stage = h('div', { class: 'mp-stage', tabindex: '0', 'aria-label': 'Media' });

    // transport (video)
    const seek = h('input', { class: 'mp-seek', type: 'range', min: '0', max: '1000', value: '0', step: '1', 'aria-label': 'Seek' });
    const vol = h('input', { class: 'mp-vol', type: 'range', min: '0', max: '100', value: '80', 'aria-label': 'Volume' });
    const tbtn = (cls, icon, label, fn) => { const b = h('button', { class: 'mp-b ' + cls, type: 'button', 'aria-label': label, title: label, html: iconSVG(icon, cls.includes('mp-play') ? 26 : 18) }); b.addEventListener('click', fn); return b; };
    const bPlay = tbtn('mp-play', 'play', 'Play', () => toggle());
    const bStop = tbtn('', 'mstop', 'Stop', () => stopPlay());
    const bPrev = tbtn('', 'prev', 'Previous', () => step(-1));
    const bNext = tbtn('', 'next', 'Next', () => step(1));
    const bMute = tbtn('', 'volume', 'Mute', () => mute());
    const bFull = tbtn('', 'fullscreen', 'Full screen', () => fullscreen());
    const lcd = h('span', { class: 'mp-lcd' }, h('span', { class: 'mp-lcd-state', text: 'Ready' }), h('span', { class: 'mp-lcd-time', text: '' }));
    const transport = h('div', { class: 'mp-transport' },
      h('div', { class: 'mp-seekrow' }, seek),
      h('div', { class: 'mp-controls' },
        h('div', { class: 'mp-left' }, bPlay, bStop, h('span', { class: 'mp-gap' }), bPrev, bNext),
        lcd,
        h('div', { class: 'mp-right' }, bMute, vol, bFull)));

    // picture toolbar
    const ptools = toolbar([
      { id: 'prev', icon: 'picPrev', title: 'Previous picture', action: () => step(-1) },
      { id: 'next', icon: 'picNext', title: 'Next picture', action: () => step(1) },
      '|',
      { id: 'fit', icon: 'fit', title: 'Best fit', action: () => setZoom(0) },
      { id: 'actual', icon: 'actual', title: 'Actual size', action: () => setZoom(1) },
      '|',
      { id: 'zin', icon: 'zoomin', title: 'Zoom in', action: () => zoomBy(1.25) },
      { id: 'zout', icon: 'zoomout', title: 'Zoom out', action: () => zoomBy(0.8) },
      '|',
      { id: 'full', icon: 'expand', title: 'Full screen', action: () => fullscreen() },
    ], { big: false, cls: 'mp-ptools' });

    root.append(menus, nowPlaying, stage, transport, ptools);

    // ---------------------------------------------------------------- load
    function clearStage() {
      if (video) { try { video.pause(); } catch (_) { /* */ } video.removeAttribute('src'); video.load(); }
      video = null; frame = null; img = null;
      stage.textContent = '';
    }
    function load(item) {
      clearStage();
      current = item;
      zoom = 0;
      const isPic = item.kind === 'image';
      root.classList.toggle('mp-picture', isPic);
      root.classList.toggle('mp-embed', item.kind === 'youtube' || item.kind === 'vimeo' || item.kind === 'frame');
      titleEl.textContent = item.title || 'Untitled';
      subEl.textContent = item.sub || '';
      nowPlaying.querySelector('.mp-np-ico').innerHTML = iconSVG(isPic ? 'image' : 'video', 16);
      ctx.setTitle(`${item.title || 'Untitled'} - Media Player`);
      const many = list.length > 1;
      [bPrev, bNext, ptools.btns.prev, ptools.btns.next].forEach((b) => { b.disabled = !many; });

      if (isPic) {
        img = h('img', { class: 'mp-img', src: item.src, alt: item.title || 'Picture', draggable: 'false' });
        const holder = h('div', { class: 'mp-imgwrap' }, img);
        stage.append(holder);
        img.addEventListener('load', () => layoutImg(), { once: true });
        img.addEventListener('error', () => { stage.textContent = ''; stage.append(errorEl('Media Player can\'t show this picture.')); }, { once: true });
        lcdSet('Picture', '');
      } else if (item.kind === 'file') {
        video = h('video', { class: 'mp-video', src: item.src, preload: 'metadata', playsinline: true });
        video.volume = vol.value / 100;
        stage.append(video);
        wireVideo(video);
        lcdSet('Ready', '0:00');
      } else {
        frame = h('iframe', { class: 'xp-iframe mp-frame', src: item.src, title: item.title || 'Video', allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' });
        const spin = h('div', { class: 'mp-buffer' }, h('span', { class: 'mp-buffer-ring' }), h('span', { text: 'Connecting to media...' }));
        frame.addEventListener('load', () => { spin.remove(); lcdSet('Streaming', ''); }, { once: true });
        stage.append(frame, spin);
        lcdSet('Connecting...', '');
      }
      updatePlayBtn();
    }
    function errorEl(t) { return h('div', { class: 'mp-error' }, h('span', { html: iconSVG('error32', 32) }), h('p', { text: t })); }
    function lcdSet(state, time) { lcd.firstChild.textContent = state; lcd.lastChild.textContent = time; }

    // ---------------------------------------------------------------- video
    let seeking = false;
    function wireVideo(v) {
      v.addEventListener('loadedmetadata', () => lcdSet('Ready', `0:00 / ${fmt(v.duration)}`));
      v.addEventListener('timeupdate', () => {
        if (!seeking && v.duration) seek.value = String(Math.round((v.currentTime / v.duration) * 1000));
        paintSeek();
        lcdSet(v.paused ? 'Paused' : 'Playing', `${fmt(v.currentTime)} / ${fmt(v.duration)}`);
      });
      v.addEventListener('play', updatePlayBtn); v.addEventListener('pause', updatePlayBtn);
      v.addEventListener('ended', () => { updatePlayBtn(); lcdSet('Finished', `${fmt(v.duration)} / ${fmt(v.duration)}`); });
      v.addEventListener('waiting', () => lcdSet('Buffering...', lcd.lastChild.textContent));
      v.addEventListener('error', () => { if (video !== v) return; stage.textContent = ''; stage.append(errorEl('Media Player can\'t play this file.')); video = null; updatePlayBtn(); lcdSet('Error', ''); });
      v.addEventListener('click', () => toggle());
      v.addEventListener('dblclick', () => fullscreen());
    }
    function paintSeek() { seek.style.setProperty('--p', (seek.value / 10) + '%'); vol.style.setProperty('--p', vol.value + '%'); }
    function updatePlayBtn() {
      const playing = video && !video.paused && !video.ended;
      bPlay.innerHTML = iconSVG(playing ? 'pause' : 'play', 26);
      bPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play'); bPlay.title = playing ? 'Pause' : 'Play';
      [bPlay, bStop, seek].forEach((b) => { b.disabled = !video; });
    }
    function toggle() {
      if (!video) return;
      if (video.paused || video.ended) video.play().catch(() => lcdSet('Click play to start', ''));
      else video.pause();
    }
    function stopPlay() { if (!video) return; video.pause(); video.currentTime = 0; seek.value = '0'; paintSeek(); lcdSet('Stopped', `0:00 / ${fmt(video.duration)}`); }
    function mute() {
      if (!video) return;
      video.muted = !video.muted;
      bMute.innerHTML = iconSVG(video.muted ? 'mute' : 'volume', 18);
    }
    bag.on(seek, 'input', () => { seeking = true; paintSeek(); if (video && video.duration) lcdSet('Seeking', `${fmt(video.duration * seek.value / 1000)} / ${fmt(video.duration)}`); });
    bag.on(seek, 'change', () => { seeking = false; if (video && video.duration) video.currentTime = video.duration * seek.value / 1000; });
    bag.on(vol, 'input', () => { paintSeek(); if (video) { video.volume = vol.value / 100; video.muted = false; bMute.innerHTML = iconSVG('volume', 18); } });

    function fullscreen() {
      const el = stage;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    }

    // ---------------------------------------------------------------- pictures
    let pan = null;
    function layoutImg() {
      if (!img || !img.naturalWidth) return;
      const wrap = img.parentElement;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const fitS = Math.min(1, (sw - 24) / img.naturalWidth, (sh - 24) / img.naturalHeight);
      const s = zoom === 0 ? fitS : zoom;
      const w = Math.round(img.naturalWidth * s), hh = Math.round(img.naturalHeight * s);
      img.style.width = w + 'px'; img.style.height = hh + 'px';
      wrap.style.width = Math.max(sw, w + 24) + 'px'; wrap.style.height = Math.max(sh, hh + 24) + 'px';
      root.classList.toggle('mp-pannable', w > sw || hh > sh);
      lcdSet('Picture', `${img.naturalWidth} × ${img.naturalHeight} · ${Math.round(s * 100)}%`);
      ptools.btns.fit.classList.toggle('pressed', zoom === 0);
      ptools.btns.actual.classList.toggle('pressed', zoom === 1);
    }
    function curScale() {
      if (!img || !img.naturalWidth) return 1;
      return zoom || Math.min(1, (stage.clientWidth - 24) / img.naturalWidth, (stage.clientHeight - 24) / img.naturalHeight);
    }
    function setZoom(z, anchor) {
      if (!img) return;
      const prev = curScale();
      const ax = anchor ? anchor.x : stage.clientWidth / 2, ay = anchor ? anchor.y : stage.clientHeight / 2;
      const cx = (stage.scrollLeft + ax) / prev, cy = (stage.scrollTop + ay) / prev;
      zoom = z ? Math.max(0.05, Math.min(8, z)) : 0;
      layoutImg();
      const s = curScale();
      stage.scrollLeft = cx * s - ax; stage.scrollTop = cy * s - ay;
    }
    function zoomBy(f, anchor) { setZoom(curScale() * f, anchor); }
    bag.on(stage, 'wheel', (e) => {
      if (!img) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0025), { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });
    bag.on(stage, 'pointerdown', (e) => {
      if (!img || e.button !== 0 || e.pointerType !== 'mouse') return;
      pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
      stage.setPointerCapture(e.pointerId); root.classList.add('mp-panning');
    });
    bag.on(stage, 'pointermove', (e) => { if (pan) { stage.scrollLeft = pan.sl - (e.clientX - pan.x); stage.scrollTop = pan.st - (e.clientY - pan.y); } });
    const endPan = () => { pan = null; root.classList.remove('mp-panning'); };
    bag.on(stage, 'pointerup', endPan); bag.on(stage, 'pointercancel', endPan);
    bag.on(stage, 'dblclick', () => { if (img) setZoom(zoom === 0 ? 1 : 0); });

    // ---------------------------------------------------------------- keys / resize
    bag.on(root, 'keydown', (e) => {
      if (e.target.closest && e.target.closest('input[type=range]') && (e.key.startsWith('Arrow'))) return;
      if (e.key === ' ' && video) { e.preventDefault(); toggle(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fullscreen(); }
      else if (e.key === 'ArrowRight' && img) { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft' && img) { e.preventDefault(); step(-1); }
      else if ((e.key === '+' || e.key === '=') && img) { e.preventDefault(); zoomBy(1.25); }
      else if (e.key === '-' && img) { e.preventDefault(); zoomBy(0.8); }
    });
    const ro = new ResizeObserver(() => { if (img) layoutImg(); });
    ro.observe(stage);
    bag.push(() => ro.disconnect());

    // ---------------------------------------------------------------- playlist
    function itemFor(p, mode) {
      const t = mode || (detectType(p) === 'image' ? 'image' : undefined);
      const r = resolveMedia(p.url, t);
      return { ...r, id: p.id, title: p.title, sub: [p.category, p.year].filter(Boolean).join(' · ') };
    }
    function step(d) {
      if (list.length < 2 || !current) return;
      const i = list.findIndex((p) => p.id === current.id);
      const p = list[(i + d + list.length) % list.length];
      load(itemFor(p, current.kind === 'image' ? 'image' : undefined));
    }

    // initial: direct URL or project
    paintSeek();
    if (args.url) {
      load({ ...resolveMedia(args.url, args.mode), title: args.title || 'Untitled', sub: '' });
    } else {
      titleEl.textContent = 'Loading...';
      lcdSet('Connecting...', '');
      updatePlayBtn();
    }
    ctx.site.then((site) => {
      if (!alive) return;
      const all = visibleProjects(site);
      const wantImage = args.mode === 'image';
      const p = all.find((x) => x.id === args.projectId);
      const isImg = wantImage || (p && detectType(p) === 'image');
      list = all.filter((x) => (isImg ? detectType(x) === 'image' : detectType(x) === 'video'));
      if (p && !list.includes(p)) list.unshift(p);
      if (args.url) return;
      if (p) load(itemFor(p, isImg ? 'image' : undefined));
      else if (list[0]) load(itemFor(list[0]));
      else {
        titleEl.textContent = 'Media Player'; subEl.textContent = '';
        stage.textContent = '';
        stage.append(h('div', { class: 'mp-error' }, h('span', { html: iconSVG('video', 32) }), h('p', { text: args.projectId ? 'This project isn\'t available any more.' : 'Nothing to play yet. Open a video from My Projects.' })));
        lcdSet('Ready', '');
      }
    }).catch(() => {});

    return {
      unmount() { alive = false; clearStage(); bag.dispose(); },
      onBlur() {},
    };
  },
};
