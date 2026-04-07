import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PollPage from './pages/PollPage';

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-gray-50">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/poll/:id" element={<PollPage />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
