// Small input validators. All user text is trimmed and stripped of control characters.
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

const strongPassword = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);
const PASSWORD_RULE = 'Use at least 10 characters with a letter and a number';

function validName(n) { const v = clean(n, 60); return v.length >= 2 ? v : null; }
module.exports = { clean, strongPassword, PASSWORD_RULE, validName };
