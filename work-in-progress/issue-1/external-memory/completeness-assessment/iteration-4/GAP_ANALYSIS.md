# Gap Analysis — Issue #1: Build App (Quick Poll App)

**Assessment Date**: 2026-04-09
**Iteration**: 4
**Overall Gap Status**: **MINIMAL — No blocking gaps**

---

## Gap Summary

| Priority | Count | Blocking | Description |
|----------|-------|----------|-------------|
| Critical (P0) | 0 | — | No critical gaps |
| High (P1) | 0 | — | No high-priority gaps |
| Medium (P2) | 1 | No | Build script adaptation |
| Low (P3) | 4 | No | Production hardening observations |
| **Total** | **5** | **0** | All non-blocking |

---

## Detailed Gap Analysis

### GAP-001: Build Script Adaptation
- **Priority**: P2 (Medium) — Non-blocking
- **Category**: Deployment
- **Design Spec**: TDD PKG-3 specifies `"build": "cd client && npm run build"`
- **Implementation**: `"build": "sh scripts/build.sh"` — a shell script that detects `#` in workspace path and uses a temp directory for Vite build
- **Reason**: Vite/Rollup cannot resolve modules when the project path contains `#` (URL-encodes to `%23`). This is a known Vite limitation.
- **Impact**: Zero — the build produces identical output; the script is a transparent wrapper
- **Assessment**: **Valid engineering adaptation, not a defect.** The build works correctly in all environments. The `#` character issue is specific to the deployment workspace path and would not affect standard development environments.
- **Recommendation**: No action needed. If deploying to a path without `#`, the standard `cd client && npm run build` would also work.

---

### GAP-002: Security Headers on JSON Parse Errors (OBS-001)
- **Priority**: P3 (Low) — Non-blocking
- **Category**: Security / Production Hardening
- **Design Spec**: SEC-13/SEC-14 require `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on responses
- **Implementation**: Security header middleware is positioned after `express.json()` per MW-1/MW-3 ordering. When `express.json()` throws a SyntaxError for malformed JSON, the error bypasses the security header middleware and goes directly to the global error handler.
- **Impact**: Low-Medium — Security headers are missing only on 500 responses triggered by malformed JSON payloads. All normal API responses have correct headers.
- **Assessment**: The middleware ordering follows the TDD specification exactly (MW-1: `express.json()` FIRST, MW-3: security headers). This is a design limitation, not an implementation defect.
- **Recommendation**: For production hardening, move security header middleware before `express.json()`, or add headers in the global error handler. Can be addressed in a follow-up iteration.

---

### GAP-003: X-Powered-By Header Disclosure (OBS-002)
- **Priority**: P3 (Low) — Non-blocking
- **Category**: Security / Production Hardening
- **Design Spec**: SECURITY_DESIGN.md does not require disabling `X-Powered-By`. SEC-13 and SEC-14 specify only `X-Content-Type-Options` and `X-Frame-Options`.
- **Implementation**: Express default `X-Powered-By: Express` header is present on all responses.
- **Impact**: Minimal — information disclosure of server technology. Standard security best practice to disable but not required by spec.
- **Recommendation**: Add `app.disable('x-powered-by')` in a future iteration. Single line change.

---

### GAP-004: Missing Advanced Security Headers (OBS-003)
- **Priority**: P3 (Low) — Non-blocking
- **Category**: Security / Production Hardening
- **Design Spec**: SEC-16 explicitly states: "CSP can be added in future iterations (not required now)". No requirement for HSTS, Referrer-Policy, or Permissions-Policy headers.
- **Implementation**: Only `X-Content-Type-Options` and `X-Frame-Options` headers are set, which matches the specification exactly.
- **Impact**: None for current scope — these headers are explicitly deferred.
- **Recommendation**: Consider adding `helmet` middleware in a production hardening iteration. Not needed for release.

---

### GAP-005: Invalid JSON Returns 500 Instead of 400 (OBS-004)
- **Priority**: P3 (Low) — Non-blocking
- **Category**: Error Handling / Production Hardening
- **Design Spec**: ERR-3 specifies that unexpected errors return 500 with `"Internal server error"`. The design docs do not specify special handling for JSON parse errors.
- **Implementation**: When `express.json()` encounters malformed JSON, it throws a SyntaxError that falls through to the global error handler, which correctly returns 500 with `"Internal server error"`.
- **Impact**: Minimal — clients sending malformed JSON get a 500 instead of a more semantically correct 400. No data loss or security risk.
- **Recommendation**: Add a `SyntaxError` check in the error handler to return 400 for parse errors. Can be addressed in a follow-up iteration.

---

## Requirements Not Applicable / Explicitly Out of Scope

The following items are confirmed out of scope per design documents and ticket:

| Item | Source | Status |
|------|--------|--------|
| User authentication | Ticket, SEC-OOS1 | Out of scope |
| Real-time WebSocket updates | Ticket | Out of scope |
| CI/CD configuration | Ticket | Out of scope |
| Rate limiting | Ticket, SEC-OOS2 | Out of scope |
| Duplicate vote prevention | Ticket, SEC-OOS3 | Out of scope |
| CSRF protection | SEC-OOS4 | Out of scope |
| Database encryption at rest | SEC-21 | Not required |
| HTTPS | SEC-22 | Handled by infrastructure |
| CSP headers | SEC-16 | Future iteration |

---

## Conclusion

The gap analysis reveals **zero blocking gaps**. The 5 identified items are:
- 1 valid engineering adaptation (build script)
- 4 production hardening observations, all either not required by spec or explicitly deferred

**No corrective action is required before release.**
