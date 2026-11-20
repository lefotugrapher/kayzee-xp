// Admin session: HMAC-signed, expiring token in an HttpOnly cookie.
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { cookies, isProd, sameOrigin, send } from './http.js';

export const COOKIE = 'kxp_admin';
export const COOKIE_PATH = '/api/admin';
export const SESSION_DAYS = 7;
// "This browser is the owner's": set at log on, only ever sent to /api/hit so his own visits are not counted.
// It grants nothing; it is signed with a different key than the session token.
export const OWNER_COOKIE = 'kxp_owner';
export const OWNER_PATH = '/api/hit';
export const OWNER_DAYS = 180;

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function secret() {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function configured() {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

/** Constant-time password check (hash both sides so lengths never leak). */
export function passwordMatches(given) {
  const want = process.env.ADMIN_PASSWORD || '';
  if (!want || typeof given !== 'string' || !given) return false;
  const a = createHash('sha256').update(given, 'utf8').digest();
  const b = createHash('sha256').update(want, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeToken(days = SESSION_DAYS) {
  const exp = Date.now() + days * 864e5;
  const payload = b64u(JSON.stringify({ v: 1, exp, n: b64u(randomBytes(9)) }));
  return { token: `${payload}.${sign(payload)}`, exp };
}

export function verifyToken(token) {
  if (!secret() || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

export function sessionCookie(token, maxAgeSec) {
  const parts = [
    `${COOKIE}=${token}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isProd()) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie() {
  return sessionCookie('', 0);
}

export function getSession(req) {
  return verifyToken(cookies(req)[COOKIE]);
}

function signOwner(payload) {
  const key = createHmac('sha256', secret()).update('kxp-owner-marker').digest();
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function ownerCookie(days = OWNER_DAYS) {
  const payload = b64u(JSON.stringify({ v: 1, exp: Date.now() + days * 864e5 }));
  const parts = [
    `${OWNER_COOKIE}=${payload}.${signOwner(payload)}`,
    `Path=${OWNER_PATH}`,
    `Max-Age=${days * 86400}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isProd()) parts.push('Secure');
  return parts.join('; ');
}

/** True when the request comes from a browser that has logged on to the admin (session or owner marker). */
export function isOwner(req) {
  if (!secret()) return false;
  if (getSession(req)) return true;
  const token = cookies(req)[OWNER_COOKIE];
  if (typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const want = Buffer.from(signOwner(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch { return false; }
}

/**
 * Guard for admin routes. Returns the session, or sends 401/403 and returns null.
 * Mutating methods must also come from our own origin.
 */
export function requireAdmin(req, res) {
  if (!configured()) { send(res, 503, { error: 'admin_not_configured' }); return null; }
  const s = getSession(req);
  if (!s) { send(res, 401, { error: 'unauthorized' }); return null; }
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    send(res, 403, { error: 'bad_origin' }); return null;
  }
  return s;
}
