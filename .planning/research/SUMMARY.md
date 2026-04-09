# Project Research Summary

**Project:** Rush — Campus Club Recruitment Platform (Visual Portal Editor Milestone)
**Domain:** Two-sided campus recruitment marketplace with visual customization
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

Rush is a mature platform at a specific inflection point: the core infrastructure (auth, clubs, forms, pipeline schema, ML recommendations) is built and solid. This milestone is about completing the product surface — turning a functional prototype into a launchable platform. The six active requirements break down into four distinct feature areas: profile auto-fill, multi-stage pipeline notifications, visual portal editor, and admin onboarding. Three of these four areas have substantial schema or infrastructure already in place; the work is wiring and UI, not greenfield engineering.

The recommended approach is to build in dependency order with a clear priority: profile auto-fill first (low complexity, schema already built), decision notifications second (Resend already integrated, idempotency guard is the main work), visual portal editor third (largest net-new UI work, fully independent of the other three), and admin onboarding last (gates production launch, should be ready before go-live). Phases 1 and 3 (auto-fill and portal editor) are parallelizable; phase 4 (admin onboarding) can also be developed in parallel but must be complete before launch. The critical finding from STACK.md is to not use any third-party visual editor library — build a custom theme picker using CSS custom properties stored in a structured `club_portal_themes` table. Every library evaluated (Puck, Craft.js, GrapeJS) is either incompatible with React 19, abandoned, or dramatically overpowered for the actual scope (hero image + accent color + section toggles).

The top risks cluster around two areas: email reliability (duplicate sends on retry, CAN-SPAM compliance for decision emails and deadline reminders) and data integrity (snapshot submitted answers at apply time, not live from profiles; optimistic concurrency on stage transitions; schema versioning on the JSONB portal theme config). Both are well-understood patterns with established prevention strategies already partially present in the codebase. The existing `deadline_reminder_sends` deduplication table is the template for decision email idempotency.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16.2.1 App Router, React 19.2.4, Supabase, Tailwind CSS v4, Resend) handles all four feature areas without new dependencies. The only net-new library needed is `react-colorful` (2.8KB, zero deps, React 19-compatible) for the color picker in the portal editor. All other work uses built-in React patterns, Supabase Storage (already authenticated), and Server Actions (already the codebase mutation pattern).

**Core technologies:**
- `react-colorful ^5.6.1`: Inline hex/HSL color picker for portal editor — only new dependency; hook-based, React 19-compatible, no legacy context
- Supabase Storage: Hero image and logo hosting — already in stack, eliminates a separate CDN integration
- CSS custom properties (native): Per-club theme rendering on public pages — Server Component injects `--club-*` variables at SSR time, zero client JS required
- `zod ^3.23.x`: Server Action validation for theme saves and stage transitions — not in codebase yet but required by TypeScript rules; add now
- `club_portal_themes` table (structured columns, not JSONB blob): Named columns per CSS token map directly to `--club-*` variable names; `custom_css_vars jsonb` escape hatch for future fields

**What NOT to use:**
- Puck, Craft.js, GrapeJS: React 19 compat issues + scope mismatch (Rush needs a theme picker, not a page assembly canvas)
- Builder.io: Paid SaaS lock-in unacceptable for a campus product

### Expected Features

**Must have (table stakes — these block launch):**
- Decision notification emails (accept/reject/waitlist) — schema exists, emails not triggered; clubs cannot close recruitment without this
- Admin onboarding flow with club approval — no `/admin` route exists; any bad actor can currently claim a club
- Student pipeline stage visibility — dashboard shows bucket only, not custom stage name; pipeline stages are invisible to the people they serve
- Email unsubscribe compliance — both decision emails and deadline reminders lack unsubscribe mechanism; CAN-SPAM risk

**Should have (differentiators):**
- Visual portal editor (hero image, accent color, section toggles) — highest club engagement feature; what clubs demo during onboarding
- Profile auto-fill — reduces per-application friction to near zero; auto-fills name/major/year from `profiles` into native application forms
- Bulk decision send with idempotency guard — clubs need to notify all accepted applicants in one action, not one-by-one
- `notification_sent_at` idempotency on `user_applications` — prevents duplicate decision email sends on retry

