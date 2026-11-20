// Paints the boot / login art straight away (no three.js dependency, so it runs while the world downloads).
import { iconCanvas, voxFor } from './icons.js';
import { sprite2D } from '../sprites.js';
import { installCursors } from './cursors.js';
installCursors();

// voxel logo: the sprite stacked in depth so it reads as a thick tile while it turns (CSS 3D, compositor-animated)
export function paintLogo(el, scale) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const layers = 7;
  const spin = document.createElement('div');
  spin.className = 'logo-spin';
  for (let i = layers - 1; i >= 0; i--) {
    const c = iconCanvas('logo', scale, { shadow: false, bevel: i === 0 });
    c.className = 'logo-layer' + (i === 0 ? ' front' : '');
    c.style.transform = `translateZ(${-i * Math.max(2, scale * 0.55)}px)`;
    if (i > 0) c.style.filter = `brightness(${0.55 + 0.05 * (layers - i)})`;
    spin.appendChild(c);
  }
  el.appendChild(spin);
}
export function paintAvatar(el, scale = 4) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  el.appendChild(iconCanvas('avatar', scale, { shadow: false, bevel: true }));
}
// boot flag: the window-onto-the-hill logo cut into one-pixel columns that ripple like a flag in the wind
export function paintFlag(el, scale = 8) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const src = sprite2D(voxFor('logo'), scale, { shadow: false, bevel: true });
  const f = voxFor('logo').front();
  el.style.width = src.width + 'px'; el.style.height = (src.height + 2 * scale) + 'px';
  for (let c = 0; c < f.w; c++) {
    const col = document.createElement('canvas');
    col.width = scale; col.height = src.height;
    col.getContext('2d').drawImage(src, c * scale, 0, scale, src.height, 0, 0, scale, src.height);
    col.className = 'flag-col';
    col.style.left = c * scale + 'px';
    col.style.setProperty('--px', scale + 'px');
    col.style.animationDelay = (-c * 0.085).toFixed(3) + 's';
    col.style.filter = `brightness(${(1.06 - 0.1 * Math.sin(c / f.w * Math.PI * 2 + 0.6)).toFixed(3)})`;
    el.appendChild(col);
  }
}
function paintAll() {
  document.querySelectorAll('.kz-flag').forEach((el) => paintFlag(el, 8));
  document.querySelectorAll('.tp-ico[data-ico]').forEach((el) => { if (!el.firstChild) el.appendChild(iconCanvas(el.dataset.ico, 2, { shadow: true })); });
  document.querySelectorAll('.kz-logo').forEach((el) => paintLogo(el, el.classList.contains('small') ? 4 : 6));
  document.querySelectorAll('.kz-avatar').forEach((el) => paintAvatar(el));
  const off = document.querySelector('.off-ico');
  if (off && !off.firstChild) off.appendChild(iconCanvas('power', 2, { shadow: false }));
}
paintAll();
