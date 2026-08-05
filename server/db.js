/*
  SQLite storage. Uses the built-in node:sqlite driver, so no native build step
  and no external database server is required.
*/

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.CHOGAR_DATA_DIR || join(here, 'data');

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, 'chogar.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT    NOT NULL UNIQUE,
    password_hash  TEXT    NOT NULL,
    name           TEXT    NOT NULL,
    email          TEXT    NOT NULL,
    phone          TEXT    NOT NULL DEFAULT '',
    note           TEXT    NOT NULL DEFAULT '',
    role           TEXT    NOT NULL DEFAULT 'student',
    status         TEXT    NOT NULL DEFAULT 'pending',
    level_name     TEXT    NOT NULL DEFAULT 'Beginner — Siu Nim Tau Form',
    level_color    TEXT    NOT NULL DEFAULT '#c9a227',
    level_progress INTEGER NOT NULL DEFAULT 0,
    member_since   TEXT    NOT NULL DEFAULT '',
    next_milestone TEXT    NOT NULL DEFAULT 'First assessment after approval',
    requested_at   TEXT    NOT NULL,
    decided_at     TEXT    NOT NULL DEFAULT '',
    decided_by     TEXT    NOT NULL DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT    PRIMARY KEY,
    member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    trained_on  TEXT    NOT NULL,
    session_name TEXT   NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    sender     TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL
  )
`);

/*
  Password resets. Only the hash of the token is stored, so a stolen database
  cannot be used to take over accounts.
*/
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT    PRIMARY KEY,
    member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at    TEXT    NOT NULL DEFAULT ''
  )
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_members_status ON members(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions(member_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_resets_member ON password_resets(member_id)');

/* Drop expired sessions and reset tokens on startup and hourly afterwards. */
export function purgeExpired() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(Date.now());
}

purgeExpired();
setInterval(purgeExpired, 60 * 60 * 1000).unref();
