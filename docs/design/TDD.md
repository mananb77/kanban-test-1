# Technical Design Document — Quick Poll App

**Issue**: #1 — Build App
**Version**: Iteration 4
**Date**: 2026-04-07
**Status**: Implementation-Ready

---

## 1. Executive Summary

This document describes the complete technical architecture for a **full-stack Quick Poll web application**. The app enables users to create polls with 2–6 options, share them via unique links, vote, and view results as bar charts — all without authentication. The system uses a React (Vite) + Tailwind CSS frontend, a Node.js/Express backend, and SQLite for persistent storage, deployed as a single-server monorepo.

**Key Design Decisions:**
- Monorepo structure with `client/` and `server/` directories
- SQLite via `better-sqlite3` for zero-configuration persistent storage
- Express serves both the REST API and the built React SPA in production
- Pure CSS bar charts (no charting library dependency)
- Single `npm install && npm run build && npm start` command for deployment

**Iteration 4 Changes:**
- Resolved root `package.json` script design to ensure `npm install && npm run build && npm start` works correctly
- Specified exact Express middleware ordering to prevent route conflicts
- Added complete `validateVote` middleware specification
- Fixed `created_at` format inconsistency between SQLite and API responses
- Added `.gitignore` specification
- Completed Vite config with all required imports and plugins
- Enumerated exact package dependencies for `client/` and `server/`
- Specified frontend loading states, error UI, and 404 handling
- Declared design **implementation-ready** with recommendation to transition to development phase

---

## 2. Requirements Analysis

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Create poll with question + 2–6 options | MUST |
| FR-2 | Generate unique shareable link per poll | MUST |
| FR-3 | Vote on a poll by selecting an option | MUST |
| FR-4 | View vote results as a bar chart after voting | MUST |
| FR-5 | Copy poll link to clipboard | MUST |
| FR-6 | Persist data across server restarts | MUST |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Single-command startup | `npm install && npm run build && npm start` |
| NFR-2 | Responsive UI | Mobile and desktop |
| NFR-3 | Input validation | Server-side on all endpoints |
| NFR-4 | Clean, modern UI | Tailwind CSS styling |

### 2.3 Explicit Out of Scope

- User authentication / accounts
- Real-time WebSocket updates (manual refresh is acceptable)
- Deployment / CI/CD configuration
- Rate limiting or duplicate vote prevention

### 2.4 Business Constraints

- Test harness for agent-driven development workflows
- Must be completable in a single sprint
- No external database infrastructure required

---

## 3. System Architecture

> Full details: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

### 3.1 High-Level Architecture

```
Browser (React SPA)
    │
    │  HTTP/JSON
    │
Express Server (Node.js)
    ├── /api/*        → REST API routes
    ├── /static/*     → Built React app
    └── /*            → SPA fallback (index.html)
    │
SQLite Database (polls.db)
```

The architecture is a classic **single-server monolith** — the simplest viable pattern for this scope. Express handles both API requests and static file serving, eliminating the need for a reverse proxy.

### 3.2 Component Breakdown

**Frontend Components:**
- `App` — React Router setup, top-level layout
- `HomePage` — Poll creation form
- `PollPage` — Voting interface + results display
- `PollForm` — Dynamic form (question + option inputs)
- `VoteSection` — Option selection + vote button
- `ResultsChart` — CSS-based horizontal bar chart
- `CopyLinkButton` — Clipboard API integration
- `api.js` — Centralized fetch wrapper

**Backend Modules:**
- `server/index.js` — Express app, middleware, static serving
- `server/routes/polls.js` — API route handlers
- `server/db/index.js` — Database initialization
- `server/db/queries.js` — Prepared SQL statements
- `server/middleware/validate.js` — Input validation

### 3.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.x |
| Build Tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.x |
| Routing (client) | React Router | 6.x |
| Backend | Node.js + Express | 18+ / 4.x |
| Database | SQLite (better-sqlite3) | Latest |
| UUID | `uuid` package | v4 |

### 3.4 Package Dependencies

**Root `package.json`** — No runtime dependencies. Only scripts.

