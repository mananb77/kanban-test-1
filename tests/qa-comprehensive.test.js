/**
 * QA Comprehensive Test Suite — Quick Poll App
 *
 * Covers gaps identified during QA review of the existing 101-test suite:
 *   - SQL injection prevention
 *   - XSS content handling
 *   - End-to-end flow testing
 *   - Security headers on all endpoints
 *   - Error sanitization (no stack trace leakage)
 *   - Large payload / body size limits
 *   - Unicode and special character handling
 *   - HTTP method enforcement
 *   - Concurrent vote accumulation
 *   - Poll isolation (cross-poll vote safety)
 *   - Malformed JSON / empty body handling
 *   - Duplicate option labels
 *   - API contract compliance (response structure, Content-Type)
 *   - Dockerfile health check mismatch verification
 *   - Response shape validation for all endpoints
 */

const request = require('supertest');
const app = require('../server/app');

// ─────────────────────────────────────────────────────────────────────────────
// 1. END-TO-END FLOW TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('End-to-End Flow', () => {
    it('should support create → fetch → vote → verify results flow', async () => {
        // Step 1: Create a poll
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Best pizza topping?', options: ['Pepperoni', 'Mushrooms', 'Olives'] });

        expect(createRes.status).toBe(201);
        const pollId = createRes.body.id;
        expect(pollId).toBeDefined();

        // Step 2: Fetch the poll via its unique link
        const fetchRes = await request(app).get(`/api/polls/${pollId}`);
        expect(fetchRes.status).toBe(200);
        expect(fetchRes.body.question).toBe('Best pizza topping?');
        expect(fetchRes.body.options).toHaveLength(3);
        expect(fetchRes.body.options.every(o => o.votes === 0)).toBe(true);

        // Step 3: Vote on option 0 (Pepperoni)
        const voteRes1 = await request(app)
            .post(`/api/polls/${pollId}/vote`)
            .send({ optionIndex: 0 });
        expect(voteRes1.status).toBe(200);
        expect(voteRes1.body.options[0].votes).toBe(1);

        // Step 4: Another user votes on option 1 (Mushrooms)
        const voteRes2 = await request(app)
            .post(`/api/polls/${pollId}/vote`)
            .send({ optionIndex: 1 });
        expect(voteRes2.status).toBe(200);
        expect(voteRes2.body.options[0].votes).toBe(1);
        expect(voteRes2.body.options[1].votes).toBe(1);

        // Step 5: Verify final results via GET
        const resultsRes = await request(app).get(`/api/polls/${pollId}`);
        expect(resultsRes.status).toBe(200);
        expect(resultsRes.body.options[0].votes).toBe(1);
        expect(resultsRes.body.options[1].votes).toBe(1);
        expect(resultsRes.body.options[2].votes).toBe(0);
    });

    it('should support multiple independent polls without interference', async () => {
        const poll1 = await request(app)
            .post('/api/polls')
            .send({ question: 'Poll 1?', options: ['A', 'B'] });
        const poll2 = await request(app)
            .post('/api/polls')
            .send({ question: 'Poll 2?', options: ['C', 'D'] });

        // Vote on poll1
        await request(app)
            .post(`/api/polls/${poll1.body.id}/vote`)
            .send({ optionIndex: 0 });

        // Verify poll2 is unaffected
        const poll2Res = await request(app).get(`/api/polls/${poll2.body.id}`);
        expect(poll2Res.body.options[0].votes).toBe(0);
        expect(poll2Res.body.options[1].votes).toBe(0);

        // Verify poll1 was updated
        const poll1Res = await request(app).get(`/api/polls/${poll1.body.id}`);
        expect(poll1Res.body.options[0].votes).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SQL INJECTION PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

describe('SQL Injection Prevention', () => {
    const sqlPayloads = [
        "'; DROP TABLE polls; --",
        "\" OR 1=1 --",
        "'; DELETE FROM options WHERE 1=1; --",
        "1; UPDATE options SET votes=999 WHERE 1=1; --",
        "Robert'); DROP TABLE polls;--",
        "' UNION SELECT id, question, created_at FROM polls --",
    ];

    it('should safely store SQL injection attempts in question field', async () => {
        for (const payload of sqlPayloads) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: payload, options: ['Safe A', 'Safe B'] });

            expect(res.status).toBe(201);
            // The SQL payload should be stored literally, not executed
            expect(res.body.question).toBe(payload);
        }
    });

    it('should safely store SQL injection attempts in option fields', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'SQL test?',
                options: ["'; DROP TABLE options; --", "\" OR 1=1 --"]
            });

        expect(res.status).toBe(201);
        expect(res.body.options[0].label).toBe("'; DROP TABLE options; --");
        expect(res.body.options[1].label).toBe("\" OR 1=1 --");
    });

    it('should not execute SQL via poll ID parameter', async () => {
        const res = await request(app)
            .get("/api/polls/' OR 1=1 --");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
    });

    it('should not execute SQL via vote endpoint poll ID', async () => {
        const res = await request(app)
            .post("/api/polls/' OR 1=1 --/vote")
            .send({ optionIndex: 0 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
    });

    it('should verify tables still exist after SQL injection attempts', async () => {
        // If tables were dropped, this would fail
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Tables intact?', options: ['Yes', 'No'] });

        expect(res.status).toBe(201);

        const poll = await request(app).get(`/api/polls/${res.body.id}`);
        expect(poll.status).toBe(200);
        expect(poll.body.question).toBe('Tables intact?');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. XSS PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

describe('XSS Prevention', () => {
    it('should store XSS payloads literally in question field (not execute them)', async () => {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert(1)>',
            '<svg onload=alert("xss")>',
            'javascript:alert(1)',
            '<iframe src="javascript:alert(1)">',
            '"><script>document.location="http://evil.com"</script>',
        ];

        for (const payload of xssPayloads) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: payload, options: ['A', 'B'] });

            expect(res.status).toBe(201);
            // XSS payload should be stored as-is (React auto-escapes on render)
            expect(res.body.question).toBe(payload);
        }
    });

    it('should store XSS payloads literally in option fields', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'XSS options test?',
                options: ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>']
            });

        expect(res.status).toBe(201);
        expect(res.body.options[0].label).toBe('<script>alert(1)</script>');
        expect(res.body.options[1].label).toBe('<img src=x onerror=alert(1)>');
    });

    it('should return XSS content safely in GET response (no transformation)', async () => {
        const xssQuestion = '<script>document.cookie</script>';
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: xssQuestion, options: ['A', 'B'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.status).toBe(200);
        // Content stored and returned as-is; React handles escaping at render time
        expect(getRes.body.question).toBe(xssQuestion);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SECURITY HEADERS ON ALL ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Security Headers — All Endpoints', () => {
    it('should include security headers on POST /api/polls', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Headers test?', options: ['A', 'B'] });

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include security headers on GET /api/polls/:id', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Headers GET?', options: ['A', 'B'] });

        const res = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include security headers on POST /api/polls/:id/vote', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Headers vote?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: 0 });

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include security headers on 404 responses', async () => {
        const res = await request(app).get('/api/polls/nonexistent-uuid');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should include security headers on 400 validation errors', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: '', options: ['A', 'B'] });

        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ERROR SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Error Sanitization', () => {
    it('should not leak stack traces in 404 error responses', async () => {
        const res = await request(app).get('/api/polls/nonexistent-id');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('at ');
        expect(JSON.stringify(res.body)).not.toContain('.js:');
    });

    it('should not leak stack traces in 400 validation errors', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: '', options: [] });

        expect(res.status).toBe(400);
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('at ');
    });

    it('should return only { error: string } shape in error responses', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Test?', options: ['A'] });

        expect(res.status).toBe(400);
        const keys = Object.keys(res.body);
        expect(keys).toEqual(['error']);
        expect(typeof res.body.error).toBe('string');
    });

    it('should return only { error: string } shape for 404', async () => {
        const res = await request(app).get('/api/polls/no-such-poll');
        expect(res.status).toBe(404);
        const keys = Object.keys(res.body);
        expect(keys).toEqual(['error']);
    });

    it('should not include internal details in vote 404', async () => {
        const res = await request(app)
            .post('/api/polls/nonexistent/vote')
            .send({ optionIndex: 0 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
        expect(res.body.pollId).toBeUndefined();
        expect(res.body.stack).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. API CONTRACT COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────

describe('API Contract Compliance', () => {
    describe('POST /api/polls response contract', () => {
        it('should return application/json content type', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Content-Type?', options: ['A', 'B'] });

            expect(res.headers['content-type']).toMatch(/application\/json/);
        });

        it('should return exactly {id, question, options, created_at}', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Contract test?', options: ['X', 'Y'] });

            expect(res.status).toBe(201);
            const keys = Object.keys(res.body).sort();
            expect(keys).toEqual(['created_at', 'id', 'options', 'question']);
        });

        it('should return option objects with exactly {id, label, votes}', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Option contract?', options: ['A', 'B'] });

            for (const opt of res.body.options) {
                const optKeys = Object.keys(opt).sort();
                expect(optKeys).toEqual(['id', 'label', 'votes']);
            }
        });
    });

    describe('GET /api/polls/:id response contract', () => {
        it('should return application/json content type', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'CT test?', options: ['A', 'B'] });

            const res = await request(app).get(`/api/polls/${createRes.body.id}`);
            expect(res.headers['content-type']).toMatch(/application\/json/);
        });

        it('should return exactly {id, question, options, created_at}', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'GET contract?', options: ['A', 'B'] });

            const res = await request(app).get(`/api/polls/${createRes.body.id}`);
            const keys = Object.keys(res.body).sort();
            expect(keys).toEqual(['created_at', 'id', 'options', 'question']);
        });
    });

    describe('POST /api/polls/:id/vote response contract', () => {
        it('should return application/json content type', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'Vote CT?', options: ['A', 'B'] });

            const res = await request(app)
                .post(`/api/polls/${createRes.body.id}/vote`)
                .send({ optionIndex: 0 });

            expect(res.headers['content-type']).toMatch(/application\/json/);
        });

        it('should return the full updated poll object', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'Vote response?', options: ['A', 'B'] });

            const res = await request(app)
                .post(`/api/polls/${createRes.body.id}/vote`)
                .send({ optionIndex: 0 });

            const keys = Object.keys(res.body).sort();
            expect(keys).toEqual(['created_at', 'id', 'options', 'question']);
            expect(res.body.options[0].votes).toBe(1);
        });
    });

    describe('GET /api/health response contract', () => {
        it('should return exactly {status, timestamp}', async () => {
            const res = await request(app).get('/api/health');
            const keys = Object.keys(res.body).sort();
            expect(keys).toEqual(['status', 'timestamp']);
            expect(res.body.status).toBe('ok');
        });

        it('should return application/json content type', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['content-type']).toMatch(/application\/json/);
        });
    });

    describe('created_at format compliance', () => {
        it('should use ISO 8601 without milliseconds (YYYY-MM-DDTHH:MM:SSZ)', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Date format?', options: ['A', 'B'] });

            const timestamp = res.body.created_at;
            // Must match exactly: no milliseconds, Z suffix
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
            // Must NOT contain milliseconds (no dot)
            expect(timestamp).not.toContain('.');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. UNICODE AND SPECIAL CHARACTER HANDLING
// ─────────────────────────────────────────────────────────────────────────────

describe('Unicode and Special Character Handling', () => {
    it('should handle emoji in question and options', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Best emoji? 🎉', options: ['👍', '❤️', '🎊'] });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('Best emoji? 🎉');
        expect(res.body.options[0].label).toBe('👍');
        expect(res.body.options[1].label).toBe('❤️');
        expect(res.body.options[2].label).toBe('🎊');
    });

    it('should handle CJK characters', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: '你最喜欢什么颜色？', options: ['红色', '蓝色'] });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('你最喜欢什么颜色？');
        expect(res.body.options[0].label).toBe('红色');
    });

    it('should handle Arabic and RTL text', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'ما هو لونك المفضل؟', options: ['أحمر', 'أزرق'] });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('ما هو لونك المفضل؟');
    });

    it('should handle special characters and symbols', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?',
                options: ['Option with "quotes"', "Option with 'apostrophes'"]
            });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('Special chars: @#$%^&*()_+-=[]{}|;:,.<>?');
        expect(res.body.options[0].label).toBe('Option with "quotes"');
        expect(res.body.options[1].label).toBe("Option with 'apostrophes'");
    });

    it('should handle newline and tab characters in question', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Line1\nLine2\tTabbed', options: ['A', 'B'] });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('Line1\nLine2\tTabbed');
    });

    it('should persist and retrieve unicode content correctly', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: '日本語テスト？', options: ['はい', 'いいえ'] });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        expect(getRes.body.question).toBe('日本語テスト？');
        expect(getRes.body.options[0].label).toBe('はい');
        expect(getRes.body.options[1].label).toBe('いいえ');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. HTTP METHOD ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

