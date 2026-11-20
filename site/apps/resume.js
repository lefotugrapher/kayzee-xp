// My Resume: a document viewer showing the CV as a styled A4 page (built from lib/resume-data.js).
import { h, setupRoot, menubar, toolbar, statusbar, msgbox, esc } from './projects.kit.js';
import resume from '../lib/resume-data.js';

const PAGE_W = 794, PAGE_H = 1123; // A4 @ 96 dpi
const PAD = 22;                     // grey margin around pages (CSS px, unscaled)
const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
const CSS_URL = new URL('./resume.css', import.meta.url).href;

const ICON = {
  pin: '<svg viewBox="0 0 12 12" width="10" height="10"><path d="M6 11.4S1.8 7.2 1.8 4.6a4.2 4.2 0 0 1 8.4 0C10.2 7.2 6 11.4 6 11.4z" fill="#2457c9"/><circle cx="6" cy="4.6" r="1.5" fill="#fff"/></svg>',
  mail: '<svg viewBox="0 0 12 12" width="10" height="10"><rect x=".8" y="2.2" width="10.4" height="7.6" rx="1" fill="#2457c9"/><path d="M1.4 3l4.6 3.6L10.6 3" fill="none" stroke="#fff" stroke-width="1"/></svg>',
  web: '<svg viewBox="0 0 12 12" width="10" height="10"><rect x=".6" y=".6" width="10.8" height="10.8" rx="2" fill="#2457c9"/><path d="M3.2 5v3.6M3.2 3.4v.1M5.2 8.6V5m0 1.6c0-1 .7-1.6 1.6-1.6s1.4.6 1.4 1.6v2" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
};

function bullets(list) {
  return h('ul', { class: 'rs-bullets' }, list.map((b) => h('li', { text: b })));
}
function entry(e) {
  return h('div', { class: 'rs-entry' },
    h('div', { class: 'rs-row' }, h('span', { class: 'rs-title', text: e.title }), h('span', { class: 'rs-dates', text: e.dates })),
    h('div', { class: 'rs-row rs-orgrow' }, h('span', { class: 'rs-org', text: e.org }), h('span', { class: 'rs-loc', text: e.location })),
    e.note ? h('p', { class: 'rs-note', text: e.note }) : null,
    e.bullets ? bullets(e.bullets) : null);
}
const mainHead = (t) => h('h2', { class: 'rs-h', text: t });
const sideHead = (t) => h('h2', { class: 'rs-sh', text: t });

function prettyUrl(u) { return String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }

/** Build the résumé pages into `host` (must be in the DOM, unscaled layout). */
export function buildPages(host, settings) {
  host.textContent = '';
  const email = settings.contactEmail || '';
  const linkedin = settings.linkedin || '';
  const name = settings.displayName || resume.name;

  // ---- blocks
  const contact = h('div', { class: 'rs-block' }, sideHead('Contact'),
    h('p', { class: 'rs-contact' }, h('span', { html: ICON.pin }), h('span', { text: settings.location || resume.location })),
    email ? h('p', { class: 'rs-contact' }, h('span', { html: ICON.mail }), h('a', { href: 'mailto:' + email, text: email })) : null,
    linkedin ? h('p', { class: 'rs-contact' }, h('span', { html: ICON.web }), h('a', { href: linkedin, target: '_blank', rel: 'noopener', text: prettyUrl(linkedin) })) : null);
  const sideBlocks = [contact];
  resume.skills.forEach((g, i) => sideBlocks.push(h('div', { class: 'rs-block rs-skill' },
    i === 0 ? sideHead('Skills') : null,
    h('h3', { class: 'rs-sk', text: g.label }),
    h('p', { class: 'rs-sktext', text: g.items.join(' · ') }))));
  sideBlocks.push(h('div', { class: 'rs-block' }, sideHead('Tools'), h('ul', { class: 'rs-taglist' }, resume.tools.map((t) => h('li', { text: t })))));
  sideBlocks.push(h('div', { class: 'rs-block' }, sideHead('Languages'), h('p', { class: 'rs-sktext', text: resume.languages.join(', ') })));
  sideBlocks.push(h('div', { class: 'rs-block' }, sideHead('Interests'), h('p', { class: 'rs-sktext', text: resume.interests.join(', ') + '.' })));

  const mainBlocks = [];
  mainBlocks.push(h('div', { class: 'rs-block' }, mainHead('Summary'), h('p', { class: 'rs-summary', text: resume.summary })));
  resume.experience.forEach((e, i) => mainBlocks.push(h('div', { class: 'rs-block' }, i === 0 ? mainHead('Work Experience') : null, entry(e))));
  resume.education.forEach((e, i) => mainBlocks.push(h('div', { class: 'rs-block' }, i === 0 ? mainHead('Education') : null, entry(e))));
  resume.projects.forEach((e, i) => mainBlocks.push(h('div', { class: 'rs-block' }, i === 0 ? mainHead('Freelance and Campaign Projects') : null, entry(e))));

  // ---- pages
  const pages = [];
  function newPage() {
    const n = pages.length + 1;
    const side = h('aside', { class: 'rs-side' });
    const main = h('div', { class: 'rs-main' });
    const head = n === 1
      ? h('header', { class: 'rs-header' },
        h('h1', { class: 'rs-name', text: name }),
        h('p', { class: 'rs-tagline', text: resume.tagline.replace(/\s*\|\s*/g, '  |  ') }))
      : h('header', { class: 'rs-header rs-header-cont' },
        h('span', { class: 'rs-name-sm', text: name }), h('span', { class: 'rs-pageno', text: 'Page ' + n }));
    const page = h('article', { class: 'rs-page' + (n === 1 ? ' first' : ''), 'aria-label': 'Résumé page ' + n },
      head, h('div', { class: 'rs-accent' }), h('div', { class: 'rs-cols' }, side, main));
    host.append(page);
    pages.push({ page, side, main });
    return pages[pages.length - 1];
  }
  function flow(blocks, key) {
    let pi = 0;
    for (const b of blocks) {
      let p = pages[pi] || newPage();
      p[key].append(b);
      if (p[key].scrollHeight > p[key].clientHeight + 1 && p[key].childElementCount > 1) {
        b.remove();
        pi++;
        p = pages[pi] || newPage();
        p[key].append(b);
      }
    }
  }
  newPage();
  flow(mainBlocks, 'main');
  flow(sideBlocks, 'side');
  // continuation pages with nothing in the sidebar: give the main column the full width
  pages.forEach((p, i) => { if (i > 0 && !p.side.childElementCount) p.page.classList.add('rs-noside'); });
  return pages.map((p) => p.page);
}

