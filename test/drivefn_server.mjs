// Servidor de prueba de la función «drive-legajos» con Google falso. SOLO PRUEBAS. Puerto 54399.
import http from 'node:http';
import { manejar, _limpiarCache } from '../supabase/functions/drive-legajos/index.ts';
import { makeGoogle } from './fakegoogle.mjs';
let G = makeGoogle();
const ENV = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'sb_publishable_TESTKEY', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_service_role',
  GOOGLE_OAUTH_CLIENT_ID: '123456789012-abcdefghijklmnop.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret', ALLOWED_ORIGINS: 'null,http://127.0.0.1:8000', SITE_URL: process.env.SITE_URL || '' };
const env = (k) => ENV[k];
const f = (url, init) => (/googleapis\.com/.test(url) ? G.fetch(url, init) : fetch(url, init));
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  const u = new URL(req.url, 'http://127.0.0.1:54321');
  const out = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/__g/state') return out(200, { files: G.S.files.map((x) => ({ id: x.id, name: x.name, mimeType: x.mimeType, parents: x.parents, appProperties: x.appProperties, size: x.size })), sheets: G.S.sheets, revoked: G.S.revoked.length, calls: G.S.calls.length });
  if (u.pathname === '/__g/reset') { G = makeGoogle(); _limpiarCache(); return out(200, {}); }
  if (u.pathname === '/__g/mode') { G.S.mode = JSON.parse(body).mode; _limpiarCache(); return out(200, {}); }
  if (u.pathname === '/__g/unconfig') { const k = JSON.parse(body).k; ENV[k + '_SAVED'] = ENV[k]; delete ENV[k]; return out(200, {}); }
  if (u.pathname === '/__g/reconfig') { const k = JSON.parse(body).k; ENV[k] = ENV[k + '_SAVED']; return out(200, {}); }
  if (u.pathname === '/__g/autorizar') { const o = JSON.parse(body); const a = G.autorizar(o.url, o); return out(200, a); }
  const h = {}; for (const [k, v] of Object.entries(req.headers)) h[k] = Array.isArray(v) ? v.join(',') : v;
  const r = await manejar(new Request(u.toString(), { method: req.method, headers: h, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), { env, fetch: f });
  const hh = {}; r.headers.forEach((v, k) => { hh[k] = v; });
  res.writeHead(r.status, hh); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(54399, '127.0.0.1', () => console.log('drivefn listo'));
