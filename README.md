# Cozy Threads — AI Live Chat Agent

A customer support chat widget where an AI agent answers questions about a fictional store ("Cozy Threads") — shipping, returns, support hours, etc.

**Stack:** Express + TypeScript · SvelteKit · PostgreSQL (Prisma) · Redis · OpenAI

---

## How It Works

```
User types message in chat widget (SvelteKit)
        ↓
POST /chat/message  →  Backend (Express)
        ↓
Save message to Postgres
        ↓
Check Redis FAQ cache (first message only) → hit? skip OpenAI
        ↓
Call OpenAI with store knowledge + conversation history
        ↓
Save AI reply to Postgres · update Redis cache
        ↓
Return reply to frontend · display in chat
```

On page reload, the frontend reads `sessionId` from `localStorage` and fetches past messages via `GET /chat/session/:id` (served from Redis cache when available).

---

## Important Note — Production (Render Free Tier)

The backend is deployed on **Render's free plan**. The server **sleeps after ~15 minutes of inactivity**.

- The **first message after sleep** can take **30–60 seconds** while the server wakes up.
- After that, responses are normal speed.
- The chat UI shows a hint about this so users aren't surprised by the wait.

This is a Render free-tier limitation, not an app bug.

**Production services:**
| Service | Provider |
|---|---|
| Frontend | Vercel |
| Backend | Render (free) |
| Database | Neon.tech (PostgreSQL) |
| Cache | Upstash (Redis) |

---

## Local Setup (Step by Step)

