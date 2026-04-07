function validateCreatePoll(req, res, next) {
    const { question, options } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required' });
    }
    if (question.trim().length > 500) {
        return res.status(400).json({ error: 'Question must be 500 characters or fewer' });
    }
    if (!Array.isArray(options)) {
        return res.status(400).json({ error: 'Options must be an array' });
    }
    if (options.length < 2) {
        return res.status(400).json({ error: 'At least 2 options are required' });
    }
    if (options.length > 6) {
        return res.status(400).json({ error: 'No more than 6 options are allowed' });
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

function validateVote(req, res, next) {
    const { optionIndex } = req.body;

    if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ error: 'optionIndex is required and must be a number' });
    }
    if (typeof optionIndex !== 'number' || !Number.isInteger(optionIndex)) {
        return res.status(400).json({ error: 'optionIndex is required and must be a number' });
    }
    if (optionIndex < 0) {
        return res.status(400).json({ error: 'Invalid option index' });
    }
    next();
}

module.exports = { validateCreatePoll, validateVote };
