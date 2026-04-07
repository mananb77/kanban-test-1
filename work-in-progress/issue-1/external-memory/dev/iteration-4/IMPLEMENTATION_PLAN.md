# Implementation Plan — Iteration 4 (Test Coverage)

## Objective
Add comprehensive test coverage to the Quick Poll App. Previous iteration implemented the full application but had zero automated tests.

## Test Framework
- **Jest** — Test runner (CommonJS compatible, works with better-sqlite3 native module)
- **Supertest** — HTTP assertion library for Express integration tests
- **In-memory SQLite** — `DB_PATH=:memory:` for fast, isolated test execution

## Implementation Tasks
- [x] Install Jest + Supertest as server dev dependencies
- [x] Refactor `server/index.js` to extract app setup into `server/app.js` (enables Supertest without starting listener)
- [x] Add `test` script to server/package.json and root package.json
- [x] Write integration tests for all API endpoints (`__tests__/api.test.js`)
- [x] Write unit tests for validation middleware (`__tests__/validate.test.js`)
- [x] Write unit tests for database queries (`__tests__/queries.test.js`)
- [x] Run all tests and verify they pass (101/101)
- [x] Verify build still works after refactor

## Test Coverage Summary

### api.test.js — 46 tests
- GET /api/health (2 tests)
- Security headers (2 tests)
- POST /api/polls — happy path (8 tests) + validation (16 tests)
- GET /api/polls/:id — happy path (3 tests) + 404 (2 tests)
- POST /api/polls/:id/vote — happy path (5 tests) + validation (10 tests)
- Data persistence (2 tests)

### validate.test.js — 35 tests
- validateCreatePoll — question validation (7 tests)
- validateCreatePoll — options validation (12 tests)
- validateVote — all input types (11 tests)

### queries.test.js — 20 tests
- createPoll (5 tests)
- getPoll (4 tests)
- castVote (5 tests)
- getOptionsForPoll (3 tests)
