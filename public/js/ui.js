// Shared UI helpers. User text is ALWAYS inserted with textContent / text nodes, never innerHTML.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- icons (static strings only) ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  tickets: '<path d="M3 9a2 2 0 0 0 0 6v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2a2 2 0 0 1 0-6V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M9 6v12"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
  access: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6c2.4.2 4.2 1.9 4.6 4.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  comment: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/>',
};
export function icon(name, cls = '') {
  const d = document.createElement('div');
  d.innerHTML = `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  return d.firstChild;
}

/* ---------- the Iris ring logo ---------- */
export function ring({ size = 32, draw = false, cls = '' } = {}) {
  const d = document.createElement('div');
  d.innerHTML = `<svg class="ring ${draw ? 'draw' : ''} ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle class="seg s1" cx="50" cy="50" r="40"/><circle class="seg s2" cx="50" cy="50" r="40"/><circle class="seg s3" cx="50" cy="50" r="40"/>
    <circle class="seg s4" cx="50" cy="50" r="40"/><circle class="seg s5" cx="50" cy="50" r="40"/>
    <circle class="pupil" cx="50" cy="50" r="17"/><circle class="glint" cx="44" cy="44" r="4"/></svg>`;
  return d.firstChild;
}
export const wordmark = (size = 30) => h('a', { class: 'wordmark', href: '/', 'data-link': true, 'aria-label': 'Iris home' }, ring({ size }), 'Iris');

/* ---------- avatar ---------- */
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const colorOf = (key) => { let n = 0; for (const ch of String(key)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n % 8; };
export function avatar(user, size = 'md') {
  const el = h('span', { class: `av ${size} c${colorOf(user.id ?? user.email ?? user.name)}`, role: 'img', 'aria-label': user.name });
  if (user.avatarUrl) {
    const img = h('img', { src: user.avatarUrl, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => { img.remove(); el.textContent = initials(user.name); });
    el.append(img);
  } else el.textContent = initials(user.name);
  return el;
}

/* ---------- toasts and busy buttons ---------- */
export function toast(message, kind = 'ok') {
  const t = h('div', { class: `toast ${kind === 'err' ? 'err' : ''}` }, icon(kind === 'err' ? 'alert' : 'check'), message);
  const box = document.getElementById('toasts');
  box.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 5000 : 3000);
}
export async function busy(btn, fn) {
  btn.classList.add('busy'); btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('busy'); btn.disabled = false; }
}

/* ---------- API ---------- */
export async function api(method, url, body, opts = {}) {
  const headers = { 'X-Requested-With': 'iris' };
  let payload;
  if (opts.raw) { payload = body; headers['Content-Type'] = opts.type; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin' }); }
  catch { throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { code: 'network' }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status, code: data.code });
  return data;
}

/* ---------- forms ---------- */
export function field({ label, name, type = 'text', autocomplete, placeholder, hint = '', required = true, value = '', maxlength, readonly, multiline }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  const msg = h('div', { class: 'field-msg', id: `${id}-m`, 'aria-live': 'polite' }, hint);
  const common = { id, name, autocomplete, placeholder, required, maxlength, readonly, 'aria-describedby': `${id}-m` };
  const input = multiline ? h('textarea', { ...common, rows: 4 }, value) : h('input', { ...common, type, value, spellcheck: type === 'text' ? undefined : 'false' });
  let control = input;
  if (type === 'password') {
    const toggle = h('button', { class: 'pw-toggle', type: 'button', 'aria-label': 'Show password' }, icon('eye'));
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      toggle.replaceChildren(icon(show ? 'eyeoff' : 'eye'));
    });
    control = h('div', { class: 'pw' }, input, toggle);
  }
  const el = h('div', { class: 'field' }, h('label', { for: id }, label), control, msg);
  return {
    el, input,
    setError(m) { el.classList.toggle('has-error', Boolean(m)); msg.textContent = m || hint; input.setAttribute('aria-invalid', m ? 'true' : 'false'); },
    get value() { return input.value; },
  };
}

export function strength(pw) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 14) s++;
  if (pw.length < 10) s = Math.min(s, 1);
  return pw ? Math.max(1, s) : 0;
}
export function meter(input) {
  const label = h('span', {}, 'Use at least 10 characters with a letter and a number');
  const el = h('div', { class: 'meter', 'aria-live': 'polite' }, h('span', { class: 'bars' }, h('i'), h('i'), h('i'), h('i')), label);
  const words = ['', 'Too weak', 'Okay', 'Good', 'Strong'];
  input.addEventListener('input', () => {
    const s = strength(input.value);
    el.className = `meter s${s}`;
    label.textContent = s ? words[s] : 'Use at least 10 characters with a letter and a number';
  });
  return el;
}

/* ---------- modal ---------- */
export function confirmModal({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const close = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); resolve(v); };
    const ok = h('button', { class: `btn ${danger ? 'danger' : ''}`, type: 'button', onclick: () => close(true) }, confirmLabel);
    const cancel = h('button', { class: 'btn secondary', type: 'button', onclick: () => close(false) }, 'Cancel');
    const overlay = h('div', { class: 'overlay', onclick: (e) => e.target === overlay && close(false) },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'm-title' }, h('h2', { id: 'm-title' }, title), h('p', {}, body), h('div', { class: 'row' }, cancel, ok)));
    const onKey = (e) => { if (e.key === 'Escape') close(false); if (e.key === 'Tab') { const f = [cancel, ok]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus(); } };
    document.addEventListener('keydown', onKey);
    document.body.append(overlay); cancel.focus();
  });
}

/* ---------- misc ---------- */
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const setTitle = (t) => { document.title = t ? `${t} · Iris` : 'Iris'; };
export const firstName = (n) => String(n || '').split(' ')[0];
export function fmtMonth(s) { const d = new Date(String(s).replace(' ', 'T') + 'Z'); return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
export function fmtAgo(s) {
  if (!s) return 'Never';
  const d = new Date(String(s).replace(' ', 'T') + 'Z'); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Just now'; if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`; return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function emptyState({ iconName = 'search', title, text, action }) {
  return h('div', { class: 'empty' }, h('div', { class: 'state-icon' }, icon(iconName)), h('h3', {}, title), h('p', {}, text), action || null);
}
export const skeletonCard = () => h('div', { class: 'person' }, h('div', { class: 'sk circle s64' }), h('div', { class: 'sk line w60' }), h('div', { class: 'sk line w80' }));

/* ---------- dates ---------- */
export const parseTs = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
export function fmtDay(d) { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
export function fmtWhen(s) { return parseTs(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
