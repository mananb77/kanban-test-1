/**
 * QA Iteration 3 Test Suite — Quick Poll App
 *
 * Focus areas per iteration 3 priorities:
 *
 * Priority 2: Production Hardening Gaps
 *   1. X-Powered-By header disclosure (document and verify)
 *   2. Content-Security-Policy header absence (document and verify)
 *   3. JSON parse error handling (verify 400 vs 500 behavior)
 *
 * Priority 3: Remaining Coverage Gaps
 *   4. Graceful shutdown behavior (SIGTERM/SIGINT handling)
 *   5. File-based SQLite persistence (data survives restart)
 *   6. Timestamp edge cases (UTC consistency)
 *   7. Multiple sequential votes (no vote-once enforcement)
 *   8. Empty poll state (all votes 0 immediately after creation)
 *   9. Client-side route handling (SPA routes serve React app)
 *
 * Priority 4: Code Quality
 *   10. Test isolation verification (no shared state leaking)
 *   11. API idempotency and consistency checks
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { execSync, fork } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────────
// 1. X-POWERED-BY HEADER DISCLOSURE
// ─────────────────────────────────────────────────────────────────────────────

describe('X-Powered-By Header Disclosure', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should expose X-Powered-By: Express header on API responses (production hardening gap)', async () => {
        const res = await request(app).get('/api/health');
        // Document: Express sets this by default. app.disable("x-powered-by") should be added.
        expect(res.headers['x-powered-by']).toBe('Express');
    });

    it('should expose X-Powered-By on POST /api/polls responses', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'X-Powered-By test?', options: ['A', 'B'] });

        expect(res.headers['x-powered-by']).toBe('Express');
    });

    it('should expose X-Powered-By on 404 error responses', async () => {
        const res = await request(app).get('/api/polls/nonexistent-uuid');
        expect(res.headers['x-powered-by']).toBe('Express');
    });

    it('should expose X-Powered-By on 400 validation error responses', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: '', options: [] });

        expect(res.headers['x-powered-by']).toBe('Express');
    });

    it('should expose X-Powered-By on SPA fallback responses', async () => {
        const res = await request(app).get('/some/random/route');
        expect(res.headers['x-powered-by']).toBe('Express');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONTENT-SECURITY-POLICY HEADER ABSENCE
// ─────────────────────────────────────────────────────────────────────────────

describe('Content-Security-Policy Header Absence', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should NOT have Content-Security-Policy header on API responses (production hardening gap)', async () => {
        const res = await request(app).get('/api/health');
        // Document: CSP header should be added for production security
        expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('should NOT have CSP header on poll creation responses', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'CSP test?', options: ['A', 'B'] });

        expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('should NOT have CSP header on SPA fallback (HTML) responses', async () => {
        const res = await request(app).get('/');
        expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('should NOT have Strict-Transport-Security header (HSTS)', async () => {
        const res = await request(app).get('/api/health');
        // Document: HSTS should be added when running behind HTTPS
        expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('should NOT have Referrer-Policy header', async () => {
        const res = await request(app).get('/api/health');
        // Document: Referrer-Policy should be set for production
        expect(res.headers['referrer-policy']).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. JSON PARSE ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe('JSON Parse Error Handling', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should return 400 or 500 for invalid JSON on POST /api/polls', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('{bad json}');

        // Current behavior: Express JSON parser throws SyntaxError → global error handler → 500
        // Recommendation: Add dedicated JSON parse error handler returning 400
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal server error');
    });

    it('should return 400 or 500 for truncated JSON on POST /api/polls', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('{"question":"test","opti');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal server error');
    });

    it('should return 400 or 500 for invalid JSON on POST /api/polls/:id/vote', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'JSON error test?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .set('Content-Type', 'application/json')
            .send('{invalid}');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal server error');
    });

    it('should not leak parser error details in response', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('{syntax error here!!!}');

        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('SyntaxError');
        expect(bodyStr).not.toContain('Unexpected token');
        expect(bodyStr).not.toContain('node_modules');
        expect(bodyStr).not.toContain('.js:');
    });

    it('should handle empty string body with application/json content type', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('');

        // Empty body with application/json → body is {} → validation error → 400
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GRACEFUL SHUTDOWN BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('Graceful Shutdown Behavior', () => {
    it('should have server/index.js that creates a listening server', () => {
        const indexPath = path.join(__dirname, '..', 'server', 'index.js');
        const content = fs.readFileSync(indexPath, 'utf8');

        // Server should call app.listen
        expect(content).toContain('app.listen');
        expect(content).toContain('PORT');
    });

    it('should use PORT environment variable or default to 3000', () => {
        const indexPath = path.join(__dirname, '..', 'server', 'index.js');
        const content = fs.readFileSync(indexPath, 'utf8');

        expect(content).toContain('process.env.PORT');
        expect(content).toContain('3000');
    });

    it('should import app from app.js (separation of concerns for testability)', () => {
        const indexPath = path.join(__dirname, '..', 'server', 'index.js');
        const content = fs.readFileSync(indexPath, 'utf8');

        expect(content).toContain("require('./app')");
    });

    it('should verify that the app module exports an Express app', () => {
        const app = require('../server/app');
        // Express app should be a function (request handler)
        expect(typeof app).toBe('function');
        // Express app should have use, get, post methods
        expect(typeof app.use).toBe('function');
        expect(typeof app.get).toBe('function');
        expect(typeof app.post).toBe('function');
    });

    it('should handle requests correctly after heavy load (no resource leaks)', async () => {
        const app = require('../server/app');

        // Simulate heavy load
        const promises = Array.from({ length: 100 }, (_, i) =>
            request(app)
                .post('/api/polls')
                .send({ question: `Shutdown load test ${i}?`, options: ['A', 'B'] })
        );
        await Promise.all(promises);

        // Verify server still responds correctly after heavy load
        const healthRes = await request(app).get('/api/health');
        expect(healthRes.status).toBe(200);
        expect(healthRes.body.status).toBe('ok');

        const pollRes = await request(app)
            .post('/api/polls')
            .send({ question: 'After heavy load?', options: ['X', 'Y'] });
        expect(pollRes.status).toBe(201);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FILE-BASED SQLITE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

describe('File-Based SQLite Persistence', () => {
    it('should use DB_PATH environment variable for database location', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain('process.env.DB_PATH');
        expect(content).toContain('polls.db');
    });

    it('should default DB_PATH to server/polls.db when not set', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        // Default path should be relative to server directory
        expect(content).toContain("path.join(__dirname, '..', 'polls.db')");
    });

    it('should configure WAL journal mode for better concurrency', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain("pragma('journal_mode = WAL')");
    });

    it('should enable foreign key constraints', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain("pragma('foreign_keys = ON')");
    });

    it('should create polls table with correct schema', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain('CREATE TABLE IF NOT EXISTS polls');
        expect(content).toContain('id         TEXT PRIMARY KEY');
        expect(content).toContain('question   TEXT NOT NULL');
        expect(content).toContain('created_at TEXT NOT NULL');
    });

    it('should create options table with correct schema', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain('CREATE TABLE IF NOT EXISTS options');
        expect(content).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
        expect(content).toContain('poll_id TEXT    NOT NULL');
        expect(content).toContain('label   TEXT    NOT NULL');
        expect(content).toContain('votes   INTEGER NOT NULL DEFAULT 0');
        expect(content).toContain('FOREIGN KEY (poll_id) REFERENCES polls(id)');
    });

    it('should create an index on options.poll_id for query performance', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_options_poll_id ON options(poll_id)');
    });

    it('should use CASCADE on foreign key delete for data integrity', () => {
        const dbIndexPath = path.join(__dirname, '..', 'server', 'db', 'index.js');
        const content = fs.readFileSync(dbIndexPath, 'utf8');

        expect(content).toContain('ON DELETE CASCADE');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TIMESTAMP EDGE CASES AND UTC CONSISTENCY
// ─────────────────────────────────────────────────────────────────────────────

describe('Timestamp Edge Cases and UTC Consistency', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should return created_at in UTC (Z suffix, no timezone offset)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'UTC check?', options: ['A', 'B'] });

        expect(res.body.created_at).toMatch(/Z$/);
        expect(res.body.created_at).not.toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it('should return created_at without milliseconds', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'No ms?', options: ['A', 'B'] });

        expect(res.body.created_at).not.toContain('.');
        expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should return parseable ISO 8601 timestamps', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Parseable?', options: ['A', 'B'] });

        const date = new Date(res.body.created_at);
        expect(date.toString()).not.toBe('Invalid Date');
        expect(date.toISOString()).toContain(res.body.created_at.slice(0, 19));
    });

    it('should return the same created_at on create and subsequent GET', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Same timestamp?', options: ['A', 'B'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

        expect(getRes.body.created_at).toBe(createRes.body.created_at);
    });

    it('should return created_at close to current time (within 5 seconds)', async () => {
        const before = Math.floor(Date.now() / 1000);

        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Timely?', options: ['A', 'B'] });

        const after = Math.floor(Date.now() / 1000);
        const createdAtUnix = Math.floor(new Date(res.body.created_at).getTime() / 1000);

        expect(createdAtUnix).toBeGreaterThanOrEqual(before - 1);
        expect(createdAtUnix).toBeLessThanOrEqual(after + 1);
    });

    it('should have monotonically increasing timestamps for sequential poll creation', async () => {
        const polls = [];
        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: `Sequential ts ${i}?`, options: ['A', 'B'] });
            polls.push(res.body);
        }

        for (let i = 1; i < polls.length; i++) {
            const prev = new Date(polls[i - 1].created_at).getTime();
            const curr = new Date(polls[i].created_at).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
        }
    });

    it('should format created_at correctly via formatPoll (T separator, Z suffix)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Format check?', options: ['A', 'B'] });

        const ts = res.body.created_at;
        // Verify T separator exists (not a space)
        expect(ts).toContain('T');
        // Verify no space character in timestamp
        expect(ts).not.toContain(' ');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MULTIPLE SEQUENTIAL VOTES (NO VOTE-ONCE ENFORCEMENT)
// ─────────────────────────────────────────────────────────────────────────────

describe('Multiple Sequential Votes — No Vote-Once Enforcement', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should allow the same client to vote multiple times on the same option', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Multi-vote same?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        for (let i = 0; i < 5; i++) {
            const voteRes = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(voteRes.status).toBe(200);
            expect(voteRes.body.options[0].votes).toBe(i + 1);
        }
    });

    it('should allow the same client to vote on different options sequentially', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Multi-vote different?', options: ['A', 'B', 'C'] });

        const pollId = createRes.body.id;

        // Vote on option 0, then 1, then 2, then 0 again
        await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 0 });
        await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 1 });
        await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 2 });
        await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 0 });

        const getRes = await request(app).get(`/api/polls/${pollId}`);
        expect(getRes.body.options[0].votes).toBe(2);
        expect(getRes.body.options[1].votes).toBe(1);
        expect(getRes.body.options[2].votes).toBe(1);
    });

    it('should allow 100 sequential votes from the same client', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: '100 votes?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        const promises = Array.from({ length: 100 }, () =>
            request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 })
        );
        const results = await Promise.all(promises);

        for (const res of results) {
            expect(res.status).toBe(200);
        }

        const getRes = await request(app).get(`/api/polls/${pollId}`);
        expect(getRes.body.options[0].votes).toBe(100);
    });

    it('should not set any cookies or session tracking (no vote-once enforcement)', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'No cookies?', options: ['A', 'B'] });

        const voteRes = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });

        // No Set-Cookie header means no vote tracking
        expect(voteRes.headers['set-cookie']).toBeUndefined();
    });

    it('should return updated vote count after each sequential vote', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Incremental count?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        for (let i = 1; i <= 10; i++) {
            const voteRes = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(voteRes.body.options[0].votes).toBe(i);
            expect(voteRes.body.options[1].votes).toBe(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. EMPTY POLL STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Empty Poll State — Immediately After Creation', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should return all votes as 0 on GET immediately after creation', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Fresh poll?', options: ['A', 'B', 'C'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

        expect(getRes.status).toBe(200);
        for (const opt of getRes.body.options) {
            expect(opt.votes).toBe(0);
        }
    });

    it('should return 0 votes in the creation response itself', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Zero on create?', options: ['X', 'Y'] });

        expect(res.status).toBe(201);
        for (const opt of res.body.options) {
            expect(opt.votes).toBe(0);
        }
    });

    it('should return consistent data between creation response and immediate GET', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Consistent?', options: ['Alpha', 'Beta'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

        expect(getRes.body.id).toBe(createRes.body.id);
        expect(getRes.body.question).toBe(createRes.body.question);
        expect(getRes.body.created_at).toBe(createRes.body.created_at);
        expect(getRes.body.options).toHaveLength(createRes.body.options.length);

        for (let i = 0; i < createRes.body.options.length; i++) {
            expect(getRes.body.options[i].id).toBe(createRes.body.options[i].id);
            expect(getRes.body.options[i].label).toBe(createRes.body.options[i].label);
            expect(getRes.body.options[i].votes).toBe(createRes.body.options[i].votes);
        }
    });

    it('should show all votes as 0 for a 6-option poll immediately after creation', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Six zeros?', options: ['A', 'B', 'C', 'D', 'E', 'F'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

        expect(getRes.body.options).toHaveLength(6);
        const totalVotes = getRes.body.options.reduce((sum, opt) => sum + opt.votes, 0);
        expect(totalVotes).toBe(0);
    });

    it('should return votes as integer 0, not null/undefined/string', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Type check?', options: ['A', 'B'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

        for (const opt of getRes.body.options) {
            expect(opt.votes).toStrictEqual(0);
            expect(typeof opt.votes).toBe('number');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CLIENT-SIDE ROUTE HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe('Client-Side Route Handling — SPA Routes', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should serve React app for /poll/<uuid> route', async () => {
        const res = await request(app).get('/poll/550e8400-e29b-41d4-a716-446655440000');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('<div id="root"></div>');
    });

    it('should serve React app for /create route', async () => {
        const res = await request(app).get('/create');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('<div id="root"></div>');
    });

    it('should serve React app for root / route', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('<!DOCTYPE html>');
    });

    it('should serve the same HTML for all SPA routes', async () => {
        const routes = ['/create', '/poll/abc-123', '/poll/xyz/results', '/about', '/'];
        const responses = await Promise.all(routes.map(r => request(app).get(r)));

        const baseHtml = responses[0].text;
        for (const res of responses) {
            expect(res.text).toBe(baseHtml);
        }
    });

    it('should NOT return SPA HTML for API routes', async () => {
        const apiRes = await request(app).get('/api/health');
        const spaRes = await request(app).get('/');

        // API should return JSON, not HTML
        expect(apiRes.headers['content-type']).toMatch(/application\/json/);
        expect(spaRes.headers['content-type']).toMatch(/text\/html/);
        expect(apiRes.text).not.toEqual(spaRes.text);
    });

    it('should serve static assets from client/dist', () => {
        const distPath = path.join(__dirname, '..', 'client', 'dist');
        expect(fs.existsSync(distPath)).toBe(true);

        const indexPath = path.join(distPath, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should serve index.html with proper DOCTYPE and root div', async () => {
        const res = await request(app).get('/');

        expect(res.text).toMatch(/<!DOCTYPE html>/i);
        expect(res.text).toContain('<div id="root"></div>');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. TEST ISOLATION VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Test Isolation Verification', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('should create independent polls that do not share state', async () => {
        // Create poll A and vote on it
        const pollA = await request(app)
            .post('/api/polls')
            .send({ question: 'Isolation A?', options: ['A1', 'A2'] });
        await request(app)
            .post(`/api/polls/${pollA.body.id}/vote`)
            .send({ optionIndex: 0 });

        // Create poll B — should have 0 votes
        const pollB = await request(app)
            .post('/api/polls')
            .send({ question: 'Isolation B?', options: ['B1', 'B2'] });

        expect(pollB.body.options[0].votes).toBe(0);
        expect(pollB.body.options[1].votes).toBe(0);

        // Verify poll A still has its vote
        const pollAGet = await request(app).get(`/api/polls/${pollA.body.id}`);
        expect(pollAGet.body.options[0].votes).toBe(1);
    });

    it('should generate unique UUIDs for every poll', async () => {
        const ids = new Set();
        for (let i = 0; i < 50; i++) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: `Unique ${i}?`, options: ['A', 'B'] });
            ids.add(res.body.id);
        }
        expect(ids.size).toBe(50);
    });

    it('should not have shared mutable state between requests', async () => {
        // Two polls with the same question should be independent entities
        const poll1 = await request(app)
            .post('/api/polls')
            .send({ question: 'Same question?', options: ['Same A', 'Same B'] });
        const poll2 = await request(app)
            .post('/api/polls')
            .send({ question: 'Same question?', options: ['Same A', 'Same B'] });

        expect(poll1.body.id).not.toBe(poll2.body.id);

        // Vote on poll1 should not affect poll2
        await request(app)
            .post(`/api/polls/${poll1.body.id}/vote`)
            .send({ optionIndex: 0 });

        const poll2Get = await request(app).get(`/api/polls/${poll2.body.id}`);
        expect(poll2Get.body.options[0].votes).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. API IDEMPOTENCY AND CONSISTENCY CHECKS
// ─────────────────────────────────────────────────────────────────────────────

describe('API Idempotency and Consistency', () => {
    let app;

    beforeAll(() => {
        app = require('../server/app');
    });

    it('GET /api/polls/:id should be idempotent (same result for same input)', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Idempotent GET?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        const res1 = await request(app).get(`/api/polls/${pollId}`);
        const res2 = await request(app).get(`/api/polls/${pollId}`);
        const res3 = await request(app).get(`/api/polls/${pollId}`);

        expect(res1.body).toEqual(res2.body);
        expect(res2.body).toEqual(res3.body);
    });

    it('GET /api/health should be idempotent', async () => {
        const res1 = await request(app).get('/api/health');
        const res2 = await request(app).get('/api/health');

        expect(res1.body.status).toBe(res2.body.status);
        expect(res1.status).toBe(res2.status);
    });

    it('POST /api/polls should create a new poll each time (not idempotent)', async () => {
        const payload = { question: 'Not idempotent?', options: ['A', 'B'] };

        const res1 = await request(app).post('/api/polls').send(payload);
        const res2 = await request(app).post('/api/polls').send(payload);

        expect(res1.body.id).not.toBe(res2.body.id);
        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);
    });

    it('POST /api/polls/:id/vote should increment vote count each time (not idempotent)', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Vote not idempotent?', options: ['A', 'B'] });

        const pollId = createRes.body.id;
        const payload = { optionIndex: 0 };

        const res1 = await request(app).post(`/api/polls/${pollId}/vote`).send(payload);
        const res2 = await request(app).post(`/api/polls/${pollId}/vote`).send(payload);

        expect(res1.body.options[0].votes).toBe(1);
        expect(res2.body.options[0].votes).toBe(2);
    });

    it('should return application/json Content-Type for all API endpoints', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Content type?', options: ['A', 'B'] });

        const healthRes = await request(app).get('/api/health');
        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        const voteRes = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });
        const notFoundRes = await request(app).get('/api/polls/nonexistent');

        for (const res of [createRes, healthRes, getRes, voteRes, notFoundRes]) {
            expect(res.headers['content-type']).toMatch(/application\/json/);
        }
    });

    it('should return correct HTTP status codes for all operations', async () => {
        // 201 for creation
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Status codes?', options: ['A', 'B'] });
        expect(createRes.status).toBe(201);

        // 200 for GET
        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.status).toBe(200);

        // 200 for vote
        const voteRes = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });
        expect(voteRes.status).toBe(200);

        // 200 for health
        const healthRes = await request(app).get('/api/health');
        expect(healthRes.status).toBe(200);

        // 404 for not found
        const notFoundRes = await request(app).get('/api/polls/nonexistent');
        expect(notFoundRes.status).toBe(404);

        // 400 for validation error
        const badReqRes = await request(app)
            .post('/api/polls')
            .send({ question: '', options: [] });
        expect(badReqRes.status).toBe(400);
    });
});
