# build.md: Iris

Internal app for Exquis App Factory. Spec = WHAT to build. Edit freely; then tell Claude "build.md changed, sync the code".
Items marked **(ASSUMPTION)** are defaults Claude chose. Confirm or change them before Stage 1.

## 1. Summary
Iris is the company's internal hub for (a) tickets, (b) managing access to external tools such as GitHub and AWS without leaving the app, (c) team chat, and (d) notifications that also reach people in Discord when they are not logged in. Every employee uses it. Sign-up is limited to verified `@exquisappfactory.com` emails.

## 2. Users and roles
| Role | Can do |
|---|---|
| member (default) | Tickets they created or are assigned, chat, own profile, see own access, connect Discord |
| grantor | Everything a member can, plus grant/revoke access on connected tools (Access page) **(ASSUMPTION: a manager-type role set by an admin)** |
| admin | Everything, plus connect tools (Settings > Integrations), manage roles, deactivate users, view audit log. First admins come from the `ADMIN_EMAILS` env var |

## 3. Features
Priority: MUST / SHOULD / LATER.

| # | Feature | Priority | Rules / notes |
|---|---|---|---|
| 1 | Sign up with work email | MUST | Email must end with `@exquisappfactory.com` (case-insensitive, enforced on the server). Account stays inactive until the emailed link is clicked |
| 2 | Log in / log out | MUST | Email + password. Session 8h |
| 3 | Forgot / reset password | MUST | Emailed one-time link, expires in 1h |
| 4 | Profiles + profile picture | MUST | Name, job title, team, bio, picture (png/jpg/webp, max 2 MB). Visible to everyone. People directory with search |
| 5 | Tickets | MUST | Title, description, assignee, priority, due date, type (General / Access request). Creator is the **assigner** |
| 6 | Ticket status rules | MUST | See section 6 |
| 7 | Dashboard | MUST | Assigned to me, created by me, tickets waiting for my review (highlighted), notification list |
| 8 | In-app notifications | MUST | Bell with unread count; events in section 6 |
| 9 | Ticket comments + history | SHOULD | Comments notify the other party. Status history is recorded |
| 10 | Board view (To Do / In Progress / In Review / Done) | SHOULD | Jira-style columns; drag follows the same status rules |
| 11 | Discord notifications | MUST | Every user can link Discord; the Iris bot DMs them every notification (appears as an "Iris" chat). See section 8 |
| 12 | Integrations settings | MUST | Admin connects tools by entering the credentials each needs. Secrets encrypted, never shown again. "Test connection" button |
| 13 | GitHub integration | MUST | Add person to org, add to repo with a permission level, add to team, remove access, view a person's access |
| 14 | AWS integration | MUST | Manage IAM **group membership**, view a person's groups and attached policies. Direct policy attach is off unless an admin enables it |
| 15 | Access page (grant / revoke) | MUST | Grantor picks tool, person, resource and level, confirms. Optionally linked to a ticket. Everything goes to the audit log |
| 16 | My Access | MUST | Any user sees their live access per tool (which repos and permission, which IAM groups and policies) |
| 17 | Linked accounts | MUST | Each user stores their GitHub username and AWS IAM username. User edits own; grantors can set when granting |
| 18 | Chat: direct messages and group chats | MUST | Real time, history kept, unread counts. Create group, add/remove members, leave group |
| 19 | Online indicator in chat | SHOULD | |
| 20 | Admin: users and roles, deactivate user | SHOULD | Deactivated users cannot log in and their sessions end (needed when someone leaves the company) |
| 21 | Audit log page | SHOULD | Who granted/revoked what, when, for which ticket |
| 22 | Mock integration | MUST | A fake "Mock tool" provider so the full workflow can be built, tested and demoed with no real credentials |
| 23 | More tools (Azure, Google Workspace, Slack, Jira...) | LATER | Added through the provider pattern (see `integration-provider` skill) |
| 24 | Chat attachments, edit/delete messages, search | LATER | |
| 25 | Claude API features, money features | LATER | Out of scope now |

## 4. Screens
- **Auth:** Register, "Check your email", Verify result, Login, Forgot password, Reset password
- **Dashboard:** counters, "Waiting for your review", assigned to me, created by me, recent notifications
- **Tickets:** list with filters (assigned to me / created by me / status / priority) and board view; Create ticket; Ticket detail (fields, status control, comments, history, "Open in Access" button for access requests)
- **Access** (grantor/admin): choose tool > person > resource > level > confirm; revoke
- **My Access:** per tool cards with live data, last checked time, Refresh
- **Chat:** conversation list (DMs and groups, unread badges) + thread + "New message" and "New group"
- **People:** directory and profile page
- **Settings:** My profile, Linked accounts, Notifications (Connect Discord, send test message), Integrations (admin), Users and roles (admin), Audit log (admin)

