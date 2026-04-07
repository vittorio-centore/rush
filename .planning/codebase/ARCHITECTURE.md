# Architecture
_Last updated: 2026-04-07_

## Summary

Rush is a two-sided campus recruiting platform built on Next.js 15 App Router with Supabase as the primary data and auth layer. The student-facing side covers club discovery, follow/track workflows, and ML-powered recommendations; the recruiter-facing side provides a full application management portal. A separate Python FastAPI service (`ml-service/`) handles recommendation inference and is called from the Next.js server layer over HTTP with a shared bearer token.

---

## Overall Pattern

**Full-stack monorepo with a co-located ML sidecar.**

- Next.js App Router handles all routing, server rendering, and API routes. No separate BFF.
- Server Components do direct Supabase queries — no intermediate service layer for reads.
- Mutations flow through Next.js Server Actions (`"use server"`) attached to page or layout subtrees.
- The ML service is a standalone FastAPI process invoked over HTTP only from `src/lib/recommendations/server.ts` — it is never called from the client.
- Supabase provides auth (OTP email magic link), Postgres, RLS, and Postgres RPC functions.

---

## Layers

**Routing / UI Layer:**
- Purpose: Render pages, layouts, and client components. Own the URL structure.
- Location: `src/app/`
- Contains: Page Server Components, layout files, route groups, loading/not-found stubs
- Depends on: Supabase clients, `src/lib/*` helpers
- Used by: Browser (RSC streaming) and Next.js middleware

**Server Actions Layer:**
- Purpose: Handle all mutations submitted from forms. Replaces API routes for writes.
- Location: `src/app/**/actions.ts` files (e.g., `src/app/portal/[slug]/actions.ts`, `src/app/dashboard/applications/actions.ts`)
- Contains: `"use server"` functions called by `<form action={...}>` or direct invocation
- Depends on: Supabase server client, `src/lib/portal.ts` context helper
- Used by: React Server Components and Client Components via progressive enhancement

**Library / Domain Logic Layer:**
- Purpose: Reusable business logic, typed helpers, and domain utilities shared across routes.
- Location: `src/lib/`
- Key files:
  - `src/lib/portal.ts` — `getPortalContext()` / `requirePortalAdmin()`: auth + membership guard for all recruiter portal routes
  - `src/lib/recommendations/server.ts` — orchestrates ML rollout, remote fetch, and fallback
  - `src/lib/application-forms.ts` — form question visibility logic and answer extraction
  - `src/lib/events.ts` — behavioral event schema and insertion
  - `src/lib/email.ts` — deadline reminder email dispatch (Resend)
  - `src/lib/csv.ts` — applicant CSV import parsing
  - `src/lib/recruiter-decisions.ts` — decision workspace scoring helpers

**Supabase Client Layer:**
- Purpose: Typed, context-aware Supabase client factories.
- Location: `src/lib/supabase/`
- Files:
  - `server.ts` — cookie-aware server client (RSC / Server Actions / Route Handlers)
  - `client.ts` — browser client (Client Components)
  - `service.ts` — service-role client (bypasses RLS; cron jobs, ML hydration)
  - `proxy.ts` — middleware session refresh (`updateSession()`)
  - `config.ts` — reads `NEXT_PUBLIC_SUPABASE_URL` and publishable key

**ML Service (Python FastAPI):**
- Purpose: Serve personalized club recommendations using collaborative embeddings and reranking.
- Location: `ml-service/`
- Exposes: `POST /v1/recommendations`, `GET /healthz`, `GET /version`
- Auth: Bearer token (`RECOMMENDER_SERVICE_TOKEN`)
- Caching: Redis (`ml-service/ml_service/cache.py`)
- Artifact refresh: in-process, lazy, every 5 minutes (`main.py:refresh_artifacts_if_stale`)

**Database Layer:**
- Purpose: All persistent state and server-side business rules.
- Location: `supabase/migrations/` (9 migrations from initial schema through ML foundation)
- Key tables inferred: `clubs`, `club_admin_memberships`, `user_follows`, `user_applications`, `club_deadlines`, `deadline_reminder_sends`, `events`, `profiles`
- RLS enforced at Postgres level; service-role client used only for background/cron operations

---

## Data Flow

**Student viewing the dashboard:**
1. `src/app/dashboard/layout.tsx` — Server Component calls `createClient()` (cookie-aware), verifies auth, redirects to `/auth` if unauthenticated.
2. `src/app/dashboard/page.tsx` — Server Component queries `profiles`, `user_follows`, `user_applications`, `club_deadlines` in parallel.
3. `<RecommendationRail>` component (`src/app/dashboard/RecommendationRail.tsx`) triggers `getDashboardRecommendations()` from `src/lib/recommendations/server.ts`.
4. Recommendations: rollout check → if user in rollout, HTTP POST to ML service with 1 s timeout → on error or miss, fallback to `get_popular_recommendation_clubs` RPC.
5. Impression logged via `POST /api/events` from the client after render.

