// GET /api/admin/session -> { authenticated, exp?, configured }
import { configured, getSession } from '../_lib/auth.js';
import { send, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const s = configured() ? getSession(req) : null;
  send(res, 200, { authenticated: Boolean(s), exp: s?.exp ?? null, configured: configured() });
}
