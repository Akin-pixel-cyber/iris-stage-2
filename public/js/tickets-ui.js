// Pieces shared by the tickets screens and the dashboard.
import { h, icon, avatar, fmtDay } from './ui.js';

export const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
export const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', in_review: 'In review', done: 'Done' };
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export const statusBadge = (s) => h('span', { class: `st st-${s}` }, h('i', { 'aria-hidden': 'true' }), STATUS_LABEL[s]);
export const priorityChip = (p) => h('span', { class: `pr pr-${p}` }, icon('flag'), PRIORITY_LABEL[p]);

export function dueChip(t) {
  if (!t.dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(t.dueDate + 'T00:00:00');
  const days = Math.round((d - today) / 86400000);
  const late = t.status !== 'done' && days < 0;
  const label = late ? `Overdue · ${fmtDay(t.dueDate)}` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${fmtDay(t.dueDate)}`;
  return h('span', { class: ['due', late && 'late', t.status !== 'done' && days >= 0 && days <= 1 && 'soon'] }, icon('calendar'), label);
}

/** True when this ticket is waiting for ME to review it (I created it, someone else sent it for review). */
export const needsMyReview = (t, me) => t.assigner.id === me.id && t.assignee.id !== me.id && t.status === 'in_review';

/** A compact, clickable ticket row used on the dashboard. */
export function ticketRow(t, me) {
  const other = t.assignee.id === me.id ? t.assigner : t.assignee;
  const sub = t.assignee.id === me.id ? `From ${t.assigner.name}` : `For ${t.assignee.name}`;
  return h('a', { class: ['trow', needsMyReview(t, me) && 'needs-me'], href: `/tickets/${t.id}`, 'data-link': true },
    avatar(other, 'sm'),
    h('div', { class: 'grow' }, h('b', {}, t.title), h('span', {}, `${t.ref} · ${sub}`)),
    dueChip(t), statusBadge(t.status));
}
