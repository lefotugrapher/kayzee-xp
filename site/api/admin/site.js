// GET /api/admin/site -> full site (incl. hidden projects)
// PUT /api/admin/site {settings, projects} -> validates and saves
import { requireAdmin } from '../_lib/auth.js';
import { getSite, putSite } from '../_lib/store.js';
import { send, methodNotAllowed, jsonBody, isJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') return send(res, 200, await getSite({ fresh: true }));
    if (!isJson(req)) return send(res, 415, { error: 'expected_json' });
    const body = jsonBody(req);
    if (!body) return send(res, 400, { error: 'invalid_json', errors: ['Body is not valid JSON'] });
    const r = await putSite(body);
    if (!r.ok) return send(res, 400, { error: 'validation_failed', errors: r.errors });
    send(res, 200, { ok: true, site: r.site, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[api/admin/site]', e);
    send(res, e.code === 'storage_not_configured' ? 503 : 500, { error: e.code || 'save_failed', message: String(e.message || e) });
  }
}
