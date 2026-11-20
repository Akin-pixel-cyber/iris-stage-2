// Notification bell: unread count + a small panel. Polls every 30 s (live push arrives with Socket.IO in Stage 3).
import { h, icon, api, fmtAgo, toast } from './ui.js';
import { state } from './state.js';
import { navigate } from './router.js';

const badges = new Set();
let unread = 0, timer = null, panel = null, opener = null;

function paint() {
  for (const b of badges) { b.textContent = unread > 99 ? '99+' : String(unread); b.classList.toggle('hide', unread === 0); if (b.parentNode) b.parentNode.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications'); }
}
export async function refreshUnread() {
  if (!state.user) return;
  try { unread = (await api('GET', '/notifications/unread-count')).unread; paint(); } catch {}
}
export function startPolling() { stopPolling(); refreshUnread(); timer = setInterval(() => { if (!document.hidden) refreshUnread(); }, 30000); }
export function stopPolling() { clearInterval(timer); closePanel(false); unread = 0; paint(); }

function closePanel(restore = true) {
  if (!panel) return;
  panel.remove(); panel = null;
  document.removeEventListener('keydown', onKey); document.removeEventListener('click', onOutside, true);
  if (opener) { opener.setAttribute('aria-expanded', 'false'); if (restore) opener.focus(); }
}
const onKey = (e) => { if (e.key === 'Escape') closePanel(); };
const onOutside = (e) => { if (panel && !panel.contains(e.target) && !opener.contains(e.target)) closePanel(false); };

async function openPanel(btn) {
  if (panel) return closePanel();
  opener = btn; btn.setAttribute('aria-expanded', 'true');
  const list = h('div', { class: 'np-list' }, h('div', { class: 'sk line w80' }));
  const markAll = h('button', { class: 'btn ghost sm', type: 'button' }, 'Mark all read');
  panel = h('div', { class: 'np', role: 'dialog', 'aria-label': 'Notifications' },
    h('div', { class: 'np-head' }, h('h2', {}, 'Notifications'), markAll), list);
  document.body.append(panel);
  document.addEventListener('keydown', onKey); document.addEventListener('click', onOutside, true);

  async function load() {
    try {
      const data = await api('GET', '/notifications');
      unread = data.unread; paint();
      markAll.disabled = unread === 0;
      list.replaceChildren(...(data.notifications.length ? data.notifications.map((n) =>
        h('button', { class: ['np-item', !n.read && 'unread'], type: 'button', onclick: async () => {
          closePanel(false);
          if (!n.read) { try { await api('POST', '/notifications/read', { ids: [n.id] }); } catch {} refreshUnread(); }
          if (n.link) navigate(n.link);
        } }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'grow' }, h('b', {}, n.title), n.body ? h('span', {}, n.body) : null, h('em', {}, fmtAgo(n.createdAt))),
        n.read ? null : h('span', { class: 'sr' }, 'Unread')))
        : [h('div', { class: 'np-empty' }, icon('bell'), h('b', {}, 'You are all caught up'), h('span', {}, 'New assignments and updates show up here.'))]));
    } catch (e) { list.replaceChildren(h('div', { class: 'np-empty' }, e.message)); }
  }
  markAll.addEventListener('click', async () => { try { await api('POST', '/notifications/read', {}); await load(); } catch (e) { toast(e.message, 'err'); } });
  await load();
  const first = panel && panel.querySelector('button.np-item, button'); first && first.focus();
}

/** A bell button. `cls` styles it for the dark sidebar or the light top bar. */
export function bellButton(cls = '') {
  const badge = h('span', { class: 'bell-badge hide', 'aria-hidden': 'true' }, '0');
  badges.add(badge);
  const btn = h('button', { class: `icon-btn bell ${cls}`, type: 'button', 'aria-label': 'Notifications', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('bell'), badge);
  btn.addEventListener('click', () => openPanel(btn));
  paint();
  return btn;
}
export const unreadNow = () => unread;
