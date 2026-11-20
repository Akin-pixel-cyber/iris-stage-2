// SQLite with simple versioned migrations. Add a new string to MIGRATIONS for every schema change; never edit old ones.
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

if (cfg.dbPath !== ':memory:') fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new Database(cfg.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const MIGRATIONS = [
  // 1: users and auth tokens (Stage 1)
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','grantor','admin')),
    active INTEGER NOT NULL DEFAULT 1,
    session_epoch INTEGER NOT NULL DEFAULT 0,
    email_verified_at TEXT,
    avatar_file TEXT,
    title TEXT NOT NULL DEFAULT '',
    team TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('verify','reset')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_tokens_user ON auth_tokens(user_id, type);
  `,
  // 2: tickets, comments, status history, notifications (Stage 2)
  `
  CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general','access')),
    provider TEXT NOT NULL DEFAULT '' CHECK (provider IN ('','github','aws','other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','in_review','done')),
    assigner_id INTEGER NOT NULL REFERENCES users(id),
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    done_at TEXT
  );
  CREATE INDEX idx_tickets_assignee ON tickets(assignee_id, status);
  CREATE INDEX idx_tickets_assigner ON tickets(assigner_id, status);
  CREATE TABLE ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id, id);
  CREATE TABLE ticket_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('created','status','edited','reassigned')),
    from_value TEXT,
    to_value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_events_ticket ON ticket_events(ticket_id, id);
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id INTEGER REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_notif_user ON notifications(user_id, read_at, id);
  `,
];

const current = db.pragma('user_version', { simple: true });
for (let v = current; v < MIGRATIONS.length; v++) {
  db.transaction(() => { db.exec(MIGRATIONS[v]); db.pragma(`user_version = ${v + 1}`); })();
}

module.exports = { db };
