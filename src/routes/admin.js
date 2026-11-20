const router = require('express').Router();
const { db } = require('../db');
const { requireAuth, requireRole, profileOf } = require('../auth');

router.use(requireAuth, requireRole('admin'));

router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all();
  res.json(rows.map((u) => ({ ...profileOf(u, { withRole: true }), active: !!u.active, verified: !!u.email_verified_at, lastLoginAt: u.last_login_at })));
});

router.patch('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Person not found', code: 'not_found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role or status. Ask another admin.', code: 'self' });
  const { role, active } = req.body || {};
  if (role !== undefined && !['member', 'grantor', 'admin'].includes(role)) return res.status(400).json({ error: 'Unknown role', code: 'bad_role' });
  if (active !== undefined && typeof active !== 'boolean') return res.status(400).json({ error: 'Invalid status', code: 'bad_status' });
  const newRole = role ?? target.role;
  const newActive = active === undefined ? target.active : (active ? 1 : 0);
  // Changing role or deactivating ends that person's sessions straight away.
  const bump = newRole !== target.role || newActive !== target.active ? 1 : 0;
  db.prepare('UPDATE users SET role = ?, active = ?, session_epoch = session_epoch + ? WHERE id = ?').run(newRole, newActive, bump, id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ ...profileOf(u, { withRole: true }), active: !!u.active, verified: !!u.email_verified_at });
});

module.exports = router;
