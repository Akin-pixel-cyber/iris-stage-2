// The ONE place that decides whether an email may sign up. Server-side only.
const cfg = require('../config');

function normalizeEmail(raw) { return String(raw || '').trim().toLowerCase(); }

function isWorkEmail(raw, domain = cfg.allowedDomain) {
  const email = normalizeEmail(raw);
  if (email.length > 254 || /\s/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;             // exactly one @
  const [local, host] = parts;
  if (!local || local.length > 64) return false;
  if (!/^[a-z0-9._%+'-]+$/.test(local)) return false;
  return host === domain;                            // exact match: blocks sub-domains and look-alikes
}
module.exports = { isWorkEmail, normalizeEmail };
