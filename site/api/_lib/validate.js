// Validate + sanitise the site document before it is stored.
import { normalizeUrl, toEmbedUrl, detectType, slugify, spotifyPlaylistId } from '../../admin/embed.js';

export const LIMITS = {
  displayName: 80, nickname: 40, role: 200, location: 120, about: 4000,
  contactEmail: 254, url: 2048,
  title: 140, category: 60, year: 12, description: 1200, id: 60,
  projects: 200,
};
export const TYPES = ['page', 'video', 'image'];
const SETTINGS_TEXT = ['displayName', 'nickname', 'role', 'location', 'about'];
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// Strip control characters (keep \n and \t in long text).
const clean = (v, multiline = false) => String(v ?? '')
  .replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
  .replace(/\r\n?/g, '\n')
  .trim();

/**
 * @returns {{ ok: true, site: object } | { ok: false, errors: string[] }}
 */
export function validateSite(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['body must be an object {settings, projects}'] };
  const sIn = input.settings;
  const pIn = input.projects;
  if (!sIn || typeof sIn !== 'object' || Array.isArray(sIn)) errors.push('settings must be an object');
  if (!Array.isArray(pIn)) errors.push('projects must be an array');
  if (errors.length) return { ok: false, errors };

  // ---- settings
  const settings = {};
  for (const k of SETTINGS_TEXT) {
    const v = clean(sIn[k], k === 'about');
    if (v.length > LIMITS[k]) errors.push(`settings.${k} is too long (max ${LIMITS[k]} characters)`);
    settings[k] = v;
  }
  if (!settings.displayName) errors.push('settings.displayName is required');

  const email = clean(sIn.contactEmail);
  if (email && (email.length > LIMITS.contactEmail || !EMAIL_RE.test(email))) errors.push('settings.contactEmail is not a valid email address');
  settings.contactEmail = email;

  for (const k of ['linkedin', 'resumePdfUrl']) {
    const raw = clean(sIn[k]);
    if (!raw) { settings[k] = ''; continue; }
    const u = normalizeUrl(raw);
    if (!u) errors.push(`settings.${k} must be an http(s) URL`);
    else if (u.length > LIMITS.url) errors.push(`settings.${k} is too long`);
    settings[k] = u;
  }

  const sp = clean(sIn.spotifyPlaylist);
  if (!sp) settings.spotifyPlaylist = '';
  else {
    const id = spotifyPlaylistId(sp);
    if (!id) errors.push('settings.spotifyPlaylist must be a Spotify playlist link, URI or embed code');
    settings.spotifyPlaylist = id ? `https://open.spotify.com/playlist/${id}` : '';
  }

  // Guestbook: show new entries without approval (optional, off by default).
  if (sIn.guestbookAuto !== undefined && sIn.guestbookAuto !== null && typeof sIn.guestbookAuto !== 'boolean') errors.push('settings.guestbookAuto must be true or false');
  settings.guestbookAuto = sIn.guestbookAuto === true;

  // ---- projects
  if (pIn.length > LIMITS.projects) errors.push(`too many projects (max ${LIMITS.projects})`);
  const projects = [];
  const seen = new Set();
  pIn.slice(0, LIMITS.projects).forEach((p, i) => {
    const at = `projects[${i}]`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) { errors.push(`${at} must be an object`); return; }
    const title = clean(p.title);
    const label = title ? `${at} ("${title.slice(0, 40)}")` : at;
    if (!title) errors.push(`${at}.title is required`);
    if (title.length > LIMITS.title) errors.push(`${label}.title is too long (max ${LIMITS.title})`);

    const category = clean(p.category);
    if (category.length > LIMITS.category) errors.push(`${label}.category is too long (max ${LIMITS.category})`);
    const year = clean(p.year);
    if (year.length > LIMITS.year) errors.push(`${label}.year is too long (max ${LIMITS.year})`);
    const description = clean(p.description, true);
    if (description.length > LIMITS.description) errors.push(`${label}.description is too long (max ${LIMITS.description})`);

    const rawUrl = clean(p.url);
    const url = toEmbedUrl(rawUrl);
    if (!rawUrl) errors.push(`${label}.url is required`);
    else if (!url) errors.push(`${label}.url must be an http(s) link or an <iframe> embed code`);
    else if (url.length > LIMITS.url) errors.push(`${label}.url is too long`);

    let type = p.type == null || p.type === '' ? detectType(url) : String(p.type);
    if (!TYPES.includes(type)) errors.push(`${label}.type must be one of ${TYPES.join(', ')}`);

    const coverRaw = clean(p.cover);
    const cover = coverRaw ? normalizeUrl(coverRaw) : '';
    if (coverRaw && !cover) errors.push(`${label}.cover must be an http(s) image URL`);
    else if (cover.length > LIMITS.url) errors.push(`${label}.cover is too long`);

    // Slug: from given id, else from title. Unique: append -2, -3 ...
    let base = slugify(p.id) || slugify(title) || 'project';
    base = base.slice(0, LIMITS.id - 4).replace(/-+$/, '') || 'project';
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);

    projects.push({
      id, title, category, year, description, url, type,
      cover, visible: p.visible === undefined ? true : p.visible === true,
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, site: { settings, projects } };
}

/** Public view: visible projects only, stored order. */
export function publicView(site) {
  return {
    settings: site.settings,
    projects: (site.projects || []).filter((p) => p && p.visible !== false),
  };
}
