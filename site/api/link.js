// GET /api/link?s=<slug> -> { ok:true, company, note, open } for one recruiter link, or 404 { ok:false }.
// The list itself is never public.
import { getDoc } from './_lib/store.js';
import { send, methodNotAllowed, query, clientIp, rateLimiter } from './_lib/http.js';
import { EMPTY_LINKS, isSlug, listOf } from './_lib/visitors.js';

const limiter = rateLimiter({ limit: 60, windowMs: 60_000 }); // slows down slug guessing

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET']);
  const ip = clientIp(req);
  const rl = limiter.check(ip);
  if (!rl.ok) return send(res, 429, { ok: false, error: 'too_many_requests', retryAfter: rl.retryAfter }, { 'Retry-After': String(rl.retryAfter) });
  limiter.hit(ip);
  const slug = String(query(req).s ?? '').trim().toLowerCase();
  if (!isSlug(slug)) return send(res, 404, { ok: false });
  try {
    const link = listOf(await getDoc('links', EMPTY_LINKS), 'links').find((l) => l && l.slug === slug);
    if (!link) return send(res, 404, { ok: false });
    send(res, 200, { ok: true, company: link.company, note: link.note, open: link.open || '' });
  } catch (e) {
    console.error('[api/link]', e?.message);
    send(res, 404, { ok: false }); // the page just greets nobody in particular
  }
}
