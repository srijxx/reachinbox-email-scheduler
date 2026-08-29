# ReachInbox — Full-Stack Email Job Scheduler

A production-oriented email scheduling platform built for the Outbox Labs / ReachInbox Software Development Engineer Intern assignment.

---

## Project Overview

ReachInbox lets an authenticated user upload a list of email recipients, compose a message, and schedule the entire campaign via BullMQ delayed jobs backed by Redis. Workers pick up jobs when their timers fire, apply per-sender rate limiting, send through Ethereal SMTP, and index results in Elasticsearch. A real Slack notification fires when a sender hits the hourly limit. All state survives process restarts because Redis is the scheduler — not cron.

---

## Features

- **Google OAuth** — real sign-in, HTTP-only session cookies, user data isolation
- **CSV/TXT upload** — PapaParse on the frontend extracts and validates email addresses
- **Email scheduling** — BullMQ delayed jobs; each recipient gets its own job with exact `startTime + delay * index` timing
- **BullMQ worker** — configurable concurrency, processes jobs from Redis
- **Ethereal SMTP** — real test email delivery with preview URL stored per email
- **Status tracking** — `scheduled → processing → sent | failed` state machine in MySQL
- **Idempotency** — unique key per email + status check prevents double-sends
- **Redis-backed rate limiting** — atomic `INCR` per sender per hour window
- **Rescheduling** — over-limit jobs are moved to the next hour; never dropped
- **Elasticsearch** — full-text search across recipient, subject, sender, status
- **Bull Board** — live queue dashboard at `/admin/queues`
- **Slack OAuth** — real Slack app connection; notifications when rate limit fires
- **Restart persistence** — BullMQ/Redis retains delayed jobs across server restarts
- **Pagination** — all list endpoints support page/pageSize
- **Health check** — `/api/health` reports MySQL, Redis, Elasticsearch status

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, PapaParse |
| Backend | Node.js, TypeScript, Express.js |
| Queue | BullMQ, Redis |
| Database | MySQL 8, Prisma ORM |
| Search | Elasticsearch 8 |
| Email | Nodemailer, Ethereal SMTP |
| Auth | Passport.js, Google OAuth 2.0, express-session, connect-redis |
| Notifications | Slack OAuth v2, Slack chat.postMessage API |
| Monitoring | Bull Board |
| Infrastructure | Docker Compose |

---

## Architecture

```mermaid
flowchart TD
    Browser["Browser / React SPA"]
    Express["Express API\n:5000"]
    Passport["Passport.js\nGoogle OAuth"]
    MySQL["MySQL 8\n(Prisma ORM)"]
    BullMQ["BullMQ Queue\nemail-scheduler"]
    Redis["Redis 7\n(queue + sessions\n+ rate limits)"]
    Worker["BullMQ Worker\n(separate process)"]
    RateLimit["Redis Rate Limiter\nemail-rate:{sender}:{hour}"]
    Ethereal["Ethereal SMTP\n(test email)"]
    ES["Elasticsearch 8\nemails index"]
    Slack["Slack API\nchat.postMessage"]
    BullBoard["Bull Board\n/admin/queues"]

    Browser -->|"HTTP + session cookie"| Express
    Express --> Passport
    Express --> MySQL
    Express --> BullMQ
    Express --> ES
    BullMQ -->|"delayed jobs"| Redis
    Worker -->|"consume jobs"| Redis
    Worker --> MySQL
    Worker --> RateLimit
    RateLimit --> Redis
    Worker -->|"send"| Ethereal
    Worker -->|"index"| ES
    Worker -->|"notify"| Slack
    BullBoard -->|"reads"| Redis
```

---

## Scheduling Algorithm

For a campaign with N recipients starting at `startTime` with `delayBetweenEmails` ms:

```
Recipient 1:   startTime
Recipient 2:   startTime + delay * 1
Recipient 3:   startTime + delay * 2
Recipient N:   startTime + delay * (N-1)
```

Each recipient gets one MySQL `Email` record and one BullMQ delayed job (`email-{id}`). The job delay is `scheduledAt - now`. BullMQ stores the job in a Redis sorted set keyed by execution timestamp, so the job survives any number of server restarts.

---

## Why BullMQ Instead of Cron

| Concern | BullMQ + Redis | Cron |
|---|---|---|
| Restart persistence | Jobs live in Redis sorted set | Jobs are lost unless recreated |
| Exact timing | Millisecond-precision delays | Minute-precision at best |
| Concurrency | Built-in worker pool | Requires external coordination |
| Retry logic | Built-in with backoff | Manual implementation |
| Observability | Bull Board | None |
| Multiple workers | Safe with atomic Redis ops | Race conditions |

