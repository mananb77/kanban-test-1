# QA Summary — Quick Poll App (Iteration 1)

## Overview

First QA iteration for the Quick Poll App (GitHub Issue #1, mananb77/kanban-test-1). This iteration reviewed the existing 101-test suite from dev iteration 4, identified 14 coverage gaps across the QA focus areas, and added 75 new comprehensive tests.

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `server/__tests__/api.test.js` (existing) | 46 | All Passing |
| `server/__tests__/validate.test.js` (existing) | 35 | All Passing |
| `server/__tests__/queries.test.js` (existing) | 20 | All Passing |
| `tests/qa-comprehensive.test.js` (new) | 75 | All Passing |
| **Total** | **176** | **All Passing** |

## New QA Test Coverage (75 tests)

### 1. End-to-End Flow (2 tests)
- Complete create → fetch → vote → verify results flow
- Multiple independent polls without interference

### 2. SQL Injection Prevention (5 tests)
- SQL injection via question field (6 payloads: DROP TABLE, OR 1=1, UNION SELECT, etc.)
- SQL injection via option fields
- SQL injection via poll ID path parameter (GET)
- SQL injection via vote endpoint poll ID (POST)
- Verification that tables remain intact after injection attempts

### 3. XSS Prevention (3 tests)
- XSS payloads in question field (6 vectors: script tags, img onerror, svg onload, javascript:, iframe, etc.)
- XSS payloads in option fields
- XSS content round-trip (create and GET back — stored as-is; React auto-escapes at render)

### 4. Security Headers — All Endpoints (5 tests)
- Headers verified on POST /api/polls (201 response)
- Headers verified on GET /api/polls/:id (200 response)
- Headers verified on POST /api/polls/:id/vote (200 response)
- Headers verified on 404 error responses
- Headers verified on 400 validation error responses

### 5. Error Sanitization (5 tests)
- No stack traces in 404 responses
- No stack traces in 400 validation errors
- Error responses contain only `{ error: string }` shape (no extra fields)
- 404 shape validation
- No internal details (pollId, stack) in vote 404 response

### 6. API Contract Compliance (10 tests)
- Content-Type: application/json on all endpoints
- Exact response shape `{id, question, options, created_at}` for POST /api/polls
- Option objects have exactly `{id, label, votes}`
- GET /api/polls/:id response shape compliance
- POST /api/polls/:id/vote response shape compliance
- Health check response shape `{status, timestamp}`
- `created_at` ISO 8601 format without milliseconds (`YYYY-MM-DDTHH:MM:SSZ`)

### 7. Unicode and Special Character Handling (6 tests)
- Emoji in question and options (🎉, 👍, ❤️, 🎊)
- CJK characters (Chinese: 你最喜欢什么颜色？)
- Arabic/RTL text
- Special characters and symbols (@#$%^&*()_+-=)
- Newline and tab characters
- Unicode content persistence and retrieval (Japanese)

### 8. HTTP Method Enforcement (4 tests)
- GET request to POST /api/polls endpoint rejected
- PUT request to POST /api/polls endpoint rejected
- DELETE request to GET /api/polls/:id endpoint rejected
- GET to /api/polls/:id/vote does not cast a vote (data integrity)

### 9. Malformed Input and Edge Cases (13 tests)
- Empty body on POST /api/polls
- Null body values
- Empty body on POST /api/polls/:id/vote
- Array as optionIndex
- Object as optionIndex
- Very large optionIndex (Number.MAX_SAFE_INTEGER)
- Extra fields in request body (ignored gracefully)
- Duplicate option labels (allowed)
- Boundary values: 499-char question, 199-char option
- Mixed valid/invalid option types
- Mid-range option counts (3, 4, 5 options)

### 10. Concurrent Vote Accumulation (2 tests)
- 10 rapid concurrent votes on the same option
- 15 concurrent votes spread across 3 options (5 each)

### 11. Dockerfile Health Check Verification (3 tests)
- Health check at `/api/health` works correctly (200 + JSON)
- **BUG DOCUMENTED**: `/health` does NOT return JSON health response (Dockerfile HEALTHCHECK mismatch)
- Valid timestamp in health response

### 12. Poll Isolation and Data Integrity (4 tests)
- Voting on one poll does not affect another
- 20 polls created with unique IDs
- Option order preserved across create and fetch (6 non-alphabetical options)
- Vote tracking across all options (A=3, B=1, C=0, D=5)

### 13. Large Payload Testing (2 tests)
- Maximum-length question (500) with maximum options (6×200 chars)
- Payload exceeding 1MB body size limit (rejected with 400+)

### 14. UUID Format and 404 Edge Cases (5 tests)
- Empty string poll ID
- UUID-format non-existent ID
- Very long poll ID (1000 chars)
- Path traversal attempt (`..%2F..%2Fetc%2Fpasswd`)
- Numeric poll ID

### 15. Database Schema Compliance (5 tests)
- Poll ID is UUID v4 text format
- Option IDs are integers
- Option IDs autoincrement
- Votes default to 0
- created_at is UTC datetime within expected range

## Bugs Found

### BUG-001: Dockerfile Health Check Mismatch (Severity: Medium)
- **Location**: `Dockerfile:24`
- **Issue**: HEALTHCHECK command hits `http://localhost:3000/health` but the API serves health at `/api/health`
- **Impact**: Docker container health checks will always fail, causing orchestrators (Docker Compose, Kubernetes, ECS) to mark the container as unhealthy
- **Evidence**: Test "should NOT serve health check at /health" confirms `/health` returns HTML (SPA fallback), not JSON health response
- **Fix**: Change Dockerfile HEALTHCHECK to `http://localhost:3000/api/health`

## Coverage Gap Analysis

| QA Focus Area | Previous Coverage | New Coverage | Status |
|---------------|------------------|--------------|--------|
| End-to-end flow | None | 2 tests | Covered |
| SQL injection | None | 5 tests | Covered |
| XSS prevention | None | 3 tests | Covered |
| Security headers (all endpoints) | 2 tests (health only) | 5 tests (all endpoints) | Covered |
| Error sanitization | None | 5 tests | Covered |
| API contract compliance | Partial | 10 tests | Covered |
| Unicode handling | None | 6 tests | Covered |
| HTTP method enforcement | None | 4 tests | Covered |
| Malformed input edge cases | Limited | 13 tests | Covered |
| Concurrent votes | None | 2 tests | Covered |
| Health check mismatch | None | 3 tests | Bug Documented |
| Poll isolation | Limited | 4 tests | Covered |
| Large payloads | None | 2 tests | Covered |
| UUID/404 edge cases | Limited | 5 tests | Covered |
| DB schema compliance | Partial | 5 tests | Covered |

## Configuration

- **Test Framework**: Jest 30.3.0 + Supertest 7.2.2
- **Database**: In-memory SQLite (`DB_PATH=:memory:`)
- **Run QA Tests**: `npm run test:qa` (from repo root)
- **Run All Tests**: `npm run test:all` (existing + QA)
- **Run Existing Tests Only**: `npm test`

## Files Created/Modified

### New Files
- `tests/qa-comprehensive.test.js` — 75 QA tests
- `tests/jest.config.js` — Jest config for root-level tests

### Modified Files
- `package.json` — Added `test:qa` and `test:all` scripts