**`client/package.json` dependencies:**
| Package | Type | Purpose |
|---------|------|---------|
| `react` | dependency | UI library |
| `react-dom` | dependency | React DOM renderer |
| `react-router-dom` | dependency | Client-side routing |
| `@vitejs/plugin-react` | devDependency | Vite React plugin |
| `vite` | devDependency | Build tool / dev server |
| `tailwindcss` | devDependency | Utility-first CSS |
| `postcss` | devDependency | CSS processing |
| `autoprefixer` | devDependency | Vendor prefix automation |

**`server/package.json` dependencies:**
| Package | Type | Purpose |
|---------|------|---------|
| `express` | dependency | HTTP framework |
| `better-sqlite3` | dependency | SQLite driver |
| `uuid` | dependency | UUID v4 generation |

---

## 4. Foundation Layer

### 4.1 Database Design

> Full details: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

#### Schema

```sql
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
```

#### Key Design Decisions

- **UUID v4 for poll IDs**: Unpredictable, shareable, no enumeration attacks
- **INTEGER AUTOINCREMENT for option IDs**: Simple, ordered, used internally only
- **WAL journal mode**: Better read concurrency for simultaneous poll viewers
- **Foreign keys enabled**: `PRAGMA foreign_keys = ON` for referential integrity
- **ON DELETE CASCADE**: Deleting a poll removes its options automatically

#### Transaction Pattern

Poll creation (INSERT poll + INSERT options) is wrapped in a `better-sqlite3` transaction to ensure atomicity:

```javascript
const createPoll = db.transaction((id, question, options) => {
    insertPoll.run(id, question);
    for (const label of options) {
        insertOption.run(id, label);
    }
});
```

#### `created_at` Format Handling

SQLite's `datetime('now')` produces `YYYY-MM-DD HH:MM:SS` (UTC, no timezone suffix). The API response must return ISO 8601 format. The server formats this on read:

```javascript
// In the poll assembly function (queries.js or route handler)
function formatPoll(row, options) {
    return {
        id: row.id,
        question: row.question,
        options: options.map(o => ({ id: o.id, label: o.label, votes: o.votes })),
        created_at: row.created_at.replace(' ', 'T') + 'Z'
    };
}
```

This converts `"2026-04-07 20:00:00"` → `"2026-04-07T20:00:00Z"`. Since `datetime('now')` always produces UTC, the `Z` suffix is correct.

### 4.2 Configuration & Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Express listen port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./polls.db` | SQLite file location (relative to `server/`) |

No `.env` file or secrets management required. All configuration has sensible defaults.

### 4.3 `.gitignore` Specification

**Root `.gitignore`:**
```
node_modules/
client/dist/
server/polls.db
server/polls.db-wal
server/polls.db-shm
```

This ensures:
- No `node_modules` are committed (any level)
- The Vite build output is not committed
- The SQLite database and its WAL/SHM journal files are excluded

---

## 5. Core Infrastructure

### 5.1 Authentication & Authorization

**Not applicable.** The application is explicitly public with no user accounts. All endpoints are unauthenticated by design (per requirements).

### 5.2 API Contracts

> Full details: [API_CONTRACTS.md](./API_CONTRACTS.md)

#### Endpoints Summary

| Method | Path | Description | Status Codes |
|--------|------|-------------|-------------|
| POST | `/api/polls` | Create a new poll | 201, 400 |
| GET | `/api/polls/:id` | Get poll with vote counts | 200, 404 |
| POST | `/api/polls/:id/vote` | Cast a vote | 200, 400, 404 |
| GET | `/api/health` | Health check | 200 |

#### Request/Response Examples

**Create Poll:**
```
POST /api/polls
{ "question": "Best pizza topping?", "options": ["Pepperoni", "Mushrooms", "Pineapple"] }

→ 201 { "id": "uuid", "question": "...", "options": [...], "created_at": "..." }
```

**Vote:**
```
POST /api/polls/:id/vote
{ "optionIndex": 0 }

→ 200 { "id": "uuid", "question": "...", "options": [...], "created_at": "..." }
```

**Error Shape:**
```json
{ "error": "Human-readable error message" }
```

---

## 6. Core Functionality

### 6.1 Domain Logic

#### Poll Creation Flow
1. Validate input (question: non-empty, trimmed, ≤500 chars; options: 2–6, each non-empty, trimmed, ≤200 chars)
2. Generate UUID v4
3. Insert poll + options in a transaction
4. Return created poll with all options (votes = 0)

