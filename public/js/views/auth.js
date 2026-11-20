import { h, icon, ring, field, meter, api, busy, wordmark } from '../ui.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

/* Two-column shell: brand panel on the left (hidden on phones), form on the right. */
function shell(...content) {
  const hero = h('section', { class: 'auth-hero', 'aria-hidden': 'false' },
    h('a', { class: 'wordmark', href: '/login', 'data-link': true }, ring({ size: 34 }), 'Iris'),
    h('div', { class: 'copy' },
      h('h1', {}, 'Access, tickets and teamwork in one place.'),
      h('p', {}, 'Ask for access, follow the request until it is done, and hear about every step wherever you are.'),
      h('div', { class: 'flow', 'aria-label': 'A request moves from To Do, to In Review, to Done' },
        h('span', { class: 'step todo' }, 'To Do'), h('span', { class: 'arrow' }), h('span', { class: 'step review' }, 'In Review'), h('span', { class: 'arrow' }), h('span', { class: 'step done' }, 'Done'))),
    h('div', { class: 'foot' }, 'Exquis App Factory internal tool'),
    ring({ size: 560, draw: true, cls: 'big-ring' }));
  const card = h('div', { class: 'auth-card' }, h('div', { class: 'mobile-brand' }, wordmark(34)), ...content);
  return h('div', { class: 'auth' }, hero, h('main', { id: 'main', class: 'auth-main' }, card));
}

function devLinkBox(link) {
  if (!link || !state.config.devMail) return null;
  const u = new URL(link);
  return h('div', { class: 'devbox' }, 'Development mode: no email is sent. Use this link instead.',
    h('br'), h('a', { href: u.pathname + u.search, 'data-link': true }, u.pathname + u.search));
}
const alertBox = (kind, text) => h('div', { class: `alert ${kind}`, role: 'alert' }, icon(kind === 'danger' ? 'alert' : 'info'), h('div', {}, text));

/* ---------- login ---------- */
export function loginView({ query }) {
  const email = field({ label: 'Work email', name: 'email', type: 'email', autocomplete: 'username', placeholder: `you@${state.config.allowedDomain}` });
  const password = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' });
  const slot = h('div');
  const submit = h('button', { class: 'btn block', type: 'submit' }, 'Log in');

  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); slot.replaceChildren(); email.setError(''); password.setError('');
    if (!email.value.trim()) return email.setError('Enter your work email');
    if (!password.value) return password.setError('Enter your password');
    await busy(submit, async () => {
      try {
        const r = await api('POST', '/auth/login', { email: email.value, password: password.value });
        state.user = r.user;
        const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/';
        navigate(next, { replace: true });
      } catch (err) {
        if (err.code === 'unverified') {
          const resend = h('button', { class: 'btn-link', type: 'button', onclick: async () => {
            try { const r = await api('POST', '/auth/resend', { email: email.value }); slot.replaceChildren(alertBox('ok', 'A new link is on its way. Check your inbox.'), devLinkBox(r.devLink)); }
            catch (e2) { slot.replaceChildren(alertBox('danger', e2.message)); }
          } }, 'Send a new link');
          slot.replaceChildren(h('div', { class: 'alert danger', role: 'alert' }, icon('alert'), h('div', {}, err.message, ' ', resend)));
        } else slot.replaceChildren(alertBox('danger', err.message));
      }
    });
  } }, slot, email.el, password.el,
    h('div', { class: 'row-between' }, h('span'), h('a', { href: '/forgot', 'data-link': true }, 'Forgot password?')), submit);

  return shell(
    h('h1', {}, 'Welcome back'), h('p', { class: 'lead' }, 'Log in with your work email.'), form,
    h('p', { class: 'alt' }, 'New to Iris? ', h('a', { href: '/register', 'data-link': true }, 'Create an account')));
}

/* ---------- register ---------- */
export function registerView() {
  const domain = state.config.allowedDomain;
  const name = field({ label: 'Full name', name: 'name', autocomplete: 'name', placeholder: 'Ada Lovelace', maxlength: 60 });
  const email = field({ label: 'Work email', name: 'email', type: 'email', autocomplete: 'username', placeholder: `you@${domain}`, hint: `Only @${domain} addresses can join.` });
  const password = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' });
  const slot = h('div');
  const submit = h('button', { class: 'btn block', type: 'submit' }, 'Create account');
  const checkEmail = () => {
    const v = email.value.trim().toLowerCase();
    if (!v) return email.setError('');
    if (v.includes('@') && !v.endsWith(`@${domain}`)) { email.setError(`Use your work email ending in @${domain}`); return false; }
    email.setError(''); return true;
  };
  email.input.addEventListener('blur', checkEmail);
  email.input.addEventListener('input', () => email.el.classList.contains('has-error') && checkEmail());

  const form = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); slot.replaceChildren();
    let ok = true;
    if (name.value.trim().length < 2) { name.setError('Enter your full name'); ok = false; } else name.setError('');
    const v = email.value.trim().toLowerCase();
    if (!v || !v.endsWith(`@${domain}`) || v.split('@').length !== 2) { email.setError(`Use your work email ending in @${domain}`); ok = false; } else email.setError('');
    if (password.value.length < 10 || !/[A-Za-z]/.test(password.value) || !/\d/.test(password.value)) { password.setError('Use at least 10 characters with a letter and a number'); ok = false; } else password.setError('');
    if (!ok) return;
    await busy(submit, async () => {
      try {
        const r = await api('POST', '/auth/register', { name: name.value, email: email.value, password: password.value });
        showSent(r.email, r.devLink);
      } catch (err) { slot.replaceChildren(alertBox('danger', err.message)); }
    });
  } }, slot, name.el, email.el, password.el, meter(password.input), submit);

  const card = shell(
    h('h1', {}, 'Create your account'), h('p', { class: 'lead' }, 'Use your work email. We will send a link to confirm it.'), form,
    h('p', { class: 'alt' }, 'Already have an account? ', h('a', { href: '/login', 'data-link': true }, 'Log in')));

  function showSent(addr, link) {
    const box = card.querySelector('.auth-card');
    let cooldown = 0; const resend = h('button', { class: 'btn secondary block', type: 'button' }, 'Send the email again');
    const msg = h('div');
    resend.addEventListener('click', async () => {
      await busy(resend, async () => {
        try { const r = await api('POST', '/auth/resend', { email: addr }); msg.replaceChildren(alertBox('ok', 'Sent again. Check your inbox and spam folder.'), devLinkBox(r.devLink)); }
        catch (err) { msg.replaceChildren(alertBox('danger', err.message)); }
      });
    });
    box.replaceChildren(h('div', { class: 'mobile-brand' }, wordmark(34)),
      h('div', { class: 'state-icon' }, icon('mail')), h('h1', {}, 'Check your email'),
      h('p', { class: 'lead' }, 'We sent a verification link to ', h('b', {}, addr), '. It works for 24 hours.'),
      devLinkBox(link), msg, h('div', { class: 'gap12' }), resend,
      h('p', { class: 'alt' }, h('a', { href: '/login', 'data-link': true }, 'Back to log in')));
  }
  return card;
}

