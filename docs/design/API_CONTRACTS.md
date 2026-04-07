# API Contracts — Quick Poll App

## 1. Overview

| Property | Value |
|----------|-------|
| Base URL | `http://localhost:3000/api` |
| Protocol | HTTP/1.1 |
| Content Type | `application/json` |
| Authentication | None (public API) |
| Versioning | None (single version) |

## 2. Endpoints

### 2.1 Create Poll

**`POST /api/polls`**

Creates a new poll with a question and 2–6 answer options.

**Request:**

```json
{
    "question": "Best pizza topping?",
    "options": ["Pepperoni", "Mushrooms", "Pineapple"]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `question` | string | Yes | Non-empty, max 500 characters |
| `options` | string[] | Yes | 2–6 items, each non-empty, max 200 characters each |

**Response: `201 Created`**

```json
{
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "question": "Best pizza topping?",
    "options": [
        { "id": 1, "label": "Pepperoni", "votes": 0 },
        { "id": 2, "label": "Mushrooms", "votes": 0 },
        { "id": 3, "label": "Pineapple", "votes": 0 }
    ],
    "created_at": "2026-04-07T20:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| `400` | Missing or empty `question` | `{ "error": "Question is required" }` |
| `400` | `options` not an array | `{ "error": "Options must be an array" }` |
| `400` | Fewer than 2 options | `{ "error": "At least 2 options are required" }` |
| `400` | More than 6 options | `{ "error": "No more than 6 options are allowed" }` |
| `400` | Any option is empty | `{ "error": "All options must be non-empty strings" }` |

---

### 2.2 Get Poll

**`GET /api/polls/:id`**

Fetches a poll by its UUID, including all options and current vote counts.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | UUID of the poll |

**Response: `200 OK`**

```json
{
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "question": "Best pizza topping?",
    "options": [
        { "id": 1, "label": "Pepperoni", "votes": 5 },
        { "id": 2, "label": "Mushrooms", "votes": 3 },
        { "id": 3, "label": "Pineapple", "votes": 1 }
    ],
    "created_at": "2026-04-07T20:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Poll ID not found | `{ "error": "Poll not found" }` |

---

### 2.3 Cast Vote

**`POST /api/polls/:id/vote`**

Casts a vote for a specific option on a poll.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | UUID of the poll |

**Request:**

```json
{
    "optionIndex": 0
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `optionIndex` | number | Yes | Integer, 0-based index into the options array |

**Response: `200 OK`**

Returns the updated poll with incremented vote counts (same shape as GET):

```json
{
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "question": "Best pizza topping?",
    "options": [
        { "id": 1, "label": "Pepperoni", "votes": 6 },
        { "id": 2, "label": "Mushrooms", "votes": 3 },
        { "id": 3, "label": "Pineapple", "votes": 1 }
    ],
    "created_at": "2026-04-07T20:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Poll ID not found | `{ "error": "Poll not found" }` |
| `400` | `optionIndex` missing or not a number | `{ "error": "optionIndex is required and must be a number" }` |
| `400` | `optionIndex` out of range | `{ "error": "Invalid option index" }` |

---

## 3. Common Response Shape

All poll responses share this shape:

```typescript
interface PollResponse {
    id: string;          // UUID v4
    question: string;
    options: {
        id: number;      // Auto-increment integer
        label: string;
        votes: number;
    }[];
    created_at: string;  // ISO 8601 datetime
}
```

All error responses share this shape:

```typescript
interface ErrorResponse {
    error: string;       // Human-readable error message
}
```

## 4. HTTP Headers

### Request Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes (for POST) |

### Response Headers

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

## 5. Status Code Summary

| Code | Meaning | Used By |
|------|---------|---------|
| `200` | Success | GET /api/polls/:id, POST /api/polls/:id/vote |
| `201` | Created | POST /api/polls |
| `400` | Bad Request (validation) | POST /api/polls, POST /api/polls/:id/vote |
| `404` | Not Found | GET /api/polls/:id, POST /api/polls/:id/vote |
| `500` | Internal Server Error | Any (unexpected errors) |

## 6. Vote Mechanism

The `optionIndex` in the vote request is a **0-based index** into the poll's options array (ordered by option `id`). The server:

1. Fetches the poll and its options ordered by `id`
2. Validates `optionIndex` is within `[0, options.length - 1]`
3. Maps the index to the option's database `id`
4. Increments the `votes` column for that option
5. Returns the full updated poll

This approach matches the frontend's array rendering order, making it straightforward for clients.

## 7. CORS Configuration

For development (Vite dev server on port 5173, Express on port 3000):

```javascript
// In development, Vite proxies /api requests to Express
// vite.config.js:
server: {
    proxy: {
        '/api': 'http://localhost:3000'
    }
}
```

In production, both frontend and API are served from the same Express server on port 3000, so CORS is not needed.
