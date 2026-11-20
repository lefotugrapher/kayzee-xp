// /api/admin/visitors?kind=links|guestbook|visits
// One function for the three visitor tools (recruiter links, guestbook moderation, visits), because the hosting plan
// caps how many separate functions a deployment may have. Each kind keeps its own handler in ../_lib/admin-<kind>.js.
import links from '../_lib/admin-links.js';
import guestbook from '../_lib/admin-guestbook.js';
import visits from '../_lib/admin-visits.js';
import { send, query } from '../_lib/http.js';

const KINDS = { links, guestbook, visits };

export default async function handler(req, res) {
  const kind = String(query(req).kind || '');
  const h = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null;
  if (!h) return send(res, 404, { error: 'not_found' });
  return h(req, res);
}
