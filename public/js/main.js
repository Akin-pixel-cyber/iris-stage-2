import { api } from './ui.js';
import { state } from './state.js';
import { route, render } from './router.js';
import { loginView, registerView, verifyView, forgotView, resetView } from './views/auth.js';
import { dashboardView } from './views/dashboard.js';
import { peopleView, profileView } from './views/people.js';
import { ticketsView, ticketNewView, ticketDetailView } from './views/tickets.js';
import { settingsView } from './views/settings.js';

route('/login', { access: 'public', guestOnly: true, layout: 'auth', title: 'Log in', view: loginView });
route('/register', { access: 'public', guestOnly: true, layout: 'auth', title: 'Create account', view: registerView });
route('/verify', { access: 'public', layout: 'auth', title: 'Verify email', view: verifyView });
route('/forgot', { access: 'public', guestOnly: true, layout: 'auth', title: 'Forgot password', view: forgotView });
route('/reset', { access: 'public', layout: 'auth', title: 'Reset password', view: resetView });

route('/', { access: 'user', layout: 'app', title: 'Dashboard', view: dashboardView });
route('/tickets', { access: 'user', layout: 'app', title: 'Tickets', view: ticketsView });
route('/tickets/new', { access: 'user', layout: 'app', title: 'New ticket', view: ticketNewView });
route('/tickets/:id', { access: 'user', layout: 'app', title: 'Ticket', view: ticketDetailView });
route('/people', { access: 'user', layout: 'app', title: 'People', view: peopleView });
route('/people/:id', { access: 'user', layout: 'app', title: 'Profile', view: profileView });
route('/settings', { access: 'user', layout: 'app', title: 'Settings', view: (ctx) => settingsView(ctx, 'profile') });
route('/settings/account', { access: 'user', layout: 'app', title: 'Account', view: (ctx) => settingsView(ctx, 'account') });
route('/settings/users', { access: 'admin', layout: 'app', title: 'Users and roles', view: (ctx) => settingsView(ctx, 'users') });

(async function boot() {
  try { state.config = await api('GET', '/config'); } catch {}
  try { state.user = await api('GET', '/me'); } catch { state.user = null; }
  render();
})();
