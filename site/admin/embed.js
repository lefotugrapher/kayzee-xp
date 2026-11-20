// Shared pure helpers for embeds. Used by the admin UI (browser) and the API (Node).
// No DOM, no Node built-ins: this file must run in both.

const decodeEntities = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/gi, '/');

/** If `input` contains an <iframe ...> embed code, return its src; otherwise return the trimmed input. */
export function extractIframeSrc(input) {
  const s = String(input ?? '').trim();
  if (!/<iframe\b/i.test(s)) return s;
  const m = s.match(/<iframe\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return '';
  return decodeEntities((m[1] ?? m[2] ?? m[3] ?? '').trim());
}

/** Return a normalised absolute http(s) URL string, or '' if `input` is not one. Accepts iframe code. */
export function normalizeUrl(input) {
  let s = extractIframeSrc(input);
  if (!s) return '';
  if (s.startsWith('//')) s = 'https:' + s;
  else if (/^www\./i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  if (!u.hostname || !u.hostname.includes('.') && u.hostname !== 'localhost') return '';
  return u.href;
}

/** YouTube video id from any common YouTube URL form, or null. */
export function youtubeId(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

/** Vimeo video id (+ optional private hash) from a Vimeo URL, or null. */
export function vimeoId(url) {
  let u; try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/video\/(\d+)/);
    return m ? { id: m[1], hash: u.searchParams.get('h') || '' } : null;
  }
  if (h === 'vimeo.com') {
    const m = u.pathname.match(/^\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([0-9a-f]+))?/);
    return m ? { id: m[1], hash: m[2] || u.searchParams.get('h') || '' } : null;
  }
  return null;
}

/**
 * Turn a pasted link into the URL we should iframe / play.
 * YouTube and Vimeo watch pages refuse framing, so map them to their player URLs.
 */
export function toEmbedUrl(input) {
  const url = normalizeUrl(input);
  if (!url) return '';
  const yt = youtubeId(url);
  if (yt) {
    const u = new URL(url);
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    const start = t ? parseInt(String(t).replace(/s$/, ''), 10) : 0;
    return `https://www.youtube.com/embed/${yt}` + (start > 0 ? `?start=${start}` : '');
  }
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm.id}` + (vm.hash ? `?h=${vm.hash}` : '');
  return url;
}

/** Guess the project type for a URL: 'video' | 'image' | 'page'. */
export function detectType(input) {
  const url = normalizeUrl(input);
  if (!url) return 'page';
  if (youtubeId(url) || vimeoId(url)) return 'video';
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* ignore */ }
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return 'video';
  if (/\.(jpe?g|png|webp|gif|avif)$/.test(path)) return 'image';
  return 'page';
}

/** Friendly provider name for the UI. */
export function providerName(input) {
  const url = normalizeUrl(input);
  if (!url) return '';
  if (youtubeId(url)) return 'YouTube';
  if (vimeoId(url)) return 'Vimeo';
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h === 'playbook.com' || h.endsWith('.playbook.com')) return 'Playbook';
    return h;
  } catch { return ''; }
}

/** URL-safe slug: lowercase ascii, digits and single dashes, max 60 chars. */
export function slugify(s, max = 48) {
  let out = String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (out.length > max) {
    out = out.slice(0, max + 1);
    const cut = out.lastIndexOf('-');
    out = cut > max / 2 ? out.slice(0, cut) : out.slice(0, max); // end on a whole word when possible
  }
  return out.replace(/-+$/g, '');
}

/** Spotify playlist id from an id, open.spotify.com URL, spotify: URI or embed code. Null if none. */
export function spotifyPlaylistId(input) {
  const s = extractIframeSrc(input);
  if (!s) return null;
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  const uri = s.match(/^spotify:(?:user:[^:]+:)?playlist:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];
  const m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(?:user\/[^/]+\/)?playlist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}