#### Voting Flow
1. Validate `optionIndex` is present and is an integer (`Number.isInteger()`)
2. Fetch poll by UUID — return 404 if not found
3. Fetch options ordered by `id`
4. Validate `optionIndex` is within bounds `[0, options.length - 1]`
5. Map index to option's database `id`: `const targetOptionId = options[optionIndex].id`
6. Execute `UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND id = ?`
7. Verify the UPDATE affected exactly 1 row (`changes === 1`)
8. Re-fetch and return updated poll

#### Poll Retrieval
1. Fetch poll by UUID
2. Return 404 if not found
3. Fetch options ordered by `id`
4. Format `created_at` to ISO 8601 (`"...T...Z"`)
5. Return assembled poll object

### 6.2 Primary Features

#### Feature: Poll Creation (Home Page)

```
User Flow:
  1. User visits / (home page)
  2. Enters a poll question
  3. Adds 2–6 answer options (dynamic add/remove)
  4. Clicks "Create Poll"
  5. Frontend POSTs to /api/polls
  6. On success, redirects to /poll/:id
  7. On error, displays validation error inline
```

**Frontend Components:**
- `HomePage` renders `PollForm`
- `PollForm` manages dynamic option inputs with add/remove buttons
- Minimum 2 options enforced (remove button disabled at 2)
- Maximum 6 options enforced (add button hidden at 6)
- Client-side validation mirrors server rules (non-empty question, 2–6 non-empty options)
- Submit button shows loading spinner/disabled state while API call is in-flight
- Validation errors from the server are displayed below the form

#### Feature: Voting (Poll Page)

```
User Flow:
  1. User visits /poll/:id (shared link)
  2. Loading spinner shown while fetching poll data
  3. If poll not found (404), show "Poll not found" message with link to home page
  4. Sees question and options as selectable cards/radio buttons
  5. Selects one option
  6. Clicks "Vote"
  7. Vote button disabled while API call is in-flight
  8. Frontend POSTs to /api/polls/:id/vote
  9. Results view appears with bar chart
  10. If API error, display error message inline
```

**Frontend Components:**
- `PollPage` fetches poll data via GET `/api/polls/:id` on mount
- Shows loading state (spinner or skeleton) while fetch is pending
- Shows "Poll not found" with navigation link if 404 is returned
- `VoteSection` renders options as selectable items (radio buttons or card-style)
- After voting, switches to `ResultsChart` view
- Vote state stored in component state (not persisted client-side)

#### Feature: Results Display

```
ResultsChart:
  - Horizontal bar chart showing each option with its vote count
  - Bar width proportional to (votes / max_votes * 100)%
  - If all votes are 0, all bars show 0% width
  - Implemented with pure CSS (div width + Tailwind)
  - Each bar shows: option label, colored bar, vote count
  - Total votes displayed at the bottom
```

Example rendering:
```
Pepperoni   ████████████████████  5 votes
Mushrooms   ████████████         3 votes
Pineapple   ████                 1 vote
                              Total: 9 votes
```

**Bar width calculation:**
```javascript
const maxVotes = Math.max(...options.map(o => o.votes), 1); // Avoid division by 0
const widthPercent = (option.votes / maxVotes) * 100;
```

#### Feature: Share Poll

```
CopyLinkButton:
  - Displays current URL (window.location.href)
  - Click copies to clipboard via navigator.clipboard.writeText()
  - Shows brief "Copied!" confirmation (2 seconds, then reverts)
  - Fallback for older browsers: select + document.execCommand('copy')
```

---

## 7. Cross-Cutting Concerns

### 7.1 Security Hardening

> Full details: [SECURITY_DESIGN.md](./SECURITY_DESIGN.md)

| Concern | Approach |
|---------|----------|
| SQL Injection | Parameterized queries via `better-sqlite3` prepared statements |
| XSS | React auto-escaping; never use `dangerouslySetInnerHTML` |
| Input Validation | Server-side on all POST endpoints |
| Body Size Limit | `express.json({ limit: '1mb' })` |
| Error Sanitization | Generic 500 messages; no stack traces in responses |
| Security Headers | `X-Content-Type-Options`, `X-Frame-Options` |

### 7.2 Error Handling

**API Error Strategy:**
- Validation errors → `400` with specific message
- Not found → `404` with `"Poll not found"`
- Unexpected errors → `500` with `"Internal server error"` (details logged server-side)

