// All ticket rules live here. Status changes happen ONLY through changeStatus(), which asks canTransition().
const { db } = require('../db');
const { notify } = require('./notify');

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TYPES = ['general', 'access'];
const PROVIDERS = ['', 'github', 'aws', 'other'];
const LABEL = { todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done' };
const ref = (id) => `IRIS-${id}`;

const ok = { ok: true };
const deny = (error, status = 403) => ({ ok: false, error, status });

/** The single source of truth for "may this person move this ticket to this status?" */
function canTransition(ticket, actor, newStatus) {
  if (!STATUSES.includes(newStatus)) return deny('Unknown status', 400);
  if (newStatus === ticket.status) return deny('The ticket is already in that status', 400);
  const isAssigner = actor.id === ticket.assigner_id;
  const isAssignee = actor.id === ticket.assignee_id;
  if (!isAssigner && !isAssignee) return deny('Only the creator or the assignee can change the status');
  if (isAssigner) return ok;                                   // the creator may set any status (send back, reopen, Done)
  if (newStatus === 'done') return deny('Only the person who created this ticket can mark it Done');
  if (ticket.status === 'done') return deny('This ticket is Done. Ask the creator to reopen it');
  return ok;
}

/** Statuses the actor may move this ticket to right now (the UI uses this to show only valid choices). */
const allowedStatuses = (ticket, actor) => STATUSES.filter((s) => canTransition(ticket, actor, s).ok);

const canView = (ticket, user) => !!ticket && (user.role === 'admin' || ticket.assigner_id === user.id || ticket.assignee_id === user.id);
const isParty = (ticket, user) => ticket.assigner_id === user.id || ticket.assignee_id === user.id;
const get = (id) => db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

const SELECT = `SELECT t.*, ar.name AS assigner_name, ar.avatar_file AS assigner_avatar, ar.email AS assigner_email,
  ae.name AS assignee_name, ae.avatar_file AS assignee_avatar, ae.email AS assignee_email,
  (SELECT COUNT(*) FROM ticket_comments c WHERE c.ticket_id = t.id) AS comment_count
  FROM tickets t JOIN users ar ON ar.id = t.assigner_id JOIN users ae ON ae.id = t.assignee_id`;

const av = (f) => (f ? `/api/avatars/${f}` : null);
function present(t) {
  return {
    id: t.id, ref: ref(t.id), title: t.title, description: t.description, type: t.type, provider: t.provider,
    priority: t.priority, status: t.status, dueDate: t.due_date, createdAt: t.created_at, updatedAt: t.updated_at, doneAt: t.done_at,
    commentCount: t.comment_count ?? 0,
    assigner: { id: t.assigner_id, name: t.assigner_name, avatarUrl: av(t.assigner_avatar) },
    assignee: { id: t.assignee_id, name: t.assignee_name, avatarUrl: av(t.assignee_avatar) },
  };
}
const presented = (id) => present(db.prepare(`${SELECT} WHERE t.id = ?`).get(id));

function addEvent(ticketId, actorId, kind, from, to) {
  db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, kind, from_value, to_value) VALUES (?,?,?,?,?)').run(ticketId, actorId, kind, from ?? null, to ?? null);
}
const other = (t, actor) => (actor.id === t.assigner_id ? t.assignee_id : t.assigner_id);
const link = (t) => `/tickets/${t.id}`;

function create(actor, f) {
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO tickets (title, description, type, provider, priority, assigner_id, assignee_id, due_date) VALUES (?,?,?,?,?,?,?,?)')
      .run(f.title, f.description, f.type, f.provider, f.priority, actor.id, f.assigneeId, f.dueDate);
    addEvent(r.lastInsertRowid, actor.id, 'created', null, 'todo');
    return r.lastInsertRowid;
  })();
  const t = get(id);
  notify({ userId: t.assignee_id, actorId: actor.id, kind: 'assigned', title: `${actor.name} assigned you ${ref(id)}`, body: t.title, link: link(t), ticketId: id });
  return id;
}

/** The only function that changes a status. Returns { ok } or { ok:false, error, status }. */
function changeStatus(ticket, actor, newStatus) {
  const verdict = canTransition(ticket, actor, newStatus);
  if (!verdict.ok) return verdict;
  db.transaction(() => {
    db.prepare("UPDATE tickets SET status = ?, updated_at = datetime('now'), done_at = ? WHERE id = ?")
      .run(newStatus, newStatus === 'done' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null, ticket.id);
    addEvent(ticket.id, actor.id, 'status', ticket.status, newStatus);
  })();
  const to = other(ticket, actor);
  const kind = newStatus === 'in_review' ? 'review' : newStatus === 'done' ? 'done' : 'status';
  const title = newStatus === 'in_review' ? `${actor.name} sent ${ref(ticket.id)} for your review`
    : newStatus === 'done' ? `${actor.name} marked ${ref(ticket.id)} as Done`
    : ticket.status === 'done' ? `${actor.name} reopened ${ref(ticket.id)}`
    : `${actor.name} moved ${ref(ticket.id)} to ${LABEL[newStatus]}`;
  notify({ userId: to, actorId: actor.id, kind, title, body: ticket.title, link: link(ticket), ticketId: ticket.id });
  return ok;
}

function addComment(ticket, actor, body) {
  const r = db.prepare('INSERT INTO ticket_comments (ticket_id, author_id, body) VALUES (?,?,?)').run(ticket.id, actor.id, body);
  db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticket.id);
  notify({ userId: other(ticket, actor), actorId: actor.id, kind: 'comment', title: `${actor.name} commented on ${ref(ticket.id)}`, body: body.slice(0, 140), link: link(ticket), ticketId: ticket.id });
  return r.lastInsertRowid;
}

module.exports = { STATUSES, PRIORITIES, TYPES, PROVIDERS, LABEL, ref, canTransition, allowedStatuses, canView, isParty, get, SELECT, present, presented, addEvent, create, changeStatus, addComment, link };
