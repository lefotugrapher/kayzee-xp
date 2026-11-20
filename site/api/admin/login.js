// POST /api/admin/login {password} -> sets the session cookie (and the owner marker read by /api/hit)
import { configured, passwordMatches, makeToken, sessionCookie, ownerCookie, SESSION_DAYS } from '../_lib/auth.js';
import { send, methodNotAllowed, jsonBody, isJson, clientIp, rateLimiter, sameOrigin, sleep } from '../_lib/http.js';

const limiter = rateLimiter({ limit: 8, windowMs: 15 * 60_000 });

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!configured()) return send(res, 503, { error: 'admin_not_configured' });
  if (!isJson(req) || !sameOrigin(req)) return send(res, 400, { error: 'bad_request' });

  const ip = clientIp(req);
  const rl = limiter.check(ip);
  if (!rl.ok) return send(res, 429, { error: 'too_many_attempts', retryAfter: rl.retryAfter }, { 'Retry-After': String(rl.retryAfter) });

  const body = jsonBody(req) || {};
  if (!passwordMatches(body.password)) {
    limiter.hit(ip);
    await sleep(400 + Math.floor(Math.random() * 300));
    return send(res, 401, { error: 'wrong_password' });
  }
  limiter.clear(ip);
  const { token, exp } = makeToken();
  send(res, 200, { ok: true, exp }, { 'Set-Cookie': [sessionCookie(token, SESSION_DAYS * 86400), ownerCookie()] });
}