All commands below assume you are in the **project root** (`spur_assignment/`) unless stated otherwise.

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres + Redis)
- OpenAI API key → [platform.openai.com](https://platform.openai.com)

### Step 1 — Clone and install

```bash
git clone https://github.com/ayush844/spur_assignment.git
cd spur_assignment
npm run install:all
```

### Step 2 — Start Postgres and Redis (Docker)

From project root:

```bash
docker compose up -d
```

If this fails with a port conflict, make sure ports **5433** (Postgres) and **6380** (Redis) are free — fix that and try again.

| Service | Container | Host port |
|---|---|---|
| PostgreSQL 15 | `spur_chat_db` | **5433** |
| Redis 7 | `spur_chat_redis` | **6380** |

Check they're running:

```bash
docker compose ps
```

### Step 3 — Backend environment

From project root:

```bash
cp .env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/spur_chat
REDIS_URL=redis://localhost:6380
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGIN=http://localhost:5173
```

### Step 4 — Frontend environment

From project root:

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### Step 5 — Database setup (Prisma)

From project root:

```bash
npm run db:migrate
```

This runs `prisma db push` — creates `conversations` and `messages` tables in Postgres. No seed data needed; store FAQ knowledge lives in the LLM prompt.

### Step 6 — Run the app

From project root, in two separate terminals:

```bash
# Terminal 1 — backend (http://localhost:3001)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:frontend
```

Open **http://localhost:5173** and talk with the bot

**Local ports summary:**

| Service | Port |
|---|---|
| Frontend (Vite) | `5173` |
| Backend (Express) | `3001` |
| PostgreSQL (Docker) | `5433` |
| Redis (Docker) | `6380` |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default (local) | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key |
| `DATABASE_URL` | No | `postgresql://postgres:postgres@localhost:5433/spur_chat` | Postgres connection (Prisma) |
| `REDIS_URL` | No | `redis://localhost:6380` | Redis connection |
| `PORT` | No | `3001` | Backend port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `MAX_MESSAGE_LENGTH` | No | `4000` | Max chars per user message |
| `MAX_HISTORY_MESSAGES` | No | `20` | Prior messages sent to LLM as context |
| `MAX_TOKENS` | No | `500` | Max tokens per LLM reply |
| `REDIS_SESSION_TTL_SECONDS` | No | `3600` | Session cache TTL (1 hour) |
| `REDIS_FAQ_TTL_SECONDS` | No | `86400` | FAQ cache TTL (24 hours) |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (1 min) |
| `RATE_LIMIT_MAX` | No | `30` | Max requests per IP per window |

### Frontend (`frontend/.env`)

| Variable | Required | Default (local) | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend API URL |

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat/message` | Send a message, get AI reply |
| `GET` | `/chat/session/:sessionId` | Get conversation history |
| `GET` | `/health` | Health check |

**POST /chat/message**

```json
// Request
{ "message": "What's your return policy?", "sessionId": "optional-uuid" }

// Response
{ "reply": "...", "sessionId": "uuid" }
```

---

## Architecture

```
frontend/                 SvelteKit chat widget
  src/lib/api.ts          fetch calls to backend
  src/lib/ChatWidget.svelte

backend/
  prisma/schema.prisma    DB schema (source of truth)
  src/
    routes/               URL → controller mapping only
    controllers/          validate input, call services, return JSON
    services/
      chat.ts             orchestrates DB + cache + LLM
      llm.ts              OpenAI integration
      cache.ts            Redis read/write/invalidate
    db/
      prisma.ts           Prisma client
      repository.ts       DB queries (createConversation, addMessage, …)
    cache/redis.ts        Redis connection
    schemas/              Zod validation
    middleware/           rate limiting, async error handler
    knowledge/store.ts    hardcoded store FAQ for LLM prompt
```

**Request flow:**

```
Route → Controller → Service → Repository / Cache / LLM
                         ↓
                    Postgres · Redis · OpenAI
```

### Design decisions

1. **Prisma ORM + Zod validation** — type-safe DB queries in `repository.ts`; input validation (empty messages, bad UUIDs, oversized text) at the controller boundary via Zod before hitting the DB or LLM.

2. **Redis caching (graceful fallback)** — two caches, both optional:
   - **Session history** — faster page reloads (`GET /chat/session/:id`)
   - **FAQ replies** — skips OpenAI when a new user asks the same first-message FAQ (e.g. return policy). Saves cost and latency.
   - If Redis is down, the app still works — it just skips caching.

3. **LLM behind one function** — `generateReply(history, userMessage)` in `services/llm.ts`. Swapping OpenAI for Anthropic is a one-file change.

4. **Session = conversation UUID** — frontend stores it in `localStorage`; no auth needed for this exercise.

---

## LLM Integration

- **Provider:** OpenAI (`gpt-4o-mini`)
- **Prompting:**
  - System prompt includes hardcoded store knowledge from `knowledge/store.ts` (shipping, returns, hours, payment)
  - Last **20 messages** sent as conversation history for follow-up context (`MAX_HISTORY_MESSAGES=20`)
  - Instructions: answer concisely, stay in scope, don't invent policies
- **Guardrails:**
  - Zod rejects empty / oversized messages (400)
  - API errors (401, 429, timeout) mapped to friendly user-facing messages
  - `max_tokens: 500` cap for cost control
  - Error replies still saved to DB so history stays consistent

---

## Database

**Tables** (see `backend/prisma/schema.prisma`):

| Table | Fields |
|---|---|
| `conversations` | `id` (UUID), `created_at` |
| `messages` | `id`, `conversation_id`, `sender` (enum: `user` \| `ai`), `text`, `created_at` |

FAQ content is in the LLM prompt, not the database.

---

## Redis Caching

| Key | Purpose | TTL |
|---|---|---|
| `session:{uuid}:history` | Cached message list for reload | 1 hour |
| `faq:{normalized question}` | Cached AI reply for repeat first-message FAQs | 24 hours |

Postgres is always the source of truth. Redis is a speed/cost layer only.

---

## Trade-offs & Notes

This project covers the full assignment scope — chat UI, backend API, Postgres persistence, Redis caching, OpenAI integration, input validation, rate limiting, error handling, and deployment.

**Things to be aware of:**

- **20-message context window** — only the last 20 messages are sent to OpenAI. Older messages are still stored in Postgres and shown in the UI, but the AI won't remember them when generating replies. Long conversations may lose early context.

- **Render free-tier cold starts** — the backend sleeps after ~15 min of inactivity. The first request after sleep takes 30–60 seconds. The UI warns users about this. Upgrading to a paid Render plan would fix it.

- **FAQ cache is first-message only** — Redis caches replies for repeat opening questions (e.g. "What's your return policy?") to save OpenAI costs. Follow-up messages always hit the LLM since they need conversation context.

- **Store knowledge is hardcoded** — shipping/return policies live in `knowledge/store.ts` and the LLM prompt. Changing them requires a code deploy.

- **Rate limiting is in-memory** — 30 requests/minute per IP.

**Possible future improvements:**

- Streaming responses (SSE) for token-by-token display
- Admin panel to edit store knowledge
