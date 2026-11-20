const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');
const { canTransition } = require('../src/services/tickets');
const { registerChannel } = require('../src/services/notify');

let app, adam, sarah, eve, boss, adamId, sarahId;
before(async () => {
  app = await start();
  adam = await app.user('adam@exquisappfactory.com', 'Adam Lead');
  sarah = await app.user('sarah@exquisappfactory.com', 'Sarah Dev');
  eve = await app.user('eve@exquisappfactory.com', 'Eve Other');
  boss = await app.user('boss@exquisappfactory.com', 'Boss Admin');
  adamId = (await adam.call('GET', '/api/me')).json.id;
  sarahId = (await sarah.call('GET', '/api/me')).json.id;
});
after(() => app.close());

const make = async (creator, assigneeId, extra = {}) => (await creator.call('POST', '/api/tickets', { title: 'Set up staging', assigneeId, ...extra })).json;
const status = (c, id, s) => c.call('PATCH', `/api/tickets/${id}/status`, { status: s });
const notes = async (c) => (await c.call('GET', '/api/notifications')).json;

test('create validates input and records creator as assigner', async () => {
  assert.equal((await adam.call('POST', '/api/tickets', { title: 'x', assigneeId: sarahId })).status, 400);
  assert.equal((await adam.call('POST', '/api/tickets', { title: 'Fine title', assigneeId: 99999 })).status, 400);
  assert.equal((await adam.call('POST', '/api/tickets', { title: 'Fine title', assigneeId: sarahId, dueDate: 'soon' })).status, 400);
  assert.equal((await adam.call('POST', '/api/tickets', { title: 'Fine title', assigneeId: sarahId, priority: 'wow' })).status, 400);
  const t = await make(adam, sarahId, { priority: 'high', dueDate: '2030-01-31', description: 'Details\nline two' });
  assert.equal(t.assigner.id, adamId); assert.equal(t.assignee.id, sarahId);
  assert.equal(t.status, 'todo'); assert.match(t.ref, /^IRIS-\d+$/);
});

test('canTransition: unit rules', () => {
  const t = { status: 'todo', assigner_id: 1, assignee_id: 2 };
  assert.equal(canTransition(t, { id: 2 }, 'done').ok, false);
  assert.equal(canTransition(t, { id: 2 }, 'in_review').ok, true);
  assert.equal(canTransition(t, { id: 1 }, 'done').ok, true);
  assert.equal(canTransition(t, { id: 3 }, 'in_progress').ok, false);
  assert.equal(canTransition({ ...t, status: 'done' }, { id: 2 }, 'in_progress').ok, false);
  assert.equal(canTransition({ ...t, status: 'done' }, { id: 1 }, 'in_progress').ok, true);
  assert.equal(canTransition({ status: 'todo', assigner_id: 5, assignee_id: 5 }, { id: 5 }, 'done').ok, true);
  assert.equal(canTransition(t, { id: 1 }, 'bogus').ok, false);
});

test('assignee cannot set Done (403); cannot touch a Done ticket', async () => {
  const t = await make(adam, sarahId);
  assert.equal((await status(sarah, t.id, 'done')).status, 403);
  assert.equal((await status(adam, t.id, 'done')).status, 200);
  assert.equal((await status(sarah, t.id, 'in_progress')).status, 403);
});

test('self-created self-assigned ticket can be set Done, with no notifications', async () => {
  const t = await make(adam, adamId);
  const before = (await notes(adam)).notifications.length;
  assert.equal((await status(adam, t.id, 'done')).status, 200);
  assert.equal((await notes(adam)).notifications.length, before);
});

test('creator can send back and reopen', async () => {
  const t = await make(adam, sarahId);
  await status(sarah, t.id, 'in_review');
  assert.equal((await status(adam, t.id, 'in_progress')).status, 200);   // send back
  await status(sarah, t.id, 'in_review');
  await status(adam, t.id, 'done');
  assert.equal((await status(adam, t.id, 'todo')).status, 200);          // reopen
});

test('third user gets 404 on view/change/comment; admin can view but not change', async () => {
  const t = await make(adam, sarahId);
  for (const [m, u, b] of [['GET', ''], ['PATCH', '/status', { status: 'done' }], ['POST', '/comments', { body: 'hi' }], ['PATCH', '', { title: 'hack' }]])
    assert.equal((await eve.call(m, `/api/tickets/${t.id}${u}`, b)).status, 404, `${m}${u}`);
  assert.equal((await eve.call('GET', '/api/tickets')).json.tickets.some((x) => x.id === t.id), false);
  assert.equal((await boss.call('GET', `/api/tickets/${t.id}`)).status, 200);
  assert.equal((await status(boss, t.id, 'done')).status, 403);
  assert.equal((await boss.call('POST', `/api/tickets/${t.id}/comments`, { body: 'x' })).status, 403);
  assert.equal((await boss.call('GET', '/api/tickets?scope=all')).json.tickets.some((x) => x.id === t.id), true);
  assert.equal((await eve.call('GET', '/api/tickets?scope=all')).json.tickets.some((x) => x.id === t.id), false);
});

