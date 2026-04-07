import { useState } from 'react';

function PollForm({ onSubmit, loading }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);

    function addOption() {
        if (options.length < 6) {
            setOptions([...options, '']);
        }
    }

    function removeOption(index) {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    }

    function updateOption(index, value) {
        const updated = [...options];
        updated[index] = value;
        setOptions(updated);
    }

    function handleSubmit(e) {
        e.preventDefault();

        const trimmedQuestion = question.trim();
        const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0);

        if (!trimmedQuestion) return;
        if (trimmedOptions.length < 2) return;

        onSubmit(trimmedQuestion, trimmedOptions);
    }

    const canSubmit = question.trim().length > 0 &&
        options.filter(o => o.trim().length > 0).length >= 2;

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
                <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Question
                </label>
                <input
                    id="question"
                    type="text"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="What do you want to ask?"
                    maxLength={500}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Options
                </label>
                <div className="space-y-3">
                    {options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                            <input
                                type="text"
                                value={opt}
                                onChange={e => updateOption(i, e.target.value)}
                                placeholder={`Option ${i + 1}`}
                                maxLength={200}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                            />
                            {options.length > 2 && (
                                <button
                                    type="button"
                                    onClick={() => removeOption(i)}
                                    className="px-3 py-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    aria-label="Remove option"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {options.length < 6 && (
                    <button
                        type="button"
                        onClick={addOption}
                        className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
                    >
                        + Add Option
                    </button>
                )}
            </div>

            <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                    </>
                ) : (
                    'Create Poll'
                )}
            </button>
        </form>
    );
}

export default PollForm;
