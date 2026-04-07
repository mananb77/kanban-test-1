import { useState } from 'react';

function VoteSection({ options, onVote, loading }) {
    const [selected, setSelected] = useState(null);

    function handleSubmit(e) {
        e.preventDefault();
        if (selected !== null) {
            onVote(selected);
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-3 mb-6">
                {options.map((option, index) => (
                    <label
                        key={option.id}
                        className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${
                            selected === index
                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <input
                            type="radio"
                            name="poll-option"
                            value={index}
                            checked={selected === index}
                            onChange={() => setSelected(index)}
                            className="sr-only"
                        />
                        <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mr-3 ${
                            selected === index ? 'border-indigo-600' : 'border-gray-300'
                        }`}>
                            {selected === index && (
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            )}
                        </span>
                        <span className="text-gray-800">{option.label}</span>
                    </label>
                ))}
            </div>

            <button
                type="submit"
                disabled={selected === null || loading}
                className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Voting...
                    </>
                ) : (
                    'Vote'
                )}
            </button>
        </form>
    );
}

export default VoteSection;
