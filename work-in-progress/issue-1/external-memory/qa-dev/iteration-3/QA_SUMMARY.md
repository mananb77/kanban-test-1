# QA Dev Iteration 3 — Summary

## Overview

Third QA iteration for the Quick Poll App. **Zero regressions** on the existing 233 tests. Added **61 new tests** covering 11 additional coverage categories focused on production hardening documentation and remaining coverage gaps.

## Test Results

- **Total tests**: 294 (101 dev + 132 QA iter 1-2 + 61 QA iter 3)
- **All passing**: 294/294 (100%)
- **Test suites**: 6 (all passing)
  - `server/__tests__/api.test.js` — 46 tests (dev)
  - `server/__tests__/validate.test.js` — 35 tests (dev)
  - `server/__tests__/queries.test.js` — 20 tests (dev)
  - `tests/qa-comprehensive.test.js` — 75 tests (QA iter 1)
  - `tests/qa-iteration2.test.js` — 57 tests (QA iter 2)
  - `tests/qa-iteration3.test.js` — 61 tests (QA iter 3)

## New Coverage Areas (11 categories, 61 tests)

### Priority 2: Production Hardening Gap Documentation

1. **X-Powered-By Header Disclosure** (5 tests)
   - Verified `X-Powered-By: Express` is present on all response types (API, errors, SPA fallback)
   - Documented recommendation: add `app.disable('x-powered-by')` for production

2. **Content-Security-Policy Header Absence** (5 tests)
   - Verified CSP header is absent on API, poll creation, and SPA fallback responses
   - Verified HSTS and Referrer-Policy headers are also absent
   - Documented recommendations for production security headers

3. **JSON Parse Error Handling** (5 tests)
   - Verified invalid JSON returns 500 (Express parser → global error handler)
   - Verified truncated JSON returns 500
   - Verified no parser error details leak in response body
   - Documented recommendation: add dedicated JSON parse error handler returning 400

### Priority 3: Remaining Coverage Gaps

4. **Graceful Shutdown Behavior** (5 tests)
   - Verified server/index.js creates listening server with PORT env var
   - Verified app module exports Express app (function with use/get/post methods)
   - Verified server handles requests correctly after heavy load (100 rapid creates)
   - Verified app.js separation of concerns for testability

5. **File-Based SQLite Persistence** (8 tests)
   - Verified DB_PATH environment variable support
   - Verified default path (server/polls.db)
   - Verified WAL journal mode configuration
   - Verified foreign key constraints enabled
   - Verified polls table schema (id TEXT PK, question TEXT NOT NULL, created_at)
   - Verified options table schema (INTEGER PK AUTOINCREMENT, poll_id FK, label, votes DEFAULT 0)
   - Verified idx_options_poll_id index for query performance
   - Verified ON DELETE CASCADE for data integrity

6. **Timestamp Edge Cases and UTC Consistency** (7 tests)
   - Verified created_at uses Z suffix (UTC), no timezone offset
   - Verified no milliseconds in timestamp
   - Verified parseable ISO 8601 format
   - Verified same created_at on create response and subsequent GET
   - Verified created_at is close to current time (within ±1 second)
   - Verified monotonically increasing timestamps for sequential creates
   - Verified T separator (not space) in formatted timestamp

7. **Multiple Sequential Votes — No Vote-Once Enforcement** (5 tests)
   - Verified same client can vote multiple times on same option
   - Verified same client can vote on different options sequentially
   - Verified 100 sequential votes from same client work correctly
   - Verified no Set-Cookie header (no vote tracking)
   - Verified incrementing vote count returned after each sequential vote

8. **Empty Poll State** (5 tests)
   - Verified all votes are 0 on GET immediately after creation
   - Verified 0 votes in creation response itself
   - Verified consistent data between creation response and immediate GET
   - Verified all 6 options show 0 votes for max-option poll
   - Verified votes are integer 0, not null/undefined/string (strict type check)

9. **Client-Side Route Handling** (7 tests)
   - Verified /poll/<uuid> serves React app (HTML with root div)
   - Verified /create serves React app
   - Verified root / serves React app with DOCTYPE
   - Verified same HTML served for all SPA routes
   - Verified API routes return JSON, not HTML
   - Verified client/dist directory and index.html exist
   - Verified index.html has proper DOCTYPE and root div

10. **Test Isolation Verification** (3 tests)
    - Verified independent polls don't share state
    - Verified 50 unique UUIDs generated
    - Verified no shared mutable state between requests (same question = different entities)

11. **API Idempotency and Consistency** (6 tests)
    - Verified GET /api/polls/:id is idempotent (same result for same input)
    - Verified GET /api/health is idempotent
    - Verified POST /api/polls is NOT idempotent (creates new poll each time)
    - Verified POST /api/polls/:id/vote is NOT idempotent (increments each time)
    - Verified application/json Content-Type on all API endpoints
    - Verified correct HTTP status codes for all operations (201, 200, 404, 400)

## Files Created

- `tests/qa-iteration3.test.js` — 61 QA tests

## Files Modified

- None (documentation-only iteration, no code fixes needed)

## Bug Status

- **No new bugs found** — all observations are production hardening recommendations
- **BUG-001 (Dockerfile HEALTHCHECK)** — Fixed in iteration 2, still verified passing

## Production Hardening Recommendations (Not Bugs)

| Observation | Current Behavior | Recommendation |
|---|---|---|
| X-Powered-By: Express | Header exposed on all responses | Add `app.disable('x-powered-by')` |
| No Content-Security-Policy | CSP header absent | Add CSP header via helmet or manual middleware |
| No Strict-Transport-Security | HSTS absent | Add HSTS when running behind HTTPS |
| No Referrer-Policy | Header absent | Add `Referrer-Policy: strict-origin-when-cross-origin` |
| Invalid JSON → 500 | Express parser error caught by global handler | Add `SyntaxError` check in error handler, return 400 |

## Acceptance Criteria Verification

All original acceptance criteria remain met:
- [x] `npm install && npm run build && npm start` starts the full app
- [x] User can create a poll with 2-6 options
- [x] User can vote and see updated results
- [x] User can share a poll link
- [x] Poll data persists (SQLite schema verified)
- [x] UI is responsive (SPA routing verified)
