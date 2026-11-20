import { h, icon, avatar, field, meter, api, busy, toast, confirmModal, emptyState, fmtAgo } from '../ui.js';
import { state } from '../state.js';
import { refreshShell, logout } from '../router.js';

function tabs(active) {
  const items = [['profile', '/settings', 'Profile'], ['account', '/settings/account', 'Account']];
  if (state.user.role === 'admin') items.push(['users', '/settings/users', 'Users and roles']);
  return h('nav', { class: 'tabs', 'aria-label': 'Settings sections' }, items.map(([k, to, label]) => h('a', { href: to, 'data-link': true, 'aria-current': active === k ? 'page' : null }, label)));
}

export function settingsView(ctx, tab) {
  const body = tab === 'profile' ? profileTab() : tab === 'account' ? accountTab() : usersTab();
  const titles = { profile: ['Profile', 'This is how other people see you in Iris.'], account: ['Account', 'Appearance, password and sign out.'], users: ['Users and roles', 'Decide who can grant access and who can leave.'] };
  return h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, titles[tab][0]), h('p', {}, titles[tab][1]))), tabs(tab), body);
}

/* ---------- profile ---------- */
async function squareBlob(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error('That file could not be read as an image'); }
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 512, 512);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.9));
  if (!blob) throw new Error('Could not process that image');
  return blob;
}

function profileTab() {
  const u = state.user;
  const name = field({ label: 'Full name', name: 'name', autocomplete: 'name', value: u.name, maxlength: 60 });
  const title = field({ label: 'Job title', name: 'title', value: u.title, maxlength: 80, placeholder: 'e.g. DevOps Engineer', required: false });
  const team = field({ label: 'Team', name: 'team', value: u.team, maxlength: 80, placeholder: 'e.g. Platform', required: false });
  const bio = field({ label: 'About you', name: 'bio', value: u.bio, maxlength: 500, multiline: true, required: false, placeholder: 'What do you work on? What can people ask you about?' });
  const email = field({ label: 'Work email', name: 'email', value: u.email, readonly: true, hint: 'Your work email cannot be changed.' });
  const counter = h('div', { class: 'counter num' }, `${u.bio.length}/500`);
  const save = h('button', { class: 'btn', type: 'submit', disabled: true }, 'Save changes');

  // live preview card
  const prevAv = h('div'); const prevName = h('div', { class: 'name' }); const prevRole = h('div', { class: 'role-line' }); const prevTags = h('div', { class: 'tags' });
  const preview = h('aside', { class: 'card preview sticky' }, h('div', { class: 'cap' }, 'How others see you'), prevAv, prevName, prevRole, prevTags);
  const drawPreview = () => {
    prevAv.replaceChildren(avatar({ ...state.user, name: name.value || 'You' }, 'xl'));
    prevName.textContent = name.value.trim() || 'Your name';
    prevRole.textContent = title.value.trim() || 'No title yet';
    prevTags.replaceChildren(...(team.value.trim() ? [h('span', { class: 'badge' }, team.value.trim())] : []));
  };

  const saved = () => ({ name: state.user.name, title: state.user.title, team: state.user.team, bio: state.user.bio });
  const dirty = () => { const s = saved(); return name.value.trim() !== s.name || title.value.trim() !== s.title || team.value.trim() !== s.team || bio.value.trim() !== s.bio; };
  for (const f of [name, title, team, bio]) f.input.addEventListener('input', () => { save.disabled = !dirty(); drawPreview(); counter.textContent = `${bio.value.length}/500`; });

  // picture
  const avBox = h('div'); const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hide', 'aria-label': 'Choose a profile picture' });
  const removeBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('trash'), 'Remove photo');
  const pickBtn = h('button', { class: 'btn secondary sm', type: 'button', onclick: () => fileInput.click() }, icon('camera'), 'Upload photo');
  const drawAvatar = () => { avBox.replaceChildren(avatar(state.user, 'xl')); removeBtn.classList.toggle('hide', !state.user.avatarUrl); drawPreview(); refreshShell(); };
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; fileInput.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(f.type)) return toast('Choose a PNG, JPG or WebP image', 'err');
    if (f.size > 15 * 1024 * 1024) return toast('That image is too large. Choose one under 15 MB', 'err');
    await busy(pickBtn, async () => {
      try {
        const blob = await squareBlob(f);
        const r = await api('PUT', '/me/avatar', blob, { raw: true, type: blob.type });
        state.user.avatarUrl = r.avatarUrl; drawAvatar(); toast('Profile picture updated');
      } catch (err) { toast(err.message, 'err'); }
    });
  });
  removeBtn.addEventListener('click', async () => {
    await busy(removeBtn, async () => { try { await api('DELETE', '/me/avatar'); state.user.avatarUrl = null; drawAvatar(); toast('Photo removed'); } catch (err) { toast(err.message, 'err'); } });
  });

  const form = h('form', { class: 'card', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (name.value.trim().length < 2) return name.setError('Enter your full name'); name.setError('');
    await busy(save, async () => {
      try {
        const r = await api('PATCH', '/me', { name: name.value, title: title.value, team: team.value, bio: bio.value });
        Object.assign(state.user, r); toast('Profile saved'); refreshShell(); drawPreview();
      } catch (err) { toast(err.message, 'err'); }
      save.disabled = !dirty();
    });
  } },
    h('div', { class: 'avatar-edit' }, avBox, h('div', { class: 'actions' }, pickBtn, removeBtn, h('span', { class: 'hint' }, 'PNG, JPG or WebP. We crop it to a square.')), fileInput),
    name.el, h('div', { class: 'row-flex' }, h('div', { class: 'grow' }, title.el), h('div', { class: 'grow' }, team.el)), bio.el, counter, h('div', { class: 'gap16' }), email.el,
    h('div', { class: 'form-actions' }, save));
  drawAvatar();
  return h('div', { class: 'split' }, form, preview);
}

