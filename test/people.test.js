const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./helpers');

let t, admin, member, other;
test.before(async () => {
  t = await start();
  admin = await t.user('boss@exquisappfactory.com', 'Big Boss');
  member = await t.user('mem@exquisappfactory.com', 'Mem Ber');
  other = await t.user('oth@exquisappfactory.com', 'Oth Er');
});
test.after(() => t.close());

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('profile updates are saved and cleaned', async () => {
  const r = await member.call('PATCH', '/api/me', { name: '  Mem   Ber ', title: 'Engineer', team: 'Platform', bio: 'Hello\u0000 there' });
  assert.equal(r.status, 200);
  assert.equal(r.json.name, 'Mem Ber'); assert.equal(r.json.bio, 'Hello there');
  assert.equal((await member.call('PATCH', '/api/me', { name: 'x' })).status, 400);
});

test('people directory lists only verified active people and supports search', async () => {
  const unverified = t.client();
  await unverified.call('POST', '/api/auth/register', { name: 'Not Yet', email: 'notyet@exquisappfactory.com', password: 'Passw0rd123!' });
  const list = (await member.call('GET', '/api/users')).json;
  assert.ok(list.find((u) => u.email === 'oth@exquisappfactory.com'));
  assert.ok(!list.find((u) => u.email === 'notyet@exquisappfactory.com'));
  const found = (await member.call('GET', '/api/users?q=platform')).json;
  assert.equal(found.length, 1); assert.equal(found[0].name, 'Mem Ber');
  assert.equal((await member.call('GET', '/api/users?q=%25')).json.length, 0, 'wildcards are escaped');
  assert.equal((await t.client().call('GET', '/api/users')).status, 401);
});

test('roles are hidden from members, visible to admins', async () => {
  assert.equal((await member.call('GET', '/api/users')).json[0].role, undefined);
  assert.ok((await admin.call('GET', '/api/users')).json[0].role);
});

test('avatar upload validates the file and serves it only to signed-in users', async () => {
  assert.equal((await member.call('PUT', '/api/me/avatar', Buffer.from('not an image at all, just text'), { raw: true })).status, 400);
  assert.equal((await member.call('PUT', '/api/me/avatar', Buffer.alloc(3 * 1024 * 1024, 1), { raw: true })).status, 413);
  assert.equal((await member.call('PUT', '/api/me/avatar', PNG, { raw: true, type: 'text/html' })).status, 400);
  const up = await member.call('PUT', '/api/me/avatar', PNG, { raw: true });
  assert.equal(up.status, 200);
  assert.match(up.json.avatarUrl, /^\/api\/avatars\/[a-f0-9]{32}\.png$/);
  const seen = await other.call('GET', up.json.avatarUrl);
  assert.equal(seen.status, 200);
  assert.equal((await t.client().call('GET', up.json.avatarUrl)).status, 401);
  assert.equal((await other.call('GET', '/api/avatars/..%2f..%2fetc%2fpasswd')).status, 404);
  assert.equal((await member.call('DELETE', '/api/me/avatar')).status, 200);
});

test('members cannot use admin routes', async () => {
  assert.equal((await member.call('GET', '/api/admin/users')).status, 403);
  assert.equal((await member.call('PATCH', '/api/admin/users/1', { role: 'admin' })).status, 403);
});

test('admin can change roles and deactivate; deactivated users are locked out at once', async () => {
  const id = (await admin.call('GET', '/api/admin/users')).json.find((u) => u.email === 'oth@exquisappfactory.com').id;
  assert.equal((await admin.call('PATCH', `/api/admin/users/${id}`, { role: 'grantor' })).json.role, 'grantor');
  assert.equal((await other.call('GET', '/api/me')).status, 401, 'role change ends that session');
  const c = t.client(); await c.call('POST', '/api/auth/login', { email: 'oth@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal((await c.call('GET', '/api/me')).json.role, 'grantor');
  assert.equal((await admin.call('PATCH', `/api/admin/users/${id}`, { active: false })).status, 200);
  assert.equal((await c.call('GET', '/api/me')).status, 401);
  const l = await t.client().call('POST', '/api/auth/login', { email: 'oth@exquisappfactory.com', password: 'Passw0rd123!' });
  assert.equal(l.json.code, 'deactivated');
  assert.ok(!(await member.call('GET', '/api/users')).json.find((u) => u.id === id), 'hidden from directory');
  assert.equal((await admin.call('PATCH', `/api/admin/users/${id}`, { role: 'superuser' })).status, 400);
});

test('admin cannot change their own role or status', async () => {
  const me = (await admin.call('GET', '/api/me')).json;
  assert.equal((await admin.call('PATCH', `/api/admin/users/${me.id}`, { role: 'member' })).status, 400);
});
