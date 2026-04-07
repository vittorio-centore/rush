# Concerns
_Last updated: 2026-04-07_

## Summary
Rush has ~6% test file coverage (5 files for 77 source files), several security concerns around error message leakage and missing rate limiting, meaningful technical debt from duplicated utility code, and performance risks from unbounded queries and per-row database writes.

## Critical Issues

### Raw Supabase Error Messages Surfaced to Users
- **Files:** ~35 callsites across all server action and API route files
- **Problem:** Raw Supabase `error.message` strings are URL-encoded into redirect params and shown to users, leaking table/column/constraint names (e.g. `"User already registered"`, `"duplicate key value violates unique constraint \"profiles_email_key\""`)
- **Fix:** Normalize all DB/auth errors to generic user-facing messages before surfacing

### No Rate Limiting on Any Endpoint
- **Files:** `src/app/api/events/route.ts`, `src/app/api/cron/deadline-reminders/route.ts`, all server action files
- **Problem:** No rate limiting on application submission, CSV import, event tracking, or the ML service proxy. An attacker can spam submissions or flood the events table.
- **Fix:** Add rate limiting middleware (e.g. Upstash Ratelimit) at the route level

### Deadline Reminder Emails Lack Unsubscribe Link
- **Files:** `src/lib/email.ts`
- **Problem:** Transactional reminder emails have no unsubscribe mechanism — CAN-SPAM and GDPR risk.
- **Fix:** Add a one-click unsubscribe link or preference center

## Technical Debt

### Duplicated Utility Functions
- `getProfile()` duplicated in 4 files: `src/app/portal/[slug]/page.tsx`, `src/app/portal/[slug]/applicants/[applicationId]/page.tsx`, `src/app/portal/[slug]/decisions/page.tsx`, `src/app/portal/[slug]/imports/actions.ts`
- `daysUntil()` duplicated in 3 files: `src/lib/email.ts`, the cron route, `src/app/dashboard/page.tsx`
- `VALID_STATUSES`/`VALID_DECISIONS` arrays redefined independently across 4 action files

### Oversized Files
- 5 page files exceed the 800-line guideline; largest: `src/app/portal/[slug]/decisions/page.tsx` (~839 lines)

### Open Redirect in Portal/Dashboard Actions
- **Files:** `src/app/portal/[slug]/actions.ts`, `src/app/dashboard/applications/actions.ts`
- `redirect_to` form parameter accepted without origin validation — can redirect users to arbitrary external URLs

### Club Claim Approval UI Missing
- `club_claims` table and `approve_claim_fn` migration exist but no admin approval UI has been built. Claims are stored but cannot be processed.

### ML Recommendations Default to 0% Rollout
- **Files:** `src/lib/recommendations/server.ts`, `RECOMMENDER_ROLLOUT_PERCENT` env var
- The ML service is deployed and integrated but defaults to 0% traffic — serving no personalized recommendations unless the env var is explicitly set.

## TODOs & FIXMEs

Based on codebase scan:
- No inline `TODO` or `FIXME` comments found in source — debt is structural rather than annotated.

## Security Concerns

### Auth Error Messages Enable Account Enumeration
- **Files:** `src/app/auth/actions.ts` (lines ~28, ~55)
- Supabase errors like `"User already registered"` surfaced verbatim; attackers can enumerate registered emails
- **Fix:** Single generic error for all auth failures

### Cron Endpoint Accepts GET and Has No IP Allowlist
- **Files:** `src/app/api/cron/deadline-reminders/route.ts` (lines ~65–70)
- Only `CRON_SECRET` bearer token guards the endpoint — no method restriction, no Vercel cron IP allowlist
- **Fix:** Restrict to `POST` only; optionally allowlist Vercel cron IP ranges

### Service Role Key Used Widely
- **Files:** `src/lib/supabase/service.ts`, `src/lib/recommendations/server.ts`, `src/app/api/cron/deadline-reminders/route.ts`
- Service role key bypasses all RLS; any bug in these paths can read/write arbitrary data
- **Mitigation:** Currently scoped to `server-only` modules; audit each callsite for necessity

### No Input Length Limits on Free-Text Fields
- **Files:** `src/app/clubs/[slug]/claim/actions.ts`, `src/app/clubs/[slug]/apply/actions.ts`, `src/app/portal/[slug]/forms/actions.ts`
- Megabyte-scale text submissions accepted and stored without server-side length validation
- **Fix:** Enforce max-length (e.g. 10,000 chars) on all free-text fields server-side

### No Zod / Schema Validation
- All API input validation is hand-rolled (`typeof x === "string"`, regex checks, custom parse functions)
- Missing a validation case introduces a silent bug rather than a thrown schema error
- **Files:** `src/app/api/events/route.ts`, all server action files
- **Fix:** Introduce Zod for schema-based validation at all API and server action boundaries

## Performance Concerns

### CSV Import Fires One DB Write Per Row
- **Files:** `src/app/portal/[slug]/imports/actions.ts` (lines ~188–278)
- Each CSV row triggers an individual `supabase.update()` or `supabase.insert()` — 1,000-row CSV = 1,000 round trips
- **Fix:** Batch inserts; separate update/insert sets after in-memory dedup pass

### Applicant List Loads All Applications Without Pagination
- **Files:** `src/app/portal/[slug]/page.tsx`
- All applications for a club fetched in a single query with no `LIMIT` or pagination, then sorted/filtered in JS
- **Fix:** Server-side pagination with `range()` or cursor-based pagination on `applied_at`

### Recommendations Cached 1 Hour Per User
- **Files:** `ml-service/ml_service/main.py` (line ~98)
- Cache keyed per `user_id + surface + limit` with 1-hour TTL — stale after follow/unfollow events; 10,000 users = 10,000 cache entries
- **Fix:** Reduce TTL to 5–10 minutes, or invalidate on follow/unfollow

### Reminder Cron Builds Log Rows In-Memory Before Writing
- **Files:** `src/app/api/cron/deadline-reminders/route.ts` (lines ~97–111)
- `sentLogRows` accumulated in memory during async sends; if interrupted mid-run, partial send logs are lost and reminders will re-send
- **Fix:** Write each log row immediately after each successful send

## Test Coverage Gaps (~6% file coverage)

### No Tests for Server Actions (Critical)
- Zero tests for all `"use server"` action files: application submission, CSV import, status updates, form management, bulk update, decision settings
- **Files:** `src/app/portal/[slug]/decisions/actions.ts`, `src/app/portal/[slug]/forms/actions.ts`, `src/app/portal/[slug]/imports/actions.ts`, `src/app/clubs/[slug]/apply/actions.ts`, `src/app/dashboard/applications/actions.ts`, and ~6 others
- **Risk:** Regressions in mutation paths go undetected until production

### No Tests for Email Delivery
- `src/lib/email.ts` — HTML template builder and Resend integration entirely untested
- **Risk:** Broken templates or misconfigured sender addresses are invisible until reminders actually send

### No Tests for Cron Reminder Route
- `src/app/api/cron/deadline-reminders/route.ts` — dedup logic, fallback query, and bundle-grouping logic untested

### No Integration Tests for Recommendations
- Next.js ↔ ML service boundary, fallback behavior when service is down, and rollout gating under realistic user IDs — all untested

## Dependencies at Risk

### Next.js 16 and React 19 Are Very New
- `AGENTS.md` explicitly warns this codebase has breaking API changes from training data
- Limited community troubleshooting resources; upstream bugs may require quick upgrades
- `package.json` pins exact versions (no `^` on `next` or `react`) — mitigates accidental upgrades
