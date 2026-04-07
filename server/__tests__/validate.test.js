const { validateCreatePoll, validateVote } = require('../middleware/validate');

// Helper to create mock req/res/next
function createMocks(body = {}) {
    const req = { body };
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('validateCreatePoll', () => {
    it('should call next() for valid input', () => {
        const { req, res, next } = createMocks({
            question: 'Test?',
            options: ['A', 'B']
        });

        validateCreatePoll(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should trim question and options before passing to next', () => {
        const { req, res, next } = createMocks({
            question: '  Trimmed?  ',
            options: ['  A  ', '  B  ']
        });

        validateCreatePoll(req, res, next);
        expect(req.body.question).toBe('Trimmed?');
        expect(req.body.options).toEqual(['A', 'B']);
    });

    // Question validation
    it('should reject missing question', () => {
        const { req, res, next } = createMocks({ options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question is required');
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject empty string question', () => {
        const { req, res, next } = createMocks({ question: '', options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question is required');
    });

    it('should reject whitespace-only question', () => {
        const { req, res, next } = createMocks({ question: '   ', options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question is required');
    });

    it('should reject non-string question', () => {
        const { req, res, next } = createMocks({ question: 42, options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question is required');
    });

    it('should reject null question', () => {
        const { req, res, next } = createMocks({ question: null, options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question is required');
    });

    it('should reject question exceeding 500 chars', () => {
        const { req, res, next } = createMocks({
            question: 'x'.repeat(501),
            options: ['A', 'B']
        });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Question must be 500 characters or fewer');
    });

    it('should accept question of exactly 500 chars', () => {
        const { req, res, next } = createMocks({
            question: 'x'.repeat(500),
            options: ['A', 'B']
        });
        validateCreatePoll(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    // Options validation
    it('should reject non-array options', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: 'string' });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Options must be an array');
    });

    it('should reject missing options', () => {
        const { req, res, next } = createMocks({ question: 'Q?' });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Options must be an array');
    });

    it('should reject fewer than 2 options', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A'] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('At least 2 options are required');
    });

    it('should reject empty options array', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: [] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('At least 2 options are required');
    });

    it('should reject more than 6 options', () => {
        const { req, res, next } = createMocks({
            question: 'Q?',
            options: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('No more than 6 options are allowed');
    });

    it('should accept exactly 2 options', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A', 'B'] });
        validateCreatePoll(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should accept exactly 6 options', () => {
        const { req, res, next } = createMocks({
            question: 'Q?',
            options: ['A', 'B', 'C', 'D', 'E', 'F']
        });
        validateCreatePoll(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should reject empty string option', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A', ''] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('All options must be non-empty strings');
    });

    it('should reject whitespace-only option', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A', '   '] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('All options must be non-empty strings');
    });

    it('should reject null option', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A', null] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('All options must be non-empty strings');
    });

    it('should reject numeric option', () => {
        const { req, res, next } = createMocks({ question: 'Q?', options: ['A', 123] });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('All options must be non-empty strings');
    });

    it('should reject option exceeding 200 chars', () => {
        const { req, res, next } = createMocks({
            question: 'Q?',
            options: ['A', 'x'.repeat(201)]
        });
        validateCreatePoll(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Each option must be 200 characters or fewer');
    });

    it('should accept option of exactly 200 chars', () => {
        const { req, res, next } = createMocks({
            question: 'Q?',
            options: ['A', 'x'.repeat(200)]
        });
        validateCreatePoll(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('validateVote', () => {
    it('should call next() for valid integer optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: 0 });
        validateVote(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should accept optionIndex of 0', () => {
        const { req, res, next } = createMocks({ optionIndex: 0 });
        validateVote(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should accept positive integer optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: 5 });
        validateVote(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should reject missing optionIndex', () => {
        const { req, res, next } = createMocks({});
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject null optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: null });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject undefined optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: undefined });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject string optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: 'abc' });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject float optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: 1.5 });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject boolean optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: true });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('optionIndex is required and must be a number');
    });

    it('should reject negative optionIndex', () => {
        const { req, res, next } = createMocks({ optionIndex: -1 });
        validateVote(req, res, next);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid option index');
    });

    it('should reject negative zero (still valid as 0)', () => {
        const { req, res, next } = createMocks({ optionIndex: -0 });
        // -0 === 0 in JavaScript, so this should pass
        validateVote(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