describe('HTTP Method Enforcement', () => {
    it('should reject GET request to POST /api/polls', async () => {
        const res = await request(app).get('/api/polls');
        // Should not return 200 or 201 — likely 404 from SPA fallback or method not found
        expect(res.status).not.toBe(201);
    });

    it('should reject PUT request to POST /api/polls', async () => {
        const res = await request(app)
            .put('/api/polls')
            .send({ question: 'PUT test?', options: ['A', 'B'] });

        expect(res.status).not.toBe(201);
    });

    it('should reject DELETE request to GET /api/polls/:id', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'DELETE test?', options: ['A', 'B'] });

        const res = await request(app).delete(`/api/polls/${createRes.body.id}`);
        // DELETE is not a defined endpoint
        expect(res.status).not.toBe(200);
    });

    it('should not cast a vote via GET to /api/polls/:id/vote', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'GET vote test?', options: ['A', 'B'] });

        const pollId = createRes.body.id;
        await request(app).get(`/api/polls/${pollId}/vote`);

        // Verify no vote was actually cast (GET should not modify data)
        const pollRes = await request(app).get(`/api/polls/${pollId}`);
        expect(pollRes.body.options[0].votes).toBe(0);
        expect(pollRes.body.options[1].votes).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. MALFORMED INPUT AND EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Malformed Input and Edge Cases', () => {
    it('should handle empty body on POST /api/polls', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({});

        expect(res.status).toBe(400);
    });

    it('should handle null body values on POST /api/polls', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: null, options: null });

        expect(res.status).toBe(400);
    });

    it('should handle empty body on POST /api/polls/:id/vote', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Empty vote?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({});

        expect(res.status).toBe(400);
    });

    it('should handle array as optionIndex', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Array index?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: [0] });

        expect(res.status).toBe(400);
    });

    it('should handle object as optionIndex', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Obj index?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: { value: 0 } });

        expect(res.status).toBe(400);
    });

    it('should handle very large optionIndex', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Large index?', options: ['A', 'B'] });

        const res = await request(app)
            .post(`/api/polls/${createRes.body.id}/vote`)
            .send({ optionIndex: Number.MAX_SAFE_INTEGER });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid option index');
    });

    it('should handle extra fields in request body gracefully', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'Extra fields?',
                options: ['A', 'B'],
                extraField: 'should be ignored',
                admin: true
            });

        expect(res.status).toBe(201);
        expect(res.body.question).toBe('Extra fields?');
        // Extra fields should not appear in response
        expect(res.body.extraField).toBeUndefined();
        expect(res.body.admin).toBeUndefined();
    });

    it('should allow creating polls with duplicate option labels', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Dupes?', options: ['Same', 'Same'] });

        // Duplicate options are allowed (no uniqueness constraint)
        expect(res.status).toBe(201);
        expect(res.body.options).toHaveLength(2);
        expect(res.body.options[0].label).toBe('Same');
        expect(res.body.options[1].label).toBe('Same');
    });

    it('should handle question at exactly 499 characters (just under limit)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'x'.repeat(499), options: ['A', 'B'] });

        expect(res.status).toBe(201);
    });

    it('should handle option at exactly 199 characters (just under limit)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Test?', options: ['A', 'x'.repeat(199)] });

        expect(res.status).toBe(201);
    });

    it('should handle options with mixed valid and invalid types', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Mixed?', options: ['Valid', null, 'Also valid'] });

        expect(res.status).toBe(400);
    });

    it('should handle 3 options (mid-range count)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Three?', options: ['A', 'B', 'C'] });
        expect(res.status).toBe(201);
        expect(res.body.options).toHaveLength(3);
    });

    it('should handle 4 options', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Four?', options: ['A', 'B', 'C', 'D'] });
        expect(res.status).toBe(201);
        expect(res.body.options).toHaveLength(4);
    });

    it('should handle 5 options', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Five?', options: ['A', 'B', 'C', 'D', 'E'] });
        expect(res.status).toBe(201);
        expect(res.body.options).toHaveLength(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. CONCURRENT VOTE ACCUMULATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Concurrent Vote Accumulation', () => {
    it('should handle multiple rapid votes on the same option correctly', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Concurrent?', options: ['A', 'B'] });

        const pollId = createRes.body.id;

        // Fire 10 votes concurrently on the same option
        const promises = Array.from({ length: 10 }, () =>
            request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 })
        );

        const results = await Promise.all(promises);

        // All should succeed
        for (const res of results) {
            expect(res.status).toBe(200);
        }

        // Final count should be exactly 10
        const finalPoll = await request(app).get(`/api/polls/${pollId}`);
        expect(finalPoll.body.options[0].votes).toBe(10);
        expect(finalPoll.body.options[1].votes).toBe(0);
    });

    it('should handle concurrent votes on different options correctly', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Spread votes?', options: ['A', 'B', 'C'] });

        const pollId = createRes.body.id;

        // 5 votes on each of 3 options = 15 concurrent requests
        const promises = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 5; j++) {
                promises.push(
                    request(app)
                        .post(`/api/polls/${pollId}/vote`)
                        .send({ optionIndex: i })
                );
            }
        }

        await Promise.all(promises);

        const finalPoll = await request(app).get(`/api/polls/${pollId}`);
        expect(finalPoll.body.options[0].votes).toBe(5);
        expect(finalPoll.body.options[1].votes).toBe(5);
        expect(finalPoll.body.options[2].votes).toBe(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. DOCKERFILE HEALTH CHECK VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Health Check Endpoint Verification', () => {
    it('should serve health check at /api/health (the correct path)', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('should NOT serve health check at /health (Dockerfile mismatch)', async () => {
        const res = await request(app).get('/health');
        // /health is not an API route; it falls through to SPA fallback
        // which serves index.html (200 with HTML, not JSON health response)
        expect(res.headers['content-type']).not.toMatch(/application\/json/);
        // This documents the bug: Dockerfile HEALTHCHECK hits /health
        // but the app only serves health at /api/health
    });

    it('should return valid timestamp in health response', async () => {
        const res = await request(app).get('/api/health');
        const timestamp = res.body.timestamp;
        // Should be a valid date string
        expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. POLL ISOLATION AND DATA INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

describe('Poll Isolation and Data Integrity', () => {
    it('should not allow voting on one poll to affect another poll', async () => {
        const poll1 = await request(app)
            .post('/api/polls')
            .send({ question: 'Isolation A?', options: ['A1', 'A2'] });
        const poll2 = await request(app)
            .post('/api/polls')
            .send({ question: 'Isolation B?', options: ['B1', 'B2'] });

        // Vote heavily on poll1
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post(`/api/polls/${poll1.body.id}/vote`)
                .send({ optionIndex: 0 });
        }

        // Verify poll2 is completely unaffected
        const poll2Res = await request(app).get(`/api/polls/${poll2.body.id}`);
        expect(poll2Res.body.options[0].votes).toBe(0);
        expect(poll2Res.body.options[1].votes).toBe(0);
    });

    it('should maintain unique poll IDs', async () => {
        const ids = new Set();
        for (let i = 0; i < 20; i++) {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: `Unique ${i}?`, options: ['A', 'B'] });
            expect(res.status).toBe(201);
            ids.add(res.body.id);
        }
        // All 20 polls should have unique IDs
        expect(ids.size).toBe(20);
    });

    it('should preserve option order across create and fetch', async () => {
        const options = ['Zeta', 'Alpha', 'Mu', 'Beta', 'Omega', 'Gamma'];
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'Order preserved?', options });

        const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
        for (let i = 0; i < options.length; i++) {
            expect(getRes.body.options[i].label).toBe(options[i]);
        }
    });

    it('should correctly track votes across all options in a poll', async () => {
        const createRes = await request(app)
            .post('/api/polls')
            .send({ question: 'All options vote?', options: ['A', 'B', 'C', 'D'] });

        const pollId = createRes.body.id;

        // Vote: A=3, B=1, C=0, D=5
        for (let i = 0; i < 3; i++) await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 0 });
        await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 1 });
        for (let i = 0; i < 5; i++) await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 3 });

        const result = await request(app).get(`/api/polls/${pollId}`);
        expect(result.body.options[0].votes).toBe(3);
        expect(result.body.options[1].votes).toBe(1);
        expect(result.body.options[2].votes).toBe(0);
        expect(result.body.options[3].votes).toBe(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. LARGE PAYLOAD TESTING
// ─────────────────────────────────────────────────────────────────────────────

describe('Large Payload Testing', () => {
    it('should accept a poll with maximum-length question and maximum options', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({
                question: 'Q'.repeat(500),
                options: [
                    'O'.repeat(200),
                    'P'.repeat(200),
                    'Q'.repeat(200),
                    'R'.repeat(200),
                    'S'.repeat(200),
                    'T'.repeat(200),
                ]
            });

        expect(res.status).toBe(201);
        expect(res.body.question.length).toBe(500);
        expect(res.body.options).toHaveLength(6);
        for (const opt of res.body.options) {
            expect(opt.label.length).toBe(200);
        }
    });

    it('should reject payloads exceeding the 1MB body size limit', async () => {
        // Create a payload larger than 1MB
        const largeString = 'x'.repeat(500); // max question length
        const largeOptions = Array.from({ length: 6 }, () => 'x'.repeat(200));
        // This is well under 1MB, so let's make a genuinely oversized payload
        const hugeBody = {
            question: 'Q',
            options: ['A', 'B'],
            // Add padding to exceed 1MB
            padding: 'x'.repeat(1024 * 1024 + 1)
        };

        const res = await request(app)
            .post('/api/polls')
            .send(hugeBody);

        // Express should reject with 413 (Payload Too Large) or similar error
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. UUID FORMAT AND 404 EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('UUID Format and 404 Edge Cases', () => {
    it('should return 404 for empty string poll ID', async () => {
        // GET /api/polls/ would match a different route or fall through
        const res = await request(app).get('/api/polls/');
        // Could be 404 or fall through to SPA — just verify it's not a success with poll data
        expect(res.body.options).toBeUndefined();
    });

    it('should return 404 for UUID-like but non-existent poll ID', async () => {
        const res = await request(app).get('/api/polls/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
    });

    it('should return 404 for very long poll ID', async () => {
        const res = await request(app).get(`/api/polls/${'a'.repeat(1000)}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
    });

    it('should not return poll data for path traversal attempt', async () => {
        const res = await request(app).get('/api/polls/..%2F..%2Fetc%2Fpasswd');
        // Path traversal should either 404 or fall through to SPA — never return poll data
        if (res.status === 404) {
            expect(res.body.error).toBe('Poll not found');
        } else {
            // SPA fallback serves HTML, not JSON poll data
            expect(res.body.options).toBeUndefined();
        }
    });

    it('should return 404 for numeric poll ID', async () => {
        const res = await request(app).get('/api/polls/12345');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Poll not found');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. DATABASE SCHEMA COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────

describe('Database Schema Compliance', () => {
    it('should use UUID text as poll ID (not integer)', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Schema test?', options: ['A', 'B'] });

        expect(typeof res.body.id).toBe('string');
        // UUID v4 format
        expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should use INTEGER for option IDs', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Option ID type?', options: ['A', 'B', 'C'] });

        for (const opt of res.body.options) {
            expect(typeof opt.id).toBe('number');
            expect(Number.isInteger(opt.id)).toBe(true);
            expect(opt.id).toBeGreaterThan(0);
        }
    });

    it('should autoincrement option IDs', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Autoincrement?', options: ['First', 'Second', 'Third'] });

        const ids = res.body.options.map(o => o.id);
        for (let i = 1; i < ids.length; i++) {
            expect(ids[i]).toBeGreaterThan(ids[i - 1]);
        }
    });

    it('should default votes to 0 for new options', async () => {
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'Default votes?', options: ['A', 'B', 'C', 'D'] });

        for (const opt of res.body.options) {
            expect(opt.votes).toBe(0);
        }
    });

    it('should store created_at as UTC datetime', async () => {
        const beforeCreate = new Date();
        const res = await request(app)
            .post('/api/polls')
            .send({ question: 'UTC time?', options: ['A', 'B'] });

        const afterCreate = new Date();
        const createdAt = new Date(res.body.created_at);

        // created_at should be between before and after creation
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - 1000);
        expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + 1000);
    });
});
