// Usage: node scripts/make-admin.js you@exquisappfactory.com
// Makes an existing (already registered) user an admin.
const { db } = require('../src/db');
const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Usage: node scripts/make-admin.js <email>'); process.exit(1); }
const r = db.prepare("UPDATE users SET role = 'admin', session_epoch = session_epoch + 1 WHERE email = ?").run(email);
console.log(r.changes ? `${email} is now an admin.` : `No user found with email ${email}. They must register first.`);
