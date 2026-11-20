// GET    /api/admin/links                         -> { links }
// POST   /api/admin/links {company, note?, open?}  -> { ok:true, link, links }
// DELETE /api/admin/links?slug=<slug>              -> { ok:true, links }
import { requireAdmin } from './auth.js';
import { getDoc, getSite, updateDoc } from './store.js';
import { send, methodNotAllowed, jsonBody, isJson, query } from './http.js';
import { EMPTY_LINKS, LIMITS, OPEN_TARGETS, oneLine, kebab, randomBase36, defaultNote, isSlug, listOf, storageError } from './visitors.js';

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      return send(res, 200, { links: listOf(await getDoc('links', EMPTY_LINKS, { fresh: true }), 'links') });
    }

    if (req.method === 'DELETE') {
      const slug = String(query(req).slug ?? '').trim().toLowerCase();
      if (!isSlug(slug)) return send(res, 400, { ok: false, error: 'bad_slug' });
      let found = false;
      let links = [];
      await updateDoc('links', EMPTY_LINKS, (doc) => {
        const all = listOf(doc, 'links');
        links = all.filter((l) => l && l.slug !== slug);
        found = links.length !== all.length;
        return found ? { links } : undefined;
      });
      if (!found) return send(res, 404, { ok: false, error: 'not_found' });
      return send(res, 200, { ok: true, links });
    }

    if (!isJson(req)) return send(res, 415, { ok: false, error: 'expected_json' });
    const b = jsonBody(req);
    if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { ok: false, error: 'invalid_json', errors: ['Body is not valid JSON'] });

    const errors = [];
    const company = oneLine(b.company);
    if (!company) errors.push('Type the company name.');
    else if (company.length > LIMITS.company) errors.push(`The company name is too long (max ${LIMITS.company} characters).`);
    let note = oneLine(b.note);
    if (note.length > LIMITS.note) errors.push(`The sticky note is too long (max ${LIMITS.note} characters).`);
    if (!note && company) note = defaultNote(company);
    const open = b.open == null ? '' : String(b.open).trim();
    if (!OPEN_TARGETS.includes(open)) {
      const m = /^project:(.+)$/.exec(open);
      const projects = m ? (await getSite()).projects || [] : [];
      if (!m || !projects.some((p) => p && p.id === m[1])) errors.push('"Open first" must be a section of the site or one of your projects.');
    }
    if (errors.length) return send(res, 400, { ok: false, error: 'validation_failed', errors });

    let link = null;
    let links = [];
    let full = false;
    await updateDoc('links', EMPTY_LINKS, (doc) => {
      links = listOf(doc, 'links').filter(Boolean);
      full = links.length >= LIMITS.links;
      if (full) return undefined;
      const base = kebab(company) || 'team';
      let slug;
      do { slug = `${base}-${randomBase36(3)}`; } while (links.some((l) => l.slug === slug));
      link = { slug, company, note, open, created: Date.now() };
      links = [link, ...links];
      return { links };
    });
    if (full) return send(res, 400, { ok: false, error: 'validation_failed', errors: [`That is a lot of links (max ${LIMITS.links}). Delete a few old ones first.`] });
    send(res, 200, { ok: true, link, links });
  } catch (e) {
    console.error('[api/admin/links]', e?.message);
    const { status, body } = storageError(e);
    send(res, status, body);
  }
}
