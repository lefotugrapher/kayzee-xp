// POST /api/contact { from, subject, message, website (honeypot) }
// -> { ok:true } when sent through Resend, or { ok:false, mailto } when no provider is configured.
import { send, methodNotAllowed, jsonBody, isJson, clientIp, rateLimiter, fetchT } from './_lib/http.js';
import { getSite } from './_lib/store.js';

const limiter = rateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const oneLine = (s, max) => String(s ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);
const text = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!isJson(req)) return send(res, 415, { ok: false, error: 'expected_json' });
  const b = jsonBody(req);
  if (!b || typeof b !== 'object') return send(res, 400, { ok: false, error: 'invalid_json' });

  // Honeypot: bots fill every field. Pretend success, do nothing.
  if (b.website) return send(res, 200, { ok: true });

  const from = oneLine(b.from, 254);
  const subject = oneLine(b.subject, 150) || 'Hello from your portfolio';
  const message = text(b.message, 5000);
  const errors = [];
  if (!EMAIL_RE.test(from)) errors.push('Please enter a valid email address.');
  if (message.length < 2) errors.push('Please write a message.');
  if (String(b.message ?? '').length > 5000) errors.push('Message is too long (max 5000 characters).');
  if (errors.length) return send(res, 400, { ok: false, error: 'validation_failed', errors });

  const ip = clientIp(req);
  const rl = limiter.check(ip);
  if (!rl.ok) return send(res, 429, { ok: false, error: 'too_many_messages', retryAfter: rl.retryAfter }, { 'Retry-After': String(rl.retryAfter) });
  limiter.hit(ip);

  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO;
  if (key && to) {
    try {
      const r = await fetchT('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM || 'Kayzee XP <onboarding@resend.dev>',
          to: to.split(',').map((s) => s.trim()).filter(Boolean),
          reply_to: from,
          subject: `[Kayzee XP] ${subject}`,
          text: `From: ${from}\nIP: ${ip}\n\n${message}\n`,
        }),
      }, 8000);
      if (r.ok) return send(res, 200, { ok: true });
      console.error('[api/contact] resend', r.status, (await r.text()).slice(0, 300));
    } catch (e) {
      console.error('[api/contact] resend failed', e?.message);
    }
    // fall through to mailto so the visitor can still reach out
  }

  let email = '';
  try { email = (await getSite()).settings?.contactEmail || ''; } catch { /* ignore */ }
  const body = `${message}\n\n(from ${from})`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  send(res, 200, { ok: false, mailto });
}