**Defer to v2+:**
- Editor live-preview split-pane — preview link is sufficient for launch; live preview requires a separate Client Component tree with unsaved state sync
- Interview scheduling / calendar sync — clubs use existing external tools; adds calendar OAuth scope
- Waitlist self-serve accept/decline — club decides who comes off waitlist; student receives notification only
- Rich text club description editor (TipTap/Plate) — plain text or basic markdown sufficient for v1

### Architecture Approach

All four features extend the existing architecture without restructuring it. The codebase's central patterns — `getPortalContext(slug)` for portal authorization, Server Actions for mutations, `revalidatePath` for cache busting, `src/lib/email.ts` for Resend sends — are the correct patterns for new features too. The four features divide into four distinct component boundaries with minimal coupling: Portal Theme Engine (reads/writes `club_portal_themes`, fully independent), Application Pipeline (extends `user_applications` with `application_stage_transitions` audit log), Student Profile Auto-Fill (adds `profile_field` question type, snapshots answers at submit time), and Admin Onboarding (new `/admin` route subtree with `requirePlatformAdmin()` guard modeled after `getPortalContext`).

**Major components:**
1. Portal Theme Engine — `src/app/portal/[slug]/design/actions.ts` writes theme; `clubs/[slug]/page.tsx` injects CSS vars at SSR; `club_portal_themes` table (structured columns, not JSON blob)
2. Application Pipeline with Audit Trail — `moveApplicationToStage` Server Action wraps a Postgres RPC for atomic UPDATE + INSERT; `application_stage_transitions` append-only log; email trigger on decision-bucket transition
3. Student Profile Auto-Fill — `profile_field` question type added to `club_application_form_questions`; profile values seeded into form as Server Component initial values; answers snapshotted into `submission_answers` at submit time (not live profile references)
4. Admin Onboarding Workflow — `src/app/admin/clubs/` route subtree; `requirePlatformAdmin()` checks `platform_admins` table (separate from `profiles` to prevent RLS leakage); `clubs.onboarding_status` column separate from `clubs.verified`

### Critical Pitfalls

1. **XSS via user-controlled CSS in portal editor** — Never store free-form CSS strings; store only named tokens (`primary_color`, `hero_image_url`); validate hex colors with `/^#[0-9a-fA-F]{6}$/`; validate image URLs as HTTPS pointing to the Supabase Storage bucket; never use `dangerouslySetInnerHTML` for club-supplied content
2. **Duplicate decision emails on Server Action retry** — Add `decision_notification_sends (application_id, decision_status)` with unique constraint before wiring any send triggers; use Resend idempotency key as second guard; bulk sends go through the existing cron infrastructure, not inline Server Action loops
3. **Stage transition race conditions** — Use optimistic concurrency: `UPDATE user_applications SET stage_id = $new WHERE id = $id AND stage_id = $expected`; implement `move_application_stage` as a Postgres security-definer RPC to keep UPDATE + audit INSERT atomic
4. **Profile auto-fill stale data in submissions** — Snapshot auto-filled profile fields into `submission_answers` rows at submit time; never join `profiles` when displaying submitted applications to reviewers; add `source` column (`'profile_autofill' | 'manual'`) to `submission_answers`
5. **`verified` vs `onboarding_status` semantic confusion** — Keep `clubs.verified` for identity confirmation; add `clubs.onboarding_status ('pending' | 'approved' | 'suspended')` for access gating; gate portal email and pipeline features on `onboarding_status = 'approved'` in `getPortalContext`, not on `verified`

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Profile Auto-Fill
**Rationale:** Lowest complexity of the four features, pure additive schema changes, no new infrastructure dependencies. Delivers meaningful friction reduction before deeper pipeline work begins. Can be developed in parallel with Phase 3.
**Delivers:** Students see name/major/year/email pre-populated when opening any native application form; answers snapshotted at submit time
**Addresses:** Profile auto-fill (active requirement); also extends `profiles` with `bio`, `phone`, `linkedin_url` columns for future use
**Avoids:** Pitfall 8 (stale profile data) — snapshot on submit from the start; explicit `profile_field` enum on `form_questions` avoids heuristic label matching
**Schema work:** Add `profile_field` type and `source_key` column to `club_application_form_questions`; add nullable columns to `profiles`

