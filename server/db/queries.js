const { db } = require('./index');

const insertPoll = db.prepare('INSERT INTO polls (id, question) VALUES (?, ?)');
const insertOption = db.prepare('INSERT INTO options (poll_id, label) VALUES (?, ?)');
const selectPoll = db.prepare('SELECT id, question, created_at FROM polls WHERE id = ?');
const selectOptions = db.prepare('SELECT id, label, votes FROM options WHERE poll_id = ? ORDER BY id');
const updateVote = db.prepare('UPDATE options SET votes = votes + 1 WHERE poll_id = ? AND id = ?');

const createPoll = db.transaction((id, question, options) => {
    insertPoll.run(id, question);
    for (const label of options) {
        insertOption.run(id, label);
    }
});

function formatPoll(row, options) {
    return {
        id: row.id,
        question: row.question,
        options: options.map(o => ({ id: o.id, label: o.label, votes: o.votes })),
        created_at: row.created_at.replace(' ', 'T') + 'Z'
    };
}

function getPoll(id) {
    const row = selectPoll.get(id);
    if (!row) return null;
    const options = selectOptions.all(id);
    return formatPoll(row, options);
}

function castVote(pollId, optionDbId) {
    const result = updateVote.run(pollId, optionDbId);
    return result.changes === 1;
}

function getOptionsForPoll(pollId) {
    return selectOptions.all(pollId);
}

module.exports = { createPoll, getPoll, castVote, getOptionsForPoll };
