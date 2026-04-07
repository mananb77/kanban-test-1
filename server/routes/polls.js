const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createPoll, getPoll, castVote, getOptionsForPoll } = require('../db/queries');
const { validateCreatePoll, validateVote } = require('../middleware/validate');

const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/polls', validateCreatePoll, (req, res) => {
    const { question, options } = req.body;
    const id = uuidv4();

    createPoll(id, question, options);

    const poll = getPoll(id);
    res.status(201).json(poll);
});

router.get('/polls/:id', (req, res) => {
    const poll = getPoll(req.params.id);
    if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
    }
    res.json(poll);
});

router.post('/polls/:id/vote', validateVote, (req, res) => {
    const { optionIndex } = req.body;
    const pollId = req.params.id;

    const poll = getPoll(pollId);
    if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
    }

    if (optionIndex >= poll.options.length) {
        return res.status(400).json({ error: 'Invalid option index' });
    }

    const targetOptionId = poll.options[optionIndex].id;
    const success = castVote(pollId, targetOptionId);

    if (!success) {
        return res.status(500).json({ error: 'Failed to record vote' });
    }

    const updatedPoll = getPoll(pollId);
    res.json(updatedPoll);
});

module.exports = router;
