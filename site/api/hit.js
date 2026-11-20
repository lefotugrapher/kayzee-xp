// POST /api/hit { sid, ev:'open'|'update'|'end', link?, dev?, w?, h?, ref?, zoomed?, fast?, secs?, apps? } -> 204
// Anonymous visit log. Sent with navigator.sendBeacon, so the JSON may arrive as text/plain.
// No IP address and no user agent is stored. Bots are skipped, and so is the owner's own browser: it carries
// the kxp_owner marker that /api/admin/login sets (the session cookie itself is scoped to /api/admin).
import { getDoc, updateDoc } from './_lib/store.js';
import { methodNotAllowed, jsonBody, sameOrigin, clientIp, rateLimiter } from './_lib/http.js';
import { isOwner } from './_lib/auth.js';
import { EMPTY_LINKS, EMPTY_VISITS, LIMITS, isSlug, isAppId, listOf } from './_lib/visitors.js';

const SID_RE = /^[A-Za-z0-9_-]{8,40}$/;
const BOT_RE = /bot|crawl|spider|preview|headless/i;
const EVENTS = ['open', 'update', 'end'];
const all = rateLimiter({ limit: 90, windowMs: 60_000 });
const opens = rateLimiter({ limit: 20, windowMs: 10 * 60_000 });

const int = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };

/** Hostname only, and nothing at all when the visitor came from our own pages. */
function refHost(raw, req) {
  const s = String(raw ?? '').trim().slice(0, 2048);
  if (!s) return '';
  let host = '';
  try { host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname; } catch { return ''; }
  host = host.toLowerCase().replace(/^www\./, '');
  if (!/^[a-z0-9.-]{1,80}$/.test(host)) return '';
  const own = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  return host === own ? '' : host;
}

async function record(req) {
  if (BOT_RE.test(String(req.headers['user-agent'] || ''))) return;
  if (!sameOrigin(req) || isOwner(req)) return;
  const b = jsonBody(req);
  if (!b || typeof b !== 'object' || Array.isArray(b)) return;
  const sid = typeof b.sid === 'string' ? b.sid : '';
  const ev = b.ev;
  if (!SID_RE.test(sid) || !EVENTS.includes(ev)) return;

  const ip = clientIp(req);
  if (!all.check(ip).ok) return;
  all.hit(ip);
  if (ev === 'open') {
    if (!opens.check(ip).ok) return;
    opens.hit(ip);
  }

  const now = Date.now();
  let link = '';
  let company = '';
  if (ev === 'open' && b.link) {
    const slug = String(b.link).trim().toLowerCase();
    const known = isSlug(slug) && listOf(await getDoc('links', EMPTY_LINKS), 'links').find((l) => l && l.slug === slug);
    if (known) { link = known.slug; company = known.company; }
  }
  const apps = Array.isArray(b.apps) ? b.apps.slice(0, 60).filter(isAppId) : [];
  const secs = int(b.secs, 86400);

  await updateDoc('visits', EMPTY_VISITS, (doc) => {
    const visits = listOf(doc, 'visits').filter(Boolean);
    let v = visits.find((x) => x.sid === sid);
    if (!v) {
      if (ev !== 'open') return undefined; // unknown visit: ignore
      const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
      v = {
        sid, ts: now, link, company,
        dev: String(b.dev ?? '').toLowerCase().replace(/[^a-z0-9 _-]/g, '').slice(0, 16),
        w: int(b.w, 20000), h: int(b.h, 20000),
        country: /^[A-Z]{2}$/.test(country) ? country : '',
        ref: refHost(b.ref, req),
        zoomed: false, fast: false, secs: 0, apps: [], last: now,
      };
      visits.unshift(v);
      if (visits.length > LIMITS.visits) visits.length = LIMITS.visits;
    }
    if (b.zoomed === true) v.zoomed = true;
    if (b.fast === true) v.fast = true;
    if (secs > (v.secs || 0)) v.secs = secs;
    const have = Array.isArray(v.apps) ? v.apps : [];
    v.apps = [...new Set([...have, ...apps])].slice(0, LIMITS.visitApps);
    v.last = now;
    return { visits };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { await record(req); } catch (e) { if (e?.code !== 'storage_not_configured') console.error('[api/hit]', e?.message); }
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