**Frontend Error Strategy:**
- API errors displayed as inline messages below the relevant form/section
- Network errors shown as "Something went wrong. Please try again."
- Loading states shown while API calls are in-flight (disabled buttons, spinner)
- 404 poll page shows a friendly "Poll not found" message with link to create a new poll

**Global Error Handler (Express):**
```javascript
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} ERROR:`, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
```

### 7.3 Input Validation Middleware — Complete Specification

**`server/middleware/validate.js` exports two functions:**

```javascript
function validateCreatePoll(req, res, next) {
    const { question, options } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required' });
    }
    if (question.trim().length > 500) {
        return res.status(400).json({ error: 'Question must be 500 characters or fewer' });
    }
    if (!Array.isArray(options)) {
        return res.status(400).json({ error: 'Options must be an array' });
    }
    if (options.length < 2) {
        return res.status(400).json({ error: 'At least 2 options are required' });
    }
    if (options.length > 6) {
        return res.status(400).json({ error: 'No more than 6 options are allowed' });
    }
    for (const opt of options) {
        if (!opt || typeof opt !== 'string' || opt.trim().length === 0) {
            return res.status(400).json({ error: 'All options must be non-empty strings' });
        }
        if (opt.trim().length > 200) {
            return res.status(400).json({ error: 'Each option must be 200 characters or fewer' });
        }
    }

    // Normalize trimmed values onto req.body
    req.body.question = question.trim();
    req.body.options = options.map(o => o.trim());
    next();
}

function validateVote(req, res, next) {
    const { optionIndex } = req.body;

    if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ error: 'optionIndex is required and must be a number' });
    }
    if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex)) {
        return res.status(400).json({ error: 'optionIndex is required and must be a number' });
    }
    if (optionIndex < 0) {
        return res.status(400).json({ error: 'Invalid option index' });
    }
    // Upper-bound check (optionIndex < options.length) happens in the route handler
    // because it requires fetching the poll from the database
    next();
}

module.exports = { validateCreatePoll, validateVote };
```

### 7.4 Caching Strategy

No caching layer is needed for this application:
- Poll data is small and frequently updated (votes)
- SQLite reads are fast enough for expected load
- No CDN or Redis required

Browser caching for static assets (CSS, JS) is handled automatically by Vite's content-hashed filenames.

---

## 8. Integration Points

### 8.1 External Services

None. The application is entirely self-contained with no external API dependencies.

### 8.2 Vite Configuration — Complete Specification

**`client/vite.config.js`:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
```

- The `react()` plugin enables JSX transform and React Fast Refresh in dev mode
- The proxy forwards `/api` requests from Vite's dev server (port 5173) to Express (port 3000)
- In production, the proxy is not used — Express serves everything
- Default build output is `client/dist/` (Vite default, no override needed)

**`client/tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
};
```

**`client/postcss.config.js`:**
```javascript
export default {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
    },
};
```

**`client/src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 9. Operational Readiness

### 9.1 Deployment Architecture

> Full details: [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md)

**Single-Server Deployment:**
- Express serves API + static files on one port
- SQLite database file on local disk
- No external infrastructure dependencies

**Startup Command:**
```bash
npm install && npm run build && npm start
```

### 9.2 Root `package.json` — Complete Specification

The root `package.json` must support the acceptance criteria command `npm install && npm run build && npm start`. Here is the exact file:

```json
{
    "name": "quick-poll-app",
    "version": "1.0.0",
    "private": true,
    "description": "A full-stack quick poll application",
    "scripts": {
        "postinstall": "cd client && npm install && cd ../server && npm install",
        "build": "cd client && npm run build",
        "start": "cd server && node index.js",
        "dev": "cd server && node index.js"
    }
}
```

**How it works:**
1. `npm install` — Installs root-level deps (none), then npm automatically runs `postinstall` which installs `client/` and `server/` dependencies
2. `npm run build` — Runs Vite production build in `client/`, outputs to `client/dist/`
3. `npm start` — Starts Express in `server/`, which serves both the API and the built frontend

**Why `postinstall` instead of overriding `install`:**
- npm's `install` lifecycle hook is reserved and cannot be overridden as a custom script
- `postinstall` runs automatically after `npm install` completes, which is the correct lifecycle hook for cascading installs

### 9.3 Express Middleware Ordering — Complete Specification

The exact ordering of Express middleware in `server/index.js` is critical to avoid route conflicts:

```javascript
const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const pollRoutes = require('./routes/polls');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. JSON body parsing (must be first)
app.use(express.json({ limit: '1mb' }));

