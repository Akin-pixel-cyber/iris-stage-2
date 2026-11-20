import { h, icon, avatar, api, toast, busy, field, emptyState, debounce, setTitle, fmtWhen, confirmModal } from '../ui.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { STATUSES, STATUS_LABEL, PRIORITY_LABEL, statusBadge, priorityChip, dueChip, needsMyReview } from '../tickets-ui.js';
import { refreshUnread } from '../notifications.js';

const store = {
  get(k, d) { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/* =====================================================================
   Tickets: board and list
   ===================================================================== */
export function ticketsView({ query }) {
  const me = state.user;
  const f = { view: store.get('iris.tickets.view', 'board'), scope: query.scope || 'mine', q: '', priority: '' };
  let tickets = [];
  const body = h('div', { class: 'tk-body' });
  const live = h('div', { class: 'sr', 'aria-live': 'polite' });

  const viewBtn = (v, label, ic) => h('button', { type: 'button', 'aria-pressed': String(f.view === v), onclick: () => { f.view = v; store.set('iris.tickets.view', v); syncViews(); draw(); } }, icon(ic), label);
  const vBoard = viewBtn('board', 'Board', 'board'), vList = viewBtn('list', 'List', 'list');
  const syncViews = () => { vBoard.setAttribute('aria-pressed', String(f.view === 'board')); vList.setAttribute('aria-pressed', String(f.view === 'list')); };

  const scopes = [['mine', 'All mine'], ['assigned', 'Assigned to me'], ['created', 'Created by me']];
  if (me.role === 'admin') scopes.push(['all', 'Everyone']);
  const scopeSel = h('select', { 'aria-label': 'Show', onchange: (e) => { f.scope = e.target.value; load(); } }, scopes.map(([v, l]) => h('option', { value: v, selected: v === f.scope }, l)));
  const prioSel = h('select', { 'aria-label': 'Priority', onchange: (e) => { f.priority = e.target.value; load(); } },
    h('option', { value: '' }, 'Any priority'), ['urgent', 'high', 'medium', 'low'].map((p) => h('option', { value: p }, PRIORITY_LABEL[p])));
  const search = h('input', { type: 'search', placeholder: 'Search tickets', 'aria-label': 'Search tickets', autocomplete: 'off' });
  search.addEventListener('input', debounce(() => { f.q = search.value.trim(); load(); }, 250));

  async function move(t, status) {
    try {
      await api('PATCH', `/tickets/${t.id}/status`, { status });
      toast(`${t.ref} moved to ${STATUS_LABEL[status]}`);
      refreshUnread();
    } catch (e) { toast(e.message, 'err'); }
    await load();
  }

  const statusSelect = (t) => {
    const opts = [t.status, ...t.allowed.filter((s) => s !== t.status)];
    const sel = h('select', { class: `mv st-${t.status}`, 'aria-label': `Status of ${t.ref}`, disabled: t.allowed.length === 0, title: t.allowed.length ? 'Change status' : 'You cannot change this status' },
      STATUSES.filter((s) => opts.includes(s)).map((s) => h('option', { value: s, selected: s === t.status }, STATUS_LABEL[s])));
    sel.addEventListener('change', () => move(t, sel.value));
    sel.addEventListener('click', (e) => e.stopPropagation());
    return sel;
  };

  function card(t) {
    const other = t.assignee.id === me.id ? t.assigner : t.assignee;
    const mine = t.assignee.id === me.id;
    const el = h('article', { class: ['tk', `pr-b-${t.priority}`, needsMyReview(t, me) && 'needs-me', t.allowed.length && 'can-drag'], draggable: t.allowed.length ? 'true' : null, 'data-id': t.id },
      h('div', { class: 'tk-top' }, h('span', { class: 'ref' }, t.ref), priorityChip(t.priority)),
      h('a', { class: 'tk-title', href: `/tickets/${t.id}`, 'data-link': true }, t.title),
      needsMyReview(t, me) ? h('div', { class: 'need' }, icon('eye'), 'Waiting for your review') : null,
      h('div', { class: 'tk-meta' }, avatar(other, 'sm'), h('span', { class: 'who' }, mine ? `From ${t.assigner.name}` : `For ${t.assignee.name}`),
        dueChip(t), t.commentCount ? h('span', { class: 'cc', title: `${t.commentCount} comments` }, icon('comment'), t.commentCount) : null),
      h('div', { class: 'tk-foot' }, statusSelect(t)));
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
      document.querySelectorAll('.col').forEach((c) => c.classList.toggle('ok-drop', t.allowed.includes(c.dataset.status)));
      document.querySelectorAll('.col').forEach((c) => c.classList.toggle('no-drop', !t.allowed.includes(c.dataset.status) && c.dataset.status !== t.status));
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.querySelectorAll('.col').forEach((c) => c.classList.remove('ok-drop', 'no-drop', 'over')); });
    return el;
  }

  function board() {
    const wrap = h('div', { class: 'board', role: 'group', 'aria-label': 'Ticket board' });
    for (const s of STATUSES) {
      const items = tickets.filter((t) => t.status === s);
      const col = h('section', { class: `col col-${s}`, 'data-status': s, 'aria-label': `${STATUS_LABEL[s]}, ${items.length} tickets` },
        h('header', {}, statusBadge(s), h('b', { class: 'num count' }, items.length)),
        h('div', { class: 'col-body' }, items.length ? items.map(card) : h('div', { class: 'col-empty' }, s === 'done' ? 'Finished tickets land here' : 'Nothing here')));
      col.addEventListener('dragover', (e) => { if (col.classList.contains('ok-drop')) { e.preventDefault(); col.classList.add('over'); } });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        const t = tickets.find((x) => String(x.id) === e.dataTransfer.getData('text/plain'));
        if (t && t.allowed.includes(s)) move(t, s); else if (t) toast('You cannot move this ticket there', 'err');
      });
      wrap.append(col);
    }
    return wrap;
  }

  function list() {
    if (!tickets.length) return null;
    return h('div', { class: 'card flush' }, h('div', { class: 'tl' }, tickets.map((t) => {
      const other = t.assignee.id === me.id ? t.assigner : t.assignee;
      return h('div', { class: ['tl-row', needsMyReview(t, me) && 'needs-me'] },
        avatar(other, 'sm'),
        h('div', { class: 'grow' }, h('a', { class: 'tk-title', href: `/tickets/${t.id}`, 'data-link': true }, t.title),
          h('span', { class: 'sub-line' }, `${t.ref} · ${t.assignee.id === me.id ? 'From ' + t.assigner.name : 'For ' + t.assignee.name}`)),
        priorityChip(t.priority), dueChip(t), statusSelect(t));
    })));
  }

  function draw() {
    if (!tickets.length) {
      const filtered = f.q || f.priority || f.scope !== 'mine';
      body.replaceChildren(emptyState({ iconName: 'tickets', title: filtered ? 'No tickets match' : 'No tickets yet', text: filtered ? 'Try a different search or filter.' : 'Create a ticket to give someone a task, or wait for one to be assigned to you.',
        action: h('a', { class: 'btn', href: '/tickets/new', 'data-link': true }, icon('plus'), 'New ticket') }));
      return;
    }
    body.replaceChildren(f.view === 'board' ? board() : list());
  }

  async function load() {
    const p = new URLSearchParams();
    p.set('scope', f.scope); if (f.q) p.set('q', f.q); if (f.priority) p.set('priority', f.priority);
    try { tickets = (await api('GET', `/tickets?${p}`)).tickets; live.textContent = `${tickets.length} tickets`; draw(); }
    catch (e) { body.replaceChildren(emptyState({ iconName: 'alert', title: 'Could not load tickets', text: e.message })); }
  }
  body.replaceChildren(h('div', { class: 'board' }, STATUSES.map(() => h('div', { class: 'sk h200' }))));
  load();
  setTitle('Tickets');

  return h('div', { class: 'page wide' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Tickets'), h('p', {}, 'Tasks you gave, and tasks given to you.')),
      h('a', { class: 'btn', href: '/tickets/new', 'data-link': true }, icon('plus'), 'New ticket')),
    h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icon('search'), search),
      h('div', { class: 'selects' }, scopeSel, prioSel),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'View' }, vBoard, vList)),
    live, body);
}