**Rule: `node-cron`, `cron`, `Agenda`, `Bree`, `setInterval`, and `setTimeout` are not used anywhere in this codebase.**

---

## Restart Persistence

After a restart:

1. The server starts and connects to Redis.
2. BullMQ reconnects to the same Redis instance.
3. All delayed jobs that were previously added are still in the Redis sorted set.
4. When a job's delay expires, a worker picks it up and processes it normally.
5. The worker checks MySQL for the current `status` — already-sent emails are skipped (idempotency).

**We do NOT recreate jobs from MySQL on server startup.** MySQL is the record of what was scheduled; Redis/BullMQ owns the schedule.

---

## Idempotency

Every `Email` record has a unique `idempotencyKey` (UUID-based). Before sending:

```
if email.status === 'sent'  → return immediately, no SMTP call
if email.status === 'failed' → skip (respect final state)
```

The `bullJobId` uses a deterministic format `email-{emailId}`, which prevents duplicate BullMQ jobs for the same email even if `scheduleEmailJob` is called twice.

**Limitation**: The SMTP `sendMail` call and the MySQL status update are not wrapped in a single atomic transaction. In a theoretical scenario where the process crashes after `sendMail` succeeds but before the DB update, the email could be re-attempted on retry. This is the standard "at-least-once delivery" trade-off. To mitigate: the status check happens before `sendMail`, and retry count is bounded at 3 attempts with exponential backoff.

---

## Rate Limiting

### Algorithm

1. Key format: `email-rate:{sender}:{YYYY-MM-DDTHH}` — one counter per sender per UTC hour.
2. On each job: `INCR key` atomically. If count ≤ limit → proceed. If count > limit → `DECR key` (rollback) and reschedule.
3. Key TTL is 3700 seconds to survive the full hour window.
4. Works safely with multiple concurrent workers because Redis `INCR` is atomic.

### Rescheduling

When the limit is reached:

1. The existing BullMQ delayed job is removed from Redis.
2. A new delayed job is created for the start of the next UTC hour.
3. The MySQL `scheduledAt` and `bullJobId` are updated.
4. Emails are **never dropped or permanently failed** due to rate limiting.

### Slack Notification

- Sent at most **once per sender per hour window** (deduplication key: `email-rate-notified:{sender}:{hour}`).
- Slack failures do not affect email processing — logged and ignored.

---

## Minimum Delay (`MIN_EMAIL_DELAY_MS`)

The scheduler pre-calculates `scheduledAt = startTime + delay * index` for each recipient. This means the BullMQ delayed jobs are already spaced out by `delay` milliseconds in Redis — no additional throttling needed at the scheduling stage.

In the worker, a Redis key `email-last-sent:{sender}` tracks the last actual send timestamp. If a job is picked up and the time since the last send for that sender is less than `MIN_EMAIL_DELAY_MS`, the worker sleeps for the remainder.

**Trade-off with concurrency**: When `WORKER_CONCURRENCY > 1`, two workers processing different senders run fully in parallel — which is correct. Two workers processing the same sender will both check `email-last-sent:{sender}`, but there is a small window where both could read the key before either writes it. For the typical use case (delay ≥ 2000ms, concurrency ≤ 5), the pre-spaced BullMQ delays are the primary throttle and the Redis check is a secondary safeguard.

---

## Worker Concurrency

Configured via:

```
WORKER_CONCURRENCY=5
```

| Concurrency | Behavior |
|---|---|
| 1 | Strictly sequential; minimum delay always respected |
| 5 | Five jobs process in parallel; different senders are independent; same sender throttled via Redis last-sent key |
| Multiple instances | Safe — BullMQ uses Redis locks to ensure each job is processed by exactly one worker |

---

## Elasticsearch

- Index name: `emails`
- Document fields: `id`, `recipient`, `subject`, `body`, `sender`, `status`, `scheduledAt`, `sentAt`, `userId`, `etherealPreviewUrl`, `createdAt`
- Indexed on: schedule creation + every status change (non-blocking; failures are logged, not fatal)
- Search: `multi_match` across `recipient`, `subject`, `sender`, `body`, `status` with fuzzy matching
- All queries filter by `userId` — users can only see their own emails

---

## Multiple Senders

The data model stores `sender` per email. Rate limiting operates per sender:

