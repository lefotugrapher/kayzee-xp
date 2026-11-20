// GET  /api/guestbook -> { entries: [{id, name, from, msg, ts}] } approved entries, newest first (max 100)
// POST /api/guestbook {name, from?, msg, website (honeypot)} -> { ok:true, pending, entry }
import { getDoc, getSite, updateDoc } from './_lib/store.js';
import { send, methodNotAllowed, jsonBody, isJson, sameOrigin } from './_lib/http.js';
import { EMPTY_GUESTBOOK, LIMITS, oneLine, randomBase36, ipHash, publicEntry, listOf, storageError } from './_lib/visitors.js';

const DAY = 864e5;
const PER_DAY = 3;
const GAP_MS = 30_000;
const LINK_RE = /https?:\/\/|www\./i;

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return list(res);
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!isJson(req)) return send(res, 415, { ok: false, error: 'expected_json' });
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'bad_origin' });
  const b = jsonBody(req);
  if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { ok: false, error: 'invalid_json' });

  const name = oneLine(b.name);
  const from = oneLine(b.from);
  const msg = oneLine(b.msg);
  const now = Date.now();
  const fresh = { id: randomBase36(10), name: name.slice(0, LIMITS.gbName), from: from.slice(0, LIMITS.gbFrom), msg: msg.slice(0, LIMITS.gbMsg), ts: now };

  // Honeypot: bots fill every field. Pretend success, store nothing.
  if (b.website) return send(res, 200, { ok: true, pending: true, entry: fresh });

  const errors = [];
  if (!name) errors.push('Please sign with your name.');
  else if (name.length > LIMITS.gbName) errors.push(`That name is a little long (max ${LIMITS.gbName} characters).`);
  if (from.length > LIMITS.gbFrom) errors.push(`"From" is a little long (max ${LIMITS.gbFrom} characters).`);
  if (!msg) errors.push('Please write a short message.');
  else if (msg.length > LIMITS.gbMsg) errors.push(`The message is too long (max ${LIMITS.gbMsg} characters).`);
  if (LINK_RE.test(msg) || LINK_RE.test(name) || LINK_RE.test(from)) errors.push('Links are not allowed in the guestbook. Please take the web address out and sign again.');
  if (errors.length) return send(res, 400, { ok: false, error: 'validation_failed', errors });

  try {
    let auto = false;
    try { auto = (await getSite()).settings?.guestbookAuto === true; } catch { auto = false; }
    const who = ipHash(req);
    let limited = null;
    let entry = null;
    await updateDoc('guestbook', EMPTY_GUESTBOOK, (doc) => {
      const entries = listOf(doc, 'entries').filter(Boolean);
      const mine = entries.filter((e) => e.ipHash === who && now - e.ts < DAY);
      const latest = mine.reduce((m, e) => Math.max(m, e.ts), 0);
      limited = null;
      if (latest && now - latest < GAP_MS) limited = { error: 'slow_down', retryAfter: Math.ceil((GAP_MS - (now - latest)) / 1000) };
      else if (mine.length >= PER_DAY) {
        const oldest = mine.reduce((m, e) => Math.min(m, e.ts), now);
        limited = { error: 'too_many_entries', retryAfter: Math.max(1, Math.ceil((oldest + DAY - now) / 1000)) };
      }
      if (limited) return undefined;
      entry = { ...fresh, ok: auto, ipHash: who };
      return { entries: [entry, ...entries].slice(0, LIMITS.gbEntries) };
    });
    if (limited) {
      const message = limited.error === 'slow_down' ? 'You just signed. Give it half a minute before signing again.' : 'You have already signed a few times today. Come back tomorrow.';
      return send(res, 429, { ok: false, ...limited, errors: [message] }, { 'Retry-After': String(limited.retryAfter) });
    }
    send(res, 200, { ok: true, pending: !entry.ok, entry: publicEntry(entry) });
  } catch (e) {
    console.error('[api/guestbook]', e?.message);
    const { status, body } = storageError(e);
    send(res, status, body);
  }
}

async function list(res) {
  try {
    const entries = listOf(await getDoc('guestbook', EMPTY_GUESTBOOK), 'entries')
      .filter((e) => e && e.ok === true).slice(0, LIMITS.gbPublic).map(publicEntry);
    send(res, 200, { entries });
  } catch (e) {
    console.error('[api/guestbook]', e?.message);
    send(res, 500, { error: 'guestbook_unavailable', entries: [] });
  }
}
