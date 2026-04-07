const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const pollRoutes = require('./routes/polls');

const app = express();

// 1. JSON body parsing (must be first)
app.use(express.json({ limit: '1mb' }));

// 2. Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// 3. Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// 4. API routes (MUST come before static files and SPA fallback)
app.use('/api', pollRoutes);

// 5. Static file serving (serves built React app)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// 6. SPA fallback — MUST be last GET handler
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

// 7. Global error handler (Express error middleware — 4 params)
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} ERROR:`, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database
initDb();

module.exports = app;
