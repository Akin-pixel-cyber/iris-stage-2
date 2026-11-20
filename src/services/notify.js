// The ONE way to tell a user something. Writes the in-app record, then offers it to any extra channels (Discord in Stage 4).
// A failing channel is logged and ignored: it must never block the action that caused the notification.
const { db } = require('../db');

const channels = [];
/** Stage 4 registers Discord here: registerChannel(async (notification, user) => {...}) */
function registerChannel(fn) { channels.push(fn); }

function notify({ userId, actorId = null, kind, title, body = '', link = '', ticketId = null }) {
  if (!userId || userId === actorId) return null;            // never notify yourself
  const info = db.prepare('INSERT INTO notifications (user_id, actor_id, kind, title, body, link, ticket_id) VALUES (?,?,?,?,?,?,?)')
    .run(userId, actorId, kind, title, body, link, ticketId);
  const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  for (const ch of channels) {
    Promise.resolve().then(() => ch(n, user)).catch((e) => console.error('notification channel failed:', e.message));
  }
  return n;
}
module.exports = { notify, registerChannel };
