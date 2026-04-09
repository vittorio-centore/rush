# Rush

## What This Is

Rush is a centralized campus platform where students discover clubs, track their applications, and apply through a unified experience — and where club officers manage their entire recruitment pipeline. Every club gets a customizable portal: they define their own application questions, configure their review workflow, and style their public-facing page. Students maintain a persistent profile that auto-fills into any application.

## Core Value

Every club on campus lives on Rush, with a consistent application experience — so students stop hunting across Google Forms and club Instagram pages.

## Requirements

### Validated

- ✓ Public club directory with slug-based pages — existing
- ✓ Student authentication via OTP magic link — existing
- ✓ Student dashboard with followed clubs, application tracker, and profile editor — existing
- ✓ ML-powered club recommendations with popular fallback — existing
- ✓ Club admin portal with applicant management and decision workspace — existing
- ✓ Custom application form builder (questions, visibility rules) — existing
- ✓ Application deadline management with automated reminder emails — existing
- ✓ CSV import for bulk applicant ingestion — existing
- ✓ Behavioral event tracking for recommendation telemetry — existing
- ✓ Club claim flow for officers to take ownership of their club — existing

### Active

- [ ] Squarespace-style visual portal editor — clubs customize colors, layout, hero image, and branding on their public-facing page
- [ ] Full multi-stage application pipeline — submit → review → interview → decision, with stage transitions tracked and visible to both student and club
- [ ] Decision notification emails — students receive accept/reject/waitlist emails from club portal
- [ ] Student profile auto-fill — shared profile fields (name, major, year, bio) pre-populate into every application; clubs ask additional custom questions on top
- [ ] Admin onboarding flow — central admin approves and onboards clubs before they go live on the platform
- [ ] Full campus launch readiness — all clubs onboarded, discovery surfaces every active club, platform stable for real applicants

### Out of Scope

- Multi-university support — scoped to one campus; multi-tenancy adds significant auth and data isolation complexity
- Off-platform communication tools (Slack/Discord integration) — clubs handle post-decision communication outside Rush for now
- Payment/dues collection — out of scope for v1 application flow

## Context

The codebase is a Next.js 16 App Router monorepo with Supabase (Postgres + RLS + auth), a Python FastAPI ML recommendation service, and Tailwind CSS v4. Existing portal infrastructure covers applicant listing, form building, deadline management, and a decision workspace. The student dashboard has recommendation rails, follow tracking, and application status views.

The Squarespace-style UI editor is the largest net-new capability — nothing like a drag-and-drop or visual theme editor exists yet. The multi-stage pipeline (interview rounds, stage transitions) is partially stubbed but not complete.

## Constraints

- **Stack**: Next.js + Supabase + Tailwind — new features must fit this architecture
- **Auth**: Supabase OTP magic link only — no password auth, no OAuth in scope
- **Hosting**: Vercel + Supabase hosted — no infra changes
- **RLS**: All data access governed by Postgres Row-Level Security — new tables must include RLS policies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for auth + DB | Removes separate auth service, RLS handles data isolation at DB layer | ✓ Good |
| Server Actions for mutations | Eliminates separate API layer for writes, co-located with routes | ✓ Good |
| ML service as sidecar | Keeps recommendation inference isolated; fails gracefully with fallback | ✓ Good |
| Single-university scope | Reduces complexity for v1; multi-tenancy can be layered later | — Pending |
| Visual portal editor approach | TBD — block-based vs. theme picker vs. CSS variable overrides | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after initialization*