- `senderA@example.com` has its own `email-rate:senderA@example.com:{hour}` counter
- `senderB@example.com` has its own independent counter
- They never interfere with each other

---

## 1000+ Email Architecture

When 1000 emails are scheduled at 6 PM with `hourlyLimit=200`:

1. 1000 BullMQ delayed jobs are created in Redis immediately.
2. Workers pick up jobs as delays expire.
3. The first 200 are processed normally.
4. Jobs 201–1000 each hit the rate limit check, get rescheduled to 7 PM.
5. At 7 PM, the next 200 are processed, and so on.
6. All emails eventually send across 5 hours.

MySQL holds the authoritative record. Elasticsearch is updated at each step. Bull Board shows the full picture.

---

## Local Development Setup

### Prerequisites

- Node.js ≥ 18
- Docker Desktop
- A Google Cloud project with OAuth credentials
- A Slack app (optional for notifications)
- Ethereal credentials (optional — auto-created if not set)

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts MySQL, Redis, and Elasticsearch with persistent volumes. Wait ~30 seconds for Elasticsearch to initialize.

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in .env with your credentials (see Environment Variables section)
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Backend starts on `http://localhost:5000`.

### 3. Worker (separate terminal)

```bash
cd backend
npm run worker
```

### 4. Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

# MySQL — matches docker-compose defaults
DATABASE_URL="mysql://reachinbox:reachinboxpass@localhost:3306/reachinbox"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redispassword

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Worker
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200

# Google OAuth — from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack OAuth — from api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Ethereal — from https://ethereal.email (or leave blank for auto-create)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASSWORD=

# Session
SESSION_SECRET=change-this-to-a-long-random-string

# CORS
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web Application type).
3. Add Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
4. Copy Client ID and Client Secret into `backend/.env`.

---

## Slack OAuth Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch.
2. Under **OAuth & Permissions**, add Bot Token Scopes: `chat:write`, `channels:read`, `groups:read`.
3. Add Redirect URL: `http://localhost:5000/api/slack/callback`.
4. Install to workspace and copy credentials to `backend/.env`.

---

## Ethereal Email Setup

Option A — Leave `ETHEREAL_USER` and `ETHEREAL_PASSWORD` blank. The server auto-creates a test account and logs the credentials on startup.

