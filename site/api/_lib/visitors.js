// Shared bits for the visitor features: recruiter links, guestbook, visits.
import { createHmac, randomBytes } from 'node:crypto';
import { clientIp } from './http.js';

export const EMPTY_LINKS = { links: [] };
export const EMPTY_GUESTBOOK = { entries: [] };
export const EMPTY_VISITS = { visits: [] };

export const LIMITS = {
  company: 40, note: 26, slugBase: 24, links: 300,
  gbName: 40, gbFrom: 60, gbMsg: 240, gbEntries: 500, gbPublic: 100,
  visits: 1500, visitApps: 20,
};

/** Where a recruiter link can land first ('' = just the desktop). `project:<id>` is checked against the site. */
export const OPEN_TARGETS = ['', 'resume', 'projects', 'contact', 'about', 'music', 'guestbook'];

/** Things a visit may report having opened. */
const APP_IDS = new Set([
  'about', 'resume', 'projects', 'browser', 'media', 'contact', 'music', 'notepad', 'recycle', 'paint',
  'mines', 'solitaire', 'pinball', 'guestbook', 'games', 'welcome', 'display',
  'lightbox', 'fastlane', 'cv-download',
]);
const PROJECT_RE = /^project:[a-z0-9][a-z0-9-]{0,59}$/;
export const isAppId = (v) => typeof v === 'string' && (APP_IDS.has(v) || PROJECT_RE.test(v));

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSlug = (v) => typeof v === 'string' && v.length <= 32 && SLUG_RE.test(v);

// Control characters plus invisible/bidi formatting characters, which have no place in a short public text.
const JUNK_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]+/g;
/** Single line of text: control characters out, runs of whitespace collapsed, trimmed. Not truncated. */
export const oneLine = (v) => String(v ?? '').replace(JUNK_RE, ' ').replace(/\s+/g, ' ').trim();

// Letters that NFKD does not split into a base letter + accent.
const LATIN = { '\u00f8': 'o', '\u00e6': 'ae', '\u0153': 'oe', '\u00df': 'ss', '\u0111': 'd', '\u0142': 'l', '\u00f0': 'd', '\u00fe': 'th', '\u0131': 'i' };
/** kebab-case, ascii only. */
export function kebab(v, max = LIMITS.slugBase) {
  return String(v ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[\u00f8\u00e6\u0153\u00df\u0111\u0142\u00f0\u00fe\u0131]/g, (c) => LATIN[c])
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/, '');
}

export function randomBase36(n) {
  const abc = '0123456789abcdefghijklmnopqrstuvwxyz';
  let out = '';
  while (out.length < n) {
    for (const b of randomBytes(n * 2)) { if (b < 252 && out.length < n) out += abc[b % 36]; } // 252 = 7 * 36: no modulo bias
  }
  return out;
}

/** Sticky-note text when none was given. */
export function defaultNote(company) {
  for (const t of [`hi ${company} team :)`, `hi ${company} :)`]) if (t.length <= LIMITS.note) return t;
  return 'hi there :)';
}

/** Stable, non-reversible stand-in for the visitor's IP address. The address itself is never stored. */
export function ipHash(req) {
  const key = process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || 'kayzee-xp';
  return createHmac('sha256', key).update('ip:' + clientIp(req)).digest('hex').slice(0, 16);
}

/** Public shape of a guestbook entry (no ipHash, no moderation state). */
export const publicEntry = (e) => ({ id: e.id, name: e.name, from: e.from || '', msg: e.msg, ts: e.ts });
/** Admin shape of a guestbook entry (everything except ipHash). */
export const adminEntry = (e) => ({ ...publicEntry(e), ok: e.ok === true, hidden: e.hidden === true });

export const listOf = (doc, key) => (doc && Array.isArray(doc[key]) ? doc[key] : []);

/** Storage failures: 503 when Blob is not connected, 500 otherwise. */
export function storageError(e) {
  const missing = e?.code === 'storage_not_configured';
  return { status: missing ? 503 : 500, body: { ok: false, error: missing ? 'storage_not_configured' : 'storage_failed' } };
}