export default {
  id: 'resume',
  title: 'My Resume',
  icon: 'resume',
  size: [700, 640],
  minSize: [380, 320],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    let settings = {};
    let zoom = 1; let fit = true; let pages = [];

    // ---- chrome
    const menus = menubar([
      { label: '&File', items: [
        { label: '&Save a Copy...', action: () => save(), disabled: () => !settings.resumePdfUrl },
        { label: '&Print...', shortcut: 'Ctrl+P', action: () => print() },
        { sep: true },
        { label: 'E&xit', action: () => ctx.close() },
      ] },
      { label: '&View', items: [
        { label: 'Zoom &In', shortcut: '+', action: () => stepZoom(1) },
        { label: 'Zoom &Out', shortcut: '-', action: () => stepZoom(-1) },
        { sep: true },
        { label: '&Fit Width', checked: () => fit, action: () => setFit() },
        { label: '&Actual Size', checked: () => !fit && Math.abs(zoom - 1) < 0.01, action: () => setZoom(1) },
      ] },
      { label: '&Help', items: [
        { label: '&About My Resume', action: () => msgbox(root, { title: 'About My Resume', icon: 'info32', text: 'My Resume, version 1.0\n\nA page viewer for Kshitiz Mittal\'s CV.\nClick the page to zoom, then drag to look around.' }) },
      ] },
    ]);
    const tools = toolbar([
      { id: 'zoom', icon: 'zoom', label: 'Zoom', action: () => toggleZoom() },
      { id: 'save', icon: 'save', label: 'Save', title: 'Save a PDF copy', action: () => save() },
      { id: 'print', icon: 'print', label: 'Print', action: () => print() },
      '|',
      { id: 'contact', icon: 'contact', label: 'Contact Me', action: () => ctx.openApp('contact') },
    ]);
    tools.btns.save.hidden = true;

    const pagesHost = h('div', { class: 'rs-pages' });
    const stage = h('div', { class: 'rs-stage' }, pagesHost);
    const canvas = h('div', { class: 'rs-canvas', tabindex: '0', role: 'document', 'aria-label': 'Résumé document' }, stage);
    const status = statusbar([{ text: 'Click to zoom, then drag to look around', flex: true }, { text: '', width: 90 }, { text: '', width: 64 }]);
    root.append(menus, tools, canvas, status);

    // ---- layout / zoom
    function scaleNow() { return fit ? fitScale() : zoom; }
    function fitScale() {
      const avail = Math.max(120, canvas.clientWidth - PAD * 2);
      return Math.min(1.25, avail / PAGE_W);
    }
    function layout(anchor) {
      const s = scaleNow();
      const n = Math.max(1, pages.length);
      const pw = PAGE_W * s, ph = (PAGE_H * n + PAD * (n - 1)) * s;
      const sw = Math.max(canvas.clientWidth, pw + PAD * 2);
      const sh = ph + PAD * 2;
      // keep the anchor point (content coords) under the same viewport point
      let ax, ay, vx, vy;
      if (anchor) {
        const prev = stage._s || s;
        const left = parseFloat(pagesHost.style.left) || 0;
        ax = (anchor.x + canvas.scrollLeft - left) / prev; ay = (anchor.y + canvas.scrollTop - PAD) / prev;
        vx = anchor.x; vy = anchor.y;
      }
      stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
      const left = Math.round((sw - pw) / 2);
      pagesHost.style.left = left + 'px'; pagesHost.style.top = PAD + 'px';
      pagesHost.style.transform = `scale(${s})`;
      stage._s = s;
      if (anchor) { canvas.scrollLeft = ax * s + left - vx; canvas.scrollTop = ay * s + PAD - vy; }
      root.classList.toggle('rs-zoomed', canvas.scrollWidth > canvas.clientWidth + 2 || !fit);
      status.set(2, Math.round(s * 100) + '%');
      updatePageNo();
    }
    function setFit() { fit = true; layout(); }
    function setZoom(z, anchor) {
      fit = false; zoom = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], z));
      layout(anchor || { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
    }
    function stepZoom(dir, anchor) {
      const cur = scaleNow();
      const next = dir > 0 ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01);
      if (next) setZoom(next, anchor);
    }
    function toggleZoom(anchor) {
      const fs = fitScale();
      if (fit || scaleNow() <= fs + 0.01) {
        setZoom(Math.max(1.25, fs * 1.6), anchor);
        status.set(0, 'Drag to look around · click to zoom back out');
      } else {
        fit = true; layout(anchor);
        status.set(0, 'Click to zoom, then drag to look around');
      }
    }
    function updatePageNo() {
      const s = scaleNow();
      const n = Math.max(1, pages.length);
      const mid = canvas.scrollTop + canvas.clientHeight / 2 - PAD;
      const cur = Math.min(n, Math.max(1, Math.floor(mid / ((PAGE_H + PAD) * s)) + 1));
      status.set(1, `Page ${cur} of ${n}`);
    }

    // ---- click to zoom / drag to pan
    let drag = null;
    bag.on(canvas, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('a')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: canvas.scrollLeft, st: canvas.scrollTop, moved: false, type: e.pointerType, onPage: !!e.target.closest('.rs-page') };
      if (e.pointerType === 'mouse') { canvas.setPointerCapture(e.pointerId); e.preventDefault(); canvas.focus({ preventScroll: true }); }
    });
    bag.on(canvas, 'pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; root.classList.add('rs-dragging'); }
      if (drag.moved && drag.type === 'mouse') { canvas.scrollLeft = drag.sl - dx; canvas.scrollTop = drag.st - dy; }
    });
    const end = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag; drag = null;
      root.classList.remove('rs-dragging');
      if (e.type === 'pointercancel') return;
      if (!d.moved && d.onPage) {
        const r = canvas.getBoundingClientRect();
        toggleZoom({ x: e.clientX - r.left, y: e.clientY - r.top });
      }
    };
    bag.on(canvas, 'pointerup', end);
    bag.on(canvas, 'pointercancel', end);
    bag.on(canvas, 'scroll', updatePageNo, { passive: true });
    bag.on(canvas, 'wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const s = scaleNow() * Math.exp(-e.deltaY * 0.01);
      setZoom(s, { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });
    bag.on(root, 'keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); print(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
      else if (e.key === '-') { e.preventDefault(); stepZoom(-1); }
      else if (e.key === '0') { e.preventDefault(); setFit(); }
    });

    // ---- actions
    function save() {
      const url = settings.resumePdfUrl;
      if (!url) return;
      const a = h('a', { href: url, download: 'Kshitiz_Mittal_CV.pdf', target: '_blank', rel: 'noopener', style: { display: 'none' } });
      document.body.append(a); a.click(); a.remove();
      status.set(0, 'Downloading Kshitiz_Mittal_CV.pdf');
    }
    function print() {
      if (!pages.length) return;
      const frame = h('iframe', { class: 'rs-printframe', title: 'Print résumé', 'aria-hidden': 'true', tabindex: '-1' });
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(settings.displayName || resume.name)} - CV</title>
        <link rel="stylesheet" href="${CSS_URL}"><style>@page{size:A4;margin:0}html,body{margin:0;background:#fff}</style></head><body><div class="app-resume rs-print">${pages.map((p) => p.outerHTML).join('')}</div></body></html>`;
      frame.srcdoc = html;
      frame.addEventListener('load', () => {
        try {
          const w = frame.contentWindow;
          w.focus();
          w.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 100));
          w.print();
          setTimeout(() => frame.isConnected && frame.remove(), 60000);
        } catch (err) { frame.remove(); window.print(); }
      }, { once: true });
      document.body.append(frame);
      status.set(0, 'Sending the résumé to your printer...');
    }

    // ---- build
    let alive = true;
    function render() {
      pagesHost.style.transform = 'none';
      pages = buildPages(pagesHost, settings);
      layout();
    }
    render();
    ctx.site.then((site) => {
      if (!alive) return;
      settings = (site && site.settings) || {};
      tools.btns.save.hidden = !settings.resumePdfUrl;
      render();
    }).catch(() => {});

    const ro = new ResizeObserver(() => layout());
    ro.observe(canvas);
    bag.push(() => ro.disconnect());

    return {
      unmount() { alive = false; bag.dispose(); },
      onResize() { layout(); },
    };
  },
};
