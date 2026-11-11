// Tiny stand-in for Supabase (auth + the kabe_sync table) for testing the app's real sync code without an account.
// Run: node scripts/mock-supabase.js [port]   then connect Kabe to http://localhost:<port> with any long fake key.
// Not a security model: it ignores tokens. Data lives in memory and is lost on restart.
/* global Buffer */
const http = require('http');
const port = Number(process.argv[2] || 54321);
const users = new Map(); // email -> {id, password}
const rows = new Map(); // user_id -> {user_id, data, updated_at}
const log = [];

const send = (res, code, body, extra = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*', ...extra });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const idFor = (email) => 'u-' + Buffer.from(email).toString('hex').slice(0, 12).padEnd(12, '0');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const session = (email) => {
  const id = users.get(email).id;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: id, role: 'authenticated', exp })}.sig`,
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-' + id,
    user: { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
};

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const body = raw ? JSON.parse(raw) : {};
      log.push(`${req.method} ${url.pathname}${url.search}`);
      if (req.method === 'OPTIONS') return send(res, 204);
      if (url.pathname === '/__log') return send(res, 200, log.slice(-60));
      if (url.pathname === '/__rows') return send(res, 200, [...rows.values()]);

      if (url.pathname === '/auth/v1/signup') {
        const email = String(body.email || '').toLowerCase();
        if (users.has(email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        users.set(email, { id: idFor(email), password: body.password });
        return send(res, 200, session(email));
      }
      if (url.pathname === '/auth/v1/token') {
        const grant = url.searchParams.get('grant_type');
        if (grant === 'refresh_token') {
          const email = [...users.keys()].find((e) => 'refresh-' + users.get(e).id === body.refresh_token);
          return email ? send(res, 200, session(email)) : send(res, 400, { error: 'invalid_grant', error_description: 'bad refresh token' });
        }
        const email = String(body.email || '').toLowerCase();
        const u = users.get(email);
        if (!u || u.password !== body.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return send(res, 200, session(email));
      }
      if (url.pathname === '/auth/v1/logout') return send(res, 204);

      if (url.pathname === '/rest/v1/kabe_sync') {
        const wantObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
        const filter = url.searchParams.get('user_id');
        const uid = filter ? filter.replace('eq.', '') : body.user_id;
        if (req.method === 'GET') {
          const row = rows.get(uid);
          if (wantObject) return row ? send(res, 200, pickCols(row, url)) : send(res, 406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' });
          return send(res, 200, row ? [pickCols(row, url)] : []);
        }
        if (req.method === 'POST') {
          const row = { user_id: uid, data: body.data, updated_at: new Date().toISOString() };
          rows.set(uid, row);
          return wantObject ? send(res, 201, pickCols(row, url)) : send(res, 201, [pickCols(row, url)]);
        }
        if (req.method === 'DELETE') {
          rows.delete(uid);
          return send(res, 204);
        }
      }
      send(res, 404, { message: 'not found: ' + url.pathname });
    });
  })
  .listen(port, () => console.log(`mock supabase on http://localhost:${port}`));

function pickCols(row, url) {
  const sel = url.searchParams.get('select');
  if (!sel || sel === '*') return row;
  return Object.fromEntries(sel.split(',').map((s) => s.trim()).filter((c) => c in row).map((c) => [c, row[c]]));
}
