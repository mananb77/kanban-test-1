# System Architecture — Quick Poll App

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React SPA (Vite + Tailwind CSS)                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  Home Page    │  │  Poll Page   │  │  Results View │   │  │
│  │  │  (Create)     │  │  (Vote)      │  │  (Bar Chart) │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │  │
│  │         │                 │                               │  │
│  │         └────────┬────────┘                               │  │
│  │                  │                                        │  │
│  │          React Router (client-side)                       │  │
│  └──────────────────┼────────────────────────────────────────┘  │
│                     │ HTTP (fetch)                               │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      │ JSON over HTTP
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                     │        Server (Node.js + Express)         │
│  ┌──────────────────▼────────────────────────────────────────┐  │
│  │  Express Application                                      │  │
│  │  ┌─────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │  Static Files    │  │  API Router (/api)             │  │  │
│  │  │  Middleware       │  │  ┌──────────────────────────┐ │  │  │
│  │  │  (serves built   │  │  │  POST /api/polls         │ │  │  │
│  │  │   React app)     │  │  │  GET  /api/polls/:id     │ │  │  │
│  │  └─────────────────┘  │  │  POST /api/polls/:id/vote │ │  │  │
│  │                       │  └──────────┬───────────────┘ │  │  │
│  │                       └─────────────┼─────────────────┘  │  │
│  └─────────────────────────────────────┼─────────────────────┘  │
│                                        │                        │
│  ┌─────────────────────────────────────▼─────────────────────┐  │
│  │  Data Access Layer (better-sqlite3)                       │  │
│  │  ┌──────────────┐  ┌──────────────┐                      │  │
│  │  │  polls table  │  │ options table │                      │  │
│  │  └──────────────┘  └──────────────┘                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SQLite Database File (polls.db)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Component Breakdown

### 2.1 Frontend (React SPA)

| Component | Responsibility |
|-----------|---------------|
| `App` | Root component, sets up React Router |
| `HomePage` | Poll creation form with dynamic option inputs |
| `PollPage` | Displays poll question, handles voting, shows results |
| `PollForm` | Reusable form: question input + dynamic options list |
| `VoteSection` | Radio/card selection UI + "Vote" button |
| `ResultsChart` | Horizontal bar chart rendering vote counts |
| `CopyLinkButton` | Copies poll URL to clipboard |
| `api.js` | Centralized fetch wrapper for all API calls |

### 2.2 Backend (Express Server)

| Module | Responsibility |
|--------|---------------|
| `server/index.js` | Express app entry point, middleware setup, static serving |
| `server/routes/polls.js` | API route handlers for poll CRUD + voting |
| `server/db/index.js` | Database initialization, connection management |
| `server/db/queries.js` | Prepared SQL statements for all data operations |
| `server/middleware/validate.js` | Input validation middleware |

### 2.3 Database (SQLite)

- Single file `polls.db` in the `server/` directory
- Two tables: `polls` and `options`
- Synchronous access via `better-sqlite3` (no connection pooling needed)

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend Framework | React 18 (Vite) | Fast dev server, optimized builds, widely adopted |
| Styling | Tailwind CSS 3 | Utility-first, rapid prototyping, no custom CSS needed |
| Client Routing | React Router v6 | Standard React routing solution |
| Backend Runtime | Node.js 18+ | JavaScript full-stack, broad ecosystem |
| Backend Framework | Express 4 | Minimal, well-documented, lightweight |
| Database | SQLite via better-sqlite3 | Zero-config, file-based, perfect for single-server apps |
| UUID Generation | `uuid` package (v4) | Standard RFC 4122 UUIDs for poll IDs |
| Build Tool | Vite 5 | Fast HMR, optimized production builds |

## 4. Data Flow

### 4.1 Create Poll Flow

```
User fills form → POST /api/polls → Validate input
    → INSERT into polls table → INSERT options → Return poll object
    → Frontend redirects to /poll/:id
```

### 4.2 Vote Flow

```
User selects option → POST /api/polls/:id/vote → Validate optionIndex
    → UPDATE options SET votes = votes + 1 → SELECT updated poll
    → Return updated poll with counts → Frontend renders bar chart
```

### 4.3 View Poll Flow

```
User visits /poll/:id → GET /api/polls/:id
    → SELECT poll + JOIN options → Return poll with counts
    → Frontend renders vote form or results
```

## 5. Monorepo Structure

```
kanban-test-1/
├── package.json              # Root: install/build/start scripts
├── client/                   # React frontend
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx          # Entry point
│       ├── App.jsx           # Router setup
│       ├── api.js            # API client
│       ├── pages/
│       │   ├── HomePage.jsx
│       │   └── PollPage.jsx
│       └── components/
│           ├── PollForm.jsx
│           ├── VoteSection.jsx
│           ├── ResultsChart.jsx
│           └── CopyLinkButton.jsx
├── server/
│   ├── package.json
│   ├── index.js              # Express entry point
│   ├── routes/
│   │   └── polls.js          # Poll API routes
│   ├── db/
│   │   ├── index.js          # DB init + connection
│   │   └── queries.js        # Prepared statements
│   ├── middleware/
│   │   └── validate.js       # Input validation
│   └── polls.db              # SQLite file (created at runtime)
└── docs/
    └── design/
        └── TDD.md
```

## 6. Production Serving Model

In production mode, Express serves:
1. The built React SPA from `client/dist/` as static files
2. The REST API under `/api/*`
3. A catch-all route that serves `index.html` for client-side routing

```
Express Middleware Stack:
  1. express.json()           — Parse JSON bodies
  2. /api/*                   — API routes (handled first)
  3. express.static()         — Serve built frontend
  4. Catch-all → index.html   — SPA fallback for client routes
```

## 7. Key Architecture Decisions

| Decision | Choice | Alternative Considered | Rationale |
|----------|--------|----------------------|-----------|
| Database | SQLite (embedded) | PostgreSQL | Zero config, no external deps, persists to file, sufficient for single-server |
| API Style | REST | GraphQL | Simple CRUD operations, 3 endpoints, no complex querying needed |
| Monorepo | Flat (client/ + server/) | Turborepo/Nx | Only 2 packages, no need for monorepo tooling overhead |
| State Management | React useState/useEffect | Redux/Zustand | Minimal state (form data, poll data), no shared global state needed |
| Styling | Tailwind CSS | CSS Modules, Styled Components | Rapid prototyping, consistent design, no custom CSS maintenance |
| Chart Rendering | Pure CSS/HTML bars | Chart.js, D3 | Simple horizontal bars don't need a charting library |
