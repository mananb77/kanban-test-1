const API_BASE = '/api';

export async function createPoll(question, options) {
    const res = await fetch(`${API_BASE}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create poll');
    return data;
}

export async function getPoll(id) {
    const res = await fetch(`${API_BASE}/polls/${id}`);
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch poll');
    return data;
}

export async function castVote(id, optionIndex) {
    const res = await fetch(`${API_BASE}/polls/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cast vote');
    return data;
}
