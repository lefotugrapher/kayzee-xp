// POST /api/admin/logout -> clears the session cookie
import { clearCookie } from '../_lib/auth.js';
import { send, methodNotAllowed, sameOrigin } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!sameOrigin(req)) return send(res, 403, { error: 'bad_origin' });
  send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
}
