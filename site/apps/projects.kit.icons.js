// Kayzee XP apps kit: original glossy SVG icons (drawn for this project, not copied).
// Every icon is authored on a 24x24 grid; ico(name, px) scales it.

let uid = 0;
const lg = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('')}</linearGradient>`;
const rg = (id, cx, cy, r, stops) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('')}</radialGradient>`;

// shared pieces ---------------------------------------------------------------
const orb = (u, c1, c2, c3) => `
  <defs>${rg(u + 'o', '.38', '.3', '.75', [[0, c1], [.55, c2], [1, c3]])}
  ${lg(u + 'h', 0, 0, 0, 1, [[0, '#fff', .9], [1, '#fff', 0]])}</defs>
  <circle cx="12" cy="12" r="10.2" fill="url(#${u}o)" stroke="${c3}" stroke-width="1"/>
  <ellipse cx="12" cy="7.4" rx="6.6" ry="4" fill="url(#${u}h)" opacity=".75"/>`;

const folderShape = (u, open) => `
  <defs>${lg(u + 'f', 0, 0, 0, 1, [[0, '#fff3b8'], [.45, '#fbd75b'], [1, '#e3a521']])}
  ${lg(u + 'b', 0, 0, 0, 1, [[0, '#f7cf55'], [1, '#d8961a']])}</defs>
  <path d="M2 6.2c0-.8.6-1.4 1.4-1.4h5.3l1.8 1.9h10.1c.8 0 1.4.6 1.4 1.4V19c0 .8-.6 1.4-1.4 1.4H3.4C2.6 20.4 2 19.8 2 19z" fill="url(#${u}b)" stroke="#b07a12" stroke-width=".8"/>
  ${open
    ? `<path d="M4.3 10.2h17.4c.6 0 1 .5.9 1.1l-1.6 8.1c-.1.6-.6 1-1.2 1H2.6c-.5 0-.9-.5-.7-1z" fill="url(#${u}f)" stroke="#b07a12" stroke-width=".8"/>`
    : `<path d="M2 9.4h20V19c0 .8-.6 1.4-1.4 1.4H3.4C2.6 20.4 2 19.8 2 19z" fill="url(#${u}f)" stroke="#b07a12" stroke-width=".8"/>
       <path d="M2.8 10.2h18.4" stroke="#fff" stroke-opacity=".8" stroke-width=".9"/>`}`;

const page = (u, fold = '#dfe6f2') => `
  <defs>${lg(u + 'p', 0, 0, 1, 1, [[0, '#ffffff'], [1, '#e4e8ef']])}</defs>
  <path d="M5 2.5h9.5L19.5 7.5V21a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V3.3c0-.4.4-.8.8-.8z" fill="url(#${u}p)" stroke="#6d7a8f" stroke-width=".9"/>
  <path d="M14.5 2.5v4.2c0 .5.3.8.8.8h4.2" fill="${fold}" stroke="#6d7a8f" stroke-width=".9" stroke-linejoin="round"/>`;

const envelope = (u) => `
  <defs>${lg(u + 'e', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#dfe3ea']])}</defs>
  <rect x="2.5" y="6" width="19" height="13" rx="1.2" fill="url(#${u}e)" stroke="#5f6f8c" stroke-width=".9"/>
  <path d="M3 6.6l9 6.9 9-6.9" fill="none" stroke="#5f6f8c" stroke-width=".9" stroke-linejoin="round"/>
  <path d="M3 18.5l6.6-5.6M21 18.5l-6.6-5.6" stroke="#9aa6bb" stroke-width=".8"/>`;

