# Codebase Structure
_Last updated: 2026-04-07_

## Summary

Rush is organized as a Next.js 15 App Router project with a co-located Python ML service. All TypeScript source lives under `src/`, split between `app/` (routing and UI) and `lib/` (domain logic and utilities). The ML service is a self-contained Python package under `ml-service/`. Database migrations live in `supabase/migrations/`.

---

## Directory Layout

```
rush/
├── src/
│   ├── app/                    # Next.js App Router — all routes, layouts, pages, API routes
│   │   ├── layout.tsx          # Root HTML shell
│   │   ├── page.tsx            # Landing page
│   │   ├── globals.css         # Global styles (Tailwind base)
│   │   ├── auth/               # Auth pages + OTP confirm route
│   │   │   ├── page.tsx        # Sign-in UI
│   │   │   ├── actions.ts      # signIn / signOut server actions
│   │   │   └── confirm/route.ts  # OTP email verification handler
│   │   ├── clubs/              # Public club directory
│   │   │   ├── layout.tsx      # Clubs shell with header nav
│   │   │   ├── page.tsx        # Club listing with filters
│   │   │   └── [slug]/         # Individual club public page
│   │   │       ├── page.tsx
│   │   │       ├── apply/      # Native application form
│   │   │       └── claim/      # Club claim flow
│   │   ├── dashboard/          # Authenticated student workspace
│   │   │   ├── layout.tsx      # Sidebar + mobile nav (auth guard)
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── RecommendationRail.tsx   # Recommendation display component
│   │   │   ├── RecommendationImpressionLogger.tsx
│   │   │   ├── applications/   # Application tracker
│   │   │   │   ├── page.tsx
│   │   │   │   ├── actions.ts
│   │   │   │   └── [id]/       # Individual application detail
│   │   │   ├── follows/        # Followed clubs list
│   │   │   └── profile/        # Student profile editor
│   │   ├── portal/             # Recruiter portal (club admin workspace)
│   │   │   └── [slug]/         # Per-club portal
│   │   │       ├── layout.tsx  # Portal shell + nav (auth + membership guard)
│   │   │       ├── page.tsx    # Applicants list (default view)
│   │   │       ├── actions.ts  # All portal mutations (Server Actions)
│   │   │       ├── applicants/ # Applicant management
│   │   │       │   └── [applicationId]/  # Individual applicant view
│   │   │       ├── decisions/  # Recruiter decision workspace
│   │   │       ├── forms/      # Application form builder
│   │   │       ├── deadlines/  # Deadline management
│   │   │       ├── imports/    # CSV import
│   │   │       └── settings/   # Club settings
│   │   └── api/                # Next.js Route Handlers (REST endpoints)
│   │       ├── events/route.ts              # Behavioral event ingestion
│   │       └── cron/
│   │           └── deadline-reminders/route.ts  # Deadline email cron job
│   ├── components/             # Shared UI components
│   │   ├── ActiveNav.tsx        # Active-state navigation link wrapper
│   │   └── TrackedLink.tsx      # Event-firing link components
│   └── lib/                    # Domain logic and shared utilities
│       ├── portal.ts            # getPortalContext / requirePortalAdmin
│       ├── events.ts            # Event schema + createEventInsert
│       ├── email.ts             # Resend email dispatch
│       ├── csv.ts               # CSV import parsing
│       ├── application-forms.ts # Form question visibility + answer helpers
│       ├── recruiter-decisions.ts  # Decision scoring utilities
│       ├── supabase/            # Supabase client factories
│       │   ├── config.ts        # Reads NEXT_PUBLIC_SUPABASE_URL
│       │   ├── server.ts        # Cookie-aware server client
│       │   ├── client.ts        # Browser client
│       │   ├── service.ts       # Service-role client (bypasses RLS)
│       │   └── proxy.ts         # Middleware session refresh
│       └── recommendations/     # ML recommendation layer
│           ├── server.ts        # Rollout gate + remote fetch + fallback
│           ├── rollout.ts       # Deterministic user rollout bucketing
│           ├── reasons.ts       # Human-readable recommendation reason text
│           └── types.ts         # Shared recommendation types
├── ml-service/                 # Python FastAPI ML recommendation service
│   ├── ml_service/
│   │   ├── main.py             # FastAPI app + endpoints
│   │   ├── recommender.py      # RecommendationEngine
│   │   ├── embeddings.py       # Embedding utilities
│   │   ├── features.py         # Feature extraction
│   │   ├── rerank.py           # Post-retrieval reranking
│   │   ├── artifacts.py        # Model artifact loading
│   │   ├── cache.py            # Redis CacheClient
│   │   ├── supabase.py         # SupabaseRestClient (service role)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── reasons.py          # Reason code generation
│   │   └── jobs/               # Offline training / artifact build jobs
│   └── tests/                  # ML service tests
├── supabase/
│   └── migrations/             # Ordered Postgres migration files (9 total)
├── scripts/                    # One-off maintenance scripts
├── docs/                       # Project documentation
├── .github/
│   └── workflows/              # CI workflows
├── .planning/
│   └── codebase/               # GSD codebase analysis documents
├── package.json
├── tsconfig.json
├── next.config.*               # Next.js configuration
└── CLAUDE.md / AGENTS.md       # Project-level AI agent instructions
```

