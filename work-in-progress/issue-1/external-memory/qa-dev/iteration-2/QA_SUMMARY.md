# QA Dev Iteration 2 — Summary

## Overview
Second QA iteration for the Quick Poll App. Fixed BUG-001, verified zero regressions on the existing 176 tests, and added 57 new tests covering additional coverage gaps.

## Bug Fix: BUG-001 (Dockerfile Health Check Mismatch)

### Problem
- `Dockerfile:24` HEALTHCHECK directive was hitting `http://localhost:3000/health`
- The application serves health checks at `/api/health`, not `/health`
- Result: Docker container would always report "unhealthy"

### Fix Applied
- Changed `Dockerfile:24` from `http://localhost:3000/health` to `http://localhost:3000/api/health`
- Added 5 tests to verify the fix and prevent regression

### Verification
- Test confirms the Dockerfile contains the correct URL (`/api/health`)
- Test confirms `/api/health` returns 200 with JSON `{status: "ok"}`
- Test confirms `/health` does NOT return a JSON health response (old incorrect path)
- Test confirms HEALTHCHECK directive has proper parameters (interval, timeout, start-period, retries)

## Test Results

| Metric | Count |
|--------|-------|
| **Total Tests** | 233 |
| Server unit/integration tests (existing) | 101 |
| QA iteration 1 tests (existing) | 75 |
| QA iteration 2 tests (new) | 57 |
| **All Passing** | 233/233 (100%) |
| **Test Suites** | 5 (api.test.js, validate.test.js, queries.test.js, qa-comprehensive.test.js, qa-iteration2.test.js) |

## New Coverage Areas (11 categories, 57 tests)

### 1. BUG-001 Fix Verification (5 tests)
- Dockerfile contains corrected health check URL
- URL path matches actual health endpoint
- `/api/health` returns 200 JSON
- `/health` does NOT return health JSON
- HEALTHCHECK has proper Docker parameters

### 2. Rapid Repeated Request Resilience (5 tests)
- 50 rapid poll creation requests without crash
- 50 rapid health check requests without errors
- 30 rapid alternating create/vote requests
- 30 rapid GET requests for the same poll
- 20 rapid requests to non-existent polls (404 flood)

### 3. Database Edge Cases (6 tests)
- DB_PATH=:memory: mode (test isolation)
- WAL journal mode consistency
- Foreign key constraint enforcement
- Maximum data boundary test
- Sequential creation scalability (25 polls)
- Autoincrementing option IDs across polls

### 4. SPA Fallback / Static File Serving (6 tests)
- HTML for unknown routes (React Router client-side)
- HTML for root path /
- HTML for /poll/:id routes
- API routes take precedence over SPA fallback
- HTML contains React root div
- Consistent SPA entry across all non-API routes

### 5. CORS Behavior (5 tests)
- Same-origin requests (no Origin header)
- Cross-origin requests with Origin header
- POST with Origin header
- OPTIONS preflight handling
- No Access-Control-Allow-Origin header (no CORS middleware)

### 6. Security Headers Completeness (7 tests)
- X-Content-Type-Options on API responses
- X-Frame-Options on API responses
- Security headers on 400 errors
- Security headers on 404 errors
- Security headers on SPA fallback
- Security headers on vote responses
- X-Powered-By disclosure check

### 7. Malformed Content-Type Handling (5 tests)
- POST with no Content-Type header
- POST with text/plain Content-Type
- POST with form-urlencoded Content-Type
- POST with invalid JSON body (syntax error)
- POST vote with invalid JSON body

### 8. Express Error Handler (2 tests)
- Oversized payload → generic error (no stack trace leak)
- Malformed JSON → no error detail leakage

### 9. Dockerfile and Build Infrastructure (7 tests)
- Dockerfile exists and has required directives
- Port 3000 in Dockerfile matches Express default
- Root package.json has all required scripts
- Server package.json has required dependencies
- Server package.json has test devDependencies
- Build script references client build
- Client dist directory has index.html

### 10. API Response Consistency Under Edge Conditions (4 tests)
- Consistent poll structure after 100 votes
- Poll creation after heavy vote load
- Voting on last option index (boundary)
- created_at timestamp immutability after votes

### 11. Request Handling Edge Cases (5 tests)
- Query parameters handled gracefully
- Trailing slashes handled
- Double slashes in path handled
- HEAD request to health endpoint
- HEAD request to poll endpoint

## Files Created
- `tests/qa-iteration2.test.js` — 57 QA tests (iteration 2)

## Files Modified
- `Dockerfile` — Fixed HEALTHCHECK URL from `/health` to `/api/health` (BUG-001)

## Infrastructure Validation
- `npm run test:all` — 233/233 tests passing
- `DB_PATH=:memory:` mode confirmed working for test isolation
- Dockerfile validated (structure, port, health check, build steps)
- Root package.json scripts verified (postinstall, build, start, test, test:qa, test:all)
- Client dist/index.html present and correct

## Observations

### Security Note
- The app does not disable Express's default `X-Powered-By: Express` header. Recommend adding `app.disable('trust proxy')` and `app.disable('x-powered-by')` for production hardening.
- No CORS middleware is configured, which is correct for a single-origin SPA where API and client are served from the same origin.
- No Content-Security-Policy header is set. For a production deployment, consider adding CSP headers.

### Error Handling Note
- Invalid JSON in request bodies results in a 500 status code (Express's JSON parser throws a SyntaxError, caught by the global error handler). Consider adding a dedicated JSON parse error handler middleware that returns 400 instead of 500. This is not a bug in the current implementation but could be improved.
