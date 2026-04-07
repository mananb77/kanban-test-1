# Technical Design Document — Quick Poll App

**Issue**: #1 — Build App
**Version**: Iteration 3
**Date**: 2026-04-07
**Status**: Draft

---

## 1. Executive Summary

This document describes the complete technical architecture for a **full-stack Quick Poll web application**. The app enables users to create polls with 2–6 options, share them via unique links, vote, and view results as bar charts — all without authentication. The system uses a React (Vite) + Tailwind CSS frontend, a Node.js/Express backend, and SQLite for persistent storage, deployed as a single-server monorepo.

**Key Design Decisions:**
- Monorepo structure with `client/` and `server/` directories
- SQLite via `better-sqlite3` for zero-configuration persistent storage
- Express serves both the REST API and the built React SPA in production
- Pure CSS bar charts (no charting library dependency)
- Single `npm install && npm run build && npm start` command for deployment

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

---

## 4. Foundation Layer

### 4.1 Database Design

> Full details: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

#### Schema

```sql
CREATE TABLE polls (
    id         TEXT PRIMARY KEY,
    question   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE options (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT    NOT NULL,
    label   TEXT    NOT NULL,
    votes   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE INDEX idx_options_poll_id ON options(poll_id);
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

### 4.2 Configuration & Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Express listen port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./polls.db` | SQLite file location |

No `.env` file or secrets management required. All configuration has sensible defaults.

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
1. Validate input (question: non-empty ≤500 chars; options: 2–6, each non-empty ≤200 chars)
2. Generate UUID v4
3. Insert poll + options in a transaction
4. Return created poll with all options (votes = 0)

#### Voting Flow
1. Validate `optionIndex` is an integer
2. Fetch poll and options ordered by `id`
3. Validate `optionIndex` is within bounds [0, options.length - 1]
4. Map index to option's database `id`
5. Execute `UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND id = ?`
6. Return updated poll

#### Poll Retrieval
1. Fetch poll by UUID
2. Return 404 if not found
3. Fetch options ordered by `id`
4. Return assembled poll object

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
```

**Frontend Components:**
- `HomePage` renders `PollForm`
- `PollForm` manages dynamic option inputs with add/remove buttons
- Minimum 2 options enforced (remove button disabled at 2)
- Maximum 6 options enforced (add button hidden at 6)

#### Feature: Voting (Poll Page)

```
User Flow:
  1. User visits /poll/:id (shared link)
  2. Sees question and options as selectable cards/radio buttons
  3. Selects one option
  4. Clicks "Vote"
  5. Frontend POSTs to /api/polls/:id/vote
  6. Results view appears with bar chart
```

**Frontend Components:**
- `PollPage` fetches poll data via GET /api/polls/:id
- `VoteSection` renders options as selectable items
- After voting, switches to `ResultsChart` view
- Vote state stored in component state (not persisted client-side)

#### Feature: Results Display

```
ResultsChart:
  - Horizontal bar chart showing each option with its vote count
  - Bar width proportional to (votes / max_votes * 100)%
  - Implemented with pure CSS (div width + Tailwind)
  - No external charting library needed
```

Example rendering:
```
Pepperoni   ████████████████████  5 votes
Mushrooms   ████████████         3 votes
Pineapple   ████                 1 vote
```

#### Feature: Share Poll

```
CopyLinkButton:
  - Displays current URL (window.location.href)
  - Click copies to clipboard via navigator.clipboard.writeText()
  - Shows brief "Copied!" confirmation
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
- API errors displayed as inline messages
- Network errors shown as a generic "Something went wrong" message
- No error boundaries needed for this simple app (graceful degradation sufficient)

**Global Error Handler (Express):**
```javascript
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
```

### 7.3 Caching Strategy

No caching layer is needed for this application:
- Poll data is small and frequently updated (votes)
- SQLite reads are fast enough for expected load
- No CDN or Redis required

Browser caching for static assets (CSS, JS) is handled automatically by Vite's content-hashed filenames.

---

## 8. Integration Points

### 8.1 External Services

None. The application is entirely self-contained with no external API dependencies.

### 8.2 Internal Services

**Vite Dev Proxy** (development only):
```javascript
// client/vite.config.js
server: {
    proxy: {
        '/api': 'http://localhost:3000'
    }
}
```

In production, the frontend is served by Express — no proxy needed.

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

**Root `package.json` Scripts:**
```json
{
    "scripts": {
        "install": "cd client && npm install && cd ../server && npm install",
        "build": "cd client && npm run build",
        "start": "cd server && node index.js"
    }
}
```

### 9.2 Observability

