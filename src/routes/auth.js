const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const cfg = require('../config');
const { db } = require('../db');
const { issue, profileOf } = require('../auth');
const { isWorkEmail, normalizeEmail } = require('../services/emailDomain');
const tokens = require('../services/tokens');
const mail = require('../services/mail');
const { strongPassword, PASSWORD_RULE, validName } = require('../validate');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
  skip: () => cfg.isTest, message: { error: 'Too many attempts. Try again in 15 minutes.', code: 'rate_limited' } });
router.use(limiter);

const bad = (res, status, error, code) => res.status(status).json({ error, code });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);
const devLink = (link) => (cfg.isProd ? {} : { devLink: link });

// Slow down password guessing per account (in memory; resets on restart, which is fine for one instance).
const failures = new Map();
function locked(email) { const f = failures.get(email); return f && f.count >= 8 && Date.now() - f.first < 15 * 60 * 1000; }
function recordFail(email) {
  const f = failures.get(email);
  if (!f || Date.now() - f.first > 15 * 60 * 1000) failures.set(email, { count: 1, first: Date.now() }); else f.count++;
}

router.post('/register', async (req, res) => {
  const name = validName(req.body?.name);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!name) return bad(res, 400, 'Enter your full name', 'bad_name');
  if (!isWorkEmail(email)) return bad(res, 400, `Use your work email ending in @${cfg.allowedDomain}`, 'bad_domain');
  if (!strongPassword(password)) return bad(res, 400, PASSWORD_RULE, 'weak_password');

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    if (existing.email_verified_at) return bad(res, 409, 'An account with this email already exists. Log in or reset your password.', 'exists');
    // Unverified: send a fresh link instead of creating a duplicate.
    const last = tokens.lastCreatedAt(existing.id, 'verify');
    if (last && Date.now() - last.getTime() < 60 * 1000) return bad(res, 429, 'We just sent a link. Check your inbox, or wait a minute to ask again.', 'cooldown');
    const link = await mail.sendVerification(existing, tokens.create(existing.id, 'verify', cfg.verifyTokenHours));
    return res.json({ ok: true, email, ...devLink(link) });
  }
  const hash = await bcrypt.hash(password, 11);
  const role = cfg.adminEmails.includes(email) ? 'admin' : 'member';
  const { lastInsertRowid } = db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, name, hash, role);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  const link = await mail.sendVerification(user, tokens.create(user.id, 'verify', cfg.verifyTokenHours));
  res.json({ ok: true, email, ...devLink(link) });
});

router.post('/resend', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user && !user.email_verified_at && user.active) {
    const last = tokens.lastCreatedAt(user.id, 'verify');
    if (last && Date.now() - last.getTime() < 60 * 1000) return bad(res, 429, 'Please wait a minute before asking again.', 'cooldown');
    const link = await mail.sendVerification(user, tokens.create(user.id, 'verify', cfg.verifyTokenHours));
    return res.json({ ok: true, ...devLink(link) });
  }
  res.json({ ok: true });   // same answer whether or not the account exists
});

router.post('/verify', (req, res) => {
  const uid = tokens.consume(req.body?.token, 'verify');
  if (!uid) return bad(res, 400, 'This link is invalid or has expired. Request a new one.', 'bad_token');
  db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?").run(uid);
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  if (locked(email)) return bad(res, 429, 'Too many wrong passwords. Try again in 15 minutes or reset your password.', 'locked');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);   // same work either way
  if (!user || !ok) { recordFail(email); return bad(res, 401, 'Wrong email or password', 'bad_credentials'); }
  if (!user.email_verified_at) return bad(res, 403, 'Verify your email first. Check your inbox for the link.', 'unverified');
  if (!user.active) return bad(res, 403, 'This account has been deactivated. Ask an admin for help.', 'deactivated');
  failures.delete(email);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  issue(res, user);
  res.json({ ok: true, user: profileOf(user, { withRole: true }) });
});

router.post('/logout', (req, res) => { res.clearCookie('iris_session'); res.json({ ok: true }); });

router.post('/forgot', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  let extra = {};
  if (user && user.email_verified_at && user.active) {
    const last = tokens.lastCreatedAt(user.id, 'reset');
    if (!last || Date.now() - last.getTime() > 30 * 1000) {
      extra = devLink(await mail.sendReset(user, tokens.create(user.id, 'reset', cfg.resetTokenHours)));
    }
  }
  res.json({ ok: true, ...extra });   // identical answer whether or not the account exists
});

router.post('/reset', async (req, res) => {
  if (!strongPassword(req.body?.password)) return bad(res, 400, PASSWORD_RULE, 'weak_password');
  const uid = tokens.consume(req.body?.token, 'reset');
  if (!uid) return bad(res, 400, 'This link is invalid or has expired. Request a new one.', 'bad_token');
  const hash = await bcrypt.hash(req.body.password, 11);
  // Raising session_epoch signs the user out everywhere. Holding the emailed link also proves the mailbox, so mark verified.
  db.prepare("UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1, email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?").run(hash, uid);
  res.json({ ok: true });
});

module.exports = router;
