// All configuration comes from environment variables (see .env.example).
const crypto = require('crypto');
const env = process.env;

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

function fatal(msg) { console.error(`FATAL: ${msg}`); process.exit(1); }

function secret(name) {
  const v = env[name];
  if (v && !v.startsWith('change-me')) return v;
  if (isProd) fatal(`${name} is missing. Generate one with: openssl rand -hex 32 (see STEPS.md)`);
  return crypto.randomBytes(32).toString('hex'); // dev/test only: resets on every restart
}

const smtpConfigured = Boolean(env.SMTP_HOST);
let mailMode = env.MAIL_MODE || (smtpConfigured ? 'smtp' : 'console');
if (isTest) mailMode = 'memory';
if (isProd && mailMode === 'console' && env.MAIL_MODE !== 'console') {
  fatal('Email is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM, or set MAIL_MODE=console to print links in the logs while testing.');
}
if (mailMode === 'smtp' && !smtpConfigured) fatal('MAIL_MODE=smtp needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.');

const port = parseInt(env.PORT || '3000', 10);

module.exports = {
  nodeEnv, isProd, isTest, port,
  trustProxy: parseInt(env.TRUST_PROXY || '0', 10),   // set to 1 only when running behind Caddy/Nginx
  appBaseUrl: (env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  jwtSecret: secret('JWT_SECRET'),
  allowedDomain: (env.ALLOWED_EMAIL_DOMAIN || 'exquisappfactory.com').trim().toLowerCase().replace(/^@/, ''),
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  cookieSecure: env.COOKIE_SECURE === 'true',
  dbPath: env.DB_PATH || './data/iris.db',
  uploadDir: env.UPLOAD_DIR || './data/uploads',
  mailMode,
  mailFrom: env.MAIL_FROM || 'Iris <no-reply@exquisappfactory.com>',
  smtp: { host: env.SMTP_HOST, port: parseInt(env.SMTP_PORT || '587', 10), user: env.SMTP_USER, pass: env.SMTP_PASS },
  sessionHours: 8,
  verifyTokenHours: 24,
  resetTokenHours: 1,
  maxAvatarBytes: 2 * 1024 * 1024,
};
