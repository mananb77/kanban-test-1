import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PollForm from '../components/PollForm';
import { createPoll } from '../api';

function HomePage() {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleCreate(question, options) {
        setError('');
        setLoading(true);
        try {
            const poll = await createPoll(question, options);
            navigate(`/poll/${poll.id}`);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Quick Poll</h1>
            <p className="text-gray-500 mb-8 text-center">Create a poll and share it with anyone</p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <PollForm onSubmit={handleCreate} loading={loading} />
        </div>
    );
}

export default HomePage;
