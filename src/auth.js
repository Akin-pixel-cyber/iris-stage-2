const jwt = require('jsonwebtoken');
const cfg = require('./config');
const { db } = require('./db');

const COOKIE = 'iris_session';

function issue(res, user) {
  const token = jwt.sign({ uid: user.id, ep: user.session_epoch }, cfg.jwtSecret, { expiresIn: `${cfg.sessionHours}h` });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: cfg.cookieSecure, maxAge: cfg.sessionHours * 3600 * 1000 });
}

/** Loads the signed-in user from the cookie. Checks on EVERY request that the account is still active, verified, and the session wasn't revoked. */
function userFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    const { uid, ep } = jwt.verify(token, cfg.jwtSecret);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    if (!u || !u.active || !u.email_verified_at || u.session_epoch !== ep) return null;
    return u;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const u = userFromRequest(req);
  if (!u) return res.status(401).json({ error: 'Please log in', code: 'auth_required' });
  req.user = u; next();
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do that', code: 'forbidden' });

/** CSRF defence: cookies are SameSite=Strict, and every state-changing request must carry a custom header that cross-site forms cannot send. */
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'iris') return res.status(403).json({ error: 'Blocked request', code: 'csrf' });
  next();
}

const avatarUrl = (u) => (u.avatar_file ? `/api/avatars/${u.avatar_file}` : null);
function profileOf(u, { withRole = false } = {}) {
  const p = { id: u.id, name: u.name, email: u.email, title: u.title, team: u.team, bio: u.bio, avatarUrl: avatarUrl(u), memberSince: u.created_at };
  if (withRole) p.role = u.role;
  return p;
}
module.exports = { COOKIE, issue, userFromRequest, requireAuth, requireRole, csrfGuard, profileOf };
