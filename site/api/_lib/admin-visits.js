// GET    /api/admin/visits -> { visits, summary: { total, last7, zoomed, byLink: [{slug, company, opens, lastTs, zoomed}] } }
// GET    /api/admin/visits?summary=1 -> { summary } only
// DELETE /api/admin/visits -> { ok:true } (clears the log)
import { requireAdmin } from './auth.js';
import { getDoc, putDoc } from './store.js';
import { send, methodNotAllowed, query } from './http.js';
import { EMPTY_VISITS, listOf, storageError } from './visitors.js';

function summarise(visits) {
  const weekAgo = Date.now() - 7 * 864e5;
  const by = new Map();
  let last7 = 0;
  let zoomed = 0;
  for (const v of visits) {
    if (v.ts >= weekAgo) last7++;
    if (v.zoomed) zoomed++;
    if (!v.link) continue;
    let g = by.get(v.link);
    if (!g) by.set(v.link, g = { slug: v.link, company: v.company || '', opens: 0, lastTs: 0, zoomed: 0 });
    g.opens++;
    if (v.ts > g.lastTs) g.lastTs = v.ts;
    if (v.zoomed) g.zoomed++;
  }
  return { total: visits.length, last7, zoomed, byLink: [...by.values()].sort((a, b) => b.lastTs - a.lastTs) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'DELETE') return methodNotAllowed(res, ['GET', 'DELETE']);
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'DELETE') {
      await putDoc('visits', { visits: [] });
      return send(res, 200, { ok: true });
    }
    const visits = listOf(await getDoc('visits', EMPTY_VISITS, { fresh: true }), 'visits').filter(Boolean);
    const summary = summarise(visits);
    send(res, 200, query(req).summary ? { summary } : { visits, summary });
  } catch (e) {
    console.error('[api/admin/visits]', e?.message);
    const { status, body } = storageError(e);
    send(res, status, body);
  }
}
