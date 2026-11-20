import { h, icon, avatar, api, firstName } from '../ui.js';
import { state } from '../state.js';
import { ticketRow } from '../tickets-ui.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

function completeness(u) {
  const items = [
    ['Add your name', true],
    ['Upload a profile picture', Boolean(u.avatarUrl)],
    ['Add your job title', Boolean(u.title)],
    ['Add your team', Boolean(u.team)],
    ['Write a short bio', Boolean(u.bio)],
  ];
  const done = items.filter((i) => i[1]).length;
  return { items, done, pct: Math.round((done / items.length) * 100) };
}

function progressRing(pct) {
  const C = 2 * Math.PI * 45;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 110 110'); svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(ns, 'circle'); track.setAttribute('class', 'track'); track.setAttribute('cx', '55'); track.setAttribute('cy', '55'); track.setAttribute('r', '45');
  const bar = document.createElementNS(ns, 'circle'); bar.setAttribute('class', 'bar'); bar.setAttribute('cx', '55'); bar.setAttribute('cy', '55'); bar.setAttribute('r', '45');
  bar.setAttribute('stroke-dasharray', String(C)); bar.setAttribute('stroke-dashoffset', String(C));
  svg.append(track, bar);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', String(C * (1 - pct / 100)))));
  return h('div', { class: 'progress', role: 'img', 'aria-label': `Profile ${pct} percent complete` }, svg, h('b', { class: 'num' }, `${pct}%`));
}

export function dashboardView() {
  const u = state.user;
  const c = completeness(u);
  const team = h('div', { class: ['card', c.done === c.items.length ? 'span-12' : 'span-5'] }, h('h2', {}, 'Your team'), h('div', { class: 'sk h110' }));

  const profileCard = h('section', { class: 'card span-7' },
    h('div', { class: 'complete' }, progressRing(c.pct),
      h('div', {}, h('h2', {}, c.done === c.items.length ? 'Your profile is complete' : 'Finish your profile'),
        h('p', { class: 'sub' }, c.done === c.items.length ? 'Everyone in the company can see who you are.' : 'A photo and a title help people find and recognise you.'),
        h('ul', { class: 'checks' }, c.items.map(([label, ok]) => h('li', { class: ok ? 'done' : '' }, h('span', { class: 'dot' }, ok ? icon('check') : null), label))),
        c.done === c.items.length ? null : h('div', { class: 'gap16' }),
        c.done === c.items.length ? null : h('a', { class: 'btn sm', href: '/settings', 'data-link': true }, 'Complete profile'))));

  const road = (cls, ic, title, text) => h('div', { class: 'road' }, h('div', { class: `ic ${cls}` }, icon(ic)), h('b', {}, title), h('p', {}, text), h('span', { class: 'badge' }, 'Coming soon'));
  const roadmap = h('section', { class: 'card span-12' }, h('h2', {}, 'Coming to Iris'), h('p', { class: 'sub' }, 'These arrive in the next releases.'),
    h('div', { class: 'roadmap three' },
      road('b', 'access', 'Access', 'Request and grant access to GitHub, AWS and more.'),
      road('c', 'chat', 'Chat', 'Message people directly or create group chats.'),
      road('d', 'bell', 'Discord alerts', 'Get notifications from the Iris bot when you are away.')));

  const review = h('section', { class: 'card span-12 review hide', 'aria-labelledby': 'rv-h' });
  const assigned = h('section', { class: 'card span-6', 'aria-labelledby': 'as-h' }, h('h2', { id: 'as-h' }, 'Assigned to me'), h('div', { class: 'sk h110' }));
  const created = h('section', { class: 'card span-6', 'aria-labelledby': 'cr-h' }, h('h2', { id: 'cr-h' }, 'Created by me'), h('div', { class: 'sk h110' }));
  const stats = h('div', { class: 'stats span-12' });

  const listOrEmpty = (box, id, title, items, count, emptyText, scope) => box.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { id }, title, count ? h('span', { class: 'badge' }, count) : null), count ? h('a', { href: `/tickets?scope=${scope}`, 'data-link': true }, 'See all') : null),
    items.length ? h('div', { class: 'trows' }, items.map((t) => ticketRow(t, u))) : h('p', { class: 'sub gap16' }, emptyText));

  (async () => {
    try {
      const d = await api('GET', '/dashboard');
      const stat = (n, label, to, hot) => h('a', { class: ['stat', hot && n > 0 && 'hot'], href: to, 'data-link': true }, h('b', { class: 'num' }, n), h('span', {}, label));
      stats.replaceChildren(stat(d.counts.review, 'Waiting for your review', '/tickets?scope=created', true), stat(d.counts.assigned, 'Assigned to me', '/tickets?scope=assigned'),
        stat(d.counts.created, 'Created by me', '/tickets?scope=created'), stat(d.counts.overdue, 'Overdue for me', '/tickets?scope=assigned', true));
      if (d.waitingForMyReview.length) {
        review.classList.remove('hide');
        review.replaceChildren(h('div', { class: 'card-head' }, h('h2', { id: 'rv-h' }, icon('eye'), 'Waiting for your review', h('span', { class: 'badge warn' }, d.counts.review))),
          h('p', { class: 'sub' }, 'These people finished their part. Approve to mark Done, or send it back.'),
          h('div', { class: 'trows' }, d.waitingForMyReview.map((t) => ticketRow(t, u))));
      }
      listOrEmpty(assigned, 'as-h', 'Assigned to me', d.assignedToMe, d.counts.assigned, 'Nothing is assigned to you right now.', 'assigned');
      listOrEmpty(created, 'cr-h', 'Created by me', d.createdByMe, d.counts.created, 'You have no open tickets you created.', 'created');
    } catch (e) { assigned.replaceChildren(h('h2', {}, 'Assigned to me'), h('p', { class: 'sub' }, 'Could not load tickets right now.')); }
    try {
      const people = await api('GET', '/users?limit=200');
      const others = people.filter((p) => p.id !== u.id);
      const shown = others.slice(0, 6);
      team.replaceChildren(h('h2', {}, 'Your team'),
        h('p', { class: 'sub' }, people.length === 1 ? 'You are the first one here.' : `${people.length} people have joined Iris.`),
        shown.length ? h('div', { class: 'stack' }, shown.map((p) => avatar(p, 'md')), others.length > 6 ? h('span', { class: 'more num' }, `+${others.length - 6}`) : null)
          : h('p', { class: 'sub gap16' }, 'Share the sign-up link with your team to get started.'),
        h('a', { class: 'btn secondary sm', href: '/people', 'data-link': true }, 'Browse people'));
    } catch { team.replaceChildren(h('h2', {}, 'Your team'), h('p', { class: 'sub' }, 'Could not load people right now.')); }
  })();

  const profileDone = c.done === c.items.length;
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, `${greeting()}, ${firstName(u.name)}`),
      h('p', {}, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))),
      h('a', { class: 'btn', href: '/tickets/new', 'data-link': true }, icon('plus'), 'New ticket')),
    h('div', { class: 'dash' }, stats, review, assigned, created, profileDone ? null : profileCard, team, roadmap));
}