---

## Directory Purposes

**`src/app/`:**
- Purpose: All Next.js routing. Every subfolder is a route segment.
- Contains: Page Server Components, layout files, Server Action files (`actions.ts`), Route Handlers (`route.ts`), client components co-located with their page.
- Key files: `src/app/layout.tsx` (root shell), `src/app/page.tsx` (landing)

**`src/app/dashboard/`:**
- Purpose: Authenticated student workspace. All routes require a valid Supabase session (enforced in layout).
- Contains: Home dashboard, application tracker, followed clubs, profile editor, recommendation components.

**`src/app/portal/[slug]/`:**
- Purpose: Recruiter portal for a specific club. All routes require session + club membership (enforced via `getPortalContext` in layout and actions).
- Contains: Applicants list, individual applicant view, decisions workspace, form builder, deadline management, CSV import, club settings.
- Critical: `actions.ts` handles all mutations for the entire portal subtree.

**`src/app/api/`:**
- Purpose: Stateless HTTP endpoints — event ingestion and scheduled cron jobs.
- Rule: No mutations that belong to the portal/dashboard user flows. Those use Server Actions.

**`src/components/`:**
- Purpose: Shared, route-agnostic UI primitives.
- Currently small (2 files). Route-specific components live co-located in their route directory.

**`src/lib/`:**
- Purpose: All reusable domain logic. No React imports — pure TypeScript utilities and server-only modules.
- Rule: If a function is used by more than one route, it belongs here.

**`src/lib/supabase/`:**
- Purpose: One factory per calling context. Never import the wrong client for your context.
- `server.ts` for RSC / Server Actions / Route Handlers; `client.ts` for Client Components; `service.ts` for background jobs only.

**`src/lib/recommendations/`:**
- Purpose: Encapsulates the entire recommendation subsystem: rollout gating, remote ML call, fallback, and reason text.
- `server.ts` is marked `import "server-only"` — cannot be imported by client components.

**`ml-service/`:**
- Purpose: Standalone Python FastAPI service for ML recommendations. Deployed separately from Next.js.
- Contains: FastAPI app, recommendation engine, Redis cache, offline training jobs.
- Accessed only from `src/lib/recommendations/server.ts` over HTTP.

**`supabase/migrations/`:**
- Purpose: Source-of-truth for the database schema. Applied in filename order.
- Generated: No (hand-authored). Committed: Yes.

