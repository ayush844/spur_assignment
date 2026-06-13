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

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres + Redis)
- OpenAI API key → [platform.openai.com](https://platform.openai.com)

### Step 1 — Clone and install

```bash
git clone https://github.com/ayush844/spur_assignment.git
cd spur_assignment

cd backend && npm install
cd ../frontend && npm install
```

### Step 2 — Start Postgres and Redis (Docker)

From the project root:

```bash
docker compose up -d
```

This starts:

| Service | Container | Host port | Notes |
|---|---|---|---|
| PostgreSQL 15 | `spur_chat_db` | **5433** | Mapped to 5432 inside container |
| Redis 7 | `spur_chat_redis` | **6380** | Mapped to 6379 inside container |

Ports 5433/6380 avoid conflicts if you already have Postgres/Redis on default ports.

Check they're running:

```bash
docker compose ps
```

### Step 3 — Backend environment

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

```bash
cp .env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### Step 5 — Database setup (Prisma)

```bash
cd backend
npm run db:migrate
```

This runs `prisma db push` — creates `conversations` and `messages` tables in Postgres. No seed data needed; store FAQ knowledge lives in the LLM prompt.

If you previously had a `TEXT` sender column and need to migrate to enum:

```bash
npm run db:fix-sender-enum   # one-time, only if needed
npm run db:migrate
```

Browse data locally:

```bash
npx prisma studio
```

### Step 6 — Run the app

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** and try: *"What's your return policy?"*

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default (local) | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key |
| `DATABASE_URL` | No | `postgresql://postgres:postgres@localhost:5433/spur_chat` | Postgres connection (Prisma) |
| `REDIS_URL` | No | `redis://localhost:6380` | Redis connection |
| `PORT` | No | `3001` | Backend port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Frontend URL (set to Vercel URL in prod) |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model |
| `MAX_MESSAGE_LENGTH` | No | `4000` | Max chars per user message |
| `MAX_HISTORY_MESSAGES` | No | `20` | Prior messages sent to LLM |
| `MAX_TOKENS` | No | `500` | Max tokens per LLM reply |
| `REDIS_SESSION_TTL_SECONDS` | No | `3600` | Session cache TTL (1 hour) |
| `REDIS_FAQ_TTL_SECONDS` | No | `86400` | FAQ cache TTL (24 hours) |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (1 min) |
| `RATE_LIMIT_MAX` | No | `30` | Max requests per IP per window |

### Frontend (`frontend/.env`)

| Variable | Required | Default (local) | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend URL (set to Render URL in prod) |

### Production values

On Render, set `DATABASE_URL` to your **Neon** connection string, `REDIS_URL` to your **Upstash** URL, and `CORS_ORIGIN` to your **Vercel** frontend URL.

On Vercel, set `VITE_API_URL` to your **Render** backend URL.

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

1. **Layered backend** — routes, controllers, services, and DB are separate. Adding WhatsApp or Instagram later means a new route/controller reusing the same `chat` service.

2. **Prisma ORM** — type-safe queries in `repository.ts`. Services never touch Prisma directly.

3. **Zod validation** at the controller boundary — empty messages, bad UUIDs, and oversized text are rejected before hitting the DB or LLM.

4. **Redis caching (graceful fallback)** — two caches, both optional:
   - **Session history** — faster page reloads (`GET /chat/session/:id`)
   - **FAQ replies** — skips OpenAI when a new user asks the same first-message FAQ (e.g. return policy). Saves cost and latency.
   - If Redis is down, the app still works — it just skips caching.

5. **LLM behind one function** — `generateReply(history, userMessage)` in `services/llm.ts`. Swapping OpenAI for Anthropic is a one-file change.

6. **Session = conversation UUID** — frontend stores it in `localStorage`; no auth needed for this exercise.

7. **Optimistic UI** — user message shows immediately; typing indicator while waiting for the AI.

---

## LLM Integration

- **Provider:** OpenAI (`gpt-4o-mini`)
- **Prompting:**
  - System prompt includes hardcoded store knowledge from `knowledge/store.ts` (shipping, returns, hours, payment)
  - Last 20 messages sent as conversation history for follow-up context
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

```bash
cd backend
npm run db:migrate      # sync schema to Postgres
npm run db:generate     # regenerate Prisma client after schema changes
npx prisma studio       # browse data in browser
```

No seed script — FAQ content is in the LLM prompt, not the database.

---

## Redis Caching

| Key | Purpose | TTL |
|---|---|---|
| `session:{uuid}:history` | Cached message list for reload | 1 hour |
| `faq:{normalized question}` | Cached AI reply for repeat first-message FAQs | 24 hours |

Postgres is always the source of truth. Redis is a speed/cost layer only.

---

## Deployment

### Backend — Render

- **Build:** `cd backend && npm install && npm run build`
- **Start:** `npm run db:migrate && npm start`
- **Env:** `DATABASE_URL` (Neon), `REDIS_URL` (Upstash), `OPENAI_API_KEY`, `CORS_ORIGIN` (Vercel URL)

### Frontend — Vercel

- **Root directory:** `frontend`
- **Build:** `npm run build`
- **Env:** `VITE_API_URL` (Render backend URL)

### Database — Neon.tech

Create a PostgreSQL database, copy the connection string into Render's `DATABASE_URL`, then run migrations once.

### Cache — Upstash

Create a Redis database, copy the URL into Render's `REDIS_URL`.

---

## Trade-offs & If I Had More Time

**What I prioritized:**
- End-to-end chat with persistence and history reload
- Clean backend layers (routes → controllers → services)
- Redis caching with graceful fallback
- Input validation (Zod) and rate limiting
- Friendly error handling in the UI

**What I'd add with more time:**
- **Streaming responses** — SSE for token-by-token display instead of waiting for the full reply
- **Admin panel** — edit store knowledge without redeploying
- **Tests** — unit tests for validation/LLM error mapping, integration tests for the API
- **Upgrade Render plan** — eliminate cold-start delay on first request
- **Multi-channel adapter** — abstract `Channel` interface for WhatsApp / Instagram later
- **Observability** — structured logging, request tracing

---

## License

MIT — take-home assignment.
