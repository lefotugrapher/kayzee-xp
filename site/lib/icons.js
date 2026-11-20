// One sprite library for the whole site: the same voxel volume renders the 3D desktop icon and every 2D icon.
import * as S from '../sprites.js';
import snakeIcon from '../apps/snake.icon.js';
import inboxIcon from '../apps/inbox.icon.js';
import reversiIcon from '../apps/reversi.icon.js';
import typerIcon from '../apps/typer.icon.js';

const BUILD = {
  about: S.buildMonitor, resume: S.buildDoc, projects: S.buildFolder, music: S.buildCD, contact: S.buildEnvelope,
  games: S.buildJoystick, recycle: S.buildBin, bin: S.buildBin,
  notepad: S.buildNotepad, paint: S.buildPaint, browser: S.buildBrowser, media: S.buildMedia,
  mines: S.buildMines, solitaire: S.buildSolitaire, pinball: S.buildPinball, folder: S.buildFolderPlain,
  snake: () => S.buildFromRows(snakeIcon), inbox: () => S.buildFromRows(inboxIcon), reversi: () => S.buildFromRows(reversiIcon), typer: () => S.buildFromRows(typerIcon),
  sun: S.buildSun, net: S.buildNet, speaker: S.buildSpeaker, fx: S.buildFx,
  avatar: S.buildAvatar, logo: S.buildLogo, error: S.buildErrorIcon, info: S.buildInfoIcon,
  power: S.buildPower, sunset: S.buildSunset, moon: S.buildMoon, logoff: S.buildLogoff, cursor: S.buildCursor,
};
const voxCache = new Map();
export function voxFor(key) {
  if (!voxCache.has(key)) voxCache.set(key, (BUILD[key] || BUILD.folder)());
  return voxCache.get(key);
}

const urlCache = new Map();
// data URL of the sprite at an integer pixel scale
export function spriteURL(key, scale = 2, { shadow = true, bevel = false } = {}) {
  const k = `${key}|${scale}|${shadow}|${bevel}`;
  if (!urlCache.has(k)) urlCache.set(k, S.sprite2D(voxFor(key), scale, { shadow, bevel }).toDataURL());
  return urlCache.get(k);
}

// <img> of the sprite, `px` CSS pixels wide. Rendered at ~2 device px per sprite pixel so it stays crisp on HiDPI.
export function iconImg(key, px = 16, { shadow = true, bevel } = {}) {
  const f = voxFor(key).front();
  const scale = Math.max(1, Math.round((px * 2) / f.w));
  const img = new Image();
  img.src = spriteURL(key, scale, { shadow, bevel: bevel ?? scale >= 3 });
  img.alt = '';
  img.draggable = false;
  img.className = 'px-icon';
  img.style.width = px + 'px';
  img.style.height = 'auto';
  return img;
}

// canvas version (used where the original markup expects a canvas, e.g. [data-sprite])
export function iconCanvas(key, scale = 2, opts) { return S.sprite2D(voxFor(key), scale, opts); }