**Logging:**
- Console-based request logging (`method url → status`)
- Error logging with timestamps
- No structured logging framework needed for this scope

**Health Check:**
```
GET /api/health → { "status": "ok", "timestamp": "..." }
```

### 9.3 Health Checks

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

**Integration Tests:**
- POST /api/polls — 201 with valid data, 400 with invalid
- GET /api/polls/:id — 200 for existing, 404 for missing
- POST /api/polls/:id/vote — 200 increments vote, 400 for bad index, 404 for missing poll

**Manual Test Checklist:**
- [ ] Create poll with 2 options → success
- [ ] Create poll with 6 options → success
- [ ] Create poll with 1 option → validation error
- [ ] Create poll with 7 options → validation error
- [ ] Vote on poll → results update
- [ ] Copy link → clipboard works
- [ ] Open copied link → poll loads
- [ ] Restart server → data persists

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

1. Initialize `server/` directory with `package.json`
2. Set up Express with JSON parsing
3. Initialize SQLite database with schema
4. Implement prepared statements (`queries.js`)
5. Create poll CRUD functions (create, get)
6. Create vote function

**Deliverables**: Working database layer + Express app skeleton

### Phase 2: API Layer
**Dependencies**: Phase 1

1. Implement `POST /api/polls` route with validation
2. Implement `GET /api/polls/:id` route
3. Implement `POST /api/polls/:id/vote` route with validation
4. Add global error handler
5. Add health check endpoint
6. Write integration tests

**Deliverables**: Fully functional REST API

### Phase 3: Frontend Setup
**Dependencies**: None (can parallelize with Phase 2)

1. Initialize `client/` with Vite + React
2. Configure Tailwind CSS
3. Set up React Router
4. Create API client (`api.js`)
5. Set up Vite dev proxy

**Deliverables**: React app skeleton with routing and API client

### Phase 4: Frontend Features
**Dependencies**: Phase 2, Phase 3

1. Build `HomePage` with `PollForm`
2. Build `PollPage` with `VoteSection`
3. Build `ResultsChart` component
4. Build `CopyLinkButton` component
5. Connect all components to API
6. Style with Tailwind CSS

**Deliverables**: Complete, functional UI

### Phase 5: Integration & Polish
**Dependencies**: Phase 4

1. Configure Express to serve built React app
2. Set up root `package.json` scripts
3. Test `npm install && npm run build && npm start` flow
4. Responsive design testing
5. Cross-browser verification
6. Add security headers

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
| Vite build output path mismatch | LOW | LOW | Verify `client/dist/` path in Express static serving config |
| UUID collision | LOW | NEGLIGIBLE | UUID v4 has 2^122 possibilities; practically impossible |

---

## 13. Approval Status

- [ ] Architecture Review
- [ ] Security Review
- [ ] Performance Review
- [ ] Stakeholder Approval

---

## Appendix: File/Directory Structure

```
kanban-test-1/
├── package.json                    # Root scripts: install, build, start
├── README.md
├── ticket.md                       # Original issue description
├── client/
│   ├── package.json                # React + Vite + Tailwind dependencies
│   ├── index.html                  # Vite entry HTML
│   ├── vite.config.js              # Dev proxy + build config
│   ├── tailwind.config.js          # Tailwind configuration
│   ├── postcss.config.js           # PostCSS for Tailwind
│   └── src/
│       ├── main.jsx                # React entry point
│       ├── App.jsx                 # Router setup
│       ├── index.css               # Tailwind imports
│       ├── api.js                  # API fetch wrapper
│       ├── pages/
│       │   ├── HomePage.jsx        # Poll creation page
│       │   └── PollPage.jsx        # Voting + results page
│       └── components/
│           ├── PollForm.jsx        # Dynamic poll form
│           ├── VoteSection.jsx     # Voting interface
│           ├── ResultsChart.jsx    # Bar chart display
│           └── CopyLinkButton.jsx  # Share link button
├── server/
│   ├── package.json                # Express + better-sqlite3 + uuid
│   ├── index.js                    # Express app + middleware + static
│   ├── routes/
│   │   └── polls.js                # Poll API routes
│   ├── db/
│   │   ├── index.js                # DB initialization + connection
│   │   └── queries.js              # Prepared statements
│   ├── middleware/
│   │   └── validate.js             # Input validation
│   └── polls.db                    # SQLite file (runtime, gitignored)
└── docs/
    └── design/
        ├── TDD.md                  # This document
        ├── SYSTEM_ARCHITECTURE.md
        ├── DATABASE_SCHEMA.md
        ├── API_CONTRACTS.md
        ├── SECURITY_DESIGN.md
        └── DEPLOYMENT_STRATEGY.md
```