---

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` — Root HTML shell, global metadata
- `src/app/page.tsx` — Public landing page
- `src/app/auth/page.tsx` — Magic link sign-in
- `src/app/auth/confirm/route.ts` — OTP verification callback
- `ml-service/ml_service/main.py` — FastAPI app and all endpoints

**Auth Guards:**
- `src/app/dashboard/layout.tsx` — Student workspace auth check
- `src/app/portal/[slug]/layout.tsx` — Recruiter portal auth + membership check
- `src/lib/portal.ts` — `getPortalContext()` reusable guard

**Mutations:**
- `src/app/portal/[slug]/actions.ts` — All recruiter portal Server Actions
- `src/app/dashboard/applications/actions.ts` — Student application tracker mutations
- `src/app/auth/actions.ts` — signIn / signOut

**Supabase Clients:**
- `src/lib/supabase/server.ts` — Use in RSC, Server Actions, Route Handlers
- `src/lib/supabase/client.ts` — Use in Client Components only
- `src/lib/supabase/service.ts` — Use in cron jobs and ML data hydration only

**Background Jobs:**
- `src/app/api/cron/deadline-reminders/route.ts` — Deadline email cron (triggered externally)

---

## Naming Conventions

**Route files:**
- `page.tsx` — Page Server Component (required by Next.js)
- `layout.tsx` — Persistent layout wrapper
- `route.ts` — Route Handler (REST endpoint)
- `actions.ts` — Server Actions file for the route subtree
- `loading.tsx` — Streaming loading skeleton
- `not-found.tsx` — 404 fallback

**Components:**
- PascalCase filenames: `ActiveNav.tsx`, `RecommendationRail.tsx`
- Co-located with their route when route-specific (e.g., `src/app/dashboard/RecommendationRail.tsx`)
- In `src/components/` only when used across multiple routes

**Library files:**
- kebab-case: `application-forms.ts`, `recruiter-decisions.ts`
- Test files co-located: `application-forms.test.ts` next to `application-forms.ts`

**Database migrations:**
- Format: `YYYYMMDD[HHMMSS]_<description>.sql`

---

## Where to Add New Code

**New student-facing page:**
- Route: `src/app/dashboard/<feature>/page.tsx`
- If it needs auth: the `dashboard` layout already guards it — no additional check needed
- Mutations: `src/app/dashboard/<feature>/actions.ts`
- Tests: `src/app/dashboard/<feature>/<feature>.test.ts` or in `src/lib/` if logic is extracted

**New recruiter portal section:**
- Route: `src/app/portal/[slug]/<section>/page.tsx`
- Auth: already handled by `src/app/portal/[slug]/layout.tsx` via `getPortalContext`
- Admin-only mutations: call `requirePortalAdmin(slug)` at the top of the Server Action
- Add nav link: update `NAV_ITEMS` array in `src/app/portal/[slug]/layout.tsx`
- Mutations: add to `src/app/portal/[slug]/actions.ts` or create `<section>/actions.ts`

**New API endpoint:**
- Location: `src/app/api/<name>/route.ts`
- Use `createClient()` for user-context, `createServiceClient()` for service operations
- Validate auth explicitly — middleware does not block API routes

**New shared utility:**
- Location: `src/lib/<domain>.ts`
- If server-only, add `import "server-only"` at top
- Add co-located test: `src/lib/<domain>.test.ts`

**New shared UI component:**
- Location: `src/components/<ComponentName>.tsx`
- If only used by one route, co-locate it in that route directory instead

**New database table/change:**
- Location: `supabase/migrations/<timestamp>_<description>.sql`
- Filename must sort after the most recent migration

**New ML feature or endpoint:**
- Location: `ml-service/ml_service/`
- Expose from Next.js: add fetch logic in `src/lib/recommendations/server.ts`

---

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: By GSD map-codebase command. Committed: Yes (tracked in git).

**`supabase/migrations/`:**
- Purpose: Ordered Postgres schema migrations
- Generated: No. Committed: Yes.

**`ml-service/ml_service/jobs/`:**
- Purpose: Offline ML training and artifact build jobs (not served by FastAPI)
- Generated: No. Committed: Yes.

**`.github/workflows/`:**
- Purpose: CI pipeline definitions
