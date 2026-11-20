// Document storage: the site document plus a few small JSON documents (links, guestbook, visits).
// Production: one JSON blob per document in Vercel Blob (private access; falls back to a public blob
// with an unguessable pathname if the store is a public-only store).
// Local dev (no BLOB_READ_WRITE_TOKEN): data/site.json on disk for the site, dev/.data/<name>.json for
// the other documents (dev/ is never deployed and dot folders are never served).
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { isProd } from './http.js';
import { validateSite } from './validate.js';

const SEED_URL = new URL('../../data/site.json', import.meta.url);
const DATA_DIR = new URL('../../dev/.data/', import.meta.url);
const CACHE_MS = 15_000;
const DOC_CACHE_MS = 5_000;
const DOCS = ['links', 'guestbook', 'visits'];
let cache = null; // { at, site }
const docCache = new Map(); // name -> { at, data }
const queues = new Map(); // name -> tail of the in-process write queue

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
let access = process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';
const isAccessError = (e) => /access|private|public/i.test(String(e?.message));
const notConfigured = () => Object.assign(new Error('storage_not_configured: set BLOB_READ_WRITE_TOKEN'), { code: 'storage_not_configured' });

function pathname(name = 'site') {
  if (access === 'private') return `kayzee-xp/${name}.json`;
  const key = process.env.BLOB_READ_WRITE_TOKEN || process.env.SESSION_SECRET || 'kayzee-xp';
  return `kayzee-xp/${name}-${createHmac('sha256', key).update(`${name}.json`).digest('hex').slice(0, 32)}.json`;
}

async function readSeed() {
  return JSON.parse(await readFile(SEED_URL, 'utf8'));
}

async function blobRead(name = 'site') {
  const { get } = await import('@vercel/blob');
  const r = await get(pathname(name), { access, useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const text = await new Response(r.stream).text();
  return JSON.parse(text);
}

async function blobPut(name, data) {
  const { put } = await import('@vercel/blob');
  await put(pathname(name), JSON.stringify(data), {
    contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
    access,
  });
}

async function blobWrite(name, data) {
  try {
    await blobPut(name, data);
  } catch (e) {
    // A store created as public-only rejects private blobs: retry public with a secret pathname.
    if (access === 'private' && isAccessError(e)) {
      console.warn('[store] private blob rejected, falling back to public blob with unguessable pathname:', e.message);
      access = 'public';
      await blobPut(name, data);
    } else throw e;
  }
}

/** Full site document (including hidden projects). */
export async function getSite({ fresh = false } = {}) {
  if (!hasBlob()) return readSeed(); // dev: always read disk so edits show immediately
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.site;
  let site = null;
  try {
    site = await blobRead();
  } catch (e) {
    if (access === 'private' && isAccessError(e)) {
      access = 'public';
      try { site = await blobRead(); } catch { site = null; }
    } else {
      console.error('[store] blob read failed:', e?.message);
      if (cache) return cache.site; // serve last good copy
      if (fresh) throw e; // admin must never edit the seed by mistake and overwrite real data
    }
  }
  if (!site) site = await readSeed(); // first run: nothing saved yet
  cache = { at: Date.now(), site };
  return site;
}

/** Validate + store. Returns { ok, site } or { ok:false, errors }. */
export async function putSite(input) {
  const v = validateSite(input);
  if (!v.ok) return v;
  if (hasBlob()) {
    await blobWrite('site', v.site);
  } else {
    if (isProd()) throw notConfigured();
    const tmp = new URL('../../data/site.json.tmp', import.meta.url);
    await writeFile(tmp, JSON.stringify(v.site, null, 1) + '\n', 'utf8');
    await rename(tmp, SEED_URL);
  }
  cache = { at: Date.now(), site: v.site };
  return v;
}

// ------------------------------------------------------------------ extra documents
const clone = (v) => JSON.parse(JSON.stringify(v ?? {}));
const isDoc = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
function docName(name) {
  if (!DOCS.includes(name)) throw new Error(`unknown document: ${name}`);
  return name;
}
const docFile = (name) => new URL(`${name}.json`, DATA_DIR);

/**
 * One of the extra JSON documents ('links' | 'guestbook' | 'visits'), or a copy of `fallback` when nothing
 * is stored yet. Public reads may be up to a few seconds old; pass { fresh: true } for admin reads and
 * before any change (a fresh read throws instead of quietly answering with the fallback).
 * Do not mutate the result of a cached read.
 */
export async function getDoc(name, fallback = {}, { fresh = false } = {}) {
  docName(name);
  if (!hasBlob()) {
    if (isProd()) return clone(fallback); // not configured: nothing to read
    try {
      const data = JSON.parse(await readFile(docFile(name), 'utf8'));
      return isDoc(data) ? data : clone(fallback);
    } catch (e) {
      if (e?.code === 'ENOENT') return clone(fallback);
      throw e;
    }
  }
  const hit = docCache.get(name);
  if (!fresh && hit && Date.now() - hit.at < DOC_CACHE_MS) return hit.data;
  let data = null;
  try {
    data = await blobRead(name);
  } catch (e) {
    if (access === 'private' && isAccessError(e)) {
      access = 'public';
      try { data = await blobRead(name); } catch (e2) { if (fresh) throw e2; data = null; }
    } else {
      console.error(`[store] ${name} read failed:`, e?.message);
      if (fresh) throw e; // never build a change on top of a failed read
      return hit ? hit.data : clone(fallback);
    }
  }
  if (!isDoc(data)) data = clone(fallback);
  docCache.set(name, { at: Date.now(), data });
  return data;
}

/** Replace one of the extra documents. Throws { code: 'storage_not_configured' } in production without Blob. */
export async function putDoc(name, data) {
  docName(name);
  if (hasBlob()) {
    await blobWrite(name, data);
    docCache.set(name, { at: Date.now(), data });
    return data;
  }
  if (isProd()) throw notConfigured();
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = new URL(`${name}.json.tmp`, DATA_DIR);
  await writeFile(tmp, JSON.stringify(data, null, 1) + '\n', 'utf8');
  await rename(tmp, docFile(name));
  return data;
}

/**
 * Read, change, write: `mutate(doc)` gets a fresh copy and returns the document to store, or nothing to
 * skip the write. One read + one write. Calls for the same document run one after another inside this
 * instance. `mutate` may run twice (see below), so it must only depend on its argument.
 * Returns the stored document, or null when nothing was written.
 */
export function updateDoc(name, fallback, mutate) {
  docName(name);
  const run = async () => {
    if (!hasBlob() && isProd()) throw notConfigured();
    let next = await mutate(await getDoc(name, fallback, { fresh: true }));
    if (!next) return null;
    if (!hasBlob()) return putDoc(name, next);
    try {
      await blobPut(name, next);
    } catch (e) {
      if (!(access === 'private' && isAccessError(e))) throw e;
      // Public-only store: what we just read under the private pathname was not the real document.
      // Switch, read the public copy and apply the change to that instead of overwriting it.
      console.warn('[store] private blob rejected, falling back to public blob with unguessable pathname:', e.message);
      access = 'public';
      next = await mutate(await getDoc(name, fallback, { fresh: true }));
      if (!next) return null;
      await blobPut(name, next);
    }
    docCache.set(name, { at: Date.now(), data: next });
    return next;
  };
  const p = (queues.get(name) || Promise.resolve()).then(run, run);
  queues.set(name, p.catch(() => {}));
  return p;
}