### Phase 2: Multi-Stage Pipeline + Decision Notifications
**Rationale:** The pipeline and notifications are tightly coupled — stage transitions trigger emails, email templates encode decision types, and the idempotency guard is shared. Building them together is cleaner than building pipeline UI, then layering notifications. This is also the feature that determines whether clubs can fully close their recruitment loop.
**Delivers:** Stage transitions visible to students in dashboard with custom stage names; accept/reject/waitlist emails triggered from portal decisions page; full audit trail in `application_stage_transitions`
**Addresses:** Full multi-stage pipeline, decision notification emails (both active requirements)
**Avoids:** Pitfall 4 (duplicate emails) — `decision_notification_sends` table before any send; Pitfall 5 (race conditions) — `move_application_stage` Postgres RPC with optimistic concurrency; Pitfall 6 (notification spam) — route bulk sends through cron queue
**Schema work:** `application_stage_transitions` table; `decision_notification_sends` table; student dashboard join with `club_pipeline_stages.label`

### Phase 3: Visual Portal Editor
**Rationale:** Largest net-new UI work in the milestone; fully independent of phases 1, 2, and 4. Can be built in parallel with Phase 1 by a second developer. Clubs will demo this feature during onboarding — it is the acquisition driver.
**Delivers:** Club officers can upload a hero image, set an accent color, and toggle section visibility from `/portal/[slug]/design`; public club page renders theme via SSR CSS variables with zero client JS
**Addresses:** Squarespace-style visual portal editor (active requirement)
**Avoids:** Pitfall 1 (XSS via CSS) — token-only storage with Zod validation on write; Pitfall 2 (hydration mismatch) — strict RSC/client boundary; Pitfall 3 (JSON schema drift) — structured columns not a JSONB blob; Pitfall 11 (hero image path hijack) — club-scoped storage paths with bucket policy
**Schema work:** `club_portal_themes` table with structured color/layout/hero columns; Supabase Storage bucket `portal-assets` with `portal-assets/{club_id}/*` RLS policy
**Stack:** `react-colorful` (only new dependency)

### Phase 4: Admin Onboarding + Launch Readiness
**Rationale:** Gates production launch — no clubs should go live without admin approval. Can be developed in parallel with phases 1-3 but must be complete before any production traffic. Also the lowest technical risk phase (mostly CRUD + email) so it can absorb schedule pressure from the other phases.
**Delivers:** `/admin/clubs` route with pending claims list, approve/reject actions, club live/staging toggle; platform admin role model; `onboarding_status` guards on portal email and pipeline actions; email unsubscribe compliance for both decision and deadline emails
**Addresses:** Admin onboarding flow, full campus launch readiness (both active requirements)
**Avoids:** Pitfall 7 (portal accessible before approval) — `onboarding_status` check in `getPortalContext`; Pitfall 12 (`verified` vs `onboarding_status` confusion) — separate column with documented semantics; Pitfall 10 (email compliance) — suppression table + `List-Unsubscribe` header retrofitted to deadline reminders too
**Schema work:** `platform_admins` table; `clubs.onboarding_status` column; `club_email_suppressions` suppression table

### Phase Ordering Rationale

