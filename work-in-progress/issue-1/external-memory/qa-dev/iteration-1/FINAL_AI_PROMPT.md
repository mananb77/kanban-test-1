# DEBUG: Final AI Prompt

> **Generated**: 2026-04-08T22:33:44.366Z
> **Role**: qa-engineer-ai
> **Iteration**: 1
> **Total Characters**: 8348

---



## MANDATORY SPECIAL INSTRUCTIONS (FROM WORKFLOW INPUT)

**YOU MUST FOLLOW THESE INSTRUCTIONS - THEY OVERRIDE DEFAULT BEHAVIOR**

## QA Focus Areas for Quick Poll App

### Priority 1: Functional Verification
- **End-to-end flow**: Create poll → share link → vote → view results bar chart
- **Boundary testing**: Verify 2-option minimum and 6-option maximum enforcement
- **Input validation**: Test all validation rules (empty question, whitespace-only, 500+ char question, option limits, invalid optionIndex types)
- **404 handling**: Non-existent poll IDs should return proper error responses
- **Vote accumulation**: Multiple votes on same option should increment correctly

### Priority 2: Build & Infrastructure
- **Build pipeline**: Verify `npm install && npm run build && npm start` works cleanly
- **Test suite**: Run all 101 tests — confirm they pass in the QA environment
- **Dockerfile**: Validate Docker build succeeds; note that health check endpoint may be `/health` vs `/api/health` — verify which is correct
- **In-memory test mode**: Confirm `DB_PATH=:memory:` works for isolated testing

### Priority 3: Security Verification
- **SQL injection**: Attempt injection via question, options, and optionIndex fields
- **XSS prevention**: Verify React auto-escaping handles malicious poll content
- **Security headers**: Confirm `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` are present
- **Payload limits**: Verify JSON body size limit enforcement
- **Error sanitization**: Ensure no stack traces leak in error responses

### Priority 4: Cross-Reference Design Documents
- **API contract compliance**: Compare actual API responses against `docs/design/API_CONTRACTS.md`
- **Schema verification**: Confirm DB schema matches `docs/design/DATABASE_SCHEMA.md`
- **Date format**: Verify `created_at` uses ISO 8601 without milliseconds (e.g., `2026-04-07T23:03:02Z`)

### Potential Issue to Investigate
- **Dockerfile health check mismatch**: The Dockerfile `HEALTHCHECK` hits `/health` but the API serves health at `/api/health` — this will likely cause container health checks to fail

---


## Upstream Design Documents (MUST READ)

The following documents were produced by upstream phases (PRD, Architecture, etc.).
You MUST read these documents for test planning and coverage verification.

- **P3 - Development** (Phase: dev, Iteration 4): `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/dev/iteration-4`
- **P2 - Architecture** (Phase: arch, Iteration 5): `/persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/arch/iteration-5`

**IMPORTANT:** Read these documents to ensure test coverage matches requirements and design.


## Previous Iteration Summary

The following is a summary of what was accomplished in the previous iteration:

## Previous Phase Results (Development — Complete)

### Dev Iteration 3: Full Application Implementation
- **Status**: Completed successfully
- **Scope**: Built entire Quick Poll App from scratch
- **Deliverables**: Full client (React + Vite + Tailwind) and server (Express + SQLite) implementation
- **Files created**: 25+ files across `client/` and `server/` directories
- **All 6 acceptance criteria met**
- **Build output**: ~174 KB JS (56 KB gzipped), ~12 KB CSS (3 KB gzipped)

### Dev Iteration 4: Comprehensive Test Suite
- **Status**: Completed successfully
- **Scope**: Added automated test coverage (zero tests existed before)
- **Deliverables**: 3 test suites with 101 tests, all passing
  - `api.test.js`: 46 integration tests
  - `validate.test.js`: 35 unit tests
  - `queries.test.js`: 20 unit tests
- **Key change**: Extracted `server/app.js` from `server/index.js` for testability
- **Framework**: Jest + Supertest with in-memory SQLite

### Architecture (5 Iterations, Score 99/100)
- All 6 design documents produced and cross-validated
- No remaining architectural ambiguities

