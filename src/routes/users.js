const router = require('express').Router();
const bcrypt = require('bcryptjs');
const express = require('express');
const path = require('path');
const cfg = require('../config');
const { db } = require('../db');
const { requireAuth, issue, profileOf } = require('../auth');
const avatars = require('../services/avatars');
const { clean, strongPassword, PASSWORD_RULE, validName } = require('../validate');

router.use(requireAuth);
const bad = (res, status, error, code) => res.status(status).json({ error, code });

/* ---- me ---- */
router.get('/me', (req, res) => res.json(profileOf(req.user, { withRole: true })));

router.patch('/me', (req, res) => {
  const b = req.body || {};
  const name = b.name === undefined ? req.user.name : validName(b.name);
  if (!name) return bad(res, 400, 'Enter your full name', 'bad_name');
  const title = b.title === undefined ? req.user.title : clean(b.title, 80);
  const team = b.team === undefined ? req.user.team : clean(b.team, 80);
  const bio = b.bio === undefined ? req.user.bio : String(b.bio).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 500);
  db.prepare('UPDATE users SET name = ?, title = ?, team = ?, bio = ? WHERE id = ?').run(name, title, team, bio, req.user.id);
  res.json(profileOf(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id), { withRole: true }));
});

router.put('/me/avatar', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: cfg.maxAvatarBytes }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return bad(res, 400, 'Choose a PNG, JPG or WebP image', 'bad_image');
  const file = avatars.save(req.body);
  if (!file) return bad(res, 400, 'That file is not a valid PNG, JPG or WebP image', 'bad_image');
  avatars.remove(req.user.avatar_file);
  db.prepare('UPDATE users SET avatar_file = ? WHERE id = ?').run(file, req.user.id);
  res.json({ avatarUrl: `/api/avatars/${file}` });
});

router.delete('/me/avatar', (req, res) => {
  avatars.remove(req.user.avatar_file);
  db.prepare('UPDATE users SET avatar_file = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/me/password', async (req, res) => {
  const { current, next } = req.body || {};
  if (!(await bcrypt.compare(String(current ?? ''), req.user.password_hash))) return bad(res, 400, 'Your current password is wrong', 'bad_current');
  if (!strongPassword(next)) return bad(res, 400, PASSWORD_RULE, 'weak_password');
  if (next === current) return bad(res, 400, 'Choose a password you have not used just now', 'same_password');
  db.prepare('UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1 WHERE id = ?').run(await bcrypt.hash(next, 11), req.user.id);
  issue(res, db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));   // keep THIS browser signed in; every other session ends
  res.json({ ok: true });
});

/* ---- people directory (only active, verified accounts) ---- */
router.get('/users', (req, res) => {
  const q = clean(req.query.q, 60);
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const rows = q
    ? db.prepare("SELECT * FROM users WHERE active = 1 AND email_verified_at IS NOT NULL AND (name LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR team LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\') ORDER BY name COLLATE NOCASE LIMIT ?").all(like, like, like, like, limit)
    : db.prepare('SELECT * FROM users WHERE active = 1 AND email_verified_at IS NOT NULL ORDER BY name COLLATE NOCASE LIMIT ?').all(limit);
  const withRole = req.user.role === 'admin';
  res.json(rows.map((u) => profileOf(u, { withRole })));
});

router.get('/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1 AND email_verified_at IS NOT NULL').get(parseInt(req.params.id, 10) || 0);
  if (!u) return bad(res, 404, 'Person not found', 'not_found');
  res.json(profileOf(u, { withRole: req.user.role === 'admin' }));
});

/* ---- avatar files (signed-in users only) ---- */
router.get('/avatars/:file', (req, res) => {
  if (!avatars.VALID.test(req.params.file)) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400, immutable');
  res.sendFile(req.params.file, { root: avatars.dir }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

module.exports = router;
