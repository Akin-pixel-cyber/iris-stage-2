# Iris: instructions (Stage 2)

Internal app for Exquis App Factory: tickets, access management for GitHub/AWS, chat, Discord notifications. **This is Stage 2: foundation + tickets + backups.** Chat, Discord and access tools come in Stages 3 to 5 (see `build.md`, section 11).

To deploy, follow **STEPS.md**. This file explains what exists and how it works.

## What Stage 1 and 2 include

| Area | Details |
|---|---|
| Sign-up | Work email only (`@exquisappfactory.com`, checked on the server). Verification link by email (24 h). Account cannot log in until verified |
| Login | Email + password, 8-hour session, rate limits, lock after repeated wrong passwords |
| Password reset | Emailed link (1 h), single use. Resetting or changing a password signs out all other devices |
| Roles | member, grantor, admin. Admins come from `ADMIN_EMAILS` or `npm run make-admin` |
| Admin screen | Settings > Users and roles: change role, deactivate or reactivate. Takes effect immediately |
| Profiles | Name, title, team, bio, profile picture (cropped square in the browser, validated on the server) |
| People | Searchable directory and profile pages |
| Tickets | Create and assign: title, details, assignee, priority, due date, type (General or Access request). The creator is the assigner |
| Status rules | To do, In progress, In review, Done. One function, `canTransition()`, decides (table below) |
| Comments and history | Comments between the two people; every status change, edit and reassignment is logged |
| Board and list | Jira-style board (drag cards, or use the status menu on each card, which also works on phones and with a keyboard) and a list view |
| Dashboard | Assigned to me, created by me, **Waiting for your review** (highlighted), overdue count |
| Notification bell | In-app, unread count, mark read. Checks every 30 seconds (live push comes with chat in Stage 3) |
| Backups | Database copied to S3 about every second (Litestream), pictures hourly, 30 days of history, restore script, separate data disk |
| UI | Responsive (phone to desktop), light and dark mode, keyboard accessible |

## Ticket rules

| Who | May do |
|---|---|
| **Creator (assigner)** | Edit the ticket, reassign it, set **any** status: Done, send back, reopen. If you assign a ticket to yourself you can also mark it Done |
| **Assignee** | Set To do, In progress, In review. **Never Done** on a ticket someone else created. Cannot change a Done ticket (ask the creator to reopen) |
| **Admin** | Can view every ticket (Tickets > Everyone) but has no override: only the creator or assignee can change or comment |
| **Anyone else** | Gets "not found". They cannot see that the ticket exists |

Notifications (in-app; Discord joins in Stage 4): new ticket, reassignment: the assignee. Assignee changes status: the creator ("sent for review" for In review). Creator marks Done, sends back or reopens: the assignee. A comment: the other person. You are never notified about your own actions.

## Project layout

```
src/server.js         starts the server
src/app.js            Express app, security headers, routes
src/config.js         all environment settings
src/db.js             SQLite + migrations (add new ones at the end, never edit old ones)
src/auth.js           session cookie, role checks, CSRF guard
src/routes/           auth.js, users.js (me, people, avatars), admin.js, tickets.js, notifications.js
src/services/         emailDomain.js (the only sign-up domain check), tokens.js, mail.js, avatars.js,
                      tickets.js (ALL ticket rules, canTransition), notify.js (the only way to notify)
scripts/make-admin.js promote an existing user to admin
scripts/restore.sh    restore database + pictures from S3 (see STEPS.md steps 12-13)
litestream/           Litestream config (what is copied to S3, how often, how long kept)
infra/iam-policy.json the small S3 permission the server needs
public/               front end (no build step): index.html, css/app.css, js/*.js, js/views/*.js
                      (views/tickets.js = board, list, new, detail; notifications.js = bell)
test/                 automated tests
design/               screenshots (optional)
```

## Run locally (no Docker)

Requires Node.js 22 or newer.
```bash
npm install
cp .env.example .env     # for local runs set NODE_ENV=development in .env
npm run dev              # http://localhost:3000
npm test
```
In development, emails are not sent: the verification link is shown on the page and printed in the terminal.

## Run with Docker

```bash
cp .env.example .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
docker compose up -d --build
```

## Configuration (.env)

| Variable | Meaning |
|---|---|
| `JWT_SECRET` | Required. `openssl rand -hex 32` |
| `APP_BASE_URL` | Public address, used in emailed links |
| `ALLOWED_EMAIL_DOMAIN` | Default `exquisappfactory.com` |
| `ADMIN_EMAILS` | Emails that become admin on registration |
| `MAIL_MODE` | `console` prints links in the log (testing). Remove it and set `SMTP_*` for real email |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Email sending |
| `COOKIE_SECURE` | `true` only when served over HTTPS |
| `TRUST_PROXY` | `1` only when behind Caddy/Nginx |
| `DATA_DIR` | Folder on the server that holds the database and pictures. Production: the mounted data disk (`/mnt/iris-data`) |
| `DB_PATH`, `UPLOAD_DIR` | Storage paths inside the container. Leave as they are |
| `COMPOSE_PROFILES` | `backup` turns on the S3 backup helpers. Empty = no backups |
| `LITESTREAM_BUCKET`, `LITESTREAM_REGION` | Your S3 bucket and its Region |

## Security design (short)

- The email domain is checked on the server only, and email ownership is proven by the verification link.
- Passwords: bcrypt, 10+ characters with a letter and a number. Reset and verification tokens are random, stored hashed, single use, and expire.
- Cookies: httpOnly, SameSite=Strict. Every non-GET request must send the `X-Requested-With: iris` header (CSRF defence).
- Every request re-checks that the account is still active and verified and that the session was not revoked, so deactivation is immediate.
- Strict Content-Security-Policy (no inline scripts or styles). User text is rendered with `textContent` only.
- Uploads: PNG/JPG/WebP only, 2 MB max, file signature checked, random file names, stored outside `public/`, served only to signed-in users.
- Ticket permissions are checked on the server for every request; ticket IDs in URLs are treated as hostile (strangers get 404).
- Known limits: plain HTTP until Stage 6 (keep the port limited to your IP), one server instance, SQLite database.

## Where the data lives, and how it is protected

```
Your data  ->  /mnt/iris-data  (separate EBS disk, NOT deleted if the server is deleted)
              |-- iris.db      database (users, tickets, comments, notifications)
              `-- uploads/     profile pictures
Protection 1:  Litestream copies every database change to S3 about once per second  (you lose seconds, not a day)
Protection 2:  pictures are copied to S3 every hour (never deleted from the backup)
Protection 3:  S3 keeps 30 days of history, so you can go back in time
```
- **Restart, rebuild, update:** nothing is lost; data is on the disk, not in the container.
- **Server deleted:** attach the old data disk to a new server (STEPS.md step 13A). Nothing to restore.
- **Disk lost too:** `./scripts/restore.sh` rebuilds everything from S3 (step 13B).
- **Go back in time** (for example after a bad change): `./scripts/restore.sh --force --at 2026-11-20T10:00:00Z`. The current data is moved aside first, never deleted.
- **Not in S3:** your `.env` file (secrets). Keep a copy in a password manager. Without `JWT_SECRET` people simply log in again.
- **Max loss:** the last second or so of changes, and pictures uploaded in the last hour.
- **Later:** if Iris outgrows one server, the database can move to RDS and pictures to S3 (a code change, planned for after Stage 6).

## Using this repo with Claude

`CLAUDE.md`, `build.md` and `.claude/` are included. Continue with Stage 3 using the prompts in `KICKOFF-PROMPT.md`.
