# Rush

Rush is a campus recruiting platform for University of Michigan club discovery,
deadline tracking, student application management, and club-side recruiting
workflows. The product is intentionally being finished as a real pre-ML beta
before recommendation infrastructure is added.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Resend for email reminders

## Local Setup

1. Copy the environment template and fill in real values from Supabase and Resend.
2. Install dependencies.
3. Apply the SQL migrations in [`supabase/migrations`](/Users/vittorioc/rush/supabase/migrations).
4. Start the app.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
RESEND_API_KEY=
RECOMMENDER_SERVICE_URL=
RECOMMENDER_SERVICE_TOKEN=
RECOMMENDER_ROLLOUT_PERCENT=
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for the deadline reminder cron and Maize Pages seed script.
- `NEXT_PUBLIC_APP_URL` is used in reminder email links.
- `CRON_SECRET` protects the reminder endpoint.
- `RESEND_API_KEY` is only required if you want reminder delivery to work.
- `RECOMMENDER_SERVICE_URL` points the dashboard recommendation rail at the FastAPI service.
- `RECOMMENDER_SERVICE_TOKEN` is the shared bearer token used for server-to-server calls.
- `RECOMMENDER_ROLLOUT_PERCENT` controls stable-hash rollout in the web app. Default `100`.

## Supabase Setup

Apply the migrations in order from [`supabase/migrations`](/Users/vittorioc/rush/supabase/migrations). If you are not using the Supabase CLI yet, run them in the SQL editor in timestamp order.

Auth settings to configure in the dashboard:
- Enable Email auth.
- Set `Site URL` to `http://localhost:3000` for local development.
- Add `http://localhost:3000/**` as a redirect URL.
- Update the confirm-signup email template URL to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

## Seed Club Data

Bootstrap the public directory from Maize Pages:

```bash
pnpm seed-clubs
```

This script:
- fetches public Maize Pages organizations
- normalizes them into the Rush `clubs` schema
- upserts by `slug`

The seed script requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## Reminder Cron

The reminder endpoint is:

```text
GET or POST /api/cron/deadline-reminders
Authorization: Bearer <CRON_SECRET>
```

Example local invocation:

```bash
curl -X POST http://localhost:3000/api/cron/deadline-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

The route uses the service-role client and sends emails through Resend.
Reminder delivery targets deadlines due in **1, 3, or 7 days** and tracks send logs to avoid duplicates on reruns.

## Current Beta Scope

Implemented product areas:
- public club directory and SEO-friendly club pages
- student auth, profile, follows, deadlines, and application tracker
- club claim requests with manual approval ops
- recruiter portal for applicant review, settings, deadlines, native forms, and CSV imports
- native Rush applications and mixed external application intake
- deadline reminder cron and event logging

Still intentionally deferred:
- full model activation against live student traffic until enough clean beta data exists

Implemented ML foundation:
- `pgvector`-ready schema for club embeddings, user recommendation profiles, recommendation stats, and model versions
- dashboard recommendation rail with service fetch + popularity fallback
- standardized event metadata and recommendation impression logging
- Python `ml-service/` workspace for FastAPI serving, offline embeddings, dataset building, and ranker training
- daily readiness report workflow and nightly training workflow

## ML Service

The top-level [`ml-service`](/Users/vittorioc/rush/ml-service) directory contains the FastAPI service and offline jobs.

Key commands:

```bash
pnpm ml:check-data

cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn ml_service.main:app --reload
```

Service endpoints:
- `GET /healthz`
- `GET /version`
- `POST /v1/recommendations`

Nightly pipeline entrypoint:

```bash
cd ml-service
python -m ml_service.jobs.nightly_pipeline
```

## Operations

See the operator runbook in [`docs/operator-runbook.md`](/Users/vittorioc/rush/docs/operator-runbook.md) for:
- migration/application workflow
- Maize Pages seeding
- manual claim approval
- reminder cron deployment secrets

## Quality Checks

Run all gates before shipping:

```bash
pnpm lint
pnpm test
pnpm build
```
