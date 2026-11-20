// About Me: who Kshitiz is, at a glance, for recruiters.
import { h, setupRoot, iconSVG } from './projects.kit.js';
import resume from '../lib/resume-data.js';

// Original voxel portrait: a photographer holding a camera up to his face.
const PORTRAIT = [
  '.......hhhhhh.......',
  '.....hhhhhhhhhh.....',
  '....hhHHhhhhhhhhh...',
  '...hhhhhhhhhhhhhhh..',
  '...hhhsssssssssshh..',
  '...hhssssssssssssh..',
  '..fKKKKKKKKKKKKKKf..',
  '..fkkkkkllllllkkkf..',
  '..fkkkkllLLLLllkkf..',
  '..fkrkklLgLLLLlkkf..',
  '..fkkkklLLLLLLlkkf..',
  '..fkkkklLLLLLLlkkf..',
  '..fkkkkllLLLLllkkf..',
  '...kkkkkllllllkkk...',
  '....ssssssssssss....',
  '.......SssssS.......',
  '...ccccwwwwwwcccc...',
  '..ccccccwwwwcccccc..',
  '.cccccccccccccccccc.',
  'cCccccccccccccccccCc',
];
const PAL = {
  h: '#2a211c', H: '#54433a', s: '#b97a4c', S: '#94582f', f: '#c58656',
  K: '#59606d', k: '#2b2f38', l: '#9aa3b3', L: '#2f6cc4', g: '#cde8ff', r: '#e2352a',
  c: '#3a404c', C: '#272c35', w: '#f3f3f3',
};

export function drawPortrait(px = 96) {
  const dpr = Math.min(2, window.devicePixelRatio || 1) || 1;
  const c = document.createElement('canvas');
  c.width = px * dpr; c.height = px * dpr;
  c.style.width = px + 'px'; c.style.height = px + 'px';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'Voxel portrait of Kshitiz holding a camera');
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  // sky + hill backdrop
  const sky = g.createLinearGradient(0, 0, 0, px);
  sky.addColorStop(0, '#2f7cf0'); sky.addColorStop(.62, '#8cc3ff'); sky.addColorStop(1, '#d8edff');
  g.fillStyle = sky; g.fillRect(0, 0, px, px);
  const cell = Math.floor(px / 22);
  const cols = Math.ceil(px / cell);
  for (let x = 0; x < cols; x++) {
    const top = Math.round(px * 0.66 + Math.sin(x * 0.42 + 1.2) * cell * 1.4);
    for (let y = top; y < px; y += cell) {
      g.fillStyle = ((x + Math.floor(y / cell)) % 3 === 0) ? '#46ad35' : '#3c9d2c';
      g.fillRect(x * cell, y, cell, cell);
    }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x * cell, top, cell, 1);
  }
  // little cloud
  g.fillStyle = 'rgba(255,255,255,.9)';
  [[2, 3, 4], [3, 2, 2], [15, 4, 4], [16, 3, 2]].forEach(([x, y, w]) => g.fillRect(x * cell, y * cell, w * cell, cell));
  // figure
  const ox = Math.round((px - 20 * cell) / 2), oy = px - 20 * cell;
  PORTRAIT.forEach((row, r) => [...row].forEach((ch, i) => {
    const col = PAL[ch]; if (!col) return;
    const x = ox + i * cell, y = oy + r * cell;
    g.fillStyle = col; g.fillRect(x, y, cell, cell);
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x, y, cell, 1);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, y + cell - 1, cell, 1);
  }));
  return c;
}

