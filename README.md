# Cozy Threads — AI Live Chat Agent

A mini customer support chat app where an AI agent answers questions about a fictional e-commerce store ("Cozy Threads"). Built as a Spur founding engineer take-home assignment.

**Stack:** Node.js + TypeScript (Express), SvelteKit, PostgreSQL (Prisma), Redis, OpenAI GPT-4o-mini.

---

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL) — or any running Postgres instance
- OpenAI API key

### 1. Start PostgreSQL and Redis

```bash
docker compose up -d
```

This starts Postgres on port **5433** and Redis on port **6380** (avoids conflicts with other local services).

### 2. Configure environment

```bash
cp .env.example backend/.env
# Edit backend/.env and set your OPENAI_API_KEY
```

### 3. Install dependencies & run migrations

```bash
cd backend && npm install && npm run db:migrate
cd ../frontend && npm install
```

### 4. Start the servers

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** and start chatting.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `DATABASE_URL` | No | `postgresql://postgres:postgres@localhost:5433/spur_chat` | Postgres connection string (Prisma) |
| `REDIS_URL` | No | `redis://localhost:6380` | Redis connection string |
| `REDIS_SESSION_TTL_SECONDS` | No | `3600` | How long session history is cached |
| `REDIS_FAQ_TTL_SECONDS` | No | `86400` | How long FAQ replies are cached |
| `PORT` | No | `3001` | Backend port |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |
| `MAX_MESSAGE_LENGTH` | No | `4000` | Max user message chars |
| `MAX_HISTORY_MESSAGES` | No | `20` | Messages sent to LLM as context |
| `MAX_TOKENS` | No | `500` | Max tokens per LLM response |
| `VITE_API_URL` | No | `http://localhost:3001` | Frontend → backend URL (set in `frontend/.env`) |

---

## API

### `POST /chat/message`

```json
// Request
{ "message": "What's your return policy?", "sessionId": "optional-uuid" }

// Response
{ "reply": "...", "sessionId": "uuid" }
```

### `GET /chat/session/:sessionId`

Returns full message history for a conversation.

### `GET /health`

Health check endpoint.

---

## Architecture

```
frontend/          SvelteKit SPA — chat widget, session persistence (localStorage)
backend/
  prisma/          Prisma schema (conversations, messages)
  src/
    routes/        HTTP handlers (thin — validate input, call services)
    services/      Business logic (chat orchestration, LLM calls, cache)
    db/            Prisma client + repository (clean DB API)
    cache/         Redis client connection
    knowledge/     Store FAQ / domain knowledge (hardcoded prompt context)
    config.ts      Environment config
```

**Design decisions:**

- **Layered backend** — routes → services → repository/cache. Easy to add new channels (WhatsApp, IG) by reusing `chatService` and `llmService`.
- **Prisma ORM** — type-safe DB access in `db/repository.ts` instead of raw SQL. Schema lives in `prisma/schema.prisma`; sync with `npm run db:migrate`.
- **Redis caching** — two caches with graceful fallback if Redis is down:
  - **Session history** (`session:{id}:history`) — speeds up `GET /chat/session/:id` on page reload; invalidated on new messages.
  - **FAQ replies** (`faq:{normalizedQuestion}`) — skips LLM for repeated first-message FAQs (e.g. "What's your return policy?"); 24h TTL.
- **LLM encapsulated** in `services/llm.ts` behind `generateReply(history, userMessage)`. Swapping OpenAI for Anthropic is a one-file change.
- **Domain knowledge** hardcoded in `knowledge/store.ts` and injected into the system prompt. Could move to DB later for admin editing.
- **Session = conversation UUID**. Frontend stores it in `localStorage` and reloads history on page refresh.
- **Optimistic UI** — user message appears immediately; typing indicator while waiting for LLM.
- **Errors surfaced in UI** — LLM failures, rate limits, and network errors return friendly messages, never crash the server.

---

## LLM Integration

- **Provider:** OpenAI (`gpt-4o-mini` by default — fast, cheap, good enough for FAQ)
- **Prompting:** System prompt includes full store knowledge (shipping, returns, hours) plus behavioral instructions. Last 20 messages sent as conversation history for context.
- **Guardrails:**
  - Empty messages rejected (400)
  - Messages over 4,000 chars rejected (400)
  - API errors (401, 429, timeout) caught and mapped to user-friendly replies
  - `max_tokens: 500` cap for cost control
  - AI error replies still persisted so history stays consistent

---

## Database (Prisma)

Schema in `backend/prisma/schema.prisma`:

- `conversations` — id (UUID), created_at
- `messages` — id, conversation_id, sender (`user` | `ai`), text, created_at

```bash
cd backend && npm run db:migrate   # syncs schema to Postgres (prisma db push)
npm run db:generate                # regenerate Prisma client after schema changes
```

DB access goes through `backend/src/db/repository.ts` — services never import Prisma directly.

No seed script needed — store knowledge lives in the prompt, not the DB.

## Redis

Redis runs via Docker on port **6380**. Used for:

| Key pattern | Purpose | TTL |
|---|---|---|
| `session:{uuid}:history` | Cached message list for reload | 1 hour |
| `faq:{normalized question}` | Cached LLM reply for first-message FAQs | 24 hours |

If Redis is unavailable, the app still works — caching is silently skipped.

---

## Deployment

### Backend (Render / Railway / Fly.io)

1. Provision a PostgreSQL database
2. Set env vars (`DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `CORS_ORIGIN`)
3. Build: `cd backend && npm install && npm run build`
4. Start: `npm run db:migrate && npm start`

### Frontend (Vercel / Netlify)

1. Set `VITE_API_URL` to your deployed backend URL
2. Build: `cd frontend && npm install && npm run build`
3. Deploy the `build/` directory (static adapter)

---

## Trade-offs & If I Had More Time

**What I prioritized:**
- Clean separation of concerns
- End-to-end chat with persistence and history reload
- Graceful error handling
- Polished but simple UX (typing indicator, suggestions, auto-scroll)

**What I'd add with more time:**
- **Streaming responses** — SSE or WebSocket for token-by-token display
- **Admin panel** — edit store knowledge without redeploying
- **Rate limiting** — per-IP or per-session throttling
- **Tests** — unit tests for validation/LLM error mapping, integration tests for API
- **Message truncation** — soft-truncate very long messages instead of rejecting
- **Multi-channel adapter pattern** — abstract `Channel` interface for WhatsApp/IG later
- **Observability** — structured logging, request tracing

---

## License

MIT — take-home assignment, not production software.
