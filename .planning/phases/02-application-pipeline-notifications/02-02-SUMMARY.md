---
phase: 02-application-pipeline-notifications
plan: 02
subsystem: api
tags: [supabase, server-actions, pipeline, audit-log, next-js]

# Dependency graph
requires:
  - phase: 02-application-pipeline-notifications/02-01
    provides: club_application_stage_transitions table and is_released column on club_pipeline_stages

provides:
  - Audit log insert in updateApplicantStatus (read-before-write pattern, inserts on stage change only)
  - Stage history section on applicant detail page (admin-only, reverse-chronological with from/to badges)
  - updateStageRelease server action for toggling is_released per pipeline stage
  - Release toggle UI per stage row on decisions/pipeline settings page

affects:
  - 02-application-pipeline-notifications/02-03
  - student-facing pipeline visibility features

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Read-before-write for change detection in server actions (fetch current stage_id BEFORE update)
    - Separate inline <form> for toggle server actions in React Server Components (no onClick/useState)
    - Transition actor profiles fetched in batch via .in() query using Set dedup

key-files:
  created: []
  modified:
    - src/app/portal/[slug]/applicants/[applicationId]/actions.ts
    - src/app/portal/[slug]/applicants/[applicationId]/page.tsx
    - src/app/portal/[slug]/decisions/actions.ts
    - src/app/portal/[slug]/decisions/page.tsx

key-decisions:
  - "Read-before-write: currentApp stage_id fetched before .update() to avoid stale-read race condition on transition insert"
  - "Transition notes always null in Phase 2 inserts — notes column exists in schema for future use"
  - "Release toggle uses separate <form> per row (not onClick) since decisions/page.tsx is a React Server Component"

patterns-established:
  - "Change detection: always read current value before update when conditional insert depends on old vs new value"
  - "Server component toggles: wrap in isolated <form> with hidden input sending opposite value"

requirements-completed: [PIPE-01, PIPE-02]

# Metrics
duration: 8min
completed: 2026-04-13
---

# Phase 02 Plan 02: Application Pipeline Stage Audit Log and Release Toggle Summary

**Stage transition audit trail wired into updateApplicantStatus with read-before-write change detection, plus Stage history UI for officers and an is_released toggle on the pipeline settings page**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-13T00:03:00Z
- **Completed:** 2026-04-13T00:11:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `updateApplicantStatus` now reads `stage_id` before the update and inserts into `club_application_stage_transitions` only when the stage changed
- Officers see a "Stage history" section on the applicant detail page showing from/to stage badges with actor name and timestamp in reverse chronological order (admin-only)
- `updateStageRelease` server action added to decisions/actions.ts — updates `is_released` on a pipeline stage without touching `position` (avoids unique constraint issue)
- Decisions page shows a functional release toggle per stage row using a separate `<form>` with a hidden input that sends the opposite value (server component pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Hook audit log insert into updateApplicantStatus and add updateStageRelease action** - `0d841ab` (feat)
2. **Task 2: Add stage history section on applicant detail page and release toggle on decisions page** - `038367f` (feat)

## Files Created/Modified
- `src/app/portal/[slug]/applicants/[applicationId]/actions.ts` - Added read-before-write fetch, conditional stage transition insert with changed_by_user_id; destructured user from getPortalContext
- `src/app/portal/[slug]/applicants/[applicationId]/page.tsx` - Added StageTransition type, transitions query with reverse-chronological order, transitionActors profile lookup, Stage history section in admin block
- `src/app/portal/[slug]/decisions/actions.ts` - Added updateStageRelease exported server action (admin-only, updates is_released only)
- `src/app/portal/[slug]/decisions/page.tsx` - Added updateStageRelease import, is_released to Stage type and select query, inline toggle form per stage row

## Decisions Made
- Read-before-write pattern: current `stage_id` fetched before `.update()` so the conditional insert for transition rows doesn't have a stale-read race
- Release toggle uses an isolated `<form>` per stage row (not onClick) since this is a React Server Component — hidden input sends the opposite of current `is_released` value
- Transition notes always set to `null` in Phase 2 — column exists in schema for future use (per D-04 decision from RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PIPE-01 (audit trail) and PIPE-02 (history visible to officers) are complete
- PIPE-03 (student-visible release) depends on `is_released` toggle — now wired
- Plan 02-03 (notification emails) can proceed

---
*Phase: 02-application-pipeline-notifications*
*Completed: 2026-04-13*
