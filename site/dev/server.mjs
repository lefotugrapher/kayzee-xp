// Local dev server: static files + /api/* handlers, mimicking Vercel.
// Usage: node dev/server.mjs   (PORT env to override 7500)
import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 7500;

// ---- env
const envFile = path.join(ROOT, '.env.local');
if (existsSync(envFile)) { process.loadEnvFile(envFile); console.log('[dev] loaded .env.local'); }
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'kayzee-dev';
  console.warn('[dev] WARNING: ADMIN_PASSWORD not set, using dev password "kayzee-dev"');
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  console.warn('[dev] WARNING: SESSION_SECRET not set, using a random one (sessions reset on restart)');
}
if (!process.env.BLOB_READ_WRITE_TOKEN) console.log('[dev] no BLOB_READ_WRITE_TOKEN: reading/writing data/site.json and dev/.data/*.json on disk');

// Same rewrites as vercel.json.
const REWRITES = [
  [/^\/hi\/[^/]+\/?$/, '/room/index.html'], // per-recruiter links: the room page reads the slug from the path
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
};

// Never serve these (mirrors what Vercel would not expose as static files).
const BLOCKED = /(^|\/)\.|^\/(api|node_modules)(\/|$)|^\/package(-lock)?\.json$|^\/vercel\.json$/;

function sendText(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg);
}

async function resolveStatic(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  p = path.posix.normalize(p);
  if (!p.startsWith('/') || p.split('/').includes('..') || BLOCKED.test(p)) return null;
  const abs = path.resolve(ROOT, '.' + p);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  // cleanUrls: /x -> /x.html, /dir -> /dir/index.html
  const candidates = [abs];
  if (!path.extname(abs)) candidates.push(abs + '.html');
  candidates.push(path.join(abs, 'index.html'));
  for (const c of candidates) {
    try { const s = await stat(c); if (s.isFile()) return c; } catch { /* next */ }
  }
  return null;
}

// ---- API: adapt Node req/res to what the handlers (and Vercel) expect
const modCache = new Map();
async function loadHandler(rel) {
  const file = path.join(ROOT, 'api', rel + '.js');
  if (!file.startsWith(path.join(ROOT, 'api') + path.sep) || path.basename(file).startsWith('_') || rel.split('/').some((s) => s.startsWith('_'))) return null;
  let s;
  try { s = await stat(file); } catch { return null; }
  const key = file + ':' + s.mtimeMs; // re-import when the route file changes
  if (!modCache.has(key)) modCache.set(key, import(pathToFileURL(file).href + '?v=' + s.mtimeMs));
  return (await modCache.get(key)).default;
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function decorate(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
  res.send = (b) => { if (typeof b === 'object' && !Buffer.isBuffer(b)) return res.json(b); res.end(b); return res; };
  return res;
}

async function handleApi(req, res, url) {
  const rel = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9/_-]+$/i.test(rel)) return sendText(res, 404, 'Not found');
  const handler = await loadHandler(rel);
  if (!handler) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not_found"}'); }
  req.query = Object.fromEntries(url.searchParams);
  if (!['GET', 'HEAD'].includes(req.method)) {
    const raw = await readBody(req);
    const ct = req.headers['content-type'] || '';
    if (/application\/json/i.test(ct)) {
      if (!raw.length) req.body = null;
      else { try { req.body = JSON.parse(raw.toString('utf8')); } catch { req.body = raw.toString('utf8'); } }
    } else if (/application\/x-www-form-urlencoded/i.test(ct)) req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    else req.body = raw.length ? raw.toString('utf8') : undefined;
  }
  await handler(req, decorate(res));
}

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  try {
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
      const rewrite = REWRITES.find(([re]) => re.test(url.pathname));
      const file = await resolveStatic(rewrite ? rewrite[1] : url.pathname);
      if (!file) return sendText(res, 404, 'Not found');
      const body = await readFile(file);
      const headers = {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      };
      if (url.pathname.startsWith('/admin')) headers['X-Frame-Options'] = 'DENY';
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    }
  } catch (e) {
    console.error('[dev]', req.method, url.pathname, e);
    if (!res.headersSent) sendText(res, e.status || 500, e.status === 413 ? 'Payload too large' : 'Internal error');
    else res.end();
  } finally {
    if (url.pathname.startsWith('/api/')) console.log(`[dev] ${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - t0}ms`);
  }
});

server.listen(PORT, HOST, () => console.log(`[dev] Kayzee XP on http://${HOST}:${PORT}  (admin: http://${HOST}:${PORT}/admin)`));
