# Rush Operator Runbook

This runbook covers the minimum operational tasks needed to run the pre-ML Rush beta.

## 1. Apply Migrations

Rush stores the authoritative schema in [`supabase/migrations`](/Users/vittorioc/rush/supabase/migrations).

Recommended process:
1. Apply each SQL file in timestamp order.
2. Confirm the tables, policies, triggers, and functions were created successfully.
3. Re-run on a clean Supabase project before cutting a beta release.

If you are not using the Supabase CLI yet, the SQL editor is acceptable for now.

## 2. Seed Initial Club Data

Run:

```bash
pnpm seed-clubs
```

Required env vars in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

What the script does:
- fetches public organizations from Maize Pages
- filters to public + active orgs
- maps them into the `clubs` table
- upserts by `slug`

The seed is safe to rerun.

## 3. Approve Club Claims Manually

Rush intentionally keeps claim approval out of the app before ML. Approval is done through the SQL function defined in [`20260328_approve_claim_fn.sql`](/Users/vittorioc/rush/supabase/migrations/20260328_approve_claim_fn.sql).

Find pending claims:

```sql
select id, club_id, user_id, submitted_at
from public.club_claims
where status = 'pending'
order by submitted_at asc;
```

Approve a claim:

```sql
select public.approve_claim('<claim-id>', '<admin-user-id>');
```

What approval does:
- marks the claim as `approved`
- sets `reviewed_by`
- creates an `admin` membership in `club_admin_memberships`

## 4. Configure Reminder Cron Secrets

Required runtime secrets:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
RESEND_API_KEY=
RECOMMENDER_SERVICE_URL=
RECOMMENDER_SERVICE_TOKEN=
RECOMMENDER_ROLLOUT_PERCENT=
```

The reminder route is:

```text
GET or POST /api/cron/deadline-reminders
```

The request must send:

```text
Authorization: Bearer <CRON_SECRET>
```

Recommended deployment setup:
- store all secrets in Vercel project environment variables
- schedule the cron in Vercel (or GitHub Actions) to hit the route daily
- verify Resend sender/domain configuration before enabling production reminders
- keep `RECOMMENDER_ROLLOUT_PERCENT=0` until the FastAPI service is deployed and healthy

Reminder behavior:
- sends reminders for deadlines due in 1, 3, or 7 days
- stores send logs in `deadline_reminder_sends` to avoid duplicate reminders on reruns

## 5. ML Foundation Ops

Rush now includes the ML foundation but should stay dark until the beta data gate is met.

Required secrets for the FastAPI service and nightly jobs:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RECOMMENDER_SERVICE_TOKEN=
REDIS_URL=
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
ACTIVE_MODEL_MANIFEST_KEY=
```

Operational flow:
- run `pnpm ml:check-data` locally or rely on `.github/workflows/ml-readiness.yml`
- deploy [`ml-service`](/Users/vittorioc/rush/ml-service) to Railway with the secrets above
- keep `RECOMMENDER_ROLLOUT_PERCENT=0` in Vercel until `/healthz` and `/version` respond correctly
- run `.github/workflows/ml-nightly-train.yml` manually once before enabling the nightly schedule
- after a model is published, raise `RECOMMENDER_ROLLOUT_PERCENT` to `10`, then `50`, then `100`

## 6. Smoke Checklist Before Beta

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- sign up, confirm email, sign in, sign out
- directory pages render with seeded club data
- follows update dashboard deadlines
- native application submit succeeds
- recruiter portal settings/forms/imports load for an approved admin
- reminder cron returns a success payload with valid secrets
- `pnpm ml:check-data` returns a readable readiness report
- dashboard recommendations render via fallback when the ML service is unavailable