// small original badge icons for highlight cards
const BADGES = {
  su: `<svg viewBox="0 0 32 32" width="32" height="32"><defs><linearGradient id="kxab1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7db8ff"/><stop offset="1" stop-color="#1f5fd0"/></linearGradient></defs>
    <rect x="3" y="20" width="26" height="9" rx="1.5" fill="url(#kxab1)" stroke="#16449a"/><rect x="9" y="14" width="14" height="7" rx="1" fill="#e9eef8" stroke="#6d7a8f"/>
    <circle cx="16" cy="8" r="4.2" fill="#c58656" stroke="#7a4a26"/><path d="M11.6 7.2c.4-3 2.4-4 4.6-4s4 1.2 4.2 3.8c-2.4-1.2-5.6-1.2-8.8.2z" fill="#2a211c"/>
    <path d="M12 23.5h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  canopy: `<svg viewBox="0 0 32 32" width="32" height="32"><defs><linearGradient id="kxab2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9d4c8"/></linearGradient></defs>
    <path d="M7 12h16l-2 15.4c-.1.9-.9 1.6-1.8 1.6h-8.4c-.9 0-1.7-.7-1.8-1.6z" fill="url(#kxab2)" stroke="#6d6556"/>
    <path d="M8.2 17.5h13.6l-.6 4.6H8.8z" fill="#3c9d2c"/><path d="M23 15h2.4a3 3 0 0 1 0 6H22.4" fill="none" stroke="#6d6556" stroke-width="1.6"/>
    <rect x="6" y="9.6" width="18" height="3" rx="1" fill="#7b4a2a" stroke="#4d2c16"/>
    <path d="M12 7c0-2 2-2 2-4M16.5 7c0-2 2-2 2-4" stroke="#9aa3b3" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  sharpz: `<svg viewBox="0 0 32 32" width="32" height="32">
    <circle cx="9.5" cy="23" r="4.2" fill="none" stroke="#c2340f" stroke-width="2.4"/><circle cx="22.5" cy="23" r="4.2" fill="none" stroke="#c2340f" stroke-width="2.4"/>
    <path d="M12 20.2L24.5 3.5M20 20.2L7.5 3.5" stroke="#7d8696" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 20.2L24.5 3.5" stroke="#d9dee7" stroke-width="1" stroke-linecap="round"/><circle cx="16" cy="15" r="1.4" fill="#4a505c"/></svg>`,
  research: `<svg viewBox="0 0 32 32" width="32" height="32"><defs><linearGradient id="kxab3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e4e8ef"/></linearGradient></defs>
    <rect x="3" y="4" width="26" height="17" rx="1" fill="url(#kxab3)" stroke="#5b616c"/><rect x="2" y="3" width="28" height="2.4" rx="1" fill="#8a919e"/>
    <rect x="7" y="13" width="3.4" height="5" fill="#2f9be0"/><rect x="12.4" y="10" width="3.4" height="8" fill="#3caa3c"/><rect x="17.8" y="7.4" width="3.4" height="10.6" fill="#f7c21e"/>
    <path d="M16 21v6M11 29l5-2.4 5 2.4" stroke="#5b616c" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
};

export default {
  id: 'about',
  title: 'About Me',
  icon: 'about',
  size: [660, 590],
  minSize: [360, 320],
  single: true,
  resizable: true,
  mount(root, ctx) {
    const bag = setupRoot(root);
    const nameEl = h('h1', { class: 'ab-name', text: resume.name });
    const nickEl = h('span', { class: 'ab-nick', text: `"${resume.nickname}"` });
    const roleEl = h('p', { class: 'ab-role', text: resume.tagline.replace(/\s*\|\s*/g, ' · ') });
    const locEl = h('p', { class: 'ab-loc' }, h('span', { class: 'ab-pin', 'aria-hidden': 'true' }), h('span', { text: resume.location }));
    const bioEl = h('p', { class: 'ab-bio', text: resume.summary });

    const cards = resume.highlights.map((hl) => h('article', { class: 'ab-card' },
      h('span', { class: 'ab-badge', html: BADGES[hl.key] || '' }),
      h('div', { class: 'ab-card-text' }, h('h3', { text: hl.title }), h('p', { text: hl.text }))));

    const chips = resume.chips.map((c) => h('li', { class: 'ab-chip', text: c }));

    const btnResume = h('button', { class: 'xp-btn default', type: 'button' }, h('span', { html: iconSVG('doc', 16) }), 'Open My Resume');
    const btnProjects = h('button', { class: 'xp-btn', type: 'button' }, h('span', { html: iconSVG('folder', 16) }), 'View My Projects');
    const btnContact = h('button', { class: 'xp-btn', type: 'button' }, h('span', { html: iconSVG('mail', 16) }), 'Contact Me');
    const btnLinked = h('button', { class: 'xp-btn', type: 'button', hidden: true }, h('span', { html: iconSVG('linkedin', 16) }), 'LinkedIn');
    btnResume.addEventListener('click', () => ctx.openApp('resume'));
    btnProjects.addEventListener('click', () => ctx.openApp('projects'));
    btnContact.addEventListener('click', () => ctx.openApp('contact'));

    const avatar = h('div', { class: 'ab-avatar' });
    avatar.append(drawPortrait(96));

    root.append(
      h('div', { class: 'ab-scroll' },
        h('header', { class: 'ab-head' },
          avatar,
          h('div', { class: 'ab-id' }, h('div', { class: 'ab-nameline' }, nameEl, nickEl), roleEl, locEl)),
        h('div', { class: 'ab-body' },
          h('section', { class: 'ab-sec' }, h('h2', { text: 'About me' }), bioEl),
          h('section', { class: 'ab-sec' }, h('h2', { text: 'Highlights' }), h('div', { class: 'ab-cards' }, cards)),
          h('section', { class: 'ab-sec' }, h('h2', { text: 'Skills' }), h('ul', { class: 'ab-chips' }, chips)))),
      h('footer', { class: 'ab-actions' }, btnResume, btnProjects, btnContact, btnLinked));

    let alive = true;
    ctx.site.then((site) => {
      if (!alive) return;
      const s = (site && site.settings) || {};
      if (s.displayName) nameEl.textContent = s.displayName;
      if (s.nickname) nickEl.textContent = `"${s.nickname}"`;
      if (s.role) roleEl.textContent = s.role;
      if (s.location) locEl.lastChild.textContent = s.location;
      if (s.about) bioEl.textContent = s.about;
      if (s.linkedin) {
        btnLinked.hidden = false;
        btnLinked.addEventListener('click', () => window.open(s.linkedin, '_blank', 'noopener'));
      }
    }).catch(() => {});

    return {
      unmount() { alive = false; bag.dispose(); },
      onFocus() {},
    };
  },
};