const glass = (u) => `
  <defs>${rg(u + 'g', '.35', '.3', '.8', [[0, '#ffffff'], [.5, '#c6e3ff'], [1, '#69a6e6']])}
  ${lg(u + 'r', 0, 0, 1, 1, [[0, '#f2f2f2'], [1, '#7f8896']])}</defs>
  <path d="M14.2 14.4l6.2 6.2" stroke="#4a3316" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M14.2 14.4l6.2 6.2" stroke="#9a6a2e" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="9.6" cy="9.6" r="6.6" fill="url(#${u}g)" stroke="url(#${u}r)" stroke-width="2.2"/>
  <path d="M6.4 8.4a3.6 3.6 0 0 1 3-3" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;

const arrowR = 'M7 12h8.4m-3.6-4.4L16.4 12l-4.6 4.4';

const ICONS = {
  back: (u) => `${orb(u, '#b6f28e', '#3fae2a', '#1f7a17')}<path d="M16.6 12H8m3.8-4.4L7.4 12l4.4 4.4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  forward: (u) => `${orb(u, '#b6f28e', '#3fae2a', '#1f7a17')}<path d="${arrowR}" transform="translate(.6 0)" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  backOff: (u) => `${orb(u, '#f4f4f1', '#c9c8c0', '#9b9a92')}<path d="M16.6 12H8m3.8-4.4L7.4 12l4.4 4.4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  forwardOff: (u) => `${orb(u, '#f4f4f1', '#c9c8c0', '#9b9a92')}<path d="${arrowR}" transform="translate(.6 0)" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  go: (u) => `${orb(u, '#b6f28e', '#3fae2a', '#1f7a17')}<path d="${arrowR}" transform="translate(.6 0)" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  up: (u) => `${folderShape(u)}<defs>${lg(u + 'a', 0, 0, 0, 1, [[0, '#8ee86b'], [1, '#26901c']])}</defs>
    <path d="M12.5 3l5.2 5.6h-3.2v6.2h-4V8.6H7.3z" fill="url(#${u}a)" stroke="#1d6b14" stroke-width=".9" stroke-linejoin="round"/>`,
  search: (u) => glass(u),
  zoom: (u) => `${glass(u)}<path d="M9.6 6.6v6M6.6 9.6h6" stroke="#1d4f9a" stroke-width="1.8" stroke-linecap="round"/>`,
  zoomin: (u) => `${glass(u)}<path d="M9.6 6.6v6M6.6 9.6h6" stroke="#1d4f9a" stroke-width="1.8" stroke-linecap="round"/>`,
  zoomout: (u) => `${glass(u)}<path d="M6.6 9.6h6" stroke="#1d4f9a" stroke-width="1.8" stroke-linecap="round"/>`,
  folders: (u) => `${folderShape(u)}<path d="M5 12.5h3M5 15.5h3m-1.5-3v6h3" stroke="#8a5a08" stroke-width="1" fill="none"/>`,
  folder: (u) => folderShape(u),
  folderOpen: (u) => folderShape(u, true),
  views: (u) => `<defs>${lg(u + 'v', 0, 0, 1, 1, [[0, '#ffffff'], [1, '#b9d1f7']])}</defs>
    ${[[3, 3], [13, 3], [3, 13], [13, 13]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="8" rx="1" fill="url(#${u}v)" stroke="#3a6fc4" stroke-width=".9"/>
    <rect x="${x + 2}" y="${y + 2}" width="4" height="3" fill="#5ea0f0"/>`).join('')}`,
  tiles: (u) => `<defs>${lg(u + 'v', 0, 0, 1, 1, [[0, '#ffffff'], [1, '#b9d1f7']])}</defs>
    ${[[3, 4], [3, 13]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1" fill="url(#${u}v)" stroke="#3a6fc4" stroke-width=".9"/><path d="M12 ${y + 2}h9M12 ${y + 5}h6" stroke="#3a6fc4" stroke-width="1.3"/>`).join('')}`,
  list: () => `${[5, 10, 15, 20].map((y) => `<rect x="3" y="${y - 2}" width="3" height="3" fill="#5ea0f0" stroke="#3a6fc4" stroke-width=".6"/><path d="M8.5 ${y - .5}h12" stroke="#3a6fc4" stroke-width="1.4"/>`).join('')}`,
  stop: (u) => `${orb(u, '#ffb59a', '#e3461f', '#a52a0c')}<path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`,
  refresh: (u) => `<defs>${lg(u + 'r', 0, 0, 0, 1, [[0, '#8ee86b'], [1, '#22891a']])}</defs>
    <path d="M18.6 9.2A7.2 7.2 0 0 0 5.4 9.6" fill="none" stroke="#1b6a13" stroke-width="4" stroke-linecap="round"/>
    <path d="M18.6 9.2A7.2 7.2 0 0 0 5.4 9.6" fill="none" stroke="url(#${u}r)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M5.4 14.6a7.2 7.2 0 0 0 13.2.4" fill="none" stroke="#1b6a13" stroke-width="4" stroke-linecap="round"/>
    <path d="M5.4 14.6a7.2 7.2 0 0 0 13.2.4" fill="none" stroke="url(#${u}r)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M20.8 4.6l-.5 6.4-6-1.6z" fill="url(#${u}r)" stroke="#1b6a13" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M3.2 19.6l.5-6.4 6 1.6z" fill="url(#${u}r)" stroke="#1b6a13" stroke-width=".8" stroke-linejoin="round"/>`,
  home: (u) => `<defs>${lg(u + 'w', 0, 0, 0, 1, [[0, '#fffdf2'], [1, '#e4d7b4']])}${lg(u + 'r', 0, 0, 0, 1, [[0, '#ff8b6a'], [1, '#c2340f']])}</defs>
    <path d="M5 11.5V20.4h14V11.5" fill="url(#${u}w)" stroke="#8a7650" stroke-width=".9"/>
    <rect x="10" y="14.2" width="4" height="6.2" fill="#6d9be0" stroke="#2f5b9e" stroke-width=".8"/>
    <rect x="15.4" y="13" width="2.4" height="2.4" fill="#bfe0ff" stroke="#2f5b9e" stroke-width=".6"/>
    <path d="M2.4 12.6L12 3.6l9.6 9" fill="none" stroke="#7a1d05" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2.4 12.6L12 3.6l9.6 9" fill="none" stroke="url(#${u}r)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="16" y="4.4" width="2.4" height="4" fill="#a3442a"/>`,
  save: (u) => `<defs>${lg(u + 's', 0, 0, 1, 1, [[0, '#6aa2f5'], [1, '#1f4fae']])}${lg(u + 'm', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#d5dbe5']])}</defs>
    <path d="M3.5 4.2c0-.4.3-.7.7-.7h13.6l2.7 2.7v13.6c0 .4-.3.7-.7.7H4.2a.7.7 0 0 1-.7-.7z" fill="url(#${u}s)" stroke="#173c86" stroke-width=".9"/>
    <rect x="6.6" y="3.6" width="9.6" height="6.4" fill="url(#${u}m)" stroke="#173c86" stroke-width=".7"/>
    <rect x="12.6" y="4.6" width="2.2" height="4.2" fill="#3a5f9e"/>
    <rect x="6" y="13" width="12" height="7.4" rx=".5" fill="#f3f5f9" stroke="#173c86" stroke-width=".7"/>
    <path d="M7.6 15.4h8.8M7.6 17.6h8.8" stroke="#9fb0cf" stroke-width=".8"/>`,
  print: (u) => `<defs>${lg(u + 'b', 0, 0, 0, 1, [[0, '#f4f4f2'], [1, '#a9aaa6']])}</defs>
    <path d="M7 3.5h8l2 2V10H7z" fill="#fff" stroke="#6d7380" stroke-width=".8"/>
    <path d="M9 6h5M9 8h6" stroke="#9aa3b5" stroke-width=".8"/>
    <rect x="2.8" y="9.5" width="18.4" height="7.6" rx="1.6" fill="url(#${u}b)" stroke="#5b5f66" stroke-width=".9"/>
    <circle cx="18" cy="12" r=".9" fill="#43c843"/>
    <path d="M6.4 15h11.2l1 5.6H5.4z" fill="#fff" stroke="#6d7380" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M7.6 17.4h8.6M7.4 19.2h9" stroke="#9aa3b5" stroke-width=".7"/>`,
  mail: (u) => envelope(u),
  contact: (u) => `${envelope(u)}<defs>${lg(u + 'c', 0, 0, 0, 1, [[0, '#8fc8ff'], [1, '#1c6ad8']])}</defs>
    <path d="M13 3.2a7 7 0 0 1 8.2 5.6" fill="none" stroke="url(#${u}c)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M22.6 6.4l-1 3.6-3.4-1.6z" fill="#1c6ad8"/>`,
  send: (u) => `${envelope(u)}<defs>${lg(u + 'a', 0, 0, 0, 1, [[0, '#9cf27a'], [1, '#23901b']])}</defs>
    <path d="M12.6 15.2h5.4v-2.6l4.6 4.2-4.6 4.2v-2.6h-5.4z" fill="url(#${u}a)" stroke="#1b6a13" stroke-width=".8" stroke-linejoin="round"/>`,
  newmsg: (u) => `${page(u)}<path d="M7.5 10h8M7.5 13h8M7.5 16h5" stroke="#9aa6bb" stroke-width=".9"/>
    <path d="M17.5 13.5l1 2.2 2.3.4-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.4z" fill="#ffd23a" stroke="#c48a00" stroke-width=".6" stroke-linejoin="round"/>`,
  cut: () => `<circle cx="7.4" cy="17.4" r="3" fill="none" stroke="#2c5bb6" stroke-width="1.8"/><circle cx="16.6" cy="17.4" r="3" fill="none" stroke="#2c5bb6" stroke-width="1.8"/>
    <path d="M9.2 15.2L16.4 3.4M14.8 15.2L7.6 3.4" stroke="#7d8696" stroke-width="1.8" stroke-linecap="round"/>`,
  copy: (u) => `<g transform="translate(-2.4 -1.6) scale(.82)">${page(u + 'x')}</g><g transform="translate(4.4 3.6) scale(.82)">${page(u + 'y')}</g>`,
  paste: (u) => `<defs>${lg(u + 'c', 0, 0, 0, 1, [[0, '#d9a96a'], [1, '#9b6a2c']])}</defs>
    <rect x="4" y="4" width="13" height="17" rx="1.4" fill="url(#${u}c)" stroke="#6b4517" stroke-width=".9"/>
    <rect x="7.4" y="2.6" width="6.2" height="3.4" rx=".8" fill="#c9ccd2" stroke="#59606b" stroke-width=".8"/>
    <path d="M10.5 8.5h7.8l2.6 2.6v10H10.5z" fill="#fff" stroke="#6d7a8f" stroke-width=".8"/>
    <path d="M12.4 12.6h6M12.4 15h6M12.4 17.4h4" stroke="#9aa6bb" stroke-width=".8"/>`,
  linkedin: (u) => `<defs>${lg(u + 'l', 0, 0, 0, 1, [[0, '#2b8de0'], [1, '#0a5aa8']])}</defs>
    <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="3.2" fill="url(#${u}l)" stroke="#084a8a" stroke-width=".8"/>
    <circle cx="7.4" cy="7.2" r="1.7" fill="#fff"/><rect x="5.8" y="9.8" width="3.2" height="8.6" fill="#fff"/>
    <path d="M11.2 9.8h3v1.3c.5-.9 1.6-1.6 3-1.6 2.3 0 3.1 1.4 3.1 3.9v5h-3.2v-4.5c0-1.1-.3-1.8-1.3-1.8s-1.5.8-1.5 1.8v4.5h-3.1z" fill="#fff"/>`,
  globe: (u) => `<defs>${rg(u + 'g', '.36', '.3', '.8', [[0, '#bfe6ff'], [.55, '#3c8fe0'], [1, '#174f9e']])}</defs>
    <circle cx="12" cy="12" r="9.6" fill="url(#${u}g)" stroke="#123f80" stroke-width=".9"/>
    <path d="M6.2 7.4c1.6-.4 2.4.6 3.8.2 1.2-.4 1.2 1.8 2.6 2 1 .2.6 2-1 2.4-1.4.4-.8 2.6-2.4 3.4-1.2.6-.6-2.2-1.8-2.8-1.4-.8-2.6-1.4-2.8-2.6.4-1.2.8-2.2 1.6-2.6zM14.6 5.2c1.2.2 2.6.8 3.6 2-.6.6-1.6.2-2.2 1-.4.6-1.6.4-1.6-.6 0-.8-.8-1.2.2-2.4zM15 13.4c1.4-.4 2.8.4 3.4 1.6-.4 1.4-1.4 2.6-2.6 3.2-.4-1.2-1.6-2.2-.8-4.8z" fill="#58c24a" stroke="#2a7a20" stroke-width=".5"/>
    <ellipse cx="9.4" cy="7.2" rx="4.4" ry="2.4" fill="#fff" opacity=".35"/>`,
  computer: (u) => `<defs>${lg(u + 's', 0, 0, 1, 1, [[0, '#7fc0ff'], [1, '#1d5fc4']])}</defs>
    <rect x="3" y="3.5" width="18" height="13" rx="1.4" fill="#d9dbe0" stroke="#5b616c" stroke-width=".9"/>
    <rect x="5" y="5.4" width="14" height="9.2" fill="url(#${u}s)"/>
    <path d="M8.5 16.5h7l1 3.4h-9z" fill="#c4c7cd" stroke="#5b616c" stroke-width=".8"/>
    <rect x="5.4" y="19.6" width="13.2" height="1.8" rx=".6" fill="#b4b8c0" stroke="#5b616c" stroke-width=".7"/>`,
  doc: (u) => `${page(u)}<defs>${lg(u + 'd', 0, 0, 1, 0, [[0, '#3f86f2'], [1, '#1f52b8']])}</defs>
    <rect x="6.6" y="8.4" width="10.8" height="2.6" rx=".4" fill="url(#${u}d)"/>
    <path d="M6.8 13.4h10.4M6.8 15.6h10.4M6.8 17.8h7" stroke="#8592a8" stroke-width=".9"/>
    <circle cx="16.4" cy="18" r="1.6" fill="#f26d3d" stroke="#b8441c" stroke-width=".5"/>`,
  txt: (u) => `${page(u)}<path d="M7.4 9.2h9M7.4 11.6h9M7.4 14h9M7.4 16.4h6M7.4 18.8h8" stroke="#8592a8" stroke-width=".9"/>`,
  bmp: (u) => `${page(u)}<defs>${lg(u + 'k', 0, 0, 0, 1, [[0, '#9fd3ff'], [1, '#e8f6ff']])}</defs>
    <rect x="6.4" y="9" width="10.8" height="9.6" fill="url(#${u}k)" stroke="#6d7a8f" stroke-width=".6"/>
    <circle cx="14.6" cy="11.6" r="1.4" fill="#ffcf2e"/>
    <path d="M6.4 18.6l3.4-4.6 2.2 2.6 1.6-1.6 3.6 3.6z" fill="#4caf3a"/>`,
  web: (u) => `${page(u)}<g transform="translate(5.4 7.6) scale(.56)">${ICONS.globe(u + 'w')}</g>`,
  video: (u) => `<defs>${lg(u + 'v', 0, 0, 0, 1, [[0, '#5a6274'], [1, '#232733']])}</defs>
    <rect x="2.5" y="4.5" width="19" height="15" rx="1.4" fill="url(#${u}v)" stroke="#11141b" stroke-width=".8"/>
    ${[6.4, 10.4, 14.4, 18.4].map((x) => `<rect x="${x - 1}" y="5.6" width="2" height="1.6" rx=".3" fill="#e9ecf2"/><rect x="${x - 1}" y="16.8" width="2" height="1.6" rx=".3" fill="#e9ecf2"/>`).join('')}
    <path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/>`,
  image: (u) => ICONS.bmp(u),
  open: (u) => folderShape(u, true),
  resume: (u) => ICONS.doc(u),
  person: (u) => `<defs>${lg(u + 'b', 0, 0, 0, 1, [[0, '#76b0ff'], [1, '#2459c4']])}${rg(u + 'h', '.4', '.35', '.7', [[0, '#ffe2c4'], [1, '#c98b5a']])}</defs>
    <path d="M4 21c0-4.4 3.6-7.6 8-7.6s8 3.2 8 7.6z" fill="url(#${u}b)" stroke="#1a3f8a" stroke-width=".9"/>
    <circle cx="12" cy="8.2" r="4.6" fill="url(#${u}h)" stroke="#8a5a32" stroke-width=".9"/>
    <path d="M7.6 7.4c.2-3 2.2-4.4 4.6-4.4 2.6 0 4.2 1.6 4.2 4-1.4-1-3-1.4-4.8-1.2-1.6.2-2.8.8-4 1.6z" fill="#2b2420"/>`,
  info32: (u) => `<defs>${rg(u + 'i', '.36', '.3', '.8', [[0, '#d4ebff'], [.5, '#3a8be8'], [1, '#1546a8']])}</defs>
    <circle cx="12" cy="12" r="10.4" fill="url(#${u}i)" stroke="#123b8c" stroke-width=".8"/>
    <ellipse cx="12" cy="7" rx="6.4" ry="3.6" fill="#fff" opacity=".3"/>
    <circle cx="12" cy="7.2" r="1.6" fill="#fff"/><path d="M10.2 10.2h2.8v7.2h1.4v1.4H9.8v-1.4h1.4v-5.8h-1z" fill="#fff"/>`,
  question32: (u) => `<defs>${rg(u + 'i', '.36', '.3', '.8', [[0, '#d4ebff'], [.5, '#3a8be8'], [1, '#1546a8']])}</defs>
    <circle cx="12" cy="12" r="10.4" fill="url(#${u}i)" stroke="#123b8c" stroke-width=".8"/>
    <ellipse cx="12" cy="7" rx="6.4" ry="3.6" fill="#fff" opacity=".3"/>
    <path d="M9 9.2c0-2 1.4-3.2 3.2-3.2s3.2 1.2 3.2 2.9c0 2.6-2.8 2.6-2.8 4.9" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/>
    <circle cx="12.6" cy="17.4" r="1.4" fill="#fff"/>`,
  warn32: (u) => `<defs>${lg(u + 'w', 0, 0, 0, 1, [[0, '#fff3a6'], [.5, '#ffd22e'], [1, '#e5a400']])}</defs>
    <path d="M12 2.6c.5 0 .9.3 1.2.8l9 16.4c.5.9-.1 2-1.2 2H3c-1.1 0-1.7-1.1-1.2-2l9-16.4c.3-.5.7-.8 1.2-.8z" fill="url(#${u}w)" stroke="#a87500" stroke-width=".9"/>
    <path d="M12 8.2v6.6" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18" r="1.4" fill="#222"/>`,
  error32: (u) => `${orb(u, '#ffb59a', '#e3461f', '#a52a0c')}<path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`,
  bin: (u) => `<defs>${lg(u + 'b', 0, 0, 1, 0, [[0, '#9fb3c8'], [.45, '#eef4fb'], [1, '#8ea3ba']])}</defs>
    <path d="M5.4 7.4h13.2l-1.4 13.2c-.1.6-.5 1-1.1 1H7.9c-.6 0-1-.4-1.1-1z" fill="url(#${u}b)" stroke="#4d5f74" stroke-width=".9"/>
    <path d="M8.6 9.6l.6 9.6M12 9.6v9.6M15.4 9.6l-.6 9.6" stroke="#6c8198" stroke-width=".8"/>
    <rect x="4" y="5" width="16" height="2.6" rx="1" fill="url(#${u}b)" stroke="#4d5f74" stroke-width=".9"/>
    <path d="M9.6 5V3.6h4.8V5" fill="none" stroke="#4d5f74" stroke-width=".9"/>`,
  restore: (u) => `${ICONS.bin(u)}<defs>${lg(u + 'a', 0, 0, 0, 1, [[0, '#9cf27a'], [1, '#23901b']])}</defs>
    <path d="M14 4.6a5 5 0 0 1 7.4 4.8" fill="none" stroke="#1b6a13" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M14 4.6a5 5 0 0 1 7.4 4.8" fill="none" stroke="url(#${u}a)" stroke-width="1.8" stroke-linecap="round"/>`,
  play: (u) => `<defs>${lg(u + 'p', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#cfe3c6']])}</defs><path d="M8 5.2v13.6L19 12z" fill="url(#${u}p)" stroke="#2f5f22" stroke-width="1" stroke-linejoin="round"/>`,
  pause: () => `<rect x="6.4" y="5.4" width="4" height="13.2" rx=".8" fill="#fff" stroke="#24406e" stroke-width=".9"/><rect x="13.6" y="5.4" width="4" height="13.2" rx=".8" fill="#fff" stroke="#24406e" stroke-width=".9"/>`,
  mstop: () => `<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="1.2" fill="#fff" stroke="#24406e" stroke-width=".9"/>`,
  prev: () => `<path d="M17.6 6v12L9.6 12z" fill="#fff" stroke="#24406e" stroke-width=".9" stroke-linejoin="round"/><rect x="6.4" y="6" width="2.4" height="12" fill="#fff" stroke="#24406e" stroke-width=".9"/>`,
  next: () => `<path d="M6.4 6v12l8-6z" fill="#fff" stroke="#24406e" stroke-width=".9" stroke-linejoin="round"/><rect x="15.2" y="6" width="2.4" height="12" fill="#fff" stroke="#24406e" stroke-width=".9"/>`,
  volume: () => `<path d="M3.6 9.2h3.6l5-4.4v14.4l-5-4.4H3.6z" fill="#fff" stroke="#24406e" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M15 8.6a4.8 4.8 0 0 1 0 6.8M17.4 6.2a8.2 8.2 0 0 1 0 11.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  mute: () => `<path d="M3.6 9.2h3.6l5-4.4v14.4l-5-4.4H3.6z" fill="#fff" stroke="#24406e" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M15 9.4l5 5.2M20 9.4l-5 5.2" stroke="#ff6a4a" stroke-width="1.8" stroke-linecap="round"/>`,
  fullscreen: () => `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  fit: () => `<rect x="4" y="5" width="16" height="14" rx="1" fill="none" stroke="#2c4f8a" stroke-width="1.4"/><path d="M7.6 12h8.8M7.6 12l2.2-2.2M7.6 12l2.2 2.2M16.4 12l-2.2-2.2M16.4 12l-2.2 2.2" stroke="#2c4f8a" stroke-width="1.4" stroke-linecap="round"/>`,
  actual: () => `<rect x="4" y="5" width="16" height="14" rx="1" fill="none" stroke="#2c4f8a" stroke-width="1.4"/><text x="12" y="15.4" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-size="7.6" font-weight="bold" fill="#2c4f8a">1:1</text>`,
  help: (u) => ICONS.question32(u),
  picPrev: (u) => `${orb(u, '#bfe0ff', '#3a82e0', '#1a4ea8')}<path d="M14.4 7.4L9.6 12l4.8 4.6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  picNext: (u) => `${orb(u, '#bfe0ff', '#3a82e0', '#1a4ea8')}<path d="M9.6 7.4l4.8 4.6-4.8 4.6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  expand: () => `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="#2c4f8a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  newfile: (u) => `${page(u)}<path d="M15.4 13.4l1 2.2 2.3.4-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.4z" fill="#ffd23a" stroke="#c48a00" stroke-width=".6" stroke-linejoin="round"/>`,
  paint: (u) => `<defs>${lg(u + 'p', 0, 0, 1, 1, [[0, '#fff6dc'], [1, '#d9b98a']])}</defs>
    <path d="M12 3c5.4 0 9.4 3.6 9.4 8 0 2.6-2 3.6-3.8 3.2-1.6-.4-2.6.8-2 2.4.6 1.8-.6 3.8-3.6 3.8C6.6 20.4 2.6 16.6 2.6 11.8 2.6 7 6.6 3 12 3z" fill="url(#${u}p)" stroke="#8a6a3a" stroke-width=".9"/>
    <circle cx="7.4" cy="10.4" r="1.7" fill="#e2352a"/><circle cx="10.6" cy="6.8" r="1.7" fill="#f7c21e"/><circle cx="15.2" cy="7" r="1.7" fill="#2f9be0"/><circle cx="8.6" cy="15" r="1.7" fill="#3caa3c"/>`,
  info: (u) => ICONS.info32(u),
};

export function iconSVG(name, px = 24) {
  const fn = ICONS[name] || ICONS.txt;
  const u = 'kx' + (++uid) + name.replace(/[^a-z0-9]/gi, '');
  return `<svg class="kx-ico" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">${fn(u)}</svg>`;
}

export function ico(name, px = 24) {
  const t = document.createElement('template');
  t.innerHTML = iconSVG(name, px);
  return t.content.firstElementChild;
}

export const iconNames = Object.keys(ICONS);
