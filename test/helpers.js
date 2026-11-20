// Shared test helper: boots the app on a random port with an in-memory database.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.UPLOAD_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'iris-up-'));
process.env.ADMIN_EMAILS = 'boss@exquisappfactory.com';

const http = require('http');
const { createApp } = require('../src/app');
const { outbox } = require('../src/services/mail');

async function start() {
  const server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    async function call(method, url, body, opts = {}) {
      const headers = { cookie, ...(opts.noCsrf ? {} : { 'X-Requested-With': 'iris' }) };
      let payload;
      if (opts.raw) { payload = body; headers['Content-Type'] = opts.type || 'image/png'; }
      else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
      const res = await fetch(base + url, { method, headers, body: payload });
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.startsWith('iris_session=;') ? '' : sc.split(';')[0];
      let json = {}; try { json = await res.clone().json(); } catch {}
      return { status: res.status, json, res };
    }
    return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
  }

  /** Register + verify + login a user; returns a logged-in client. */
  async function user(email, name = 'Test User', password = 'Passw0rd123!') {
    const c = client();
    const r = await c.call('POST', '/api/auth/register', { name, email, password });
    if (r.status !== 200) throw new Error(`register failed ${r.status} ${JSON.stringify(r.json)}`);
    const token = new URL(r.json.devLink).searchParams.get('token');
    await c.call('POST', '/api/auth/verify', { token });
    const l = await c.call('POST', '/api/auth/login', { email, password });
    if (l.status !== 200) throw new Error(`login failed ${l.status}`);
    c.password = password;
    return c;
  }
  return { base, client, user, outbox, close: () => server.close() };
}
module.exports = { start };
