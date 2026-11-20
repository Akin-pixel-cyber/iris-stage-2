// Email sending. Modes: smtp (real), console (prints links in the log), memory (tests).
const cfg = require('../config');

const outbox = [];                       // used by tests
let transporter;

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function layout({ heading, intro, cta, url, outro }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5fa;font-family:Arial,Helvetica,sans-serif;color:#141628">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;padding:32px">
  <tr><td><div style="font-size:20px;font-weight:700;margin-bottom:20px">Iris</div>
  <div style="font-size:22px;font-weight:700;margin-bottom:12px">${esc(heading)}</div>
  <p style="font-size:15px;line-height:1.5;color:#3b415c">${esc(intro)}</p>
  <p style="margin:24px 0"><a href="${esc(url)}" style="background:#5a48e0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${esc(cta)}</a></p>
  <p style="font-size:13px;line-height:1.5;color:#626b85">Or paste this link into your browser:<br>${esc(url)}</p>
  <p style="font-size:13px;color:#626b85">${esc(outro)}</p></td></tr></table></td></tr></table></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${cta}: ${url}\n\n${outro}`;
  return { html, text };
}

async function send({ to, subject, html, text, link }) {
  const msg = { to, subject, html, text, link };
  if (cfg.mailMode === 'memory') { outbox.push(msg); return; }
  if (cfg.mailMode === 'console') { console.log(`[IRIS MAIL] To: ${to} | ${subject} | Link: ${link}`); return; }
  if (!transporter) {
    transporter = require('nodemailer').createTransport({
      host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465,
      auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
    });
  }
  await transporter.sendMail({ from: cfg.mailFrom, to, subject, html, text });
}

const first = (name) => String(name).split(' ')[0];

function sendVerification(user, token) {
  const link = `${cfg.appBaseUrl}/verify?token=${token}`;
  const { html, text } = layout({ heading: `Welcome to Iris, ${first(user.name)}`, intro: `Confirm that ${user.email} is yours to finish creating your account. The link works for ${cfg.verifyTokenHours} hours.`,
    cta: 'Verify my email', url: link, outro: 'If you did not sign up, you can ignore this email.' });
  return send({ to: user.email, subject: 'Verify your Iris account', html, text, link }).then(() => link);
}
function sendReset(user, token) {
  const link = `${cfg.appBaseUrl}/reset?token=${token}`;
  const { html, text } = layout({ heading: 'Reset your password', intro: `Use the button below to choose a new password for ${user.email}. The link works for ${cfg.resetTokenHours} hour.`,
    cta: 'Choose a new password', url: link, outro: 'If you did not ask for this, ignore this email. Your password stays the same.' });
  return send({ to: user.email, subject: 'Reset your Iris password', html, text, link }).then(() => link);
}
module.exports = { sendVerification, sendReset, outbox };
