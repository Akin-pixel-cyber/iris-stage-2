const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { clean } = require('../validate');
const T = require('../services/tickets');
const { notify } = require('../services/notify');

router.use(requireAuth);
const bad = (res, status, error, code) => res.status(status).json({ error, code });
const longText = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const validDate = (d) => d === null || d === '' || d === undefined ? null : (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : false);
const assigneeOk = (id) => Number.isInteger(id) && db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1 AND email_verified_at IS NOT NULL').get(id);

/** Load a ticket the user may see. Strangers get 404 (we do not reveal that it exists). */
function load(req, res) {
  const id = parseInt(req.params.id, 10);
  const t = Number.isInteger(id) ? T.get(id) : null;
  if (!t || !T.canView(t, req.user)) { bad(res, 404, 'Ticket not found', 'not_found'); return null; }
  return t;
}

/* ---- list: my tickets (as creator or assignee); admins can pass scope=all ---- */
router.get('/tickets', (req, res) => {
  const q = clean(req.query.q, 80);
  const where = []; const args = [];
  if (req.query.scope === 'all' && req.user.role === 'admin') { /* everything */ }
  else if (req.query.scope === 'assigned') { where.push('t.assignee_id = ?'); args.push(req.user.id); }
  else if (req.query.scope === 'created') { where.push('t.assigner_id = ?'); args.push(req.user.id); }
  else { where.push('(t.assignee_id = ? OR t.assigner_id = ?)'); args.push(req.user.id, req.user.id); }
  if (T.STATUSES.includes(req.query.status)) { where.push('t.status = ?'); args.push(req.query.status); }
  if (T.PRIORITIES.includes(req.query.priority)) { where.push('t.priority = ?'); args.push(req.query.priority); }
  if (q) { where.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')"); const l = `%${q.replace(/[\\%_]/g, '\\$&')}%`; args.push(l, l); }
  const rows = db.prepare(`${T.SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.updated_at DESC, t.id DESC LIMIT 500`).all(...args);
  res.json({ tickets: rows.map((r) => ({ ...T.present(r), allowed: T.allowedStatuses(r, req.user) })) });
});

/* ---- create ---- */
router.post('/tickets', (req, res) => {
  const b = req.body || {};
  const title = clean(b.title, 140);
  if (title.length < 3) return bad(res, 400, 'Give the ticket a short title (at least 3 characters)', 'bad_title');
  const assigneeId = Number.isInteger(b.assigneeId) ? b.assigneeId : parseInt(b.assigneeId, 10);
  if (!assigneeOk(assigneeId)) return bad(res, 400, 'Choose who this ticket is for', 'bad_assignee');
  const type = b.type === undefined ? 'general' : b.type;
  if (!T.TYPES.includes(type)) return bad(res, 400, 'Unknown ticket type', 'bad_type');
  const provider = type === 'access' ? (b.provider ?? '') : '';
  if (!T.PROVIDERS.includes(provider)) return bad(res, 400, 'Unknown tool', 'bad_provider');
  const priority = b.priority === undefined ? 'medium' : b.priority;
  if (!T.PRIORITIES.includes(priority)) return bad(res, 400, 'Unknown priority', 'bad_priority');
  const dueDate = validDate(b.dueDate);
  if (dueDate === false) return bad(res, 400, 'Enter the due date as a valid date', 'bad_date');
  const id = T.create(req.user, { title, description: longText(b.description, 5000), type, provider, priority, assigneeId, dueDate });
  res.status(201).json(T.presented(id));
});

/* ---- one ticket with comments and history ---- */
router.get('/tickets/:id', (req, res) => {
  const t = load(req, res); if (!t) return;
  const comments = db.prepare('SELECT c.id, c.body, c.created_at, u.id AS uid, u.name, u.avatar_file FROM ticket_comments c JOIN users u ON u.id = c.author_id WHERE c.ticket_id = ? ORDER BY c.id').all(t.id)
    .map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: { id: c.uid, name: c.name, avatarUrl: c.avatar_file ? `/api/avatars/${c.avatar_file}` : null } }));
  const events = db.prepare('SELECT e.id, e.kind, e.from_value, e.to_value, e.created_at, u.id AS uid, u.name, u.avatar_file FROM ticket_events e JOIN users u ON u.id = e.actor_id WHERE e.ticket_id = ? ORDER BY e.id').all(t.id)
    .map((e) => ({ id: e.id, kind: e.kind, from: e.from_value, to: e.to_value, createdAt: e.created_at, actor: { id: e.uid, name: e.name, avatarUrl: e.avatar_file ? `/api/avatars/${e.avatar_file}` : null } }));
  res.json({
    ticket: T.presented(t.id), comments, events,
    allowed: T.allowedStatuses(t, req.user),
    canEdit: t.assigner_id === req.user.id,
    canComment: T.isParty(t, req.user),
  });
});

