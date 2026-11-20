// Tiny client-side router (History API). Routes declare who may see them: public, user or admin.
import { h, $, icon, ring, wordmark, avatar, api, setTitle } from './ui.js';
import { state } from './state.js';
import { bellButton, startPolling, stopPolling, refreshUnread } from './notifications.js';

const routes = [];
let shell = null;                   // persistent app shell so the sidebar does not flicker
let renderId = 0;

export function route(pattern, opts) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ re, keys, ...opts });
}

export function navigate(to, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', to); else history.pushState({}, '', to);
  return render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[data-link]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
});
window.addEventListener('popstate', render);

export async function logout() {
  try { await api('POST', '/auth/logout'); } catch {}
  state.user = null; shell = null; stopPolling();
  navigate('/login');
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/tickets', label: 'Tickets', icon: 'tickets' },
  { to: '/chat', label: 'Chat', icon: 'chat', soon: true },
  { to: '/access', label: 'Access', icon: 'access', soon: true },
  { to: '/people', label: 'People', icon: 'people' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function activeFor(path, to) { return to === '/' ? path === '/' : path === to || path.startsWith(to + '/'); }

function buildShell() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' });
  const me = h('div', { class: 'me' });
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Main' });
  const topAvatar = h('a', { href: '/settings', 'data-link': true, 'aria-label': 'Your settings' });
  const topRight = h('div', { class: 'row-flex tight' }, bellButton('light'), topAvatar);
  const main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
  const el = h('div', { class: 'app' },
    h('aside', { class: 'side' }, h('div', { class: 'side-head' }, wordmark(30), bellButton()), nav, me),
    h('div', {},
      h('header', { class: 'topbar' }, wordmark(28), topRight),
      main, tabbar));

  function update(path) {
    const u = state.user;
    const items = [...NAV];
    nav.replaceChildren(...items.map((n) => n.soon
      ? h('a', { class: 'soon', href: n.to, 'aria-disabled': 'true', tabindex: '-1' }, icon(n.icon), n.label, h('span', { class: 'tag' }, 'Soon'))
      : h('a', { href: n.to, 'data-link': true, 'aria-current': activeFor(path, n.to) ? 'page' : null }, icon(n.icon), n.label)));
    if (u.role === 'admin') {
      nav.append(h('div', { class: 'label' }, 'Admin'),
        h('a', { href: '/settings/users', 'data-link': true, 'aria-current': path === '/settings/users' ? 'page' : null }, icon('key'), 'Users and roles'));
    }
    me.replaceChildren(avatar(u, 'sm'),
      h('div', { class: 'who' }, h('b', {}, u.name), h('span', {}, u.role === 'admin' ? 'Admin' : u.role === 'grantor' ? 'Grantor' : u.title || 'Member')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sign out', title: 'Sign out', onclick: logout }, icon('logout')));
    const tabs = [['/', 'Home', 'dashboard'], ['/tickets', 'Tickets', 'tickets'], ['/people', 'People', 'people'], ['/settings', 'Settings', 'settings']];
    if (u.role === 'admin') tabs.push(['/settings/users', 'Users', 'key']);
    tabbar.replaceChildren(...tabs.map(([to, label, ic]) => h('a', { href: to, 'data-link': true, 'aria-current': (to === '/settings' ? path === '/settings' || path === '/settings/account' : activeFor(path, to)) ? 'page' : null }, icon(ic), label)));
    topAvatar.replaceChildren(avatar(u, 'sm'));
  }
  return { el, main, update };
}

export async function render() {
  const id = ++renderId;
  const path = location.pathname;
  const hit = routes.find((r) => r.re.test(path));
  const root = document.getElementById('root');

  if (!hit) {
    root.replaceChildren(h('div', { class: 'auth-main' }, h('div', { class: 'auth-card' }, h('div', { class: 'state-icon err' }, icon('alert')), h('h1', {}, 'Page not found'), h('p', { class: 'lead' }, 'That address does not exist.'), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Go home'))));
    return;
  }
  const m = hit.re.exec(path);
  const params = Object.fromEntries(hit.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  const query = Object.fromEntries(new URLSearchParams(location.search));

  if (hit.access !== 'public' && !state.user) return navigate(`/login?next=${encodeURIComponent(path + location.search)}`, { replace: true });
  if (hit.access === 'public' && hit.guestOnly && state.user) return navigate('/', { replace: true });
  if (hit.access === 'admin' && state.user.role !== 'admin') {
    return navigate('/', { replace: true });
  }

  if (hit.layout === 'auth') {
    shell = null;
    const view = await hit.view({ params, query });
    if (id !== renderId) return;
    root.replaceChildren(view);
    setTitle(hit.title);
    return;
  }
  if (!shell || !root.contains(shell.el)) { shell = buildShell(); root.replaceChildren(shell.el); startPolling(); } else refreshUnread();
  shell.update(path);
  const view = await hit.view({ params, query });
  if (id !== renderId) return;
  shell.main.replaceChildren(view);
  setTitle(typeof hit.title === 'function' ? hit.title() : hit.title);
  window.scrollTo(0, 0);
  if (!query.keepfocus) shell.main.focus({ preventScroll: true });
}

/** Re-draw the sidebar (name, picture) after the profile changes. */
export function refreshShell() { if (shell) shell.update(location.pathname); }
