const request = require('supertest');
const app = require('../app');

describe('API Integration Tests', () => {

    // ── Health Check ──────────────────────────────────────────────

    describe('GET /api/health', () => {
        it('should return 200 with status ok', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.timestamp).toBeDefined();
        });

        it('should return a valid ISO 8601 timestamp', async () => {
            const res = await request(app).get('/api/health');
            expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
        });
    });

    // ── Security Headers ──────────────────────────────────────────

    describe('Security Headers', () => {
        it('should include X-Content-Type-Options: nosniff', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should include X-Frame-Options: DENY', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-frame-options']).toBe('DENY');
        });
    });

    // ── Create Poll ───────────────────────────────────────────────

    describe('POST /api/polls', () => {
        it('should create a poll with valid data and return 201', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Best color?', options: ['Red', 'Blue', 'Green'] });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.question).toBe('Best color?');
            expect(res.body.options).toHaveLength(3);
            expect(res.body.options[0].label).toBe('Red');
            expect(res.body.options[0].votes).toBe(0);
            expect(res.body.options[1].label).toBe('Blue');
            expect(res.body.options[2].label).toBe('Green');
            expect(res.body.created_at).toBeDefined();
        });

        it('should return a UUID v4 format id', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', 'B'] });

            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(res.body.id).toMatch(uuidRegex);
        });

        it('should return created_at in ISO 8601 format without milliseconds', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Format test?', options: ['A', 'B'] });

            // Should match pattern like "2026-04-07T23:03:02Z" (no milliseconds)
            expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        });

        it('should create a poll with 2 options (minimum)', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Min options?', options: ['Yes', 'No'] });

            expect(res.status).toBe(201);
            expect(res.body.options).toHaveLength(2);
        });

        it('should create a poll with 6 options (maximum)', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Max options?', options: ['A', 'B', 'C', 'D', 'E', 'F'] });

            expect(res.status).toBe(201);
            expect(res.body.options).toHaveLength(6);
        });

        it('should trim question and option whitespace', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: '  Trimmed?  ', options: ['  A  ', '  B  '] });

            expect(res.status).toBe(201);
            expect(res.body.question).toBe('Trimmed?');
            expect(res.body.options[0].label).toBe('A');
            expect(res.body.options[1].label).toBe('B');
        });

        it('should initialize all option votes to 0', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Votes?', options: ['X', 'Y'] });

            for (const opt of res.body.options) {
                expect(opt.votes).toBe(0);
            }
        });

        it('should include option ids as integers', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'IDs?', options: ['A', 'B'] });

            for (const opt of res.body.options) {
                expect(typeof opt.id).toBe('number');
                expect(Number.isInteger(opt.id)).toBe(true);
            }
        });

        // ── Validation errors ──

        it('should return 400 when question is missing', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ options: ['A', 'B'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Question is required');
        });

        it('should return 400 when question is empty string', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: '', options: ['A', 'B'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Question is required');
        });

        it('should return 400 when question is whitespace only', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: '   ', options: ['A', 'B'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Question is required');
        });

        it('should return 400 when question exceeds 500 characters', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'x'.repeat(501), options: ['A', 'B'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Question must be 500 characters or fewer');
        });

        it('should accept a question of exactly 500 characters', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'x'.repeat(500), options: ['A', 'B'] });

            expect(res.status).toBe(201);
        });

        it('should return 400 when options is not an array', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: 'not-array' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Options must be an array');
        });

        it('should return 400 when options is missing', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Options must be an array');
        });

        it('should return 400 with fewer than 2 options', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['Only one'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('At least 2 options are required');
        });

        it('should return 400 with 0 options', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('At least 2 options are required');
        });

        it('should return 400 with more than 6 options', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No more than 6 options are allowed');
        });

        it('should return 400 when an option is empty string', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', ''] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('All options must be non-empty strings');
        });

        it('should return 400 when an option is whitespace only', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', '   '] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('All options must be non-empty strings');
        });

        it('should return 400 when an option is not a string', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', 123] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('All options must be non-empty strings');
        });

        it('should return 400 when an option exceeds 200 characters', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', 'x'.repeat(201)] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Each option must be 200 characters or fewer');
        });

        it('should accept an option of exactly 200 characters', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Test?', options: ['A', 'x'.repeat(200)] });

            expect(res.status).toBe(201);
        });

        it('should return 400 when question is a number', async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 123, options: ['A', 'B'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Question is required');
        });
    });

    // ── Get Poll ──────────────────────────────────────────────────

    describe('GET /api/polls/:id', () => {
        let pollId;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Get test?', options: ['A', 'B', 'C'] });
            pollId = res.body.id;
        });

        it('should return 200 with poll data for existing poll', async () => {
            const res = await request(app).get(`/api/polls/${pollId}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(pollId);
            expect(res.body.question).toBe('Get test?');
            expect(res.body.options).toHaveLength(3);
            expect(res.body.created_at).toBeDefined();
        });

        it('should return options with correct structure', async () => {
            const res = await request(app).get(`/api/polls/${pollId}`);

            for (const opt of res.body.options) {
                expect(opt).toHaveProperty('id');
                expect(opt).toHaveProperty('label');
                expect(opt).toHaveProperty('votes');
                expect(typeof opt.id).toBe('number');
                expect(typeof opt.label).toBe('string');
                expect(typeof opt.votes).toBe('number');
            }
        });

        it('should return created_at in ISO 8601 format with Z suffix', async () => {
            const res = await request(app).get(`/api/polls/${pollId}`);

            expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        });

        it('should return 404 for non-existent poll', async () => {
            const res = await request(app).get('/api/polls/nonexistent-id');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Poll not found');
        });

        it('should return 404 for empty id', async () => {
            const res = await request(app).get('/api/polls/00000000-0000-0000-0000-000000000000');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Poll not found');
        });
    });

    // ── Cast Vote ─────────────────────────────────────────────────

    describe('POST /api/polls/:id/vote', () => {
        let pollId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/polls')
                .send({ question: 'Vote test?', options: ['X', 'Y', 'Z'] });
            pollId = res.body.id;
        });

        it('should return 200 and increment the vote count', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(pollId);
            expect(res.body.options[0].votes).toBe(1);
            expect(res.body.options[1].votes).toBe(0);
            expect(res.body.options[2].votes).toBe(0);
        });

        it('should increment the correct option', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 2 });

            expect(res.body.options[0].votes).toBe(0);
            expect(res.body.options[1].votes).toBe(0);
            expect(res.body.options[2].votes).toBe(1);
        });

        it('should accumulate multiple votes', async () => {
            await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 1 });
            await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 1 });
            const res = await request(app).post(`/api/polls/${pollId}/vote`).send({ optionIndex: 1 });

            expect(res.body.options[1].votes).toBe(3);
        });

        it('should return the full updated poll object', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('question');
            expect(res.body).toHaveProperty('options');
            expect(res.body).toHaveProperty('created_at');
            expect(res.body.question).toBe('Vote test?');
        });

        it('should return created_at in correct ISO 8601 format', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        });

        // ── Vote validation errors ──

        it('should return 404 for non-existent poll', async () => {
            const res = await request(app)
                .post('/api/polls/nonexistent-id/vote')
                .send({ optionIndex: 0 });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Poll not found');
        });

        it('should return 400 when optionIndex is missing', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('optionIndex is required and must be a number');
        });

        it('should return 400 when optionIndex is null', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: null });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('optionIndex is required and must be a number');
        });

        it('should return 400 when optionIndex is a string', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 'abc' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('optionIndex is required and must be a number');
        });

        it('should return 400 when optionIndex is a float', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 1.5 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('optionIndex is required and must be a number');
        });

        it('should return 400 when optionIndex is negative', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: -1 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid option index');
        });

        it('should return 400 when optionIndex is out of range', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 10 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid option index');
        });

        it('should return 400 when optionIndex equals options length (off by one)', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 3 }); // options are [X, Y, Z], so 3 is out of range

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid option index');
        });

        it('should return 400 when optionIndex is a boolean', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: true });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('optionIndex is required and must be a number');
        });

        it('should accept optionIndex 0 (first option)', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 0 });

            expect(res.status).toBe(200);
        });

        it('should accept optionIndex at last valid index', async () => {
            const res = await request(app)
                .post(`/api/polls/${pollId}/vote`)
                .send({ optionIndex: 2 }); // last valid for 3-option poll

            expect(res.status).toBe(200);
        });
    });

    // ── Poll Persistence ──────────────────────────────────────────

    describe('Data Persistence', () => {
        it('should persist poll data after creation', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'Persist test?', options: ['A', 'B'] });

            const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.question).toBe('Persist test?');
            expect(getRes.body.options).toHaveLength(2);
        });

        it('should persist vote counts', async () => {
            const createRes = await request(app)
                .post('/api/polls')
                .send({ question: 'Vote persist?', options: ['A', 'B'] });

            await request(app)
                .post(`/api/polls/${createRes.body.id}/vote`)
                .send({ optionIndex: 0 });

            const getRes = await request(app).get(`/api/polls/${createRes.body.id}`);
            expect(getRes.body.options[0].votes).toBe(1);
        });
    });
});
