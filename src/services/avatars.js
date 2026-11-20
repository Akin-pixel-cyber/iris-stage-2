// Profile pictures: validate the file signature (never trust the browser's content type), random file names, stored outside public/.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');

const dir = path.resolve(cfg.uploadDir, 'avatars');
fs.mkdirSync(dir, { recursive: true });

function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
function save(buf) {
  const ext = sniff(buf);
  if (!ext) return null;
  const file = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf, { mode: 0o640 });
  return file;
}
function remove(file) { if (file && /^[a-f0-9]{32}\.(png|jpg|webp)$/.test(file)) fs.rm(path.join(dir, file), { force: true }, () => {}); }
const VALID = /^[a-f0-9]{32}\.(png|jpg|webp)$/;
module.exports = { dir, save, remove, VALID, sniff };
