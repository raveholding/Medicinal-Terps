// Sistema VB ONGF · Medicinal Terps · Función de servidor «drive-legajos» (Supabase Edge Function, Deno) · 2026-11-02
// Google Drive de la organización SIN conectar en cada equipo:
//   una persona ADMINISTRADORA autoriza una sola vez; el servidor guarda el permiso (refresh token) cifrado en la
//   bóveda de Supabase y desde ahí crea las carpetas de los legajos, actualiza la hoja de legajos y sube documentos
//   para cualquier equipo. El navegador nunca recibe tokens de Google.
// Permiso pedido a Google: «drive.file» (sólo ve y toca lo que crea este sistema) + correo de la cuenta.
//
// POST (Authorization: Bearer <JWT del usuario>, JSON):
//   { accion: 'estado' }                              → cualquier miembro activo
//   { accion: 'conectar' }                            → admin: devuelve la dirección de Google para autorizar
//   { accion: 'desconectar' }                         → admin: revoca y borra el permiso
//   { accion: 'carpeta', legajo, dni }                → nivel «cargar» en socios: crea o reutiliza Legajos/{legajo}_{DNI|SD}
//   { accion: 'hoja', legajo, dni, fila:[12 textos] } → nivel «cargar»: alta o actualización de la fila del legajo
//   { accion: 'subir', legajo, dni, nombre, mime, tipo, version, hash, b64 } → nivel «cargar»: sube a la carpeta del legajo
// GET ?code&state (vuelta desde Google): guarda el permiso y vuelve al sistema.
// Secretos: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, ALLOWED_ORIGINS, SITE_URL
//           (SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los provee Supabase).
// «Verify JWT» APAGADO: la vuelta de Google no trae sesión; cada acción POST valida el JWT acá.

type Env = (k: string) => string | undefined;
export type Fetch = (url: string, init?: any) => Promise<Response>;
export type Deps = { env: Env; fetch: Fetch; ahora?: () => number };

const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const CARPETA = 'application/vnd.google-apps.folder';
const HOJA = 'application/vnd.google-apps.spreadsheet';
const MAX = 10 * 1024 * 1024;
const MIMES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
const ROLES = ['admin', 'mostrador', 'operador'];
const RE_LEG = /^L-\d{6}-[0-9A-Z]{6}$/;
const RE_ID = /^[A-Za-z0-9_-]{10,120}$/;
const HOJA_COLS = ['Legajo', 'Fecha de alta', 'Apellido y nombre', 'Documento', 'WhatsApp', 'Nacimiento', 'Origen', 'REPROCANN', 'Formulario de ingreso', 'Verificado', 'Carpeta del legajo', 'Actualizado'];

class Falla extends Error { status: number; codigo: string; constructor(status: number, codigo: string, msg: string) { super(msg); this.status = status; this.codigo = codigo; } }