## 5. Data (main tables)
`users` (email, name, role, active, email_verified_at, avatar_path, title, team, bio) · `auth_tokens` (hashed verify/reset tokens, expiry) · `tickets` · `ticket_comments` · `ticket_events` (status history) · `notifications` · `discord_links` · `conversations` · `conversation_members` · `messages` · `integrations` (provider, encrypted config, status, last_tested_at) · `linked_accounts` (user, provider, external_username) · `access_audit` (actor, target user, provider, action, resource, level, ticket_id, result, time)

## 6. Business rules

### Ticket status
Statuses: To Do, In Progress, In Review, Done. The person who creates a ticket is the **assigner**; the person it is given to is the **assignee**.

| Who | Allowed |
|---|---|
| Assignee (not the assigner) | To Do, In Progress, In Review. **Never Done** |
| Assigner (not the assignee) | Any status. Done only comes from the assigner. Sending a ticket back (In Review > In Progress) or reopening Done is allowed |
| Same person (self-created, assigned to self) | Any status, including Done |
| Admin | No override. Admins cannot set Done on other people's tickets **(ASSUMPTION, for audit integrity)** |

One function, `canTransition(ticket, actor, newStatus)`, enforces this. It is used by the API and the board.

### Notifications
Each one creates an in-app notification and a Discord DM (if the user linked Discord and has not turned it off). Nobody is notified about their own action.

| Event | Who is notified |
|---|---|
| Ticket created / assigned | Assignee |
| Assignee sets In Progress | Assigner |
| Assignee sets In Review | Assigner ("ready for your review") |
| Assigner sets Done | Assignee |
| Assigner sends it back / reopens | Assignee |
| Comment added | The other party |
| Access granted / revoked | The affected person |

### Access
- Only grantors and admins can grant or revoke. Every attempt (success or failure) is written to `access_audit`.
- A grant can reference a ticket ID. If it does, the assigner is told the work is done once the assignee sets In Review.
- Viewing "My Access" always queries the tool live (short cache, 60s) so what the user sees is what the tool really says.
- A person's tool usernames come from `linked_accounts`; if missing, the grantor is asked to enter them.

### Visibility
A ticket is visible to its assigner, its assignee and admins **(ASSUMPTION)**. Chat messages are visible only to conversation members. Profiles are visible to every signed-in user.

## 7. Look and feel
- Clean, modern internal tool. Jira-like tickets and board, WhatsApp/Discord-like chat.
- Screenshots (if any) are in `design/`. Match them closely and improve where something looks better. If there are none, propose a palette and layout for approval before building screens.
- Responsive: works on phone and desktop. Keyboard-friendly and readable contrast.