/* =====================================================================
   New ticket
   ===================================================================== */
export function ticketNewView({ query }) {
  const me = state.user;
  const title = field({ label: 'Title', name: 'title', placeholder: 'What needs to be done?', maxlength: 140 });
  const desc = field({ label: 'Details (optional)', name: 'description', multiline: true, required: false, maxlength: 5000, hint: 'Add links, steps, or anything that helps.' });
  const date = field({ label: 'Due date (optional)', name: 'due', type: 'date', required: false });
  let type = 'general', priority = 'medium';

  const people = h('select', { id: 'assignee', required: true }, h('option', { value: '' }, 'Loading people…'));
  const peopleMsg = h('div', { class: 'field-msg', 'aria-live': 'polite' });
  (async () => {
    try {
      const list = await api('GET', '/users?limit=500');
      people.replaceChildren(h('option', { value: '' }, 'Choose a person'),
        ...list.map((p) => h('option', { value: p.id, selected: String(p.id) === query.assignee }, p.id === me.id ? `${p.name} (me)` : p.name + (p.title ? ` · ${p.title}` : ''))));
    } catch (e) { people.replaceChildren(h('option', { value: '' }, 'Could not load people')); }
  })();

  const provider = h('select', { id: 'provider', 'aria-label': 'Tool' }, [['github', 'GitHub'], ['aws', 'AWS'], ['other', 'Other tool']].map(([v, l]) => h('option', { value: v }, l)));
  const providerBox = h('div', { class: 'field hide' }, h('label', { for: 'provider' }, 'Which tool?'), provider,
    h('div', { class: 'field-msg' }, 'In a later release, access tickets will grant the access for you.'));

  function choice(items, get, set, name) {
    const wrap = h('div', { class: 'seg wrapseg', role: 'radiogroup', 'aria-label': name });
    const btns = items.map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(get() === v), onclick: () => { set(v); btns.forEach((b, i) => b.setAttribute('aria-checked', String(items[i][0] === v))); } }, l));
    wrap.append(...btns); return wrap;
  }
  const typeSeg = choice([['general', 'General'], ['access', 'Access request']], () => type, (v) => { type = v; providerBox.classList.toggle('hide', v !== 'access'); }, 'Type');
  const prioSeg = choice([['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']], () => priority, (v) => { priority = v; }, 'Priority');

  const err = h('div', { class: 'alert danger hide', role: 'alert' });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Create ticket');
  const form = h('form', { class: 'card', novalidate: true },
    title.el, desc.el,
    h('div', { class: 'field' }, h('label', { for: 'assignee' }, 'Assign to'), people, peopleMsg),
    h('div', { class: 'field' }, h('label', {}, 'Type'), typeSeg), providerBox,
    h('div', { class: 'field' }, h('label', {}, 'Priority'), prioSeg),
    date.el, err,
    h('div', { class: 'form-actions' }, h('a', { class: 'btn ghost', href: '/tickets', 'data-link': true }, 'Cancel'), submit));
  form.addEventListener('submit', (e) => {
    e.preventDefault(); err.classList.add('hide'); title.setError('');
    if (title.value.trim().length < 3) return title.setError('Give the ticket a short title (at least 3 characters)'), title.input.focus();
    if (!people.value) { peopleMsg.textContent = 'Choose who this ticket is for'; return people.focus(); }
    busy(submit, async () => {
      try {
        const t = await api('POST', '/tickets', { title: title.value, description: desc.value, assigneeId: Number(people.value), type, provider: type === 'access' ? provider.value : '', priority, dueDate: date.value || null });
        toast(`${t.ref} created`); navigate(`/tickets/${t.id}`);
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hide'); }
    });
  });
  setTitle('New ticket');
  return h('div', { class: 'page narrow' }, h('a', { class: 'back', href: '/tickets', 'data-link': true }, icon('arrow'), 'Tickets'),
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'New ticket'), h('p', {}, 'You will be the creator. Only you can mark it Done.'))), form);
}