### Note
This is the **first QA iteration** — no previous QA results or RCA artifacts exist. QA should perform a fresh, comprehensive review of the fully implemented and tested application.

**Use this context to understand what has already been done and what remains.**
Create comprehensive test cases for GitHub issue #1 for mananb77/kanban-test-1.

Workspace: /persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1
Iteration: 1
Artifact Path: /persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-dev/iteration-1
Base Branch: main
Working Branch: main
Branch Mode: Working directly on base branch: main
Test Folder: tests
Issue file: /persistent/git-workspaces/mananb77/kanban-test-1/issues/issue-1.json

EXISTING TESTS FOUND: Review and enhance existing test cases in the tests folder. Analyze implemented code changes and add comprehensive test coverage for new functionality.

Please read the issue details, analyze the main implementation, and enhance existing tests or add new tests in the tests folder on the main branch. Follow the project's existing testing patterns and conventions.

IMPORTANT: After completing test generation, save the following artifacts to /persistent/git-workspaces/mananb77/kanban-test-1/issue-1/repos/mananb77/kanban-test-1/work-in-progress/issue-1/external-memory/qa-dev/iteration-1:
- QA_SUMMARY.md - Summary of tests created
- metadata.json - Test metadata and statistics

Additional Testing Instructions:
Application deployed successfully

---

## Quick Poll App — QA Development Context (Iteration 1)

### Project Overview
Full-stack polling application (React 18 + Express 4 + SQLite) that allows users to create polls with 2-6 options, share via unique UUID links, vote, and view results as bar charts. No authentication required.

### Architecture
- **Frontend**: React 18 (Vite 5) + Tailwind CSS 3 + React Router 6
- **Backend**: Node.js 18+ / Express 4
- **Database**: SQLite via better-sqlite3 (WAL mode, foreign keys)
- **Pattern**: Single-server monolith — Express serves REST API + built React SPA

### Current Codebase State
- **Architecture phase**: Complete (5 iterations, score 99/100)
- **Development phase**: Complete (4 iterations)
- **Full implementation** delivered in dev iteration 3; **101 automated tests** added in dev iteration 4
- **All 6 design documents** exist at `docs/design/` (TDD, SYSTEM_ARCHITECTURE, DATABASE_SCHEMA, API_CONTRACTS, SECURITY_DESIGN, DEPLOYMENT_STRATEGY)
- **CoWeave QA manifest** at `.coweave/manifest.yml` — Jest framework, `DB_PATH=:memory:`, 300s timeout
- **Dockerfile** present (node:18-alpine, health check on `/health`)

### API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/polls` | Create poll (201) |
| GET | `/api/polls/:id` | Get poll with votes (200/404) |
| POST | `/api/polls/:id/vote` | Cast vote (200/400/404) |

### Test Coverage (101 tests, all passing)
- **api.test.js** — 46 integration tests (endpoints, validation, security headers)
- **validate.test.js** — 35 unit tests (input validation middleware)
- **queries.test.js** — 20 unit tests (database queries module)

### Key Files
- `server/app.js` — Express app setup (extracted for testability)
- `server/index.js` — Server entry point
- `server/db/index.js` — DB init (WAL, FK, schema)
- `server/db/queries.js` — Prepared statements
- `server/routes/polls.js` — API route handlers
- `server/middleware/validate.js` — Input validation
- `client/src/App.jsx` — React router (/ and /poll/:id)
- `client/src/api.js` — Centralized fetch wrapper
- `client/src/pages/HomePage.jsx` — Poll creation
- `client/src/pages/PollPage.jsx` — Voting + results

### Acceptance Criteria (All Met)
1. `npm install && npm run build && npm start` starts the full app
2. Create polls with 2-6 options
3. Vote and see results immediately
4. Share poll links
5. SQLite persistence across restarts
6. Responsive Tailwind CSS UI

### Known Limitations
- Build script workaround (`scripts/build.sh`) for paths containing `#`
- No rate limiting or duplicate vote prevention (explicitly out of scope)
- No authentication (by design)
- Dockerfile health check points to `/health` but API serves at `/api/health`