// 2. Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// 3. Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// 4. API routes (MUST come before static files and SPA fallback)
app.use('/api', pollRoutes);

// 5. Health check (part of API, but listed explicitly for clarity)
// Note: This is defined inside pollRoutes or as a separate route:
// app.get('/api/health', (req, res) => { ... });

// 6. Static file serving (serves built React app)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// 7. SPA fallback — MUST be last GET handler
// Serves index.html for all non-API, non-static-file routes (client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

// 8. Global error handler (Express error middleware — 4 params)
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} ERROR:`, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database, then start listening
initDb();
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

**Critical ordering rules:**
- API routes (step 4) MUST precede static serving (step 6) and SPA fallback (step 7)
- Static serving (step 6) MUST precede SPA fallback (step 7) — Express will serve actual files first, then fall through to the catch-all
- The global error handler (step 8) MUST be last — Express identifies error middleware by its 4-parameter signature

### 9.4 Observability

**Logging:**
- Console-based request logging (`timestamp method url`)
- Error logging with timestamps and stack traces (server-side only)
- No structured logging framework needed for this scope

**Health Check:**
```
GET /api/health → { "status": "ok", "timestamp": "..." }
```

### 9.5 Health Checks

| Check | Endpoint | Expected |
|-------|----------|----------|
| API Health | GET /api/health | `{ "status": "ok" }` |
| DB Health | (part of health endpoint) | Implicit — if API responds, DB is accessible |

---

## 10. Quality Assurance

### 10.1 Testing Strategy

| Level | Scope | Tool | Priority |
|-------|-------|------|----------|
| Unit | DB queries, validation logic | Vitest / Jest | HIGH |
| Integration | API endpoint behavior | Supertest + Express | HIGH |
| E2E | Full user flows (create, vote, view) | Manual / Playwright | MEDIUM |

**Key Test Cases:**

**Unit Tests:**
- `createPoll()` — creates poll + options atomically
- `getPoll()` — returns poll with options; returns null for missing
- `castVote()` — increments correct option; rejects invalid index
- `validateCreatePoll()` — rejects bad input, passes good input
- `validateVote()` — rejects missing, non-integer, and negative `optionIndex`

**Integration Tests:**
- POST /api/polls — 201 with valid data, 400 with invalid
- POST /api/polls — 400 when question is empty string / whitespace-only
- POST /api/polls — 400 when options has 1 item or 7 items
- POST /api/polls — 400 when an option is empty string
- GET /api/polls/:id — 200 for existing, 404 for missing
- GET /api/polls/:id — returns correct `created_at` format (ISO 8601 with Z)
- POST /api/polls/:id/vote — 200 increments vote, 400 for bad index, 404 for missing poll
- POST /api/polls/:id/vote — 400 when optionIndex is a float (e.g., 1.5)
- POST /api/polls/:id/vote — 400 when optionIndex is a string
- POST /api/polls/:id/vote — 400 when optionIndex is negative
- GET /api/health — 200 with status "ok"

**Manual Test Checklist:**
- [ ] Create poll with 2 options → success
- [ ] Create poll with 6 options → success
- [ ] Create poll with 1 option → validation error
- [ ] Create poll with 7 options → validation error
- [ ] Create poll with empty question → validation error
- [ ] Create poll with whitespace-only option → validation error
- [ ] Vote on poll → results update immediately
- [ ] Copy link → clipboard works
- [ ] Open copied link in new tab → poll loads
- [ ] Restart server → previously created poll data persists
- [ ] Visit non-existent poll ID → "Poll not found" message shown
- [ ] `npm install && npm run build && npm start` from root → app accessible on port 3000
- [ ] Navigate to `/` → home page loads
- [ ] Navigate to `/poll/nonexistent` → 404 message shown with link to home

### 10.2 Performance Targets

| Metric | Target |
|--------|--------|
| API response time (create/vote/get) | < 50ms |
| Page load (production build) | < 2s |
| SQLite query time | < 10ms |
| Bundle size (gzipped) | < 200 KB |

These targets are easily achievable given the simple data model and SQLite's performance characteristics.

---

## 11. Implementation Plan

### Phase 1: Foundation (Server + Database)
**Dependencies**: None

1. Initialize `server/` directory with `package.json` (`express`, `better-sqlite3`, `uuid`)
2. Create `server/db/index.js` — SQLite initialization with WAL mode, foreign keys, table creation
3. Create `server/db/queries.js` — Prepared statements for all operations (create poll, get poll, get options, cast vote)
4. Create `server/middleware/validate.js` — `validateCreatePoll` and `validateVote` functions
5. Create `server/index.js` — Express app skeleton with JSON parsing and middleware ordering

**Deliverables**: Working database layer + Express app skeleton

### Phase 2: API Layer
**Dependencies**: Phase 1

1. Create `server/routes/polls.js` — Route handlers:
   - `POST /polls` with `validateCreatePoll` middleware
   - `GET /polls/:id`
   - `POST /polls/:id/vote` with `validateVote` middleware
   - `GET /health`
2. Wire routes into `server/index.js` as `app.use('/api', pollRoutes)`
3. Add global error handler
4. Implement `formatPoll()` helper (converts `created_at` to ISO 8601)
5. Test all endpoints with curl or similar

**Deliverables**: Fully functional REST API

### Phase 3: Frontend Setup
**Dependencies**: None (can parallelize with Phase 1 & 2)

1. Initialize `client/` with Vite + React (`npm create vite@latest client -- --template react`)
2. Install `tailwindcss`, `postcss`, `autoprefixer` as devDependencies
3. Install `react-router-dom` as dependency
4. Create `vite.config.js` with React plugin and `/api` proxy
5. Create `tailwind.config.js` and `postcss.config.js`
6. Create `src/index.css` with Tailwind directives
7. Create `src/App.jsx` with React Router routes (`/` and `/poll/:id`)
8. Create `src/api.js` — Centralized fetch wrapper

**Deliverables**: React app skeleton with routing and API client

### Phase 4: Frontend Features
**Dependencies**: Phase 2, Phase 3

1. Build `HomePage` with `PollForm` — dynamic option inputs, form submission, error display
2. Build `PollPage` — fetch poll on mount, loading state, 404 handling
3. Build `VoteSection` — option selection as radio buttons/cards, vote submission
4. Build `ResultsChart` — pure CSS horizontal bar chart with vote counts
5. Build `CopyLinkButton` — clipboard API with "Copied!" feedback
6. Style all components with Tailwind CSS (responsive, clean, modern)

**Deliverables**: Complete, functional UI

### Phase 5: Integration & Polish
**Dependencies**: Phase 4

1. Create root `package.json` with `postinstall`, `build`, `start` scripts
2. Create root `.gitignore` (node_modules, client/dist, polls.db)
3. Add `express.static()` and SPA fallback in `server/index.js`
4. Add security headers middleware
5. Test full `npm install && npm run build && npm start` flow end-to-end
6. Responsive design testing (mobile + desktop)
7. Verify all acceptance criteria are met

**Deliverables**: Production-ready application

### Implementation Order Diagram

```
Phase 1 (Foundation) ──→ Phase 2 (API) ──┐
                                          ├──→ Phase 4 (Frontend Features) ──→ Phase 5 (Integration)