/* ---------- utilidades ---------- */
const te = new TextEncoder();
function b64u(b: Uint8Array | string) { const u = typeof b === 'string' ? te.encode(b) : b; let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function deB64u(s: string) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function hex(b: ArrayBuffer) { return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function hmac(clave: string, dato: string) { const k = await crypto.subtle.importKey('raw', te.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, te.encode(dato)))); }
function igual(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function q(s: string) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
function limpio(s: string, n: number) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function celda(v: unknown) { const s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 500); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function docDe(dni: string) { const d = String(dni || '').replace(/\D/g, ''); return d.length >= 6 && d.length <= 11 ? d : 'SD'; }

/* ---------- base (PostgREST) ---------- */
function base(d: Deps) {
  const url = (d.env('SUPABASE_URL') || '').replace(/\/$/, '');
  const anon = d.env('SUPABASE_ANON_KEY') || '', srv = d.env('SUPABASE_SERVICE_ROLE_KEY') || '';
  async function rpc(fn: string, args: unknown, jwt?: string) {
    const h: Record<string, string> = { apikey: jwt ? anon : srv, 'content-type': 'application/json' };
    if (jwt) h.authorization = 'Bearer ' + jwt;
    else if (!/^sb_/.test(srv)) h.authorization = 'Bearer ' + srv;   // claves nuevas (sb_secret_…) van sólo en «apikey»
    const r = await d.fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
    const t = await r.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { /* nada */ }
    if (!r.ok) {
      const m = String((j && j.message) || '');
      if (/no_miembro/.test(m)) throw new Falla(403, 'no_miembro', 'Tu usuario no está habilitado.');
      throw new Falla(r.status === 401 ? 401 : 502, 'base', r.status === 401 ? 'La sesión venció: volvé a entrar.' : 'Error de la base (' + r.status + ')');
    }
    return j;
  }
  return { url, rpc };
}

/* ---------- Google ---------- */
const cacheTok = new Map<string, { at: string; vence: number }>();
export function _limpiarCache() { cacheTok.clear(); }
async function tokenAcceso(d: Deps, tenant: string, rt: string) {
  const ahora = (d.ahora || Date.now)();
  const c = cacheTok.get(tenant); if (c && c.vence - 60000 > ahora) return c.at;
  const r = await d.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: d.env('GOOGLE_OAUTH_CLIENT_ID') || '', client_secret: d.env('GOOGLE_OAUTH_CLIENT_SECRET') || '', refresh_token: rt, grant_type: 'refresh_token' }).toString() });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    cacheTok.delete(tenant);
    if (j && j.error === 'invalid_grant') throw new Falla(409, 'reconectar', 'Google ya no acepta el permiso de la organización (se revocó o venció). Un administrador tiene que volver a conectar Google Drive.');
    throw new Falla(502, 'google', 'Google no respondió al pedir acceso (' + r.status + ').');
  }
  cacheTok.set(tenant, { at: j.access_token, vence: ahora + (j.expires_in || 3600) * 1000 });
  return j.access_token as string;
}
async function g(d: Deps, at: string, url: string, init: any = {}) {
  const r = await d.fetch(url, { method: init.method || 'GET', headers: { authorization: 'Bearer ' + at, ...(init.json ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) }, body: init.json ? JSON.stringify(init.json) : init.body });
  if (r.status === 404) return null;
  if (!r.ok) {
    const st = r.status, t = await r.text().catch(() => '');
    if (st === 403 && /storageQuota|quotaExceeded/i.test(t)) throw new Falla(507, 'cuota', 'El Drive de la organización no tiene espacio libre.');
    if (st === 429 || (st === 403 && /rateLimit/i.test(t))) throw new Falla(429, 'limite', 'Google limitó los pedidos: probá de nuevo en unos minutos.');
    if (st === 401) { throw new Falla(409, 'reconectar', 'Google rechazó el acceso: hay que volver a conectar Google Drive.'); }
    if (st === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used/i.test(t)) throw new Falla(503, 'api_apagada', 'La API de Google Drive o de Google Sheets no está habilitada en el proyecto de Google Cloud de la organización.');
    throw new Falla(502, 'google', 'Error de Google (' + st + ').');
  }
  return r.status === 204 ? {} : r.json();
}
async function buscar(d: Deps, at: string, consulta: string) {
  const j: any = await g(d, at, `${DRIVE}?q=${encodeURIComponent(consulta)}&pageSize=10&spaces=drive&fields=${encodeURIComponent('files(id,name,webViewLink,parents)')}`);
  return (j && j.files) || [];
}
async function vivo(d: Deps, at: string, id: string | null) {
  if (!id || !RE_ID.test(id)) return false;
  const f: any = await g(d, at, `${DRIVE}/${id}?fields=id,trashed`);
  return !!(f && !f.trashed);
}
async function raizLegajos(d: Deps, at: string, tenant: string, actual: string | null, nombreOrg: string) {
  if (await vivo(d, at, actual)) return actual as string;
  const ya = await buscar(d, at, `mimeType = ${q(CARPETA)} and appProperties has { key='vbtKey' and value='legajos-raiz' } and trashed = false`);
  const id = ya.length ? ya[0].id : (await g(d, at, `${DRIVE}?fields=id`, { method: 'POST', json: { name: 'Legajos · ' + limpio(nombreOrg || 'Organización', 60), mimeType: CARPETA, appProperties: { vbtKey: 'legajos-raiz', vbt: '1' } } }) as any).id;
  await base(d).rpc('drive_set_raiz', { p_tenant: tenant, p_raiz: id });
  return id as string;
}
async function carpetaLegajo(d: Deps, at: string, raiz: string, legajo: string, dni: string) {
  const ya = await buscar(d, at, `${q(raiz)} in parents and mimeType = ${q(CARPETA)} and appProperties has { key='vbtKey' and value=${q('legajo|' + legajo)} } and trashed = false`);
  if (ya.length > 1) throw new Falla(409, 'duplicada', 'Hay más de una carpeta para el legajo ' + legajo + ': revisalo en Drive.');
  if (ya.length) return { id: ya[0].id as string, url: (ya[0].webViewLink || 'https://drive.google.com/drive/folders/' + ya[0].id) as string, creada: false };
  const f: any = await g(d, at, `${DRIVE}?fields=id,webViewLink`, { method: 'POST', json: { name: legajo + '_' + docDe(dni), mimeType: CARPETA, parents: [raiz], appProperties: { vbtKey: 'legajo|' + legajo, vbt: '1' } } });
  return { id: f.id as string, url: (f.webViewLink || 'https://drive.google.com/drive/folders/' + f.id) as string, creada: true };
}
async function hojaLegajos(d: Deps, at: string, tenant: string, raiz: string, actual: string | null, nombreOrg: string) {
  if (await vivo(d, at, actual)) return actual as string;
  const ya = await buscar(d, at, `mimeType = ${q(HOJA)} and appProperties has { key='vbtKey' and value='legajos-hoja' } and trashed = false`);
  let id = ya.length ? ya[0].id as string : '';
  if (!id) {
    const f: any = await g(d, at, `${DRIVE}?fields=id`, { method: 'POST', json: { name: 'Legajos · ' + limpio(nombreOrg || 'Organización', 60), mimeType: HOJA, parents: [raiz], appProperties: { vbtKey: 'legajos-hoja', vbt: '1' } } });
    id = f.id;
    await g(d, at, `${SHEETS}/${encodeURIComponent(id)}/values/A1:L1?valueInputOption=RAW`, { method: 'PUT', json: { values: [HOJA_COLS] } });
  }
  await base(d).rpc('drive_set_hoja', { p_tenant: tenant, p_hoja: id });
  return id;
}

