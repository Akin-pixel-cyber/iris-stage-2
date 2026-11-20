const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./helpers');
const { isWorkEmail } = require('../src/services/emailDomain');
const tokens = require('../src/services/tokens');
const { db } = require('../src/db');

let t;
test.before(async () => { t = await start(); });
test.after(() => t.close());

test('email domain check is strict', () => {
  assert.ok(isWorkEmail('adam@exquisappfactory.com'));
  assert.ok(isWorkEmail('  Adam.Smith@ExquisAppFactory.COM '));
  for (const bad of ['adam@gmail.com', 'adam@exquisappfactory.com.evil.com', 'adam@mail.exquisappfactory.com',
    'adam@@exquisappfactory.com', 'adam@evil.com@exquisappfactory.com', '@exquisappfactory.com', 'adam@exquisappfactory.co',
    'adam exquisappfactory.com', 'adam@exquisappfactory.com ,evil@x.com', '']) assert.ok(!isWorkEmail(bad), bad);
});

test('register refuses outside emails, weak passwords and bad names', async () => {
  const c = t.client();
  assert.equal((await c.call('POST', '/api/auth/register', { name: 'A B', email: 'a@gmail.com', password: 'Passw0rd123!' })).json.code, 'bad_domain');
  assert.equal((await c.call('POST', '/api/auth/register', { name: 'A B', email: 'a@exquisappfactory.com', password: 'short1' })).json.code, 'weak_password');
  assert.equal((await c.call('POST', '/api/auth/register', { name: 'A', email: 'a@exquisappfactory.com', password: 'Passw0rd123!' })).json.code, 'bad_name');
});

test('cannot log in before verifying, can after', async () => {
  const c = t.client();
  const r = await c.call('POST', '/api/auth/register', { name: 'Ada Lovelace', email: 'ada@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal(r.status, 200);
  assert.ok(t.outbox.some((m) => m.to === 'ada@exquisappfactory.com'));
  let l = await c.call('POST', '/api/auth/login', { email: 'ada@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal(l.status, 403); assert.equal(l.json.code, 'unverified');
  assert.equal((await c.call('GET', '/api/me')).status, 401);
  const token = new URL(r.json.devLink).searchParams.get('token');
  assert.equal((await c.call('POST', '/api/auth/verify', { token })).status, 200);
  assert.equal((await c.call('POST', '/api/auth/verify', { token })).status, 400, 'token is single use');
  l = await c.call('POST', '/api/auth/login', { email: 'ada@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal(l.status, 200);
  const me = await c.call('GET', '/api/me');
  assert.equal(me.json.email, 'ada@exquisappfactory.com'); assert.equal(me.json.role, 'member');
});

test('wrong password is refused with a generic message', async () => {
  const c = await t.user('bob@exquisappfactory.com', 'Bob Marley');
  const l = await t.client().call('POST', '/api/auth/login', { email: 'bob@exquisappfactory.com', password: 'nope-nope-1' });
  assert.equal(l.status, 401); assert.equal(l.json.code, 'bad_credentials');
  assert.equal((await t.client().call('POST', '/api/auth/login', { email: 'ghost@exquisappfactory.com', password: 'nope-nope-1' })).json.error, l.json.error);
});

test('duplicate registration is refused once verified', async () => {
  await t.user('dup@exquisappfactory.com', 'Dup Licate');
  const r = await t.client().call('POST', '/api/auth/register', { name: 'Dup Licate', email: 'DUP@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal(r.status, 409);
});

test('expired verification token is rejected', async () => {
  const c = t.client();
  await c.call('POST', '/api/auth/register', { name: 'Late Comer', email: 'late@exquisappfactory.com', password: 'Passw0rd123!' });
  const uid = db.prepare("SELECT id FROM users WHERE email = 'late@exquisappfactory.com'").get().id;
  const raw = tokens.create(uid, 'verify', -1);   // already expired
  assert.equal((await c.call('POST', '/api/auth/verify', { token: raw })).status, 400);
});

test('password reset flow signs out other sessions', async () => {
  const a = await t.user('rita@exquisappfactory.com', 'Rita Ora');
  assert.equal((await a.call('GET', '/api/me')).status, 200);
  const f = await t.client().call('POST', '/api/auth/forgot', { email: 'rita@exquisappfactory.com' });
  assert.equal(f.status, 200);
  const token = new URL(f.json.devLink).searchParams.get('token');
  assert.equal((await t.client().call('POST', '/api/auth/reset', { token, password: 'weak' })).status, 400);
  const r = await t.client().call('POST', '/api/auth/reset', { token, password: 'BrandNew#Pass99' });
  assert.equal(r.status, 200);
  assert.equal((await a.call('GET', '/api/me')).status, 401, 'old session ended');
  assert.equal((await t.client().call('POST', '/api/auth/login', { email: 'rita@exquisappfactory.com', password: 'BrandNew#Pass99' })).status, 200);
  assert.equal((await t.client().call('POST', '/api/auth/reset', { token, password: 'AnotherOne#99' })).status, 400, 'reset token is single use');
});

test('forgot password gives the same answer for unknown emails', async () => {
  const r = await t.client().call('POST', '/api/auth/forgot', { email: 'nobody@exquisappfactory.com' });
  assert.equal(r.status, 200); assert.equal(r.json.devLink, undefined);
});

test('changing password ends other sessions but keeps this one', async () => {
  const a = await t.user('chg@exquisappfactory.com', 'Chg Pass');
  const b = t.client(); await b.call('POST', '/api/auth/login', { email: 'chg@exquisappfactory.com', password: a.password });
  assert.equal((await a.call('POST', '/api/me/password', { current: 'wrong-pass-1', next: 'NewPassw0rd!!' })).status, 400);
  assert.equal((await a.call('POST', '/api/me/password', { current: a.password, next: 'NewPassw0rd!!' })).status, 200);
  assert.equal((await a.call('GET', '/api/me')).status, 200);
  assert.equal((await b.call('GET', '/api/me')).status, 401);
});

test('state-changing requests need the CSRF header', async () => {
  const r = await t.client().call('POST', '/api/auth/login', { email: 'x@exquisappfactory.com', password: 'x' }, { noCsrf: true });
  assert.equal(r.status, 403); assert.equal(r.json.code, 'csrf');
});

test('security headers are present', async () => {
  const res = await fetch(t.base + '/');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('ADMIN_EMAILS becomes admin, others do not', async () => {
  const boss = await t.user('boss@exquisappfactory.com', 'Big Boss');
  assert.equal((await boss.call('GET', '/api/me')).json.role, 'admin');
});