/* ---- edit (creator only) ---- */
router.patch('/tickets/:id', (req, res) => {
  const t = load(req, res); if (!t) return;
  if (t.assigner_id !== req.user.id) return bad(res, 403, 'Only the person who created this ticket can edit it', 'forbidden');
  const b = req.body || {};
  const next = { ...t };
  if (b.title !== undefined) { next.title = clean(b.title, 140); if (next.title.length < 3) return bad(res, 400, 'Give the ticket a short title (at least 3 characters)', 'bad_title'); }
  if (b.description !== undefined) next.description = longText(b.description, 5000);
  if (b.priority !== undefined) { if (!T.PRIORITIES.includes(b.priority)) return bad(res, 400, 'Unknown priority', 'bad_priority'); next.priority = b.priority; }
  if (b.dueDate !== undefined) { const d = validDate(b.dueDate); if (d === false) return bad(res, 400, 'Enter the due date as a valid date', 'bad_date'); next.due_date = d; }
  let reassigned = false;
  if (b.assigneeId !== undefined && Number(b.assigneeId) !== t.assignee_id) {
    const id = Number(b.assigneeId);
    if (!assigneeOk(id)) return bad(res, 400, 'Choose who this ticket is for', 'bad_assignee');
    next.assignee_id = id; reassigned = true;
  }
  db.transaction(() => {
    db.prepare("UPDATE tickets SET title=?, description=?, priority=?, due_date=?, assignee_id=?, updated_at=datetime('now') WHERE id=?")
      .run(next.title, next.description, next.priority, next.due_date, next.assignee_id, t.id);
    if (next.title !== t.title || next.description !== t.description || next.priority !== t.priority || next.due_date !== t.due_date) T.addEvent(t.id, req.user.id, 'edited', null, null);
    if (reassigned) {
      const name = (id) => db.prepare('SELECT name FROM users WHERE id = ?').get(id).name;
      T.addEvent(t.id, req.user.id, 'reassigned', name(t.assignee_id), name(next.assignee_id));
    }
  })();
  if (reassigned) notify({ userId: next.assignee_id, actorId: req.user.id, kind: 'assigned', title: `${req.user.name} assigned you ${T.ref(t.id)}`, body: next.title, link: T.link(t), ticketId: t.id });
  res.json(T.presented(t.id));
});

/* ---- status (the only route that changes it) ---- */
router.patch('/tickets/:id/status', (req, res) => {
  const t = load(req, res); if (!t) return;
  const r = T.changeStatus(t, req.user, req.body && req.body.status);
  if (!r.ok) return bad(res, r.status, r.error, 'not_allowed');
  res.json({ ticket: T.presented(t.id), allowed: T.allowedStatuses(T.get(t.id), req.user) });
});

/* ---- comments ---- */
router.post('/tickets/:id/comments', (req, res) => {
  const t = load(req, res); if (!t) return;
  if (!T.isParty(t, req.user)) return bad(res, 403, 'Only the creator and the assignee can comment', 'forbidden');
  const body = longText(req.body && req.body.body, 2000);
  if (!body) return bad(res, 400, 'Write a comment first', 'empty');
  T.addComment(t, req.user, body);
  res.status(201).json({ ok: true });
});

/* ---- dashboard numbers ---- */
router.get('/dashboard', (req, res) => {
  const me = req.user.id;
  const list = (cond, args = [me], order = 't.due_date IS NULL, t.due_date, t.updated_at DESC') =>
    db.prepare(`${T.SELECT} WHERE ${cond} ORDER BY ${order} LIMIT 8`).all(...args).map((r) => ({ ...T.present(r), allowed: T.allowedStatuses(r, req.user) }));
  const count = (cond) => db.prepare(`SELECT COUNT(*) n FROM tickets t WHERE ${cond}`).get(me).n;
  res.json({
    waitingForMyReview: list("t.assigner_id = ? AND t.assignee_id != t.assigner_id AND t.status = 'in_review'", [me], 't.updated_at'),
    assignedToMe: list("t.assignee_id = ? AND t.status != 'done'"),
    createdByMe: list("t.assigner_id = ? AND t.status != 'done'"),
    counts: {
      assigned: count("t.assignee_id = ? AND t.status != 'done'"),
      created: count("t.assigner_id = ? AND t.status != 'done'"),
      review: count("t.assigner_id = ? AND t.assignee_id != t.assigner_id AND t.status = 'in_review'"),
      overdue: count("t.assignee_id = ? AND t.status != 'done' AND t.due_date < date('now')"),
    },
  });
});

module.exports = router;