/* ---------- HTTP ---------- */
function cors(origen: string | null, env: Env) {
  const ok = (env('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = { 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
  if (origen && ok.includes(origen)) h['access-control-allow-origin'] = origen;
  return h;
}
const json = (c: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(c), { status: s, headers: { ...h, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function volver(d: Deps, estado: string) {
  const site = (d.env('SITE_URL') || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(site)) return new Response('Listo (' + estado + '). Ya podés cerrar esta pestaña y volver al sistema.', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  return new Response(null, { status: 302, headers: { location: `${site}/?drive=${encodeURIComponent(estado)}#/panel/socios`, 'cache-control': 'no-store' } });
}

async function vuelta(req: Request, d: Deps) {
  const u = new URL(req.url), code = u.searchParams.get('code'), state = u.searchParams.get('state') || '';
  if (u.searchParams.get('error')) return volver(d, 'cancelado');
  const sec = d.env('GOOGLE_OAUTH_CLIENT_SECRET') || '';
  const [p, firma] = state.split('.');
  if (!code || !p || !firma || !sec || !igual(await hmac(sec + ':state', p), firma)) return volver(d, 'error');
  let st: any; try { st = JSON.parse(new TextDecoder().decode(deB64u(p))); } catch { return volver(d, 'error'); }
  if (!st || !st.t || !st.u || !(st.e >= (d.ahora || Date.now)())) return volver(d, 'vencido');
  const B = base(d);
  const r = await d.fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: d.env('GOOGLE_OAUTH_CLIENT_ID') || '', client_secret: sec, redirect_uri: B.url + '/functions/v1/drive-legajos', grant_type: 'authorization_code' }).toString() });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) return volver(d, 'sin_permiso_offline');
  if (!String(j.scope || '').includes('drive.file')) return volver(d, 'sin_drive');
  let cuenta = '';
  try { cuenta = String(JSON.parse(new TextDecoder().decode(deB64u(String(j.id_token).split('.')[1]))).email || ''); } catch { /* nada */ }
  try { await B.rpc('drive_guardar_token', { p_tenant: st.t, p_token: j.refresh_token, p_cuenta: cuenta, p_uid: st.u, p_scopes: String(j.scope || '') }); }
  catch { return volver(d, 'error'); }
  cacheTok.delete(st.t);
  return volver(d, 'ok');
}

export async function manejar(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'GET') return vuelta(req, d);
  const h = cors(req.headers.get('origin'), d.env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405, h);
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ ok: false, error: 'Falta la sesión.' }, 401, h);
  let b: any;
  try { const t = await req.text(); if (t.length > Math.ceil(MAX * 4 / 3) + 8192) return json({ ok: false, error: 'El archivo supera los 10 MB.', codigo: 'grande' }, 413, h); b = JSON.parse(t || '{}'); }
  catch { return json({ ok: false, error: 'Pedido inválido.' }, 400, h); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'Pedido inválido.' }, 400, h);
  try {
    const B = base(d);
    const me: any = await B.rpc('mi_perfil', {}, jwt);   // el comercio y el rol salen de la sesión, nunca del pedido
    if (!me || !me.tenant || !me.tenant.id || !ROLES.includes(me.rol)) return json({ ok: false, error: 'Sin acceso a este sistema.' }, 403, h);
    const tenant = String(me.tenant.id), uid = String(me.user_id);
    const configurado = !!(d.env('GOOGLE_OAUTH_CLIENT_ID') && d.env('GOOGLE_OAUTH_CLIENT_SECRET'));
    const con: any = await B.rpc('drive_leer', { p_tenant: tenant });
    const conectado = !!(con && con.token);

    if (b.accion === 'estado') {
      return json({ ok: true, configurado, conectado, cuenta: conectado && con.cuenta || '',
        raiz: conectado && con.raiz ? 'https://drive.google.com/drive/folders/' + con.raiz : '',
        hoja: conectado && con.hoja ? 'https://docs.google.com/spreadsheets/d/' + con.hoja + '/edit' : '' }, 200, h);
    }
    if (b.accion === 'conectar') {
      if (me.rol !== 'admin') return json({ ok: false, error: 'Sólo un administrador puede conectar Google Drive.', codigo: 'sin_permiso' }, 403, h);
      if (!configurado) return json({ ok: false, error: 'Pendiente de configuración: faltan las credenciales de Google de la organización en el servidor.', codigo: 'config' }, 503, h);
      const p = b64u(JSON.stringify({ t: tenant, u: uid, e: (d.ahora || Date.now)() + 10 * 60000, n: b64u(crypto.getRandomValues(new Uint8Array(12))) }));
      const state = p + '.' + await hmac(d.env('GOOGLE_OAUTH_CLIENT_SECRET') + ':state', p);
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: d.env('GOOGLE_OAUTH_CLIENT_ID')!, redirect_uri: B.url + '/functions/v1/drive-legajos',
        response_type: 'code', scope: SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false', state }).toString();
      return json({ ok: true, url }, 200, h);
    }
    if (b.accion === 'desconectar') {
      if (me.rol !== 'admin') return json({ ok: false, error: 'Sólo un administrador puede desconectar Google Drive.', codigo: 'sin_permiso' }, 403, h);
      if (conectado) await d.fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(con.token), { method: 'POST' }).catch(() => null);
      await B.rpc('drive_borrar', { p_tenant: tenant, p_uid: uid }); cacheTok.delete(tenant);
      return json({ ok: true }, 200, h);
    }
    if (!['carpeta', 'hoja', 'subir'].includes(b.accion)) return json({ ok: false, error: 'Acción desconocida.' }, 400, h);
    const nivel = Number(await B.rpc('drive_mi_nivel', {}, jwt)) || 0;
    if (nivel < 2) return json({ ok: false, error: 'No tenés permiso para cargar en los legajos.', codigo: 'sin_permiso' }, 403, h);
    const legajo = String(b.legajo || '');
    if (!RE_LEG.test(legajo)) return json({ ok: false, error: 'Legajo inválido.' }, 400, h);
    if (!configurado || !conectado) return json({ ok: false, error: 'Google Drive de la organización sin conectar: un administrador tiene que conectarlo una vez.', codigo: 'sin_conectar' }, 503, h);
    const at = await tokenAcceso(d, tenant, con.token);
    const raiz = await raizLegajos(d, at, tenant, con.raiz, me.tenant.nombre);
    const cp = await carpetaLegajo(d, at, raiz, legajo, String(b.dni || ''));
    if (b.accion === 'carpeta') return json({ ok: true, carpeta: cp.id, url: cp.url, creada: cp.creada }, 200, h);

    if (b.accion === 'hoja') {
      const fila = b.fila;
      if (!Array.isArray(fila) || fila.length !== HOJA_COLS.length || fila.some((x: unknown) => typeof x !== 'string') || fila[0] !== legajo) return json({ ok: false, error: 'Fila de la hoja inválida.' }, 422, h);
      const f = fila.map(celda); f[10] = cp.url; f[11] = new Date((d.ahora || Date.now)()).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
      const hid = await hojaLegajos(d, at, tenant, raiz, con.hoja, me.tenant.nombre);
      const bs = `${SHEETS}/${encodeURIComponent(hid)}/values/`;
      const col: any = await g(d, at, bs + 'A:A');
      const v = (col && col.values) || []; let i = -1;
      for (let k = 1; k < v.length; k++) if (v[k] && v[k][0] === legajo) { i = k; break; }
      if (i < 0) await g(d, at, bs + 'A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', json: { values: [f] } });
      else await g(d, at, bs + `A${i + 1}:L${i + 1}?valueInputOption=RAW`, { method: 'PUT', json: { values: [f] } });
      return json({ ok: true, carpeta: cp.id, url: cp.url, hoja: 'https://docs.google.com/spreadsheets/d/' + hid + '/edit', nueva: i < 0 }, 200, h);
    }

    const mime = String(b.mime || '');
    if (!MIMES[mime]) return json({ ok: false, error: 'Sólo PDF o fotos.' }, 422, h);
    let bytes: Uint8Array; try { bytes = deB64u(String(b.b64 || '')); } catch { return json({ ok: false, error: 'Archivo ilegible.' }, 422, h); }
    if (!bytes.length || bytes.length > MAX) return json({ ok: false, error: 'El archivo está vacío o supera los 10 MB.', codigo: 'grande' }, 413, h);
    const hash = hex(await crypto.subtle.digest('SHA-256', bytes));
    if (b.hash && b.hash !== hash) return json({ ok: false, error: 'El archivo llegó distinto de como salió del equipo: no se guardó.' }, 422, h);
    const nombre = limpio(b.nombre, 140);
    if (!nombre.startsWith(legajo + '_')) return json({ ok: false, error: 'Nombre de archivo inválido.' }, 422, h);
    const ya = await buscar(d, at, `${q(cp.id)} in parents and appProperties has { key='vbtHash' and value=${q(hash)} } and trashed = false`);
    let f: any = ya[0];
    if (!f) {
      const bnd = '----vbt' + hash.slice(0, 16);
      const meta = JSON.stringify({ name: nombre, parents: [cp.id], mimeType: mime, appProperties: { vbt: '1', vbtHash: hash, vbtLegajo: legajo, vbtTipo: limpio(b.tipo, 40), vbtVersion: String(Number(b.version) || 1) } });
      const a = te.encode(`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bnd}\r\nContent-Type: ${mime}\r\n\r\n`), z = te.encode(`\r\n--${bnd}--`);
      const cuerpo = new Uint8Array(a.length + bytes.length + z.length); cuerpo.set(a, 0); cuerpo.set(bytes, a.length); cuerpo.set(z, a.length + bytes.length);
      f = await g(d, at, `${UPLOAD}?uploadType=multipart&fields=id,name,webViewLink`, { method: 'POST', body: cuerpo, headers: { 'content-type': 'multipart/related; boundary=' + bnd } });
      if (!f || !f.id) throw new Falla(502, 'google', 'Google no confirmó la subida.');
    }
    return json({ ok: true, carpeta: cp.id, carpetaUrl: cp.url, archivo: { id: f.id, url: f.webViewLink || 'https://drive.google.com/file/d/' + f.id + '/view' }, repetido: !!ya.length, hash }, 200, h);
  } catch (e: any) {
    if (e instanceof Falla) return json({ ok: false, error: e.message, codigo: e.codigo }, e.status, h);
    return json({ ok: false, error: 'Error inesperado.' }, 500, h);
  }
}

const D: any = (globalThis as any).Deno;
if (D && D.serve) D.serve((req: Request) => manejar(req, { env: (k) => D.env.get(k), fetch: fetch }));