test('Adam and Sarah scenario with notifications', async () => {
  const t = await make(adam, sarahId, { title: 'Scenario ticket' });
  let n = (await notes(sarah)).notifications.filter((x) => x.ticketId === t.id);
  assert.equal(n.length, 1); assert.equal(n[0].kind, 'assigned');
  await status(sarah, t.id, 'in_progress');
  await status(sarah, t.id, 'in_review');
  n = (await notes(adam)).notifications.filter((x) => x.ticketId === t.id);
  assert.equal(n.filter((x) => x.kind === 'review').length, 1);              // review notifies the creator once
  assert.equal(n.length, 2);                                                  // in progress + review, nothing else
  assert.equal((await status(sarah, t.id, 'done')).status, 403);
  await status(adam, t.id, 'done');
  n = (await notes(sarah)).notifications.filter((x) => x.ticketId === t.id);
  assert.equal(n.filter((x) => x.kind === 'done').length, 1);
  const detail = (await sarah.call('GET', `/api/tickets/${t.id}`)).json;
  assert.deepEqual(detail.events.filter((e) => e.kind === 'status').map((e) => `${e.from}>${e.to}`), ['todo>in_progress', 'in_progress>in_review', 'in_review>done']);
  assert.deepEqual(detail.allowed, []);                                       // Sarah can do nothing on a Done ticket
});

test('every status change writes a history row; failed ones do not', async () => {
  const t = await make(adam, sarahId);
  await status(sarah, t.id, 'done');                                          // refused
  await status(sarah, t.id, 'in_progress');
  const ev = (await adam.call('GET', `/api/tickets/${t.id}`)).json.events;
  assert.equal(ev.length, 2);                                                 // created + one status change
});

test('comments notify the other party only and appear in order', async () => {
  const t = await make(adam, sarahId);
  const b = (await notes(adam)).unread;
  await sarah.call('POST', `/api/tickets/${t.id}/comments`, { body: 'Question about scope' });
  assert.equal((await notes(adam)).unread, b + 1);
  assert.equal((await adam.call('POST', `/api/tickets/${t.id}/comments`, { body: '   ' })).status, 400);
  await adam.call('POST', `/api/tickets/${t.id}/comments`, { body: '<b>Answer</b>' });
  const d = (await adam.call('GET', `/api/tickets/${t.id}`)).json;
  assert.deepEqual(d.comments.map((c) => c.body), ['Question about scope', '<b>Answer</b>']);
});

test('only the creator can edit; reassigning notifies the new assignee and logs history', async () => {
  const t = await make(adam, sarahId);
  assert.equal((await sarah.call('PATCH', `/api/tickets/${t.id}`, { title: 'Mine now' })).status, 403);
  const r = await adam.call('PATCH', `/api/tickets/${t.id}`, { title: 'Renamed', priority: 'urgent', assigneeId: (await eve.call('GET', '/api/me')).json.id });
  assert.equal(r.status, 200); assert.equal(r.json.title, 'Renamed');
  assert.equal((await notes(eve)).notifications.some((x) => x.ticketId === t.id && x.kind === 'assigned'), true);
  assert.equal((await eve.call('GET', `/api/tickets/${t.id}`)).status, 200);
  assert.equal((await sarah.call('GET', `/api/tickets/${t.id}`)).status, 404);   // no longer a party
});

test('notifications: mark read, only own rows', async () => {
  await make(adam, sarahId);
  const before = (await notes(sarah)).unread; assert.ok(before > 0);
  const first = (await notes(sarah)).notifications[0];
  await adam.call('POST', '/api/notifications/read', { ids: [first.id] });         // other user's call changes nothing
  assert.equal((await notes(sarah)).unread, before);
  await sarah.call('POST', '/api/notifications/read', { ids: [first.id] });
  assert.equal((await notes(sarah)).unread, before - 1);
  await sarah.call('POST', '/api/notifications/read', {});
  assert.equal((await notes(sarah)).unread, 0);
});

test('a failing extra channel never blocks the action', async () => {
  registerChannel(async () => { throw new Error('discord down'); });
  const t = await make(adam, sarahId);
  assert.ok(t.id);
  assert.equal((await status(sarah, t.id, 'in_review')).status, 200);
});

test('dashboard shows waiting-for-review and counts', async () => {
  const t = await make(adam, sarahId, { title: 'Dash ticket' });
  await status(sarah, t.id, 'in_review');
  const d = (await adam.call('GET', '/api/dashboard')).json;
  assert.ok(d.waitingForMyReview.some((x) => x.id === t.id));
  assert.ok(d.counts.review >= 1);
  assert.ok((await sarah.call('GET', '/api/dashboard')).json.assignedToMe.some((x) => x.id === t.id));
});

test('ticket routes need login and the CSRF header', async () => {
  const anon = app.client();
  assert.equal((await anon.call('GET', '/api/tickets')).status, 401);
  assert.equal((await adam.call('POST', '/api/tickets', { title: 'Nope nope', assigneeId: sarahId }, { noCsrf: true })).status, 403);
});
