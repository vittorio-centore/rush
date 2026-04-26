---
phase: 02-application-pipeline-notifications
plan: "01"
subsystem: database
tags: [migration, rls, audit-log, pipeline, supabase]
dependency_graph:
  requires: []
  provides: [club_application_stage_transitions, is_released_column]
  affects: [club_pipeline_stages, user_applications]
tech_stack:
  added: []
  patterns: [append-only-rls, audit-table]
key_files:
  created:
    - supabase/migrations/20260410000000_pipeline_audit_and_release.sql
  modified: []
decisions:
  - "is_released added directly to club_pipeline_stages (not a separate table) — join complexity unwarranted since release history is not needed"
  - "Transition notes always null in migration design — collection deferred to v2 per research recommendation"
metrics:
  duration: "<1 minute"
  completed: "2026-04-13"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 02 Plan 01: Pipeline Audit Log and Release Column Migration Summary

## One-Liner

Append-only `club_application_stage_transitions` audit table with 3 RLS policies (2 SELECT + 1 INSERT, no UPDATE/DELETE) plus `is_released boolean` column on `club_pipeline_stages`.

## What Was Built

A single Supabase migration file (`supabase/migrations/20260410000000_pipeline_audit_and_release.sql`) containing:

1. **`is_released` column** on `club_pipeline_stages` — `boolean not null default false`, added with `add column if not exists` for idempotency. Officers flip this per-stage to control student visibility (D-05).

2. **`club_application_stage_transitions` table** — append-only audit log recording every stage move. Columns: `id`, `application_id` (FK → `user_applications`, cascade), `from_stage_id` (FK → `club_pipeline_stages`, set null on delete), `to_stage_id` (FK → `club_pipeline_stages`, set null on delete), `changed_by_user_id` (FK → `auth.users`, cascade), `changed_at`, `notes`. No `updated_at` column (D-01).

3. **Two indexes:**
   - `club_application_stage_transitions_application_idx` on `(application_id, changed_at desc)` — optimizes the student-visible stage history query that orders transitions newest-first.
   - `club_application_stage_transitions_to_stage_idx` on `(to_stage_id)` — optimizes released-stage lookups when filtering by stage.

4. **RLS enabled** with exactly 3 policies:
   - `"Club officers can view stage transitions"` (SELECT) — any club admin membership member can view transitions for their club's applications.
   - `"Club admins can insert stage transitions"` (INSERT) — only `role = 'admin'` members can insert. No UPDATE or DELETE policies exist; Postgres blocks those operations by default.
   - `"Students can view their own stage transitions"` (SELECT) — students can read transitions for their own applications, required for the released-stage fallback logic in Plan 03 (D-06 / Pitfall 2).

5. **Table comment** documenting the append-only invariant for future developers.

## Commits

| Hash | Message |
|------|---------|
| 80821f8 | feat(02-01): add stage transition audit log and is_released column migration |

## Decisions Made

- `is_released` lives directly on `club_pipeline_stages` (not a separate table). Release history is not needed for Phase 2; a separate table would only add join complexity with no benefit.
- Transition `notes` field is present in the schema (D-02 requires it) but Plan 02 will always insert `null` — the field exists for future officer-provided move reasons without requiring another migration.
- Student SELECT policy is included at this layer (not Plan 03) because the RLS constraint is a schema concern, not an application concern. Plan 03 will simply read transitions without any additional policy work.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan produces DDL only; no application code was changed.

## Self-Check: PASSED

- [x] `supabase/migrations/20260410000000_pipeline_audit_and_release.sql` exists
- [x] `grep -c "create policy" ...` returns 3
- [x] `grep "for update\|for delete" ...` returns nothing
- [x] `grep "is_released" ...` returns the ALTER TABLE line
- [x] Commit 80821f8 exists in git log
