const { createPoll, getPoll, castVote, getOptionsForPoll } = require('../db/queries');

describe('Database Queries', () => {

    describe('createPoll', () => {
        it('should create a poll and its options atomically', () => {
            const id = 'test-create-1';
            createPoll(id, 'Test question?', ['Option A', 'Option B']);

            const poll = getPoll(id);
            expect(poll).not.toBeNull();
            expect(poll.question).toBe('Test question?');
            expect(poll.options).toHaveLength(2);
        });

        it('should set initial vote counts to 0', () => {
            const id = 'test-create-2';
            createPoll(id, 'Votes zero?', ['X', 'Y', 'Z']);

            const poll = getPoll(id);
            for (const opt of poll.options) {
                expect(opt.votes).toBe(0);
            }
        });

        it('should preserve option order', () => {
            const id = 'test-create-3';
            createPoll(id, 'Order test?', ['First', 'Second', 'Third']);

            const poll = getPoll(id);
            expect(poll.options[0].label).toBe('First');
            expect(poll.options[1].label).toBe('Second');
            expect(poll.options[2].label).toBe('Third');
        });

        it('should set created_at automatically', () => {
            const id = 'test-create-4';
            createPoll(id, 'Timestamp?', ['A', 'B']);

            const poll = getPoll(id);
            expect(poll.created_at).toBeDefined();
            expect(poll.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        });

        it('should create polls with different IDs independently', () => {
            createPoll('test-create-5a', 'Poll A?', ['A1', 'A2']);
            createPoll('test-create-5b', 'Poll B?', ['B1', 'B2']);

            const pollA = getPoll('test-create-5a');
            const pollB = getPoll('test-create-5b');
            expect(pollA.question).toBe('Poll A?');
            expect(pollB.question).toBe('Poll B?');
        });
    });

    describe('getPoll', () => {
        it('should return null for non-existent poll', () => {
            const poll = getPoll('nonexistent-id');
            expect(poll).toBeNull();
        });

        it('should return full poll object with correct shape', () => {
            const id = 'test-get-1';
            createPoll(id, 'Shape test?', ['A', 'B']);

            const poll = getPoll(id);
            expect(poll).toHaveProperty('id', id);
            expect(poll).toHaveProperty('question', 'Shape test?');
            expect(poll).toHaveProperty('options');
            expect(poll).toHaveProperty('created_at');
        });

        it('should return options with id, label, and votes', () => {
            const id = 'test-get-2';
            createPoll(id, 'Options shape?', ['A', 'B']);

            const poll = getPoll(id);
            for (const opt of poll.options) {
                expect(typeof opt.id).toBe('number');
                expect(typeof opt.label).toBe('string');
                expect(typeof opt.votes).toBe('number');
            }
        });

        it('should format created_at as ISO 8601 with Z suffix', () => {
            const id = 'test-get-3';
            createPoll(id, 'Format?', ['A', 'B']);

            const poll = getPoll(id);
            // Should be like "2026-04-07T23:00:00Z" — no milliseconds
            expect(poll.created_at).not.toContain('.');
            expect(poll.created_at).toMatch(/Z$/);
        });
    });

    describe('castVote', () => {
        it('should increment vote count and return true', () => {
            const id = 'test-vote-1';
            createPoll(id, 'Vote?', ['A', 'B']);

            const poll = getPoll(id);
            const optionId = poll.options[0].id;
            const result = castVote(id, optionId);

            expect(result).toBe(true);
            const updated = getPoll(id);
            expect(updated.options[0].votes).toBe(1);
        });

        it('should only increment the targeted option', () => {
            const id = 'test-vote-2';
            createPoll(id, 'Targeted?', ['A', 'B', 'C']);

            const poll = getPoll(id);
            castVote(id, poll.options[1].id);

            const updated = getPoll(id);
            expect(updated.options[0].votes).toBe(0);
            expect(updated.options[1].votes).toBe(1);
            expect(updated.options[2].votes).toBe(0);
        });

        it('should accumulate multiple votes on same option', () => {
            const id = 'test-vote-3';
            createPoll(id, 'Accumulate?', ['A', 'B']);

            const poll = getPoll(id);
            const optionId = poll.options[0].id;
            castVote(id, optionId);
            castVote(id, optionId);
            castVote(id, optionId);

            const updated = getPoll(id);
            expect(updated.options[0].votes).toBe(3);
        });

        it('should return false for non-existent poll/option combination', () => {
            const result = castVote('nonexistent-poll', 999);
            expect(result).toBe(false);
        });

        it('should return false for wrong option id in valid poll', () => {
            const id = 'test-vote-4';
            createPoll(id, 'Wrong option?', ['A', 'B']);

            const result = castVote(id, 999999);
            expect(result).toBe(false);
        });
    });

    describe('getOptionsForPoll', () => {
        it('should return options ordered by id', () => {
            const id = 'test-opts-1';
            createPoll(id, 'Ordered?', ['First', 'Second', 'Third']);

            const options = getOptionsForPoll(id);
            expect(options).toHaveLength(3);
            expect(options[0].label).toBe('First');
            expect(options[1].label).toBe('Second');
            expect(options[2].label).toBe('Third');
            expect(options[0].id).toBeLessThan(options[1].id);
            expect(options[1].id).toBeLessThan(options[2].id);
        });

        it('should return empty array for non-existent poll', () => {
            const options = getOptionsForPoll('nonexistent-poll');
            expect(options).toEqual([]);
        });

        it('should include raw votes count', () => {
            const id = 'test-opts-2';
            createPoll(id, 'Raw votes?', ['A', 'B']);

            const options = getOptionsForPoll(id);
            expect(options[0].votes).toBe(0);
            expect(options[1].votes).toBe(0);
        });
    });
});
