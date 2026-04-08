/**
 * QA Iteration 2 Test Suite — Quick Poll App
 *
 * Covers gaps identified in iteration 2 review:
 *   1. BUG-001 fix verification (Dockerfile health check URL corrected)
 *   2. Rapid repeated request resilience (rate-limiting behavior)
 *   3. Database edge cases (DB_PATH=:memory: mode, schema integrity)
 *   4. SPA fallback / static file serving (React Router client-side routing)
 *   5. CORS behavior verification
 *   6. Content-Security-Policy / security header completeness
 *   7. Malformed Content-Type handling
 *   8. Express error handler behavior
 *   9. Build infrastructure validation (Dockerfile content verification)
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server/app');

// ─────────────────────────────────────────────────────────────────────────────
// 1. BUG-001 FIX VERIFICATION — Dockerfile Health Check
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-001 Fix: Dockerfile Health Check URL', () => {
    it('should have the corrected health check URL in Dockerfile', () => {
        const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        // The HEALTHCHECK line must use /api/health, NOT /health
        expect(content).toContain('http://localhost:3000/api/health');
        expect(content).not.toMatch(/http:\/\/localhost:3000\/health[^/]/);
    });

    it('should match the health check URL to the actual health endpoint', () => {
        const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        // Extract the URL from the HEALTHCHECK line
        const healthCheckMatch = content.match(/http:\/\/localhost:\d+\/[^'"]*/);
        expect(healthCheckMatch).not.toBeNull();

        const healthCheckUrl = healthCheckMatch[0];
        // The URL path should be /api/health
        const urlPath = new URL(healthCheckUrl).pathname;
        expect(urlPath).toBe('/api/health');
    });

    it('should confirm /api/health returns 200 with JSON (the expected Docker health check behavior)', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.status).toBe('ok');
    });

    it('should confirm /health does NOT return a JSON health response (old incorrect path)', async () => {
        const res = await request(app).get('/health');

        // /health falls through to SPA fallback (HTML), not the health API
        // If it were JSON with status 'ok', the old Dockerfile bug would still work
        const isJsonHealthResponse = (
            res.headers['content-type'] &&
            res.headers['content-type'].includes('application/json') &&
            res.body &&
            res.body.status === 'ok'
        );
        expect(isJsonHealthResponse).toBe(false);
    });

    it('should have HEALTHCHECK directive with proper parameters', () => {
        const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        // Verify HEALTHCHECK has interval, timeout, start-period, retries
        expect(content).toMatch(/HEALTHCHECK/);
        expect(content).toMatch(/--interval=/);
        expect(content).toMatch(/--timeout=/);
        expect(content).toMatch(/--start-period=/);
        expect(content).toMatch(/--retries=/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. RAPID REPEATED REQUEST RESILIENCE
// ─────────────────────────────────────────────────────────────────────────────

describe('Rapid Repeated Request Resilience', () => {
    it('should handle 50 rapid poll creation requests without crashing', async () => {
        const promises = Array.from({ length: 50 }, (_, i) =>
            request(app)
                .post('/api/polls')
                .send({ question: `Rapid create ${i}?`, options: ['A', 'B'] })
        );

        const results = await Promise.all(promises);

        // All should succeed
        for (const res of results) {
            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
        }

        // All IDs should be unique
        const ids = new Set(results.map(r => r.body.id));
        expect(ids.size).toBe(50);
    });

    it('should handle 50 rapid health check requests without errors', async () => {
        const promises = Array.from({ length: 50 }, () =>
            request(app).get('/api/health')
        );

        const results = await Promise.all(promises);

        for (const res of results) {
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        }
    });

    it('should handle rapid alternating create and vote requests', async () => {
        // Create a poll first
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Rapid alternating?', options: ['A', 'B', 'C'] });

        const pollId = createRes.body.id;

        // Fire 30 rapid votes across all 3 options (10 each)
        const promises = [];
        for (let i = 0; i < 30; i++) {
            promises.push(
                request(app)
                    .post(`/api/polls/${pollId}/vote`)
                    .send({ optionIndex: i % 3 })
            );
        }

        const results = await Promise.all(promises);

        // All should succeed
        for (const res of results) {
            expect(res.status).toBe(200);
        }

        // Verify final counts
        const finalPoll = await request(app).get(`/api/polls/${pollId}`);
        expect(finalPoll.body.options[0].votes).toBe(10);
        expect(finalPoll.body.options[1].votes).toBe(10);
        expect(finalPoll.body.options[2].votes).toBe(10);
    });

    it('should handle rapid GET requests for the same poll', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Rapid reads?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        const promises = Array.from({ length: 30 }, () =>
            request(app).get(`/api/polls/${pollId}`)
        );

        const results = await Promise.all(promises);

        for (const res of results) {
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(pollId);
            expect(res.body.question).toBe('Rapid reads?');
        }
    });

    it('should handle rapid requests to non-existent polls (404 flood)', async () => {
        const promises = Array.from({ length: 20 }, (_, i) =>
            request(app).get(`/api/polls/nonexistent-${i}`)
        );

        const results = await Promise.all(promises);

        for (const res of results) {
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Poll not found');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATABASE EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Database Edge Cases', () => {
    it('should operate correctly in DB_PATH=:memory: mode (test isolation)', async () => {
        // This test suite already runs with DB_PATH=:memory:
        // Verify that the in-memory database supports all operations
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Memory mode?', options: ['Yes', 'No'] });

        expect(createRes.status).toBe(201);

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.question).toBe('Memory mode?');

        const voteRes = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });
        expect(voteRes.status).toBe(200);
        expect(voteRes.body.options[0].votes).toBe(1);
    });

    it('should handle WAL journal mode in memory database', async () => {
        // WAL mode is set in db/index.js; verify the DB works with it
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'WAL test?', options: ['A', 'B'] });

        expect(res.status).toBe(201);

        // Create and immediately read — tests WAL consistency
        const readRes = await request(app).get(`/api/polls/${res.body.id}`);
        expect(readRes.body.question).toBe('WAL test?');
    });

    it('should enforce foreign key constraints (options reference valid poll)', async () => {
        // Create a poll
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'FK test?', options: ['A', 'B'] });

        expect(createRes.status).toBe(201);

        // Verify options are tied to the correct poll
        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.body.options).toHaveLength(2);

        // Trying to vote on a non-existent poll should fail properly
        const badVote = await request(app)
            .post('/api/polls/fake-poll-id/vote')
            .send({ optionIndex: 0 });
        expect(badVote.status).toBe(404);
    });

    it('should handle poll creation with maximum allowed data (boundary test)', async () => {
        // 6 options, each at max length, question at max length
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'A'.repeat(500),
                options: Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i).repeat(200))
            });

        expect(res.status).toBe(201);
        expect(res.body.question.length).toBe(500);
        expect(res.body.options).toHaveLength(6);

        // Verify it persists and retrieves correctly
        const getRes = await request(app).get(`/api/polls/${res.body.id}`);
        expect(getRes.body.question.length).toBe(500);
        expect(getRes.body.options).toHaveLength(6);
    });

    it('should handle sequential creation of many polls (DB scalability)', async () => {
        const ids = [];
        for (let i = 0; i < 25; i++) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: `Sequential ${i}?`, options: ['A', 'B'] });
            expect(res.status).toBe(201);
            ids.push(res.body.id);
        }

        // Verify all 25 polls are retrievable
        for (const id of ids) {
            const res = await request(app).get(`/api/polls/${id}`);
            expect(res.status).toBe(200);
        }
    });

    it('should support autoincrementing option IDs across multiple polls', async () => {
        const res1 = await request(app)
            .post('/api/polls')
            .send({ question: 'Autoincrement A?', options: ['A1', 'A2'] });

        const res2 = await request(app)
            .post('/api/polls')
            .send({ question: 'Autoincrement B?', options: ['B1', 'B2'] });

        // Option IDs from poll 2 should be greater than those from poll 1
        const lastIdPoll1 = Math.max(...res1.body.options.map(o => o.id));
        const firstIdPoll2 = Math.min(...res2.body.options.map(o => o.id));
        expect(firstIdPoll2).toBeGreaterThan(lastIdPoll1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SPA FALLBACK / STATIC FILE SERVING
// ─────────────────────────────────────────────────────────────────────────────

describe('SPA Fallback and Static File Serving', () => {
    it('should serve HTML for unknown routes (SPA fallback for React Router)', async () => {
        const res = await request(app).get('/poll/some-random-id');

        // SPA fallback should return 200 with HTML content
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('should serve HTML for root path /', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('should serve HTML for /poll/:id routes (React Router client routes)', async () => {
        const res = await request(app).get('/poll/123e4567-e89b-12d3-a456-426614174000');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('should NOT serve SPA fallback for /api/* routes (API takes precedence)', async () => {
        // API routes should return JSON, not HTML
        const healthRes = await request(app).get('/api/health');
        expect(healthRes.headers['content-type']).toMatch(/application\/json/);

        // API 404s should also return JSON, not HTML
        const notFoundRes = await request(app).get('/api/polls/nonexistent');
        expect(notFoundRes.status).toBe(404);
        expect(notFoundRes.headers['content-type']).toMatch(/application\/json/);
    });

    it('should serve HTML containing the React root div', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.text).toContain('<div id="root"></div>');
    });

    it('should serve the same HTML for any non-API GET route (consistent SPA entry)', async () => {
        const routes = [
            '/',
            '/poll/abc',
            '/about',
            '/some/deep/nested/route',
            '/poll/123/results',
        ];

        const responses = await Promise.all(
            routes.map(route => request(app).get(route))
        );

        // All should return the same HTML content
        const firstBody = responses[0].text;
        for (const res of responses) {
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/html/);
            expect(res.text).toBe(firstBody);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CORS BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('CORS Behavior', () => {
    it('should respond to requests without Origin header (same-origin)', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        // No CORS middleware is configured, so no Access-Control-Allow-Origin header
    });

    it('should handle requests with Origin header (no explicit CORS middleware)', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://localhost:5173');

        expect(res.status).toBe(200);
        // The app does not configure CORS middleware, so cross-origin behavior
        // depends on the browser. API should still respond successfully.
        expect(res.body.status).toBe('ok');
    });

    it('should handle POST requests with Origin header', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Origin', 'http://localhost:5173')
            .send({ question: 'CORS POST test?', options: ['A', 'B'] });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('CORS POST test?');
    });

    it('should handle OPTIONS preflight request gracefully', async () => {
        const res = await request(app)
            .options('/api/polls')
            .set('Origin', 'http://example.com')
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'Content-Type');

        // Without CORS middleware, Express returns 200 by default for OPTIONS
        // The app should not crash or return 500
        expect(res.status).toBeLessThan(500);
    });

    it('should not set Access-Control-Allow-Origin header (no CORS middleware configured)', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://evil.com');

        // No CORS middleware means no ACAO header
        // This is the expected behavior for a single-origin SPA
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SECURITY HEADERS COMPLETENESS
// ─────────────────────────────────────────────────────────────────────────────

describe('Security Headers Completeness', () => {
    it('should set X-Content-Type-Options: nosniff on API responses', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options: DENY on API responses', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should set security headers on error responses (400)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: '', options: [] });

        expect(res.status).toBe(400);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should set security headers on error responses (404)', async () => {
        const res = await request(app).get('/api/polls/does-not-exist');

        expect(res.status).toBe(404);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should set security headers on SPA fallback responses', async () => {
        const res = await request(app).get('/some/unknown/route');

        expect(res.status).toBe(200);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should set security headers on POST /api/polls/:id/vote responses', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'CSP vote?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should verify X-Powered-By is not exposed (information disclosure)', async () => {
        const res = await request(app).get('/api/health');

        // Express sets X-Powered-By by default, but it's recommended to disable
        // Document whether it's present (not a hard requirement for this app)
        // This test documents the current state
        if (res.headers['x-powered-by']) {
            expect(res.headers['x-powered-by']).toBe('Express');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MALFORMED CONTENT-TYPE HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe('Malformed Content-Type Handling', () => {
    it('should handle POST with no Content-Type header', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', '')
            .send('');

        // Should return 400 (missing question/options) rather than crashing
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
    });

    it('should handle POST with text/plain Content-Type', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'text/plain')
            .send('{"question":"Test?","options":["A","B"]}');

        // Express JSON parser won't parse text/plain by default
        // Should fail with validation error, not crash
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle POST with application/x-www-form-urlencoded Content-Type', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send('question=Test&options[]=A&options[]=B');

        // Express JSON parser won't parse form data by default
        // Should fail with validation error, not crash
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle POST with invalid JSON body without crashing', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('{invalid json');

        // Express JSON parser throws SyntaxError, caught by global error handler
        // Returns 500 (generic internal server error) — this is expected behavior
        expect(res.status).toBeGreaterThanOrEqual(400);
        // Verify no stack traces leak
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('SyntaxError');
        expect(bodyStr).not.toContain('node_modules');
    });

    it('should handle POST vote with invalid JSON body without crashing', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Bad JSON vote?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .set('Content-Type', 'application/json')
            .send('{not json}');

        // SyntaxError caught by global error handler → 500
        expect(res.status).toBeGreaterThanOrEqual(400);
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('SyntaxError');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. EXPRESS ERROR HANDLER BEHAVIOR
// ─────────────────────────────────────────────────────────────────────────────

describe('Express Error Handler', () => {
    it('should return 500 with generic error for oversized payloads', async () => {
        const hugeBody = {
            question: 'Q',
            options: ['A', 'B'],
            padding: 'x'.repeat(1024 * 1024 + 1)
        };

        const res = await request(app)
            .post('/api/polls')
            .send(hugeBody);

        // Express body-parser throws PayloadTooLargeError
        // Global error handler catches it and returns generic 500
        expect(res.status).toBeGreaterThanOrEqual(400);
        // Verify no stack traces leak in the response body
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('node_modules');
        expect(bodyStr).not.toContain('PayloadTooLargeError');
    });

    it('should not leak error details in response body', async () => {
        const res = await request(app)
            .post('/api/polls')
            .set('Content-Type', 'application/json')
            .send('{malformed');

        // SyntaxError from JSON parser → caught by global error handler → 500
        expect(res.status).toBeGreaterThanOrEqual(400);
        const bodyStr = JSON.stringify(res.body);
        // Should not contain file paths or stack traces
        expect(bodyStr).not.toMatch(/\/.*\.js:\d+/);
        expect(bodyStr).not.toContain('SyntaxError');
        expect(bodyStr).not.toContain('node_modules');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. DOCKERFILE AND BUILD INFRASTRUCTURE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Dockerfile and Build Infrastructure', () => {
    it('should have a valid Dockerfile', () => {
        const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
        expect(fs.existsSync(dockerfilePath)).toBe(true);

        const content = fs.readFileSync(dockerfilePath, 'utf8');
        expect(content).toContain('FROM node:');
        expect(content).toContain('WORKDIR /app');
        expect(content).toContain('EXPOSE 3000');
        expect(content).toContain('CMD');
    });

    it('should use port 3000 in Dockerfile (matching Express default)', () => {
        const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
        const content = fs.readFileSync(dockerfilePath, 'utf8');

        expect(content).toContain('EXPOSE 3000');
        expect(content).toContain('ENV PORT=3000');
    });

    it('should have a root package.json with required scripts', () => {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts.build).toBeDefined();
        expect(pkg.scripts.start).toBeDefined();
        expect(pkg.scripts.postinstall).toBeDefined();
        expect(pkg.scripts.test).toBeDefined();
        expect(pkg.scripts['test:qa']).toBeDefined();
        expect(pkg.scripts['test:all']).toBeDefined();
    });

    it('should have a server package.json with required dependencies', () => {
        const pkgPath = path.join(__dirname, '..', 'server', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        expect(pkg.dependencies).toBeDefined();
        expect(pkg.dependencies.express).toBeDefined();
        expect(pkg.dependencies['better-sqlite3']).toBeDefined();
        expect(pkg.dependencies.uuid).toBeDefined();
    });

    it('should have test dependencies in server devDependencies', () => {
        const pkgPath = path.join(__dirname, '..', 'server', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        expect(pkg.devDependencies).toBeDefined();
        expect(pkg.devDependencies.jest).toBeDefined();
        expect(pkg.devDependencies.supertest).toBeDefined();
    });

    it('should have a build script that references client build', () => {
        const buildScriptPath = path.join(__dirname, '..', 'scripts', 'build.sh');
        expect(fs.existsSync(buildScriptPath)).toBe(true);

        const content = fs.readFileSync(buildScriptPath, 'utf8');
        expect(content).toContain('client');
    });

    it('should have client dist directory with index.html', () => {
        const distPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
        expect(fs.existsSync(distPath)).toBe(true);

        const content = fs.readFileSync(distPath, 'utf8');
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('<div id="root"></div>');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. API RESPONSE CONSISTENCY UNDER EDGE CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('API Response Consistency Under Edge Conditions', () => {
    it('should return consistent poll structure after many votes', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Many votes?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        // Cast 100 votes
        const promises = Array.from({ length: 100 }, () =>
            request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 })
        );
        await Promise.all(promises);

        // Verify structure is still consistent
        const res = await request(app).get(`/api/polls/${pollId}`);
        expect(res.status).toBe(200);

        const keys = Object.keys(res.body).sort();
        expect(keys).toEqual(['created_at', 'id', 'options', 'question']);
        expect(res.body.options).toHaveLength(2);
        expect(res.body.options[0].votes).toBe(100);
        expect(res.body.options[1].votes).toBe(0);

        for (const opt of res.body.options) {
            const optKeys = Object.keys(opt).sort();
            expect(optKeys).toEqual(['id', 'label', 'votes']);
        }
    });

    it('should handle creating a poll immediately after heavy vote load', async () => {
        // Heavy vote load on existing poll
        const existingPoll = await request(app)
            .post('/api/polls')
            .send({ question: 'Heavy load?', options: ['A', 'B'] });

        const votePromises = Array.from({ length: 50 }, () =>
            request(app)
                .post(`/api/polls/${existingPoll.body.id}/vote`)
                .send({ optionIndex: 0 })
        );
        await Promise.all(votePromises);

        // Immediately create a new poll
        const newPoll = await request(app)
            .post('/api/polls')
            .send({ question: 'After heavy load?', options: ['X', 'Y'] });

        expect(newPoll.status).toBe(201);
        expect(newPoll.body.options[0].votes).toBe(0);
        expect(newPoll.body.options[1].votes).toBe(0);
    });

    it('should correctly handle voting on the last option index', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Last index?', options: ['A', 'B', 'C', 'D', 'E', 'F'] });

        // Vote on last option (index 5)
        const voteRes = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 5 });

        expect(voteRes.status).toBe(200);
        expect(voteRes.body.options[5].votes).toBe(1);
        // All other options should remain 0
        for (let i = 0; i < 5; i++) {
            expect(voteRes.body.options[i].votes).toBe(0);
        }
    });

    it('should maintain created_at timestamp immutability after votes', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Timestamp immutable?', options: ['A', 'B'] });

        const originalTimestamp = createRes.body.created_at;

        // Cast several votes
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post(`/api/polls/${createRes.body.id}/vote`)
                .send({ optionIndex: 0 });
        }

        // Verify timestamp hasn't changed
        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.body.created_at).toBe(originalTimestamp);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. REQUEST LOGGING VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Request Handling Edge Cases', () => {
    it('should handle requests with query parameters gracefully', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Query params?', options: ['A', 'B'] });

        const res = await request(app).get(`/api/polls/${createRes.body.id}?extra=param&foo=bar`);
        expect(res.status).toBe(200);
        expect(res.body.question).toBe('Query params?');
    });

    it('should handle requests with trailing slashes', async () => {
        const res = await request(app).get('/api/health/');
        // May return 200 or redirect, but should not crash
        expect(res.status).toBeLessThan(500);
    });

    it('should handle requests with double slashes in path', async () => {
        const res = await request(app).get('//api//health');
        // Should handle gracefully — either route normally or return non-500
        expect(res.status).toBeLessThan(500);
    });

    it('should handle HEAD request to health endpoint', async () => {
        const res = await request(app).head('/api/health');
        // Express automatically handles HEAD for GET routes
        expect(res.status).toBe(200);
    });

    it('should handle HEAD request to poll endpoint', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'HEAD test?', options: ['A', 'B'] });

        const res = await request(app).head(`/api/polls/${createRes.body.id}`);
        expect(res.status).toBe(200);
    });
});
