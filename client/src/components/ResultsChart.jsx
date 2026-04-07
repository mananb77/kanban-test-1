function ResultsChart({ options }) {
    const maxVotes = Math.max(...options.map(o => o.votes), 1);
    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);

    return (
        <div>
            <div className="space-y-4">
                {options.map(option => {
                    const widthPercent = (option.votes / maxVotes) * 100;
                    return (
                        <div key={option.id}>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-800">{option.label}</span>
                                <span className="text-sm text-gray-500">
                                    {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                    className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${widthPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="mt-4 text-sm text-gray-500 text-center">
                Total: {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </p>
        </div>
    );
}

export default ResultsChart;