- Phase 1 before Phase 2: Auto-fill extends `profiles` and `form_questions`; those schema additions land first before notification email templates reference profile data. Low-risk additive changes first.
- Phase 2 after Phase 1: Notification emails touch `user_applications`, `club_pipeline_stages`, `profiles` (for email addresses), and `src/lib/email.ts`. Building after Phase 1 ensures profile schema is stable.
- Phase 3 independent: Portal theme editor touches only `clubs`, `club_portal_themes`, and Supabase Storage. Zero shared state with pipeline or admin. Parallelizable with Phase 1.
- Phase 4 last but parallelizable: The `onboarding_status` column and `getPortalContext` guard change should land before Phase 2's email sends go live (to prevent unapproved clubs from sending notifications). The admin UI itself can follow. Flag this dependency during implementation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Pipeline + Notifications):** The Postgres RPC pattern for atomic stage transitions should be verified against the existing migration pattern before writing the function. The bulk email queueing via cron needs to confirm the existing cron route structure supports a new job type.
- **Phase 3 (Portal Editor):** The live preview vs. preview-link decision should be confirmed with product before building. Split-pane live preview is architecturally distinct from a preview link — confirm scope before starting.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auto-Fill):** Pure additive schema changes + Server Component pre-seeding. Well-documented App Router pattern. No novel infrastructure.
- **Phase 4 (Admin Onboarding):** CRUD route with auth guard. Mirrors `getPortalContext` exactly. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations from direct codebase analysis; react-colorful is the only new dependency and is well-established with hook-based API |
| Features | HIGH | What-exists analysis from direct code read; gap analysis from schema inspection; competitor benchmarks MEDIUM (training data, no live verification) |
| Architecture | HIGH | All schema sketches derived from reading all 9 migrations and existing codebase patterns; recommendations extend existing patterns |
| Pitfalls | HIGH | Critical pitfalls derived directly from codebase schema gaps and existing patterns; email compliance guidance MEDIUM (standard industry practice) |

**Overall confidence:** HIGH

### Gaps to Address

- **react-colorful React 19.2.4 compatibility:** Highly likely given hook-based architecture (no legacy context); verify at implementation time. Drop-in replacement is `<input type="color">` if needed.
- **Resend idempotency key 24-hour window:** If bulk decision sends span more than 24 hours (unlikely for a single club action), the Resend-level guard would expire. The `decision_notification_sends` table is the primary guard regardless; Resend key is secondary.
- **`club_application_form_questions` type CHECK constraint migration:** Adding `'profile_field'` to the type enum requires dropping and re-adding the CHECK constraint. Verify this is non-blocking in production on Postgres 15+.
- **Email unsubscribe retrofit to deadline reminders:** Deadline reminders are existing and already in production. The suppression mechanism must be added to deadline reminders as part of Phase 4 launch readiness — not deferred to a separate patch.
- **`onboarding_status` guard dependency in Phase 2:** The `onboarding_status` column and `getPortalContext` guard change (Phase 4 schema work) should land before Phase 2 email sends go live. This is a cross-phase dependency that must be tracked during implementation.

## Sources

### Primary (HIGH confidence — direct codebase read)
- `supabase/migrations/` (all 9 migration files) — schema ground truth for all recommendations
- `src/lib/portal.ts`, `src/lib/email.ts`, `src/app/portal/[slug]/` — existing patterns replicated in new features
- `src/app/api/cron/deadline-reminders` — deduplication pattern template for decision emails
- `.planning/PROJECT.md` — scope and constraints
- `.planning/codebase/ARCHITECTURE.md` — existing architecture baseline
- `CONCERNS.md` — confirmed existing gaps (unsubscribe, admin approval UI)

### Secondary (MEDIUM confidence — training knowledge, current as of August 2025)
- CampusGroups, Presence, OrgSync/Engage product patterns — informed feature priority ordering
- Puck v0.16.x React 19 compatibility status — informed "do not use" recommendation; not verified live
- Craft.js maintenance status — last release 2022, effectively abandoned; not verified live
- Resend `Idempotency-Key` deduplication window — standard ESP behavior
- CAN-SPAM / CASL transactional email exemption details — standard industry knowledge

### Tertiary (LOW confidence — needs validation before implementation)
- `react-colorful` React 19.2.4 compatibility — highly likely given architecture; verify at implementation time

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
