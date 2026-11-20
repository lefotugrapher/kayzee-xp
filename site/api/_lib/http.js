// Small HTTP helpers that work on Vercel's Node runtime and on dev/server.mjs.

export function send(res, status, data, headers = {}) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'method_not_allowed' });
}

/** Parsed JSON body (Vercel pre-parses into req.body; dev server does the same). */
export function jsonBody(req) {
  let b;
  try { b = req.body; } catch { return null; } // Vercel's lazy parser throws on malformed JSON
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string' && b) { try { return JSON.parse(b); } catch { return null; } }
  if (Buffer.isBuffer(b) && b.length) { try { return JSON.parse(b.toString('utf8')); } catch { return null; } }
  return null;
}

export function isJson(req) {
  return /^application\/json\b/i.test(req.headers['content-type'] || '');
}

export function query(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams);
}

export function cookies(req) {
  const out = {};
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* skip bad cookie */ }
  }
  return out;
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export const isProd = () => process.env.VERCEL_ENV === 'production' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

/**
 * Reject cross-site mutating requests. SameSite=Strict already blocks the cookie,
 * this is a second line: if an Origin header is present it must match our host.
 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host === host;
  } catch { return false; }
}

/** In-memory fixed-window rate limiter. Per serverless instance; good enough to slow down guessing. */
export function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      const e = hits.get(key);
      if (!e || e.reset <= now) return { ok: true, remaining: limit };
      return e.count >= limit ? { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) } : { ok: true, remaining: limit - e.count };
    },
    hit(key) {
      const now = Date.now();
      const e = hits.get(key);
      if (!e || e.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
      else e.count++;
    },
    clear(key) { hits.delete(key); },
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with timeout. */
export async function fetchT(url, opts = {}, ms = 5000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

/** Read at most `max` bytes of a fetch Response body as text. */
export async function readCapped(resp, max = 512 * 1024) {
  if (!resp.body) return '';
  const reader = resp.body.getReader();
  const chunks = [];
  let n = 0;
  try {
    while (n < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.length;
    }
  } finally { reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, max).toString('utf8');
}
