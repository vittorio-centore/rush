# External Integrations

**Analysis Date:** 2026-04-03

## APIs & Services

**Database & Auth - Supabase:**
- Supabase (PostgreSQL + Auth + RLS) - Primary database, authentication, row-level security
  - SDK/Client: `@supabase/supabase-js` ^2.100.1, `@supabase/ssr` ^0.9.0
  - Browser client: `src/lib/supabase/client.ts` (uses `createBrowserClient`)
  - Server client: `src/lib/supabase/server.ts` (uses `createServerClient` with cookie handling)
  - Service client: `src/lib/supabase/service.ts` (uses `createClient` with service role key, no auth persistence)
  - Middleware proxy: `src/lib/supabase/proxy.ts` (session refresh via `updateSession`)
  - Config: `src/lib/supabase/config.ts`
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Migrations: `supabase/migrations/` (9 migration files)

**Email - Resend:**
- Resend - Transactional email for deadline reminders
  - SDK/Client: `resend` ^6.9.4
  - Implementation: `src/lib/email.ts`
  - Sends HTML deadline reminder emails from "Rush <reminders@rush.app>"
  - Auth: `RESEND_API_KEY`

**ML Recommendations - Internal FastAPI Service:**
- Rush ML Service - Club recommendation engine
  - Next.js client: `src/lib/recommendations/server.ts`
  - Service endpoint: `POST /v1/recommendations`
  - Auth: Bearer token via `RECOMMENDER_SERVICE_TOKEN`
  - Timeout: 1 second hard abort
  - Rollout: percentage-based via `RECOMMENDER_ROLLOUT_PERCENT`
  - Fallback: Supabase RPC `get_popular_recommendation_clubs` when ML service is unavailable
  - Config: `RECOMMENDER_SERVICE_URL`, `RECOMMENDER_SERVICE_TOKEN`

**Cloud Storage - AWS S3 (ML Service):**
- AWS S3 - ML model artifact storage (optional)
  - SDK/Client: `boto3` 1.35+ (Python)
  - Implementation: `ml-service/ml_service/artifacts.py`
  - Stores/retrieves model manifests and ranker joblib files
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  - Config: `S3_BUCKET`, `ACTIVE_MODEL_MANIFEST_KEY`

## Data Storage

**Databases:**
- Supabase PostgreSQL (hosted)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (client), `SUPABASE_SERVICE_ROLE_KEY` (admin)
  - Client: `@supabase/supabase-js` (no ORM - direct Supabase query builder)
  - Tables: clubs, profiles, user_follows, club_deadlines, deadline_reminder_sends, events, applications (inferred from queries)
  - RPC functions: `get_due_deadline_reminders`, `get_popular_recommendation_clubs`
  - RLS policies enforced (see migrations)

**Caching:**
- Redis (optional, ML service only)
  - Client: `redis` Python package via `ml-service/ml_service/cache.py`
  - Config: `REDIS_URL`
  - TTL: 3600 seconds (1 hour) for recommendation responses
  - Graceful degradation: operates without Redis if `REDIS_URL` is unset

**File Storage:**
- Local filesystem for ML artifacts (fallback when S3 is not configured)
  - Path: `LOCAL_ARTIFACT_DIR` (defaults to `./artifacts`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Server-side: cookie-based sessions via `@supabase/ssr`
  - Auth confirmation flow: `src/app/auth/confirm/` (email confirmation callback)
  - Auth actions: `src/app/auth/actions.ts`
  - Session management: `src/lib/supabase/proxy.ts` (`updateSession` refreshes tokens via `getClaims()`)
  - Service-to-service: Bearer token auth for ML service (`RECOMMENDER_SERVICE_TOKEN`)
  - Cron auth: shared secret via `CRON_SECRET` header

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or similar)

**Logs:**
- `console.error` for server-side error logging (no structured logging library)
- ML service: no explicit logging framework detected

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured; Next.js 16 compatible with Vercel or similar platforms
- ML service: FastAPI + uvicorn (containerized deployment assumed)

**CI Pipeline:**
- No CI configuration files detected (no `.github/workflows/`, no `Dockerfile`)

## Environment Configuration

**Required env vars (Next.js app):**

| Variable | Service | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Yes |
| `NEXT_PUBLIC_APP_URL` | Self | Yes (defaults to localhost:3000) |
| `CRON_SECRET` | Cron auth | Yes (for deadline reminders) |
| `RESEND_API_KEY` | Resend | Yes (for email delivery) |
| `RECOMMENDER_SERVICE_URL` | ML Service | No (fallback to popular clubs) |
| `RECOMMENDER_SERVICE_TOKEN` | ML Service | No (required if service URL set) |
| `RECOMMENDER_ROLLOUT_PERCENT` | ML Service | No (defaults to 0 = rollout off) |

**Required env vars (ML service):**

| Variable | Service | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Supabase | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Yes |
| `RECOMMENDER_SERVICE_TOKEN` | Auth | Yes |
| `REDIS_URL` | Redis | No (caching disabled if unset) |
| `S3_BUCKET` | AWS S3 | No (local artifacts if unset) |
| `AWS_ACCESS_KEY_ID` | AWS | No (required if S3_BUCKET set) |
| `AWS_SECRET_ACCESS_KEY` | AWS | No (required if S3_BUCKET set) |
| `AWS_REGION` | AWS | No (defaults to us-east-1) |
| `LOCAL_ARTIFACT_DIR` | Local FS | No (defaults to ./artifacts) |
| `DEFAULT_EMBEDDING_MODEL` | ML | No (defaults to sentence-transformers/all-MiniLM-L6-v2) |
| `ACTIVE_MODEL_MANIFEST_KEY` | S3 | No (defaults to models/active-manifest.json) |

**Secrets location:**
- `.env` file (gitignored, local development)
- `.env.example` documents all variables with placeholder values

## Webhooks & Callbacks

**Incoming:**
- `POST /api/cron/deadline-reminders` - Cron-triggered endpoint for sending deadline reminder emails; authenticated via `CRON_SECRET` Bearer token (`src/app/api/cron/deadline-reminders/route.ts`)
- `POST /api/events` - Client-side analytics event ingestion; authenticated via Supabase user session (`src/app/api/events/route.ts`)
- `GET/POST /auth/confirm` - Supabase email confirmation callback (`src/app/auth/confirm/`)

**Outgoing:**
- Resend email API calls from `src/lib/email.ts`
- ML recommendation service calls from `src/lib/recommendations/server.ts`

## Scripts

**Operational scripts (`scripts/`):**
- `scripts/seed-clubs.ts` - Seed club data (run via `pnpm seed-clubs`)
- `scripts/check-ml-readiness.ts` - Validate ML data readiness (run via `pnpm ml:check-data`)

---

*Integration audit: 2026-04-03*
