import { h, icon, avatar, api, debounce, emptyState, skeletonCard, fmtMonth } from '../ui.js';
import { state } from '../state.js';

function personCard(p) {
  return h('a', { class: 'person', href: `/people/${p.id}`, 'data-link': true },
    avatar(p, 'lg'),
    h('div', {}, h('div', { class: 'name' }, p.name), h('div', { class: 'role-line' }, p.title || 'No title yet')),
    h('div', { class: 'tags' }, p.team ? h('span', { class: 'badge' }, p.team) : null, p.role && p.role !== 'member' ? h('span', { class: 'badge brand' }, p.role[0].toUpperCase() + p.role.slice(1)) : null));
}

export function peopleView({ query }) {
  const grid = h('div', { class: 'grid', 'aria-live': 'polite' }, [1, 2, 3, 4, 5, 6].map(skeletonCard));
  const count = h('p', {}, ' ');
  const input = h('input', { type: 'search', placeholder: 'Search by name, title or team', 'aria-label': 'Search people', value: query.q || '', autocomplete: 'off' });
  const search = h('div', { class: 'search' }, icon('search'), input, h('kbd', { 'aria-hidden': 'true' }, '/'));
  let seq = 0;

  async function load() {
    const id = ++seq; const q = input.value.trim();
    try {
      const rows = await api('GET', `/users?q=${encodeURIComponent(q)}`);
      if (id !== seq) return;
      count.textContent = q ? `${rows.length} ${rows.length === 1 ? 'result' : 'results'}` : `${rows.length} ${rows.length === 1 ? 'person' : 'people'} in Iris`;
      grid.replaceChildren(...(rows.length ? rows.map(personCard) : [emptyState({ title: q ? `No one matches "${q}"` : 'No one here yet', text: q ? 'Check the spelling or try a team or job title.' : 'People appear here once they verify their email.' })]));
      if (!rows.length) grid.classList.remove('grid');
      else grid.classList.add('grid');
    } catch (err) { grid.replaceChildren(emptyState({ iconName: 'alert', title: 'Could not load people', text: err.message })); }
  }
  input.addEventListener('input', debounce(() => { history.replaceState({}, '', input.value.trim() ? `/people?q=${encodeURIComponent(input.value.trim())}` : '/people'); load(); }, 180));
  const onKey = (e) => {
    if (!input.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  };
  document.addEventListener('keydown', onKey);
  load();
  return h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'People'), count), search), grid);
}

export function profileView({ params }) {
  const page = h('div', { class: 'page' }, h('a', { class: 'back', href: '/people', 'data-link': true }, icon('arrow'), 'All people'), h('div', { class: 'card' }, h('div', { class: 'sk h200' })));
  (async () => {
    try {
      const p = await api('GET', `/users/${encodeURIComponent(params.id)}`);
      const mine = p.id === state.user.id;
      const card = h('div', { class: 'card' },
        h('div', { class: 'profile-hero' }, avatar(p, 'xl'),
          h('div', { class: 'grow' },
            h('div', { class: 'row-flex' }, h('h1', {}, p.name), p.role && p.role !== 'member' ? h('span', { class: 'badge brand' }, p.role[0].toUpperCase() + p.role.slice(1)) : null),
            h('div', { class: 'role-line' }, p.title || 'No title yet'),
            h('div', { class: 'facts' },
              p.team ? h('div', {}, icon('users'), p.team) : null,
              h('div', {}, icon('mail'), h('a', { href: `mailto:${p.email}` }, p.email)),
              h('div', {}, icon('calendar'), `Joined ${fmtMonth(p.memberSince)}`))),
          mine ? h('a', { class: 'btn secondary', href: '/settings', 'data-link': true }, 'Edit profile') : null),
        p.bio ? h('p', { class: 'bio' }, p.bio) : null);
      page.lastChild.replaceWith(card);
    } catch (err) {
      page.lastChild.replaceWith(h('div', { class: 'card' }, emptyState({ iconName: 'alert', title: 'Person not found', text: 'They may have left, or the link is wrong.', action: h('a', { class: 'btn secondary', href: '/people', 'data-link': true }, 'Back to people') })));
    }
  })();
  return page;
}
