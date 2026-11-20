// GET  /api/admin/guestbook                                        -> { entries } everything, newest first (no ipHash)
// POST /api/admin/guestbook {id, action:'approve'|'hide'|'delete'}  -> { ok:true, entries }
import { requireAdmin } from './auth.js';
import { getDoc, updateDoc } from './store.js';
import { send, methodNotAllowed, jsonBody, isJson } from './http.js';
import { EMPTY_GUESTBOOK, adminEntry, listOf, storageError } from './visitors.js';

const ACTIONS = ['approve', 'hide', 'delete'];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const entries = listOf(await getDoc('guestbook', EMPTY_GUESTBOOK, { fresh: true }), 'entries').filter(Boolean);
      return send(res, 200, { entries: entries.map(adminEntry) });
    }
    if (!isJson(req)) return send(res, 415, { ok: false, error: 'expected_json' });
    const b = jsonBody(req) || {};
    const id = typeof b.id === 'string' ? b.id : '';
    if (!id || !ACTIONS.includes(b.action)) return send(res, 400, { ok: false, error: 'bad_request' });
    let found = false;
    let entries = [];
    await updateDoc('guestbook', EMPTY_GUESTBOOK, (doc) => {
      entries = listOf(doc, 'entries').filter(Boolean);
      const i = entries.findIndex((e) => e.id === id);
      found = i >= 0;
      if (!found) return undefined;
      if (b.action === 'delete') entries.splice(i, 1);
      else {
        const { hidden, ...rest } = entries[i];
        entries[i] = b.action === 'approve' ? { ...rest, ok: true } : { ...rest, ok: false, hidden: true };
      }
      return { entries };
    });
    if (!found) return send(res, 404, { ok: false, error: 'not_found' });
    send(res, 200, { ok: true, entries: entries.map(adminEntry) });
  } catch (e) {
    console.error('[api/admin/guestbook]', e?.message);
    const { status, body } = storageError(e);
    send(res, status, body);
  }
}
