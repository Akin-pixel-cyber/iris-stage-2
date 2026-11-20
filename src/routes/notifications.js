const router = require('express').Router();
const { db } = require('../db');
const { requireAuth } = require('../auth');

router.use(requireAuth);
const present = (n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, ticketId: n.ticket_id, read: !!n.read_at, createdAt: n.created_at });

router.get('/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n;
  res.json({ unread, notifications: rows.map(present) });
});
router.get('/notifications/unread-count', (req, res) =>
  res.json({ unread: db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n }));

/** Body { ids:[...] } marks those read; empty body marks all read. Only ever touches the caller's own rows. */
router.post('/notifications/read', (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter(Number.isInteger).slice(0, 100) : null;
  if (ids && ids.length) db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`).run(req.user.id, ...ids);
  else if (!ids) db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
  res.json({ ok: true });
});
module.exports = router;
