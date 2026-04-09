# Coverage Gap Analysis — QA Review Iteration 8

**Issue**: #1 — Build App (Quick Poll App)
**Review Date**: 2026-04-09
**Note**: No formal code coverage tool (Istanbul/c8) data available. Analysis is based on manual code path inspection.

---

## Server-Side Coverage Assessment (Manual)

### Files with Excellent Coverage (estimated >90%)

| File | Lines | Estimated Coverage | Evidence |
|------|-------|-------------------|----------|
| `server/middleware/validate.js` | 37 | ~98% | 35 dedicated unit tests; every branch exercised |
| `server/routes/polls.js` | 47 | ~95% | 46 integration tests; all 4 endpoints tested with success + error paths |
| `server/db/queries.js` | 31 | ~95% | 20 unit tests + 46 integration tests exercise all functions |
| `server/db/index.js` | 24 | ~90% | Schema creation verified; WAL/FK mode tested via behavior |
| `server/app.js` | 35 | ~85% | Middleware chain tested; SPA fallback tested; error handler tested |
| `server/index.js` | 5 | ~80% | `app.listen()` tested via signal handling tests |

### Server-Side Coverage Gaps

**`server/app.js` line 35-38 — Global Error Handler Branch:**
```javascript
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} ERROR:`, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
```
- Partially covered: JSON parse errors trigger this handler (tested in qa-iteration3)
- Gap: No test for a thrown error inside a route handler (e.g., if `getPoll()` throws an unexpected error)
- Impact: Low — the error handler is simple and the path is exercised by JSON parse errors

**`server/routes/polls.js` line 37-39 — Vote Failure Branch:**
```javascript
if (!success) {
    return res.status(500).json({ error: 'Failed to record vote' });
}
```
- Not covered: This branch requires `castVote()` to return `false` in the context of an HTTP request. The unit test for `castVote()` covers `false` return, but the integration test doesn't trigger this specific 500 response.
- Impact: Very low — this is a defensive guard that can only trigger if the DB state is corrupted between `getPoll()` and `castVote()` within the same request.

---

## Client-Side Coverage Assessment

### Files with ZERO test coverage

| File | Lines | Reason | Priority |
|------|-------|--------|----------|
| `client/src/App.jsx` | 16 | No frontend test framework installed | Medium |
| `client/src/api.js` | 29 | Testable with Jest + fetch mock | High |
| `client/src/pages/HomePage.jsx` | 30 | Needs React Testing Library | Medium |
| `client/src/pages/PollPage.jsx` | 83 | Needs React Testing Library | High |
| `client/src/components/PollForm.jsx` | 84 | Needs React Testing Library | High |
| `client/src/components/VoteSection.jsx` | 55 | Needs React Testing Library | Medium |
| `client/src/components/ResultsChart.jsx` | 30 | Needs React Testing Library | Medium |
| `client/src/components/CopyLinkButton.jsx` | 35 | Needs React Testing Library + clipboard mock | Low |

**Total client-side coverage: 0%**

---

## Coverage Improvement Recommendations

### Priority 1: Add `client/src/api.js` Tests (Quick Win)
**Effort**: Small — can use Jest with fetch mocking (no DOM needed)
**Value**: Tests the data layer that all components depend on

### Priority 2: Add React Testing Library for Critical Components
**Effort**: Medium — requires installing `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and configuring jsdom
**Value**: Tests user-facing behavior of the most important components

Target components (in priority order):
1. `PollForm.jsx` — Complex interactive form with dynamic inputs
2. `PollPage.jsx` — Multiple states (loading, not found, voting, results)
3. `VoteSection.jsx` — Selection and submission interaction
4. `ResultsChart.jsx` — Rendering logic with mathematical formula

### Priority 3: Add Istanbul/c8 Code Coverage Reporting
**Effort**: Small — add `--coverage` flag to Jest config
**Value**: Quantitative coverage metrics for CI gating

Recommended Jest config addition:
```json
{
  "collectCoverage": true,
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80
    }
  }
}
```

---

## Summary

| Layer | Files | Coverage | Status |
|-------|-------|----------|--------|
| Server middleware | 1 | ~98% | Excellent |
| Server routes | 1 | ~95% | Excellent |
| Server database | 2 | ~90-95% | Excellent |
| Server app/entry | 2 | ~80-85% | Good |
| Client components | 6 | 0% | **GAP** |
| Client pages | 2 | 0% | **GAP** |
| Client api | 1 | 0% | **GAP** |
| **Overall** | **15** | **~55%** | Needs frontend tests |

**Server-side is well-covered. Client-side has zero coverage. This is the primary coverage gap.**
