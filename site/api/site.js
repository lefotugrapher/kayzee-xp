// GET /api/site -> { settings, projects } (visible projects only, stored order)
import { getSite } from './_lib/store.js';
import { publicView } from './_lib/validate.js';
import { send, methodNotAllowed } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET']);
  try {
    const site = await getSite();
    send(res, 200, publicView(site), {
      'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
    });
  } catch (e) {
    console.error('[api/site]', e);
    send(res, 500, { error: 'site_unavailable' });
  }
}