Phase 3 (Frontend Setup) ────────────────┘
```

---

## 12. Risks and Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| SQLite file corruption | HIGH | LOW | WAL mode + periodic backups |
| Vote manipulation (no duplicate prevention) | LOW | MEDIUM | Explicitly out of scope; document for future work |
| Large number of concurrent voters | MEDIUM | LOW | SQLite handles moderate concurrency; upgrade to PostgreSQL if needed |
| Vite build output path mismatch | LOW | LOW | Verify `client/dist/` path in Express static serving config; Vite defaults to `dist/` |
| UUID collision | LOW | NEGLIGIBLE | UUID v4 has 2^122 possibilities; practically impossible |
| `postinstall` script failure in CI | LOW | LOW | Each sub-install is a standard `npm install`; will fail fast with clear error |
| SPA fallback serving API-like paths | LOW | LOW | API routes are registered before SPA fallback; route ordering prevents this |

---

## 13. Frontend API Client — Complete Specification

**`client/src/api.js`:**
```javascript
const API_BASE = '/api';

export async function createPoll(question, options) {
    const res = await fetch(`${API_BASE}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create poll');
    return data;
}

export async function getPoll(id) {
    const res = await fetch(`${API_BASE}/polls/${id}`);
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch poll');
    return data;
}

export async function castVote(id, optionIndex) {
    const res = await fetch(`${API_BASE}/polls/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cast vote');
    return data;
}
```

---

## 14. Acceptance Criteria Traceability

| # | Criterion | Covered By |
|---|-----------|------------|
| AC-1 | `npm install && npm run build && npm start` starts the full app on a single port | Section 9.2 (root package.json with postinstall), Section 9.3 (middleware ordering) |
| AC-2 | A user can create a poll with a question and 2–6 options | Section 6.2 (Poll Creation), Section 7.3 (validation), API POST /api/polls |
| AC-3 | A user can vote on a poll and immediately see updated results | Section 6.2 (Voting + Results Display), API POST /api/polls/:id/vote |
| AC-4 | A user can share a poll link and another user can vote on it | Section 6.2 (Share Poll / CopyLinkButton), React Router /poll/:id |
| AC-5 | Poll data persists across server restarts (SQLite file on disk) | Section 4.1 (SQLite schema), Section 4.2 (DB_PATH) |
| AC-6 | The UI is responsive and visually clean | Section 3.3 (Tailwind CSS), Section 6.2 (responsive design), Phase 5 step 6 |

---

## 15. Recommendation

**This design is implementation-ready.** All 6 acceptance criteria are fully addressed, all edge cases are specified, and the implementation plan provides unambiguous guidance for developers.

**Recommendation: Transition to development phase.**

---

## 16. Approval Status

- [x] Architecture Review (Iteration 3 — score 95/100)
- [x] Architecture Refinement (Iteration 4 — gaps closed)
- [ ] Security Review
- [ ] Performance Review
- [ ] Stakeholder Approval

---

## Appendix A: File/Directory Structure

```
kanban-test-1/
├── .gitignore                      # Excludes node_modules, dist, polls.db
├── package.json                    # Root scripts: postinstall, build, start
├── README.md
├── ticket.md                       # Original issue description
├── client/
│   ├── package.json                # React + Vite + Tailwind dependencies
│   ├── index.html                  # Vite entry HTML
│   ├── vite.config.js              # React plugin + dev proxy
│   ├── tailwind.config.js          # Tailwind content paths
│   ├── postcss.config.js           # PostCSS for Tailwind + autoprefixer
│   └── src/
│       ├── main.jsx                # React entry point (renders App into #root)
│       ├── App.jsx                 # Router setup: / → HomePage, /poll/:id → PollPage
│       ├── index.css               # Tailwind directives (@tailwind base/components/utilities)
│       ├── api.js                  # Centralized API fetch wrapper
│       ├── pages/
│       │   ├── HomePage.jsx        # Poll creation page
│       │   └── PollPage.jsx        # Voting + results page
│       └── components/
│           ├── PollForm.jsx        # Dynamic poll form (question + 2-6 options)
│           ├── VoteSection.jsx     # Voting interface (radio/cards + vote button)
│           ├── ResultsChart.jsx    # Pure CSS horizontal bar chart
│           └── CopyLinkButton.jsx  # Share link button with clipboard API
├── server/
│   ├── package.json                # Express + better-sqlite3 + uuid
│   ├── index.js                    # Express app + middleware ordering + static serving
│   ├── routes/
│   │   └── polls.js                # Poll API routes + health check
│   ├── db/
│   │   ├── index.js                # DB initialization (WAL mode, FK, schema creation)
│   │   └── queries.js              # Prepared statements + formatPoll helper
│   ├── middleware/
│   │   └── validate.js             # validateCreatePoll + validateVote
│   └── polls.db                    # SQLite file (created at runtime, gitignored)
└── docs/
    └── design/
        ├── TDD.md                  # This document
        ├── SYSTEM_ARCHITECTURE.md
        ├── DATABASE_SCHEMA.md
        ├── API_CONTRACTS.md
        ├── SECURITY_DESIGN.md
        └── DEPLOYMENT_STRATEGY.md
```

## Appendix B: Complete Client Route Setup

```jsx
// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PollPage from './pages/PollPage';

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-gray-50">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/poll/:id" element={<PollPage />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
```

```jsx
// client/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```
