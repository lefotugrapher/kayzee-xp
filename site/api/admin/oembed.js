// GET /api/admin/oembed?url=<link or iframe code>
// -> { url, embedUrl, type, provider, title, thumbnail, description }
// Best effort: YouTube/Vimeo oEmbed, otherwise read og:/twitter:/<title> from the page HTML.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { requireAdmin } from '../_lib/auth.js';
import { send, methodNotAllowed, query, fetchT, readCapped } from '../_lib/http.js';
import { normalizeUrl, toEmbedUrl, detectType, providerName, youtubeId, vimeoId } from '../../admin/embed.js';

const UA = 'Mozilla/5.0 (compatible; KayzeeXP-preview/1.0; +https://www.kayzee.xp)';

function privateIp(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublicHost(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new Error('blocked_host');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('blocked_host');
}

/** GET with manual redirects (each hop checked against private networks). */
async function safeGet(url, accept, maxHops = 4) {
  let u = new URL(url);
  for (let hop = 0; hop <= maxHops; hop++) {
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad_protocol');
    await assertPublicHost(u);
    const r = await fetchT(u.href, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'en' } }, 5000);
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      r.body?.cancel().catch(() => {});
      u = new URL(r.headers.get('location'), u);
      continue;
    }
    return { r, finalUrl: u.href };
  }
  throw new Error('too_many_redirects');
}

const decode = (s) => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function meta(html, names) {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${name}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return '';
}

async function oembed(endpoint) {
  const { r } = await safeGet(endpoint, 'application/json');
  if (!r.ok) { r.body?.cancel().catch(() => {}); return null; }
  return JSON.parse(await readCapped(r, 64 * 1024));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireAdmin(req, res)) return;

  const raw = String(query(req).url || '').slice(0, 4096);
  const url = normalizeUrl(raw);
  if (!url) return send(res, 400, { error: 'bad_url', message: 'Paste an http(s) link or an <iframe> embed code.' });

  const out = {
    url, embedUrl: toEmbedUrl(url), type: detectType(url), provider: providerName(url),
    title: '', thumbnail: '', description: '',
  };

  try {
    const yt = youtubeId(url);
    const vm = vimeoId(url);
    if (yt) {
      const j = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + yt)}`);
      if (j) { out.title = decode(j.title); out.thumbnail = j.thumbnail_url || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`; out.description = decode(j.author_name ? `by ${j.author_name}` : ''); }
      else out.thumbnail = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    } else if (vm) {
      const page = `https://vimeo.com/${vm.id}${vm.hash ? '/' + vm.hash : ''}`;
      const j = await oembed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`);
      if (j) { out.title = decode(j.title); out.thumbnail = j.thumbnail_url || ''; out.description = decode(j.description || '').slice(0, 300); }
    } else if (out.type === 'image') {
      out.thumbnail = url;
      out.title = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    } else if (out.type === 'page') {
      const { r, finalUrl } = await safeGet(url, 'text/html,application/xhtml+xml');
      const ct = r.headers.get('content-type') || '';
      if (r.ok && /html/i.test(ct)) {
        const html = await readCapped(r, 512 * 1024);
        out.title = meta(html, ['og:title', 'twitter:title']) || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
        const img = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
        if (img) { try { out.thumbnail = normalizeUrl(new URL(img, finalUrl).href); } catch { /* ignore */ } }
        out.description = meta(html, ['og:description', 'description', 'twitter:description']).slice(0, 300);
      } else {
        r.body?.cancel().catch(() => {});
        if (/^image\//i.test(ct)) { out.type = 'image'; out.thumbnail = url; }
        else if (/^video\//i.test(ct)) out.type = 'video';
      }
    }
  } catch (e) {
    out.warning = e?.message === 'blocked_host' ? 'That address is not reachable from the server.' : 'Could not read details from that link (you can still add it).';
  }
  if (out.provider === 'Playbook') {
    // Playbook sometimes serves its generic app shell; its real titles read "<Board> by <owner>".
    if (/^Playbook\b/i.test(out.title)) { out.title = ''; out.description = ''; }
    out.title = out.title.replace(/\s+by\s+[^,|]{1,40}$/i, '');
    if (/shared on Playbook\s*$/i.test(out.description)) out.description = '';
  }
  out.title = out.title.slice(0, 140);
  send(res, 200, out);
}
