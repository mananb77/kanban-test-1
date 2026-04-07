import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPoll, castVote } from '../api';
import VoteSection from '../components/VoteSection';
import ResultsChart from '../components/ResultsChart';
import CopyLinkButton from '../components/CopyLinkButton';

function PollPage() {
    const { id } = useParams();
    const [poll, setPoll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [error, setError] = useState('');
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        async function fetchPoll() {
            try {
                const data = await getPoll(id);
                if (!data) {
                    setNotFound(true);
                } else {
                    setPoll(data);
                }
            } catch (err) {
                setError('Something went wrong. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        fetchPoll();
    }, [id]);

    async function handleVote(optionIndex) {
        setError('');
        setVoting(true);
        try {
            const updated = await castVote(id, optionIndex);
            setPoll(updated);
            setHasVoted(true);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setVoting(false);
        }
    }

    if (loading) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-gray-500">Loading poll...</p>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-xl mx-auto px-4 py-16 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Poll not found</h2>
                <p className="text-gray-500 mb-6">This poll doesn't exist or may have been removed.</p>
                <Link
                    to="/"
                    className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                    Create a New Poll
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{poll.question}</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {hasVoted ? (
                    <ResultsChart options={poll.options} />
                ) : (
                    <VoteSection options={poll.options} onVote={handleVote} loading={voting} />
                )}

                <div className="mt-6 pt-4 border-t border-gray-100">
                    <CopyLinkButton />
                </div>
            </div>

            <div className="mt-4 text-center">
                <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition">
                    Create your own poll
                </Link>
            </div>
        </div>
    );
}

export default PollPage;
