// Site JSON: /api/site (Vercel Blob in production) with the static snapshot as the fallback.
let promise = null;
const API = new URL('../api/site', import.meta.url).href;
const SNAPSHOT = new URL('../data/site.json', import.meta.url).href;

async function load() {
  try {
    const r = await fetch(API, { headers: { accept: 'application/json' } });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const j = await r.json();
      if (j && j.settings) return j;
    }
  } catch (_) { /* offline or no API: fall through */ }
  const r = await fetch(SNAPSHOT);
  return r.json();
}

export function getSite() {
  if (!promise) promise = load().catch(() => ({ settings: {}, projects: [] }));
  return promise;
}
