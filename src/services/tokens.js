// One-time tokens for email verification and password reset. Only a SHA-256 hash is stored.
const crypto = require('crypto');
const { db } = require('../db');

const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

function create(userId, type, ttlHours) {
  const raw = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  db.transaction(() => {
    db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = ? AND used_at IS NULL").run(now.toISOString(), userId, type);
    db.prepare('INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(userId, type, hash(raw), new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString());
  })();
  return raw;
}

/** Returns the user id if the token is valid, and burns it so it can't be reused. */
function consume(raw, type) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ?').get(hash(raw), type);
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) return null;
    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
    return row.user_id;
  })();
}

function lastCreatedAt(userId, type) {
  const r = db.prepare('SELECT created_at FROM auth_tokens WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1').get(userId, type);
  return r ? new Date(r.created_at.replace(' ', 'T') + 'Z') : null;
}
module.exports = { create, consume, lastCreatedAt };
