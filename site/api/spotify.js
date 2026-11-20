// GET /api/spotify?playlist=<id | url | spotify:playlist:uri | iframe code>
// -> { id, name, owner, cover, tracks: [{ title, artists, ms, uri }] }
// Uses the Web API (client credentials) when SPOTIFY_CLIENT_ID/SECRET are set, otherwise the
// public embed page's __NEXT_DATA__. 502 on failure (client falls back to /data/playlist-snapshot.json).
import { send, methodNotAllowed, query, fetchT, readCapped } from './_lib/http.js';
import { getSite } from './_lib/store.js';
import { spotifyPlaylistId } from '../admin/embed.js';

const DAY = 864e5;
const cache = new Map(); // id -> { at, data }
let token = null; // { value, exp }

const nbsp = (s) => String(s ?? '').replace(/ /g, ' ').trim();

async function appToken() {
  if (token && token.exp > Date.now() + 30_000) return token.value;
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  const r = await fetchT('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }, 6000);
  if (!r.ok) throw new Error(`spotify token ${r.status}`);
  const j = await r.json();
  token = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return token.value;
}

async function viaWebApi(id) {
  const auth = { Authorization: `Bearer ${await appToken()}` };
  const r = await fetchT(`https://api.spotify.com/v1/playlists/${id}?market=IE`, { headers: auth }, 8000);
  if (!r.ok) throw new Error(`spotify playlist ${r.status}`);
  const p = await r.json();
  // Newer API responses call the paging object `items`; older ones `tracks`.
  let page = p.items && !Array.isArray(p.items) ? p.items : p.tracks;
  const tracks = [];
  for (let n = 0; page && n < 20; n++) {
    for (const it of page.items || []) {
      const t = it?.track || it?.item;
      if (!t || !t.uri) continue;
      tracks.push({ title: nbsp(t.name), artists: (t.artists || []).map((a) => nbsp(a.name)).join(', '), ms: t.duration_ms | 0, uri: t.uri, ...(t.album?.images?.length ? { art: t.album.images[t.album.images.length > 1 ? 1 : 0].url } : {}) });
    }
    if (!page.next) break;
    const nr = await fetchT(page.next, { headers: auth }, 8000);
    if (!nr.ok) break;
    page = await nr.json();
  }
  if (!tracks.length) throw new Error('spotify web api returned no tracks');
  return { id, name: nbsp(p.name), owner: nbsp(p.owner?.display_name), cover: p.images?.[0]?.url || '', tracks, source: 'webapi' };
}

async function viaEmbed(id) {
  const r = await fetchT(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept': 'text/html', 'Accept-Language': 'en',
    },
  }, 8000);
  if (!r.ok) throw new Error(`spotify embed ${r.status}`);
  const html = await readCapped(r, 3 * 1024 * 1024);
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('spotify embed: no __NEXT_DATA__');
  const e = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!e || !Array.isArray(e.trackList)) throw new Error('spotify embed: unexpected shape');
  const sources = e.coverArt?.sources || [];
  const cover = sources.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || sources[0]?.url || '';
  return {
    id,
    name: nbsp(e.name || e.title),
    owner: nbsp(e.subtitle || e.authors?.[0]?.name),
    cover,
    tracks: e.trackList.filter((t) => t && t.uri).map((t) => ({ title: nbsp(t.title), artists: nbsp(t.subtitle), ms: t.duration | 0, uri: t.uri })),
    source: 'embed',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  let raw = String(query(req).playlist || '').slice(0, 4096);
  if (!raw) {
    try { raw = (await getSite()).settings?.spotifyPlaylist || ''; } catch { raw = ''; }
  }
  const id = spotifyPlaylistId(raw);
  if (!id) return send(res, 400, { error: 'bad_playlist', message: 'Give a Spotify playlist id, link, URI or embed code.' });

  const hit = cache.get(id);
  const cacheHeaders = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' };
  if (hit && Date.now() - hit.at < DAY) return send(res, 200, hit.data, cacheHeaders);

  let data = null, err = null;
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    try { data = await viaWebApi(id); } catch (e) { err = e; console.warn('[api/spotify] web api failed, trying embed:', e.message); }
  }
  if (!data) {
    try { data = await viaEmbed(id); } catch (e) { err = e; }
  }
  if (!data) {
    if (hit) return send(res, 200, hit.data, { 'Cache-Control': 'public, s-maxage=600' }); // stale beats nothing
    console.error('[api/spotify]', err?.message);
    return send(res, 502, { error: 'spotify_unavailable', fallback: '/data/playlist-snapshot.json' });
  }
  if (cache.size > 50) cache.clear();
  cache.set(id, { at: Date.now(), data });
  send(res, 200, data, cacheHeaders);
}
