# Security Design — Quick Poll App

## 1. Threat Model

### 1.1 Application Context

This is a **public, anonymous polling app** with no authentication. The attack surface is limited but must still be addressed.

### 1.2 Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| Script kiddie | Vandalism, spam | Automated requests, basic injection |
| Casual user | Abuse (spam polls, vote stuffing) | Browser-based, moderate effort |

### 1.3 Assets to Protect

| Asset | Value | Threat |
|-------|-------|--------|
| Database integrity | HIGH | SQL injection, malformed data |
| Server availability | HIGH | Oversized payloads, resource exhaustion |
| User experience | MEDIUM | XSS via poll questions/options |

## 2. Input Validation

### 2.1 Server-Side Validation Rules

All input validation happens server-side — never trust client input.

| Endpoint | Field | Validation |
|----------|-------|------------|
| POST /api/polls | `question` | Required, string, trimmed, 1–500 chars |
| POST /api/polls | `options` | Required, array, 2–6 items |
| POST /api/polls | `options[n]` | Required, string, trimmed, 1–200 chars |
| POST /api/polls/:id/vote | `optionIndex` | Required, integer, 0 ≤ n < options.length |
| GET /api/polls/:id | `id` | UUID v4 format validation |

### 2.2 Validation Middleware

```javascript
function validateCreatePoll(req, res, next) {
    const { question, options } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required' });
    }
    if (question.trim().length > 500) {
        return res.status(400).json({ error: 'Question must be 500 characters or fewer' });
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
        return res.status(400).json({ error: 'Between 2 and 6 options are required' });
    }
    for (const opt of options) {
        if (!opt || typeof opt !== 'string' || opt.trim().length === 0) {
            return res.status(400).json({ error: 'All options must be non-empty strings' });
        }
        if (opt.trim().length > 200) {
            return res.status(400).json({ error: 'Each option must be 200 characters or fewer' });
        }
    }

    req.body.question = question.trim();
    req.body.options = options.map(o => o.trim());
    next();
}
```

## 3. SQL Injection Prevention

**Strategy**: Use parameterized queries exclusively via `better-sqlite3` prepared statements.

```javascript
// SAFE — parameterized
const stmt = db.prepare('SELECT * FROM polls WHERE id = ?');
const poll = stmt.get(pollId);

// NEVER DO — string concatenation
// const poll = db.exec(`SELECT * FROM polls WHERE id = '${pollId}'`);
```

All database queries use `?` placeholders. The `better-sqlite3` library handles escaping automatically.

## 4. Cross-Site Scripting (XSS) Prevention

### 4.1 Output Encoding

React automatically escapes JSX content, preventing XSS in rendered text:

```jsx
// React auto-escapes — safe even if question contains <script>
<h1>{poll.question}</h1>
<p>{option.label}</p>
```

### 4.2 Rules

- Never use `dangerouslySetInnerHTML`
- Never construct HTML from user input on the server
- All user content (questions, options) is rendered as text nodes by React

## 5. Request Body Limits

Prevent oversized payloads from consuming server resources:

```javascript
app.use(express.json({ limit: '1mb' }));
```

This limits JSON body parsing to 1 MB, which is more than sufficient for poll data.

## 6. HTTP Security Headers

Apply security headers via middleware:

```javascript
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Rely on CSP, not legacy header
    next();
});
```

For a simple app without a CSP requirement, these headers provide baseline protection. A Content-Security-Policy header can be added in future iterations.

## 7. Error Handling

### 7.1 Error Sanitization

Never expose stack traces or internal details in API responses:

```javascript
// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
```

### 7.2 Validation Errors

Return specific, user-friendly messages (400 status) without revealing implementation details.

## 8. Data Protection

| Concern | Status |
|---------|--------|
| Sensitive user data | None collected (no auth, no PII) |
| Database encryption at rest | Not required (no sensitive data) |
| HTTPS in transit | Handled by deployment infrastructure |
| Database file permissions | OS-level file permissions on `polls.db` |

## 9. Explicitly Out of Scope

Per the requirements, the following are intentionally not implemented:

| Feature | Rationale |
|---------|-----------|
| Authentication | Requirement states no login/accounts |
| Rate limiting | Explicitly out of scope |
| Duplicate vote prevention | Explicitly out of scope |
| CSRF protection | No authenticated state to protect |

## 10. Security Checklist

- [x] Parameterized SQL queries (no string concatenation)
- [x] Input validation on all endpoints
- [x] String length limits on user input
- [x] JSON body size limit
- [x] React auto-escaping for XSS prevention
- [x] Error responses sanitized (no stack traces)
- [x] Security HTTP headers
- [ ] Rate limiting (out of scope)
- [ ] Authentication (out of scope)
- [ ] CSRF tokens (not applicable — no sessions)