Option B — Go to [ethereal.email](https://ethereal.email), click "Create Account", and copy credentials to `.env`.

Preview URLs for sent emails are stored in the `etherealPreviewUrl` column and displayed in the Sent Emails UI.

---

## Elasticsearch Setup

Elasticsearch runs via Docker Compose with `xpack.security.enabled=false` for local development. The backend auto-creates the `emails` index with correct mappings on startup.

To verify:
```bash
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/emails/_count
```

---

## API Reference

### Health

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Service status: API, DB, Redis, ES |

### Authentication

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/google` | None | Redirect to Google OAuth |
| GET | `/api/auth/google/callback` | None | OAuth callback |
| GET | `/api/auth/me` | Required | Current user info |
| POST | `/api/auth/logout` | Required | Destroy session |

### Emails

| Method | URL | Auth | Description |
|---|---|---|---|
| POST | `/api/emails/schedule` | Required | Schedule email campaign |
| GET | `/api/emails/scheduled` | Required | List scheduled/processing emails |
| GET | `/api/emails/sent` | Required | List sent/failed emails |
| GET | `/api/emails/search?q=` | Required | Elasticsearch full-text search |

**POST /api/emails/schedule body:**
```json
{
  "subject": "Welcome",
  "body": "<h1>Hello</h1>",
  "recipients": ["a@example.com", "b@example.com"],
  "startTime": "2026-09-01T18:00:00.000Z",
  "delayBetweenEmails": 2000,
  "hourlyLimit": 200,
  "sender": "sender@example.com"
}
```

### Slack

| Method | URL | Auth | Description |
|---|---|---|---|
| GET | `/api/slack/connect` | Required | Get Slack OAuth URL |
| GET | `/api/slack/callback` | None | Slack OAuth callback |
| POST | `/api/slack/disconnect` | Required | Disconnect Slack |
| GET | `/api/slack/status` | Required | Connection status |

---

## Bull Board

Live queue dashboard at: **`http://localhost:5000/admin/queues`**

Shows:
- **Waiting** — jobs waiting to be picked up
- **Active** — jobs currently being processed
- **Delayed** — jobs scheduled for the future (the core of this system)
- **Completed** — successfully processed jobs
- **Failed** — jobs that failed all retry attempts

---

## Database Migration

```bash
cd backend
npx prisma migrate dev --name init
```

This creates all tables: `users`, `emails`, `slack_connections`.

To inspect data:
```bash
npx prisma studio
```

---

## Running Tests

```bash
cd backend
npm test
```

Test suites:
- `emailValidator.test.ts` — email validation and normalization (10 tests)
- `scheduling.test.ts` — delay calculation algorithm (5 tests)
- `rateLimiter.test.ts` — rate limit keys and hour windows (7 tests)
- `idempotency.test.ts` — idempotency key generation (3 tests)

---

## Demo Flow

### Step 1 — Start everything

```bash
docker compose up -d
cd backend && npm run dev      # terminal 1
cd backend && npm run worker   # terminal 2
cd frontend && npm run dev     # terminal 3
```

### Step 2 — Sign in

Open `http://localhost:5173` → click **Continue with Google** → authenticate.

### Step 3 — Connect Slack (optional)

Go to **Slack Integration** in the sidebar → **Connect Slack** → complete OAuth.

### Step 4 — Schedule emails for demo

For a quick rate-limit demo, set in `backend/.env`:
```
MAX_EMAILS_PER_HOUR=3
```
Then restart the backend.

### Step 5 — Compose and schedule

- Open **Compose Email**
- Upload a CSV with 5–10 email addresses
- Set Start Time to 2 minutes from now
- Set Delay to 2000ms, Hourly Limit to 3
- Click **Schedule Emails**

### Step 6 — Watch Bull Board

Open `http://localhost:5000/admin/queues` — see delayed jobs appear.

### Step 7 — Watch worker logs

In terminal 2 observe:
- `Job received`
- `Email sent successfully` (with Ethereal preview URL)
- `Rate limit reached, rescheduling` (for emails 4+)
- Slack notification logged

### Step 8 — View sent emails

Open **Sent Emails** → click **View** on any row to open the Ethereal preview.

### Step 9 — Test restart persistence

1. Schedule 3 emails for 5+ minutes in the future
2. Stop the backend (`Ctrl+C`)
3. Start the backend again: `npm run dev`
4. Worker reconnects — jobs are still in Redis, will fire on schedule

### Step 10 — Search

Open **Search** → type a recipient email or subject → results from Elasticsearch.

---

## Known Assumptions and Trade-offs

1. **SMTP atomicity**: `sendMail` and `UPDATE status='sent'` are not atomic. A crash between the two causes an at-most-one-extra-send on retry. Mitigated by the pre-send status check and bounded retry count.

2. **Minimum delay with concurrency > 1**: Jobs are pre-spaced in BullMQ by the user-configured delay. The Redis last-sent key provides secondary enforcement for the same sender, but there is a small concurrent-write window.

3. **Elasticsearch as secondary index**: ES indexing failures are non-fatal. MySQL is the system of record. A failed index operation is logged; the email is still sent and tracked in MySQL.

4. **Slack disconnect revocation**: We call `auth.revoke` when disconnecting but continue silently if it fails (e.g., token already expired).

5. **Session store**: Sessions are stored in Redis, so they survive backend restarts as long as Redis is running.

---

## File Structure

```
reachinbox-email-scheduler/
├── backend/
│   ├── src/
│   │   ├── config/          # env, database, redis, elasticsearch, passport
│   │   ├── controllers/     # authController, emailController, slackController, healthController
│   │   ├── middleware/       # auth (requireAuth), errorHandler
│   │   ├── queues/          # emailQueue (BullMQ)
│   │   ├── repositories/    # emailRepository (Prisma queries)
│   │   ├── routes/          # authRoutes, emailRoutes, slackRoutes, healthRoutes
│   │   ├── services/        # emailService (Ethereal), elasticsearchService, slackService
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # logger, rateLimiter, emailValidator, idempotency
│   │   ├── workers/         # emailWorker (BullMQ processor)
│   │   └── server.ts        # Express bootstrap
│   ├── prisma/schema.prisma
│   ├── tests/
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/ui/   # Button, Input, Textarea, Modal, FileUploader, EmailTable,
│   │   │                    # StatusBadge, LoadingSpinner, EmptyState, Pagination
│   │   ├── hooks/           # useAuth, useEmails
│   │   ├── layouts/         # DashboardLayout, Sidebar, Header
│   │   ├── pages/           # Login, Dashboard, Compose, Scheduled, Sent, Search, Slack
│   │   ├── services/        # apiClient, authService, emailService, slackService
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # csvParser
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── .env.example
├── docker-compose.yml
└── README.md
```
