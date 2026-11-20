# Iris

Internal Exquis App Factory app: tickets, access management for GitHub/AWS/etc., team chat, Discord notifications. Full spec: `build.md`. Build in the stages listed there.

## Stack
- Node 22, Express 4, SQLite (better-sqlite3, WAL), Socket.IO, vanilla JS front end (no build step), nodemailer
- Docker Compose on Ubuntu EC2, Caddy for HTTPS

## Commands
- Install: `npm install`
- Dev: `npm run dev` (http://localhost:3000)
- Test: `npm test`
- Docker: `docker compose up -d --build`

## Layout (planned)
- `src/server.js`, `src/config.js`, `src/db.js`
- `src/routes/` auth, users, tickets, chat, access, integrations, admin
- `src/services/` `tickets.js` (canTransition), `notify.js`, `mail.js`, `discord.js`, `crypto.js`, `audit.js`
- `src/integrations/` `index.js` (registry), `mock.js`, `github.js`, `aws.js`
- `src/sockets.js` chat and live notifications
- `public/` front end, `design/` screenshots, `test/`

## Rules
- Read `build.md` first. If a request conflicts with it, say so and ask. Work one stage at a time.
- Run `npm test` after every change and report the result. Never claim something works without running it.
- Email domain check happens on the server only, via `ALLOWED_EMAIL_DOMAIN`. Unverified or deactivated users can never log in.
- Ticket status changes go through ONE function, `canTransition()`. Never change status anywhere else. Assignee can never set Done unless they are also the assigner.
- Every notification goes through `notify()`, which writes the in-app record and queues the Discord DM. A Discord failure must never block the action.
- Every call to an external tool goes through a provider in `src/integrations/` (see `integration-provider` skill). Every grant or revoke writes `access_audit`, success or failure.
- Integration credentials are encrypted at rest (AES-256-GCM), never logged, never sent to the browser, never in git.
- Check permissions on the server for every route (role, ownership, conversation membership). Assume every ID in a URL is hostile.
- Render user text with `textContent`, never `innerHTML` (chat, tickets, profiles).
- Uploads: allow only png/jpg/webp, max 2 MB, verify file signature, random filenames, store outside `public/`.
- Secrets live in `.env` only. Keep `.env.example`, `INSTRUCTIONS.md` and `STEPS.md` current.
- Every repo has `INSTRUCTIONS.md` and `STEPS.md` (prerequisites first, then brief copy-paste steps with versions, every install and config step, every security group rule).
- Keep replies brief and plain. For code changes, show current code next to the replacement. State clearly what you did NOT test.
- No new dependency without saying why.

## Skills (in `.claude/skills/`)
- `add-feature`, `dockerize-and-deploy`, `write-steps-md`, `security-review`, `claude-api-integration` (later)
- `ticket-workflow`: ticket and notification rules with test cases
- `integration-provider`: how to add or change a connected tool (GitHub, AWS, new ones)
- `discord-notifications`: Discord bot DMs and account linking

## Gotchas (add lines when Claude makes a mistake you never want repeated)
- Data lives in `DATA_DIR` on a separate disk (bind mount), backed up by Litestream (SQLite -> S3). Never switch SQLite off WAL mode, never run two app instances on one database, never edit an old migration (append a new one).
- The host data folder must be owned by uid 1000 (the `node` user in the container), or the app cannot write.
- Docker containers can only use the EC2 instance role if the instance metadata hop limit is 2.
- `scripts/restore.sh` must keep working: after any change to storage paths, run the recovery drill from STEPS.md step 12.
- Notifications poll every 30 s until Stage 3 adds Socket.IO. Discord (Stage 4) plugs in through `registerChannel()` in `notify.js`.
- Chat state will live in SQLite (Stage 3), so restarts are safe. Still run one instance.
- Discord can only DM users who share a server with the bot and allow DMs. Handle 403 and 429 gracefully.
- GitHub "invite to org" is pending until the person accepts. Show "invited", not "granted".
