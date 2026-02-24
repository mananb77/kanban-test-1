# Build a Full-Stack Quick Poll App

## Summary

Build a simple full-stack web application that allows users to create polls, share them via a unique link, vote, and view live results. The app should have a clean, modern UI and a REST API backend with persistent storage.

## How It Works

1. **Create a poll** — A user visits the home page, types a question (e.g., "Best pizza topping?"), adds 2–6 answer options, and hits "Create Poll"
2. **Share it** — They get a unique link they can copy and send to anyone
3. **Vote** — Anyone with the link picks an option and submits their vote
4. **See results** — After voting, a simple bar chart shows the current vote counts for each option

No login, no accounts. Just create, share, vote, and view results.

## Motivation

This project is a test harness for evaluating agent-driven software development workflows. It covers the key concerns of a real full-stack app — routing, state management, API design, database modeling, and UI — while remaining small enough to build in a single sprint.

## Tech Stack

- **Frontend:** React (Vite) with Tailwind CSS
- **Backend:** Node.js with Express
- **Database:** SQLite (via `better-sqlite3`) — no external DB setup required
- **Monorepo:** Single repo with `client/` and `server/` directories

## Requirements

### Backend (`server/`)

1. **POST `/api/polls`** — Create a new poll
   - Request body: `{ "question": string, "options": string[] }`
   - Returns the created poll object with a unique `id`
2. **GET `/api/polls/:id`** — Fetch a poll by ID
   - Returns the poll question, options, and current vote counts
3. **POST `/api/polls/:id/vote`** — Cast a vote
   - Request body: `{ "optionIndex": number }`
   - Increments the vote count for the selected option
   - Returns the updated poll
4. **Database schema:**
   - `polls` table: `id` (TEXT, primary key, UUID), `question` (TEXT), `created_at` (DATETIME)
   - `options` table: `id` (INTEGER, primary key), `poll_id` (TEXT, FK), `label` (TEXT), `votes` (INTEGER, default 0)

### Frontend (`client/`)

1. **Home page (`/`)** — Form to create a new poll
   - Text input for the question
   - Dynamic list of option inputs (minimum 2, add/remove buttons)
   - "Create Poll" button that POSTs to the API and redirects to the results page
2. **Poll page (`/poll/:id`)** — Vote and view results
   - Displays the question and options as selectable cards or radio buttons
   - "Vote" button to submit a choice
   - After voting, show a results view with a simple bar chart of vote counts
   - A "Copy Link" button to share the poll URL

### Non-Functional

- The server should serve the built frontend in production mode (single `npm start`)
- Include a root-level `package.json` with scripts to install, build, and run the full app
- Include basic input validation (non-empty question, at least 2 options, valid option index)
- No authentication required

## Acceptance Criteria

- [ ] Running `npm install && npm run build && npm start` from the repo root starts the full app on a single port
- [ ] A user can create a poll with a question and 2–6 options
- [ ] A user can vote on a poll and immediately see updated results
- [ ] A user can share a poll link and another user can vote on it
- [ ] Poll data persists across server restarts (SQLite file on disk)
- [ ] The UI is responsive and visually clean

## Out of Scope

- User accounts / authentication
- Real-time WebSocket updates (polling or manual refresh is fine)
- Deployment / CI/CD configuration
- Rate limiting or duplicate vote prevention