## 8. Tech constraints and integrations
- **Stack (ASSUMPTION, same as Nova Bank so patterns can be reused):** Node 22, Express, SQLite (WAL mode), Socket.IO, vanilla JS front end with no build step. Move to PostgreSQL later if you need more than one instance.
- **Hosting:** Docker on Ubuntu 24.04 EC2 (t3.small, 20 GiB gp3). `docker-compose.yml` runs the app plus **Caddy** for automatic HTTPS on a company subdomain, for example `iris.exquisappfactory.com` **(ASSUMPTION: HTTPS is required because Iris holds keys to GitHub and AWS)**. A plain `http://IP:3000` test mode is also provided for the first run.
- **Email (verification, resets):** SMTP through nodemailer. Recommended: Amazon SES (verify the domain, leave the sandbox) or Google Workspace SMTP. If SMTP is not configured in development, links are printed to the console.
- **GitHub (GitHub App, recommended over personal tokens):** Settings asks for Organization login, App ID, Installation ID and the private key (.pem). Permissions needed: Organization members (read and write), Administration (repository, read and write, for collaborators), Metadata (read).
- **AWS:** Settings asks for Account ID, Region, auth mode and optionally a Role ARN to assume. Auth mode is either "EC2 instance role" (recommended, no keys stored) or "Access key" (ID and secret). The IAM permissions required are listed in STEPS.md, with a ready-to-paste least-privilege policy.
- **Discord:** a Discord application with a bot in the company server. The bot sends DMs through the REST API (no always-on gateway needed). Users link their account with Discord OAuth2 (`identify` scope). **(ASSUMPTION: every employee joins the company Discord server and allows DMs from server members. Otherwise the bot cannot message them. Fallback: a private channel per user.)**
- **Secrets at rest:** integration credentials are encrypted with AES-256-GCM using `INTEGRATION_ENCRYPTION_KEY`. They are never logged, never returned to the browser. Losing the key means reconnecting the tools.
- **Planned environment variables:**

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT`, `APP_BASE_URL` | Basics. `APP_BASE_URL` is used in email and Discord links |
| `JWT_SECRET`, `INTEGRATION_ENCRYPTION_KEY` | Random secrets (`openssl rand -hex 32`) |
| `ALLOWED_EMAIL_DOMAIN` | Defaults to `exquisappfactory.com` |
| `ADMIN_EMAILS` | Comma-separated emails that become admin at registration |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `DISCORD_REDIRECT_URI` | Discord |
| `COOKIE_SECURE`, `DB_PATH`, `UPLOAD_DIR`, `IRIS_DOMAIN` | Cookies, storage, Caddy domain |

GitHub and AWS credentials are NOT env vars. They are entered in Settings > Integrations and stored encrypted.

## 9. Out of scope (for now)
Claude API features, money features, mobile apps, SSO/SAML, creating brand-new AWS IAM users or GitHub accounts (people must already have them), file attachments in chat.

## 10. Done means
- [ ] All MUST features work and have tests
- [ ] The Adam and Sarah workflow (section 12) passes end to end with the Mock tool, and again with real GitHub and AWS in a test org/account
- [ ] Only `@exquisappfactory.com` emails can register. Unverified accounts cannot log in
- [ ] A member cannot set Done on a ticket assigned to them by someone else (tested)
- [ ] No secret appears in git, logs, API responses or the front end
- [ ] `docker compose up -d --build` works from a clean Ubuntu server and STEPS.md ends with Iris open in the browser

## 11. Build stages
Build one stage at a time. Each ends with a working app, passing tests and a zip checkpoint (chat) or a git commit (Claude Code).

| Stage | Scope | Done when |
|---|---|---|
| 1. Foundation | Skeleton, config, SQLite, register with domain check, email verify, login, reset, roles, profile + picture, people directory, tests | You can register, verify (link in console/email), log in, edit profile, see others |
| 2. Tickets + backups | Create/assign, status rules, comments, history, dashboard, notification bell, board; Litestream to S3, pictures sync, restore script, separate data disk | Rules in section 6 pass their tests; Dashboard shows review requests |
| 3. Chat | DMs, groups, history, unread, online dot | Two browsers can chat live; group add/remove works |
| 4. Discord | Bot DM sender, OAuth link, notification preferences, test message | Ticket events arrive as Discord DMs |
| 5. Access | Provider framework, Mock, GitHub, AWS, encryption, Integrations settings, Access page, My Access, linked accounts, audit log | Adam and Sarah workflow works on Mock, then on real tools |
| 6. Harden + Deploy | Security review, Docker, Caddy HTTPS, INSTRUCTIONS.md, STEPS.md with all prerequisites | A clean EC2 deploy from STEPS.md works |

## 12. Example workflow (must work end to end)
1. Adam needs a GitHub repo. He creates an Access request ticket assigned to his manager Sarah. Adam is the assigner, Sarah the assignee.
2. Sarah gets a bell notification in Iris and a Discord DM from the Iris bot.
3. Sarah (a grantor) opens Access > GitHub, selects Adam, sets his GitHub username if missing, picks the repo and permission, confirms. The audit log records it.
4. Sarah sets the ticket to In Review. Adam gets a notification in Iris and on Discord.
5. Adam opens My Access, sees the repo and permission, and checks GitHub too.
6. Adam sets the ticket to Done. Sarah is notified in Iris and Discord. Sarah cannot set Done herself.

## 13. Decision log
- 2026-11-18: Initial spec written. Assumptions above need confirmation.
- 2026-11-19: Stage 1 built with the defaults above (no changes requested). Choices made while building:
  - Duplicate sign-up with an already verified email returns a clear "account exists" message (better UX; rate limited).
  - Passwords need 10+ characters with a letter and a number.
  - Changing or resetting a password signs out all other sessions; changing a role or deactivating signs that person out immediately.
  - Email links work in `MAIL_MODE=console` (printed in logs) until SMTP is configured. Production refuses to start with no email setup unless `MAIL_MODE=console` is set on purpose.
  - Profile pictures are cropped to a square in the browser and validated again on the server.
  - UI: dark-ink sidebar, spectrum-ring logo, Plus Jakarta Sans (self-hosted), light and dark themes.
- 2026-11-20: Stage 2 built (tickets, notifications, board, backups). Choices made while building:
  - Statuses: todo, in_progress, in_review, done. One `canTransition()` in `src/services/tickets.js`; only `changeStatus()` writes a status.
  - Creator may set any status (including send back and reopen). Assignee may not set Done and cannot change a Done ticket. A self-assigned ticket behaves as creator.
  - Admins can view all tickets (read-only unless they are the creator or assignee). Strangers get 404.
  - Creator can edit and reassign; reassigning logs an event and notifies the new assignee. Only the creator and assignee can comment.
  - `notify()` is the only way to notify; it never notifies the actor and exposes `registerChannel()` for Discord (Stage 4). Channel errors are logged and ignored.
  - Bell polls every 30 s (live push arrives with Socket.IO in Stage 3).
  - Board: drag and drop follows the same rules (invalid columns dim). Every card also has a status menu (keyboard and phone friendly).
  - Access-request tickets store a `provider` (GitHub/AWS/Other) but do not grant anything yet (Stage 5).
  - Backups: Litestream to S3 (1 s sync, 30 days retention), hourly pictures sync, `scripts/restore.sh`, data on a separate EBS disk (delete-on-termination OFF) mounted at /mnt/iris-data via `DATA_DIR`. Docker volume `iris_iris-data` is replaced by a bind mount; STEPS.md has the upgrade-from-Stage-1 copy.