/* =====================================================================
   One ticket
   ===================================================================== */
export async function ticketDetailView({ params }) {
  const me = state.user;
  const root = h('div', { class: 'page' });
  let editing = false;

  async function load() {
    let d;
    try { d = await api('GET', `/tickets/${params.id}`); }
    catch (e) { root.replaceChildren(emptyState({ iconName: 'tickets', title: e.status === 404 ? 'Ticket not found' : 'Could not load ticket', text: e.status === 404 ? 'It may not exist, or it is not assigned to you.' : e.message, action: h('a', { class: 'btn', href: '/tickets', 'data-link': true }, 'Back to tickets') })); return; }
    draw(d);
  }

  async function setStatus(t, status) {
    try { await api('PATCH', `/tickets/${t.id}/status`, { status }); toast(`Moved to ${STATUS_LABEL[status]}`); refreshUnread(); }
    catch (e) { toast(e.message, 'err'); }
    load();
  }

  function actions(d) {
    const t = d.ticket, a = d.allowed, iAmCreator = t.assigner.id === me.id, iAmAssignee = t.assignee.id === me.id;
    const btn = (label, status, cls = '', ic) => h('button', { class: `btn ${cls}`, type: 'button', onclick: (e) => busy(e.currentTarget, () => setStatus(t, status)) }, ic ? icon(ic) : null, label);
    const out = [];
    if (iAmCreator && t.status === 'in_review' && !iAmAssignee) {
      out.push(btn('Approve and mark Done', 'done', '', 'check'), btn('Send back', 'in_progress', 'secondary'));
    } else if (iAmCreator && t.status === 'done') {
      out.push(btn('Reopen', iAmAssignee ? 'in_progress' : 'todo', 'secondary'));
    } else {
      if (a.includes('in_progress')) out.push(btn(t.status === 'todo' ? 'Start work' : 'Move to In progress', 'in_progress', t.status === 'todo' ? '' : 'secondary'));
      if (a.includes('in_review')) out.push(btn(iAmCreator && iAmAssignee ? 'Move to In review' : 'Send for review', 'in_review', a.includes('in_progress') ? 'secondary' : ''));
      if (a.includes('done')) out.push(btn('Mark Done', 'done', 'secondary', 'check'));
      if (a.includes('todo') && t.status !== 'todo') out.push(btn('Back to To do', 'todo', 'ghost'));
    }
    let note = null;
    if (iAmAssignee && !iAmCreator && t.status !== 'done') note = `When you are finished, send it for review. Only ${t.assigner.name} can mark it Done.`;
    else if (iAmAssignee && !iAmCreator && t.status === 'done') note = `${t.assigner.name} marked this Done. Ask them to reopen it if more work is needed.`;
    else if (iAmCreator && !iAmAssignee && t.status === 'in_review') note = `${t.assignee.name} sent this for your review.`;
    else if (!iAmCreator && !iAmAssignee) note = 'You can view this ticket but not change it.';
    return h('div', { class: 'tk-actions' }, out.length ? h('div', { class: 'row-flex' }, out) : null, note ? h('p', { class: 'muted note' }, note) : null);
  }

  function timeline(d) {
    const items = [
      ...d.comments.map((c) => ({ at: c.createdAt, order: 1, kind: 'comment', c })),
      ...d.events.map((e) => ({ at: e.createdAt, order: 0, kind: 'event', e })),
    ].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.order - y.order));
    const evText = (e) => e.kind === 'created' ? 'created this ticket'
      : e.kind === 'status' ? (e.from === 'done' ? `reopened this ticket (${STATUS_LABEL[e.to]})` : `moved this from ${STATUS_LABEL[e.from]} to ${STATUS_LABEL[e.to]}`)
      : e.kind === 'reassigned' ? `reassigned this from ${e.from} to ${e.to}` : 'edited the details';
    return h('ol', { class: 'tline' }, items.map((it) => it.kind === 'comment'
      ? h('li', { class: 'c' }, avatar(it.c.author, 'sm'), h('div', { class: 'bubble' }, h('div', { class: 'who' }, h('b', {}, it.c.author.name), h('time', {}, fmtWhen(it.c.createdAt))), h('p', {}, it.c.body)))
      : h('li', { class: 'e' }, h('span', { class: 'pip', 'aria-hidden': 'true' }), h('span', {}, h('b', {}, it.e.actor.id === me.id ? 'You' : it.e.actor.name), ' ', evText(it.e), ' · ', h('time', {}, fmtWhen(it.e.createdAt))))));
  }

  function commentBox(d) {
    if (!d.canComment) return null;
    const ta = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'Write a comment', 'aria-label': 'Write a comment' });
    const send = h('button', { class: 'btn', type: 'submit' }, 'Comment');
    const form = h('form', { class: 'cbox' }, ta, h('div', { class: 'form-actions' }, send));
    form.addEventListener('submit', (e) => {
      e.preventDefault(); if (!ta.value.trim()) return ta.focus();
      busy(send, async () => { try { await api('POST', `/tickets/${d.ticket.id}/comments`, { body: ta.value }); await load(); } catch (ex) { toast(ex.message, 'err'); } });
    });
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') form.requestSubmit(); });
    return form;
  }

  async function editForm(d) {
    const t = d.ticket;
    const title = field({ label: 'Title', name: 'title', value: t.title, maxlength: 140 });
    const desc = field({ label: 'Details', name: 'description', multiline: true, required: false, value: t.description, maxlength: 5000 });
    const date = field({ label: 'Due date', name: 'due', type: 'date', required: false, value: t.dueDate || '' });
    const prio = h('select', { id: 'e-prio' }, ['low', 'medium', 'high', 'urgent'].map((p) => h('option', { value: p, selected: p === t.priority }, PRIORITY_LABEL[p])));
    const who = h('select', { id: 'e-who' }, h('option', { value: t.assignee.id }, t.assignee.name));
    api('GET', '/users?limit=500').then((list) => who.replaceChildren(...list.map((p) => h('option', { value: p.id, selected: p.id === t.assignee.id }, p.name)))).catch(() => {});
    const save = h('button', { class: 'btn', type: 'submit' }, 'Save changes');
    const err = h('div', { class: 'alert danger hide', role: 'alert' });
    const form = h('form', { class: 'card', novalidate: true }, h('h2', { class: 'gapb' }, 'Edit ticket'), title.el, desc.el,
      h('div', { class: 'field' }, h('label', { for: 'e-who' }, 'Assign to'), who), h('div', { class: 'field' }, h('label', { for: 'e-prio' }, 'Priority'), prio), date.el, err,
      h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { editing = false; draw(d); } }, 'Cancel'), save));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(save, async () => {
        try {
          await api('PATCH', `/tickets/${t.id}`, { title: title.value, description: desc.value, priority: prio.value, dueDate: date.value || null, assigneeId: Number(who.value) });
          editing = false; toast('Saved'); await load();
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hide'); }
      });
    });
    return form;
  }

  async function draw(d) {
    const t = d.ticket;
    setTitle(`${t.ref} ${t.title}`);
    const detail = h('aside', { class: 'card side-card' },
      h('h2', {}, 'Details'),
      h('dl', { class: 'dl' },
        h('dt', {}, 'Status'), h('dd', {}, statusBadge(t.status)),
        h('dt', {}, 'Created by'), h('dd', { class: 'person-line' }, avatar(t.assigner, 'sm'), t.assigner.id === me.id ? `${t.assigner.name} (you)` : t.assigner.name),
        h('dt', {}, 'Assigned to'), h('dd', { class: 'person-line' }, avatar(t.assignee, 'sm'), t.assignee.id === me.id ? `${t.assignee.name} (you)` : t.assignee.name),
        h('dt', {}, 'Priority'), h('dd', {}, priorityChip(t.priority)),
        h('dt', {}, 'Due'), h('dd', {}, dueChip(t) || h('span', { class: 'muted' }, 'No due date')),
        h('dt', {}, 'Type'), h('dd', {}, t.type === 'access' ? `Access request${t.provider ? ' · ' + ({ github: 'GitHub', aws: 'AWS', other: 'Other' })[t.provider] : ''}` : 'General'),
        h('dt', {}, 'Created'), h('dd', {}, fmtWhen(t.createdAt)),
        t.doneAt ? [h('dt', {}, 'Done'), h('dd', {}, fmtWhen(t.doneAt))] : null));

    const main = editing ? await editForm(d) : h('div', { class: 'stack-cards' },
      h('section', { class: ['card', needsMyReview(t, me) && 'needs-me-card'] },
        h('div', { class: 'tk-top' }, h('span', { class: 'ref' }, t.ref), statusBadge(t.status)),
        h('h1', { class: 'tk-h1' }, t.title),
        t.description ? h('p', { class: 'tk-desc' }, t.description) : h('p', { class: 'muted tk-desc' }, 'No details were added.'),
        h('div', { class: 'gap16' }), actions(d)),
      h('section', { class: 'card' }, h('h2', { class: 'gapb' }, 'Activity'), timeline(d), commentBox(d)));

    root.replaceChildren(
      h('a', { class: 'back', href: '/tickets', 'data-link': true }, icon('arrow'), 'Tickets'),
      d.canEdit && !editing ? h('div', { class: 'page-head slim' }, h('span'), h('button', { class: 'btn secondary sm', type: 'button', onclick: () => { editing = true; draw(d); } }, icon('edit'), 'Edit')) : null,
      h('div', { class: 'split' }, main, detail));
  }
  await load();
  return root;
}
