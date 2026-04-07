# Database Schema — Quick Poll App

## 1. Overview

- **Engine**: SQLite 3 via `better-sqlite3`
- **File**: `server/polls.db` (created automatically on first run)
- **Access Pattern**: Synchronous, single-connection (appropriate for SQLite)
- **WAL Mode**: Enabled for better read concurrency

## 2. Entity Relationship Diagram

```
┌─────────────────────────────┐       ┌──────────────────────────────────┐
│          polls              │       │           options                │
├─────────────────────────────┤       ├──────────────────────────────────┤
│ id         TEXT    PK       │───┐   │ id         INTEGER  PK AUTOINCR │
│ question   TEXT    NOT NULL │   │   │ poll_id    TEXT     FK NOT NULL  │
│ created_at TEXT    NOT NULL │   └──▶│ label      TEXT     NOT NULL     │
└─────────────────────────────┘       │ votes      INTEGER  DEFAULT 0   │
                                      └──────────────────────────────────┘

                              1:N relationship (one poll has many options)
```

## 3. Table Definitions

### 3.1 `polls` Table

```sql
CREATE TABLE IF NOT EXISTS polls (
    id         TEXT PRIMARY KEY,
    question   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 string (e.g., `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`) |
| `question` | TEXT | NOT NULL | Poll question text |
| `created_at` | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp |

### 3.2 `options` Table

```sql
CREATE TABLE IF NOT EXISTS options (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT    NOT NULL,
    label   TEXT    NOT NULL,
    votes   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-incrementing option ID |
| `poll_id` | TEXT | NOT NULL, FK → polls.id | Reference to parent poll |
| `label` | TEXT | NOT NULL | Option display text |
| `votes` | INTEGER | NOT NULL, DEFAULT 0 | Vote count for this option |

## 4. Indexes

```sql
-- Speed up option lookups by poll_id (used on every poll fetch and vote)
CREATE INDEX IF NOT EXISTS idx_options_poll_id ON options(poll_id);
```

| Index | Table | Column(s) | Rationale |
|-------|-------|-----------|-----------|
| `idx_options_poll_id` | options | poll_id | Every GET /api/polls/:id and vote requires fetching options by poll_id |

The `polls.id` primary key index is automatic. No additional indexes are needed given the simple query patterns.

## 5. Prepared Statements

### 5.1 Create Poll

```sql
INSERT INTO polls (id, question) VALUES (?, ?);
```

### 5.2 Create Option

```sql
INSERT INTO options (poll_id, label) VALUES (?, ?);
```

### 5.3 Get Poll by ID

```sql
SELECT id, question, created_at FROM polls WHERE id = ?;
```

### 5.4 Get Options for Poll

```sql
SELECT id, label, votes FROM options WHERE poll_id = ? ORDER BY id;
```

### 5.5 Cast Vote (Increment)

```sql
UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND id = ?;
```

## 6. Transaction Patterns

### Create Poll (Transactional)

Creating a poll and its options must be atomic:

```javascript
const createPoll = db.transaction((id, question, options) => {
    db.prepare('INSERT INTO polls (id, question) VALUES (?, ?)').run(id, question);
    const insertOption = db.prepare('INSERT INTO options (poll_id, label) VALUES (?, ?)');
    for (const label of options) {
        insertOption.run(id, label);
    }
});
```

### Cast Vote (Single Statement)

Voting is a single UPDATE — no transaction needed, but the query validates both `poll_id` and option `id` in the WHERE clause to prevent voting on non-existent options.

## 7. Database Initialization

On server startup:

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'polls.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
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
```

## 8. Data Integrity

| Constraint | Implementation |
|------------|---------------|
| Poll must have 2-6 options | Enforced at API validation layer (not DB) |
| Question cannot be empty | `NOT NULL` constraint + API validation |
| Option label cannot be empty | `NOT NULL` constraint + API validation |
| Vote count non-negative | Application logic (only increments from 0) |
| Orphan prevention | `ON DELETE CASCADE` on options FK |
| Foreign key enforcement | `PRAGMA foreign_keys = ON` |

## 9. Migration Strategy

For this initial version, schema is created via `CREATE TABLE IF NOT EXISTS` on startup. No migration tool is needed.

If future iterations add columns:

```sql
-- Example: adding a description column
ALTER TABLE polls ADD COLUMN description TEXT DEFAULT '';
```

SQLite supports `ALTER TABLE ... ADD COLUMN` but not `DROP COLUMN` (before 3.35.0). For this simple schema, rebuild-based migration is unlikely to be needed.