/* ---------- account ---------- */
function accountTab() {
  const mode = window.IrisTheme.get();
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' });
  const opts = [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']];
  const draw = () => seg.replaceChildren(...opts.map(([k, label, ic]) => h('button', { type: 'button', 'aria-pressed': String(window.IrisTheme.get() === k), onclick: () => { window.IrisTheme.set(k); draw(); } }, icon(ic), label)));
  draw();

  const cur = field({ label: 'Current password', name: 'current', type: 'password', autocomplete: 'current-password' });
  const next = field({ label: 'New password', name: 'next', type: 'password', autocomplete: 'new-password' });
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Change password');
  const pwForm = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); cur.setError(''); next.setError('');
    if (!cur.value) return cur.setError('Enter your current password');
    if (next.value.length < 10 || !/[A-Za-z]/.test(next.value) || !/\d/.test(next.value)) return next.setError('Use at least 10 characters with a letter and a number');
    await busy(btn, async () => {
      try { await api('POST', '/me/password', { current: cur.value, next: next.value }); cur.input.value = ''; next.input.value = ''; toast('Password changed. Other devices were signed out.'); }
      catch (err) { (err.code === 'bad_current' ? cur : next).setError(err.message); }
    });
  } }, cur.el, next.el, meter(next.input), btn);

  return h('div', { class: 'stack-cards' },
    h('section', { class: 'card' }, h('h2', {}, 'Appearance'), h('p', { class: 'sub' }, 'Choose how Iris looks on this device.'), h('div', { class: 'gap16' }), seg),
    h('section', { class: 'card' }, h('h2', {}, 'Change password'), h('p', { class: 'sub' }, 'You stay signed in here. Every other device is signed out.'), h('div', { class: 'gap16' }), pwForm),
    h('section', { class: 'card' }, h('h2', {}, 'Sign out'), h('p', { class: 'sub' }, 'End your session on this device.'), h('div', { class: 'gap16' }),
      h('button', { class: 'btn secondary', type: 'button', onclick: logout }, icon('logout'), 'Sign out')));
}

/* ---------- admin: users and roles ---------- */
function usersTab() {
  const list = h('div', {}, h('div', { class: 'sk h200' }));
  const input = h('input', { type: 'search', placeholder: 'Search people', 'aria-label': 'Search people' });
  const search = h('div', { class: 'search' }, icon('search'), input);
  let all = [];

  const statusBadges = (p) => [
    p.id === state.user.id ? h('span', { class: 'badge brand' }, 'You') : null,
    !p.verified ? h('span', { class: 'badge warn' }, 'Email not verified') : null,
    !p.active ? h('span', { class: 'badge danger' }, 'Deactivated') : h('span', { class: 'badge ok' }, 'Active'),
  ];

  function row(p) {
    const self = p.id === state.user.id;
    const select = h('select', { 'aria-label': `Role for ${p.name}`, disabled: self }, ['member', 'grantor', 'admin'].map((r) => h('option', { value: r, selected: p.role === r }, r[0].toUpperCase() + r.slice(1))));
    select.addEventListener('change', async () => {
      const prev = p.role;
      try { const r = await api('PATCH', `/admin/users/${p.id}`, { role: select.value }); p.role = r.role; toast(`${p.name} is now ${r.role}. Their session was ended.`); }
      catch (err) { select.value = prev; toast(err.message, 'err'); }
    });
    const toggle = h('button', { class: `btn sm ${p.active ? 'danger-soft' : 'secondary'}`, type: 'button', disabled: self }, p.active ? 'Deactivate' : 'Reactivate');
    toggle.addEventListener('click', async () => {
      if (p.active && !(await confirmModal({ title: `Deactivate ${p.name}?`, body: 'They are signed out immediately and cannot log in again until you reactivate them. Their tickets and messages are kept.', confirmLabel: 'Deactivate', danger: true }))) return;
      await busy(toggle, async () => {
        try { const r = await api('PATCH', `/admin/users/${p.id}`, { active: !p.active }); p.active = r.active; toast(r.active ? `${p.name} can log in again` : `${p.name} was deactivated`); draw(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
    return h('div', { class: 'userrow' },
      h('div', { class: 'who' }, avatar(p, 'md'), h('div', { class: 'grow' }, h('b', {}, p.name), h('span', {}, p.email), h('div', { class: 'chips' }, statusBadges(p), h('span', { class: 'badge' }, `Last login ${fmtAgo(p.lastLoginAt)}`)))),
      h('div', { class: 'ctrl' }, select), h('div', { class: 'ctrl' }, toggle));
  }
  function draw() {
    const q = input.value.trim().toLowerCase();
    const rows = all.filter((p) => !q || `${p.name} ${p.email} ${p.title} ${p.team}`.toLowerCase().includes(q));
    list.replaceChildren(...(rows.length ? rows.map(row) : [emptyState({ title: 'No one matches', text: 'Try a different name or email.' })]));
  }
  input.addEventListener('input', draw);
  (async () => { try { all = await api('GET', '/admin/users'); draw(); } catch (err) { list.replaceChildren(emptyState({ iconName: 'alert', title: 'Could not load users', text: err.message })); } })();

  const roles = h('div', { class: 'legend' }, h('span', { class: 'badge' }, 'Member: tickets, chat, own profile'), h('span', { class: 'badge' }, 'Grantor: can grant and revoke access to tools'), h('span', { class: 'badge brand' }, 'Admin: everything, including this page'));
  return h('section', { class: 'card' }, h('div', { class: 'row-flex' }, search), h('div', { class: 'gap12' }), roles, list);
}
