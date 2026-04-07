const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'polls.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
        id         TEXT PRIMARY KEY,
        question   TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS options (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id TEXT    NOT NULL,
        label   TEXT    NOT NULL,
        votes   INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_options_poll_id ON options(poll_id);
`);

function initDb() {
    // Database is initialized on module load above.
    // This function exists as an explicit lifecycle hook.
}

module.exports = { db, initDb };