/* ---------- verify ---------- */
export async function verifyView({ query }) {
  const view = shell(h('div', { class: 'state-icon' }, icon('mail')), h('h1', {}, 'Verifying your email'), h('p', { class: 'lead' }, 'One moment...'));
  const box = view.querySelector('.auth-card');
  (async () => {
    try {
      await api('POST', '/auth/verify', { token: query.token || '' });
      box.replaceChildren(h('div', { class: 'mobile-brand' }, wordmark(34)), h('div', { class: 'state-icon ok' }, icon('check')), h('h1', {}, 'Email verified'),
        h('p', { class: 'lead' }, 'Your account is ready. Log in to continue.'), h('a', { class: 'btn block', href: '/login', 'data-link': true }, 'Log in'));
    } catch (err) {
      const email = field({ label: 'Work email', name: 'email', type: 'email', placeholder: `you@${state.config.allowedDomain}` });
      const out = h('div'); const btn = h('button', { class: 'btn block', type: 'submit' }, 'Send a new link');
      box.replaceChildren(h('div', { class: 'mobile-brand' }, wordmark(34)), h('div', { class: 'state-icon err' }, icon('alert')), h('h1', {}, 'This link did not work'),
        h('p', { class: 'lead' }, err.message || 'It may have expired or already been used.'),
        h('form', { novalidate: true, onsubmit: async (e) => { e.preventDefault(); await busy(btn, async () => {
          try { const r = await api('POST', '/auth/resend', { email: email.value }); out.replaceChildren(alertBox('ok', 'If that account needs verifying, a new link is on its way.'), devLinkBox(r.devLink)); }
          catch (e2) { out.replaceChildren(alertBox('danger', e2.message)); } }); } }, email.el, btn), out);
    }
  })();
  return view;
}

/* ---------- forgot / reset ---------- */
export function forgotView() {
  const email = field({ label: 'Work email', name: 'email', type: 'email', autocomplete: 'username', placeholder: `you@${state.config.allowedDomain}` });
  const out = h('div'); const btn = h('button', { class: 'btn block', type: 'submit' }, 'Send reset link');
  return shell(h('h1', {}, 'Forgot your password?'), h('p', { class: 'lead' }, 'Enter your work email and we will send you a link to choose a new one.'),
    h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.replaceChildren();
      if (!email.value.trim()) return email.setError('Enter your work email'); email.setError('');
      await busy(btn, async () => {
        try { const r = await api('POST', '/auth/forgot', { email: email.value }); out.replaceChildren(alertBox('ok', 'If an account exists for that email, a reset link is on its way. It works for 1 hour.'), devLinkBox(r.devLink)); }
        catch (err) { out.replaceChildren(alertBox('danger', err.message)); }
      });
    } }, email.el, btn, h('div', { class: 'gap16' }), out),
    h('p', { class: 'alt' }, h('a', { href: '/login', 'data-link': true }, 'Back to log in')));
}

export function resetView({ query }) {
  const pw = field({ label: 'New password', name: 'password', type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' });
  const out = h('div'); const btn = h('button', { class: 'btn block', type: 'submit' }, 'Save new password');
  const view = shell(h('h1', {}, 'Choose a new password'), h('p', { class: 'lead' }, 'You will be signed out everywhere else.'),
    h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); out.replaceChildren(); pw.setError('');
      if (pw.value.length < 10 || !/[A-Za-z]/.test(pw.value) || !/\d/.test(pw.value)) return pw.setError('Use at least 10 characters with a letter and a number');
      await busy(btn, async () => {
        try {
          await api('POST', '/auth/reset', { token: query.token || '', password: pw.value });
          const box = view.querySelector('.auth-card');
          box.replaceChildren(h('div', { class: 'mobile-brand' }, wordmark(34)), h('div', { class: 'state-icon ok' }, icon('check')), h('h1', {}, 'Password updated'),
            h('p', { class: 'lead' }, 'Log in with your new password.'), h('a', { class: 'btn block', href: '/login', 'data-link': true }, 'Log in'));
        } catch (err) { out.replaceChildren(alertBox('danger', err.message), h('a', { href: '/forgot', 'data-link': true }, 'Request a new link')); }
      });
    } }, pw.el, meter(pw.input), btn, h('div', { class: 'gap16' }), out));
  return view;
}
