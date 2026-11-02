// Google falso (Drive v3, Sheets v4, OAuth) en memoria. SOLO PARA PRUEBAS.
export function makeGoogle() {
  const S = { files: [], sheets: {}, codes: {}, rts: {}, ats: {}, revoked: [], n: 0, mode: 'ok', calls: [], email: 'medicinalterps@gmail.com' };
  const id = () => 'G' + String(++S.n).padStart(4, '0') + 'xxxxxxxxxxxx';
  const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
  const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  function match(f, q) {
    let m;
    const re = /mimeType = '((?:[^'\\]|\\.)*)'|appProperties has \{ key='((?:[^'\\]|\\.)*)' and value='((?:[^'\\]|\\.)*)' \}|'((?:[^'\\]|\\.)*)' in parents|trashed = false/g;
    while ((m = re.exec(q))) {
      if (m[1] !== undefined && f.mimeType !== unq(m[1])) return false;
      if (m[2] !== undefined && (f.appProperties || {})[unq(m[2])] !== unq(m[3])) return false;
      if (m[4] !== undefined && !(f.parents || []).includes(unq(m[4]))) return false;
      if (m[0] === 'trashed = false' && f.trashed) return false;
    }
    return true;
  }
  const pub = (f) => ({ id: f.id, name: f.name, webViewLink: 'https://drive.google.com/' + (f.mimeType.includes('folder') ? 'drive/folders/' : 'file/d/') + f.id, parents: f.parents });
  function auth(init) {
    const a = ((init && init.headers) || {}).authorization || '';
    const t = a.replace('Bearer ', '');
    if (!S.ats[t]) return null;
    return t;
  }
  async function fetch(url, init = {}) {
    const u = new URL(url); S.calls.push((init.method || 'GET') + ' ' + u.host + u.pathname);
    const body = init.body;
    if (u.host === 'oauth2.googleapis.com' && u.pathname === '/token') {
      const p = new URLSearchParams(String(body));
      if (p.get('client_secret') !== 'test-client-secret') return J({ error: 'invalid_client' }, 401);
      if (p.get('grant_type') === 'authorization_code') {
        const c = S.codes[p.get('code')]; delete S.codes[p.get('code')];
        if (!c) return J({ error: 'invalid_grant' }, 400);
        const rt = 'rt-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); S.rts[rt] = 1;
        const idt = 'x.' + Buffer.from(JSON.stringify({ email: S.email })).toString('base64url') + '.y';
        return J({ refresh_token: c.offline ? rt : undefined, access_token: 'at0', scope: c.scope, id_token: idt });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (!S.rts[p.get('refresh_token')] || S.mode === 'invalid_grant') return J({ error: 'invalid_grant' }, 400);
        const at = 'at-' + (++S.n); S.ats[at] = 1; return J({ access_token: at, expires_in: 3600 });
      }
    }
    if (u.host === 'oauth2.googleapis.com' && u.pathname === '/revoke') { const t = u.searchParams.get('token'); S.revoked.push(t); delete S.rts[t]; return J({}); }
    if (u.host === 'www.googleapis.com' || u.host === 'sheets.googleapis.com') {
      if (!auth(init)) return J({ error: { code: 401 } }, 401);
      if (S.mode === 'quota' && init.method === 'POST') return J({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, 403);
    }
    if (u.host === 'www.googleapis.com' && u.pathname === '/drive/v3/files' && (init.method || 'GET') === 'GET') {
      const q = u.searchParams.get('q') || '';
      return J({ files: S.files.filter((f) => match(f, q)).map(pub) });
    }
    let m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (u.host === 'www.googleapis.com' && m) { const f = S.files.find((x) => x.id === m[1]); return f ? J({ id: f.id, trashed: !!f.trashed }) : J({}, 404); }
    if (u.host === 'www.googleapis.com' && u.pathname === '/drive/v3/files' && init.method === 'POST') {
      const meta = JSON.parse(body); const f = { id: id(), ...meta }; S.files.push(f);
      if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') S.sheets[f.id] = [];
      return J(pub(f));
    }
    if (u.host === 'www.googleapis.com' && u.pathname === '/upload/drive/v3/files') {
      const raw = Buffer.from(body); const txt = raw.toString('latin1');
      const mj = /\r\n\r\n(\{.*?\})\r\n--/s.exec(txt); const meta = JSON.parse(mj[1]);
      const start = txt.indexOf('\r\n\r\n', txt.indexOf('Content-Type: ' + meta.mimeType)) + 4; const end = txt.lastIndexOf('\r\n--');
      const f = { id: id(), ...meta, size: end - start, content: raw.subarray(start, end) }; S.files.push(f); return J(pub(f));
    }
    m = /^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/.exec(u.pathname);
    if (u.host === 'sheets.googleapis.com' && m) {
      const rows = S.sheets[decodeURIComponent(m[1])]; if (!rows) return J({}, 404);
      const rg = decodeURIComponent(m[2]);
      if (rg === 'A:A') return J({ values: rows.map((r) => [r[0]]) });
      if (/:append$/.test(rg)) { for (const r of JSON.parse(body).values) rows.push(r); return J({}); }
      const mm = /^A(\d+):L\d+$/.exec(rg); if (mm) { rows[Number(mm[1]) - 1] = JSON.parse(body).values[0]; return J({}); }
    }
    return J({ error: 'fake: ruta no soportada ' + u.host + u.pathname }, 400);
  }
  // simula la pantalla de Google: el usuario acepta y Google devuelve un código
  function autorizar(authUrl, { offline = true, scope = 'openid email https://www.googleapis.com/auth/drive.file' } = {}) {
    const u = new URL(authUrl); const code = 'code-' + (++S.n); S.codes[code] = { offline, scope };
    return { code, state: u.searchParams.get('state'), redirect: u.searchParams.get('redirect_uri'), client: u.searchParams.get('client_id'), scope: u.searchParams.get('scope') };
  }
  return { S, fetch, autorizar };
}
