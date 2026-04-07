# Deployment Strategy — Quick Poll App

## 1. Production Architecture

```
┌─────────────────────────────────────────┐
│           Single Server Setup            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   Node.js Process (Express)       │  │
│  │   Port: 3000                      │  │
│  │                                    │  │
│  │   ├── /api/*     → API routes     │  │
│  │   ├── /static/*  → Built React    │  │
│  │   └── /*         → index.html     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   SQLite File: server/polls.db    │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 2. Build & Run Scripts

### Root `package.json` Scripts

```json
{
    "name": "quick-poll-app",
    "version": "1.0.0",
    "private": true,
    "description": "A full-stack quick poll application",
    "scripts": {
        "postinstall": "cd client && npm install && cd ../server && npm install",
        "build": "cd client && npm run build",
        "start": "cd server && node index.js",
        "dev": "cd server && node index.js"
    }
}
```

### Acceptance Criteria Command

```bash
npm install && npm run build && npm start
```

This single command chain:
1. `npm install` — Installs root-level deps (none), then npm automatically runs `postinstall` which installs `client/` and `server/` dependencies
2. `npm run build` — Runs Vite production build in `client/`, outputs to `client/dist/`
3. `npm start` — Starts Express in `server/`, which serves both the API and the built frontend on port 3000

## 3. Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | `development` | Environment mode |
| `DB_PATH` | `./polls.db` | SQLite database file path |

```javascript
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'polls.db');
```

No `.env` file needed for default operation. Environment variables can override defaults.

## 4. Static File Serving

Express serves the built React app in production:

```javascript
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');

// Serve static assets
app.use(express.static(clientDistPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});
```

## 5. Development Workflow

### Running in Development

Two terminals (or use `concurrently`):

**Terminal 1 — Backend:**
```bash
cd server && node index.js
# Express runs on port 3000
```

**Terminal 2 — Frontend:**
```bash
cd client && npm run dev
# Vite runs on port 5173, proxies /api to port 3000
```

### Vite Dev Proxy

```javascript
// client/vite.config.js
export default defineConfig({
    server: {
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
});
```

## 6. Monitoring & Logging

### Application Logging

Simple console-based logging (suitable for this project scope):

```javascript
// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Error logging
app.use((err, req, res, next) => {
    console.error(`${new Date().toISOString()} ERROR:`, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});
```

### Health Check

```javascript
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

## 7. Data Persistence

- SQLite database file (`polls.db`) persists on disk
- Database survives server restarts (acceptance criteria requirement)
- WAL mode journal file (`polls.db-wal`) and SHM file (`polls.db-shm`) are automatically managed

### Backup Strategy

For production use, a simple cron backup:

```bash
cp server/polls.db server/polls.db.backup
```

SQLite's WAL mode allows safe copying while the server is running.

## 8. Infrastructure Requirements

| Requirement | Specification |
|-------------|---------------|
| Runtime | Node.js 18+ |
| Disk Space | ~50 MB (node_modules) + DB growth |
| Memory | ~64 MB minimum |
| CPU | Single core sufficient |
| Network | Single port (3000) |

## 9. Scaling Considerations

This architecture is designed for **single-server deployment** per the requirements. If scaling were needed:

| Concern | Current | Future Option |
|---------|---------|---------------|
| Database | SQLite (single file) | Migrate to PostgreSQL |
| Server | Single process | PM2 cluster or container orchestration |
| Static assets | Express static | CDN/Nginx reverse proxy |

These are out of scope for the current iteration but noted for future reference.