**Recruiter accessing the portal:**
1. `src/app/portal/[slug]/layout.tsx` calls `getPortalContext(slug)` which verifies session, queries `clubs` and `club_admin_memberships`, returns `{ supabase, user, club, membership }`.
2. Any admin-only action (bulk status update, form save, etc.) calls `requirePortalAdmin()` which additionally asserts `membership.role === "admin"`.
3. Mutations are Server Actions in `src/app/portal/[slug]/actions.ts` — they call `getPortalContext` themselves to re-verify on each submission.

**Cron — deadline reminders:**
1. `POST /api/cron/deadline-reminders` is hit by an external scheduler (Vercel Cron or equivalent).
2. Validated with `CRON_SECRET` Bearer token.
3. Calls `get_due_deadline_reminders` RPC (fallback: manual join across `club_deadlines`, `user_follows`, `profiles`).
4. Deduplicates against `deadline_reminder_sends`, sends via Resend, upserts send log.

**Event tracking:**
1. Client component fires `POST /api/events` with `{ eventType, clubId, metadata }`.
2. Route handler in `src/app/api/events/route.ts` validates payload, verifies session, inserts into `events` table.
3. Anonymous users receive a silent `{ ok: true }` — no error surfaced.

---

## Key Abstractions

**`getPortalContext(slug)`:**
- Location: `src/lib/portal.ts`
- Purpose: Single entry point for all recruiter portal authorization. Returns `{ supabase, user, club, membership }` or redirects/404s.
- Used by: All portal layouts, pages, and Server Actions.

**Supabase client factories:**
- `createClient()` — cookie-aware, for authenticated user context
- `createServiceClient()` — bypasses RLS, for background jobs and ML hydration
- Both created fresh per request; no module-level singleton in user-context paths.

**Recommendation fallback chain:**
- Location: `src/lib/recommendations/server.ts`
- Rollout gating → remote ML service → popular RPC fallback → empty array. Each step is independently try/caught.

**Server Actions as mutation handlers:**
- Pattern: `"use server"` files co-located with the route subtree they serve.
- Always re-verify context (never trust client-passed IDs for auth checks).
- Use `redirect()` for navigation after mutation; `revalidatePath()` for cache invalidation.

---

## Entry Points

**Root layout:**
- Location: `src/app/layout.tsx`
- Purpose: Sets HTML shell, global CSS, and metadata defaults.

**Middleware (session refresh):**
- Location: `src/lib/supabase/proxy.ts` (`updateSession`) — called from `middleware.ts` (not shown but expected at project root)
- Triggers: Every request
- Responsibilities: Refresh Supabase auth session cookies on each request.

**Auth confirm route:**
- Location: `src/app/auth/confirm/route.ts`
- Purpose: Handles OTP email magic link verification, redirects to `/dashboard` or back to `/auth` on error.

**ML service entry:**
- Location: `ml-service/ml_service/main.py`
- Triggers: HTTP requests from Next.js server only
- Responsibilities: Auth via bearer token, cache lookup, recommendation inference, artifact refresh.

---

## Error Handling

**Strategy:** Fail-fast with redirects on auth failures; graceful fallback with console.error on non-critical paths (recommendations, reminder sends).

**Patterns:**
- Auth failures in portal/dashboard layouts: immediate `redirect("/auth")` or `notFound()`
- Server Actions: `redirect()` with `?error=` query param to surface errors in the UI
- Recommendation errors: caught individually, fallback to next strategy in chain, ultimately return empty items array
- Cron job: per-bundle `Promise.allSettled`; partial success counted and logged
- Route handlers: explicit `Response.json({ error: "..." }, { status: 4xx/5xx })` — never throw unhandled

---

## Cross-Cutting Concerns

**Authentication:** Supabase SSR cookie-based sessions. Every server-rendered route that requires auth calls `supabase.auth.getUser()` directly (not cached). Middleware refreshes tokens via `updateSession()`.

**Authorization:** Row-Level Security in Postgres for data access; `getPortalContext` / `requirePortalAdmin` enforced at the application layer for portal writes.

**Behavioral Telemetry:** `POST /api/events` endpoint accepts typed event records (`src/lib/events.ts`). Client components use `<TrackedLink>` / `<TrackedAnchor>` (`src/components/TrackedLink.tsx`) to fire events on navigation.

**Validation:** Inline in Server Actions using manual type checks and `FormData` extraction. Form question visibility logic centralized in `src/lib/application-forms.ts`.

**Email:** Resend SDK used only in `src/lib/email.ts`; called exclusively from the cron route handler.

**Caching (ML):** Redis in the ML service for recommendation responses (1 hour TTL keyed by model version + surface + user + limit). No application-level cache in Next.js (recommendations use `cache: "no-store"`).
