---
phase: 01-student-profile-auto-fill
plan: 01
subsystem: database
tags: [supabase, postgres, migrations, rls, storage, typescript]

# Dependency graph
requires: []
provides:
  - "profiles table with bio, phone, linkedin_url, resume_url nullable columns"
  - "club_application_form_questions.source_key column with CHECK constraint (full_name, major, year, bio)"
  - "club_application_submission_answers.source_key column for snapshot provenance"
  - "resumes storage bucket (private, PDF-only, 10MB) with 3 RLS policies"
  - "FormQuestion TypeScript type with source_key: string | null field"
affects:
  - "01-02 (profile editor) — needs new profile columns + FormQuestion type"
  - "01-03 (auto-fill) — needs source_key on questions + FormQuestion type"
  - "01-04 (snapshot) — needs source_key on answers"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Storage bucket created via SQL migration for version-controlled bucket configuration"
    - "Storage RLS using storage.foldername(name)[1] = auth.uid()::text for per-user path isolation"
    - "source_key as separate additive column (not type enum change) to avoid CHECK constraint modification"

key-files:
  created:
    - "supabase/migrations/20260409000000_student_profile_autofill.sql"
  modified:
    - "src/lib/application-forms.ts"

key-decisions:
  - "Used source_key column (not profile_field type enum) to avoid dropping/re-adding the type CHECK constraint — purely additive migration"
  - "resume_url stores Storage path (not signed URL) — signed URLs expire; display-time generation via createSignedUrl is required"
  - "Storage bucket created via SQL migration for durability and version control"

patterns-established:
  - "Pattern: Additive schema changes via separate column (source_key) rather than modifying existing CHECK constraint"
  - "Pattern: Private Supabase Storage bucket with path-based RLS (foldername[1] = user id)"

requirements-completed: [PROF-01, PROF-02, PROF-03, PROF-04]

# Metrics
duration: 1min
completed: 2026-04-09
---

# Phase 1 Plan 01: Schema Foundation Summary

**SQL migration adding profile bio/phone/linkedin/resume columns, source_key mapping columns, and a private PDF-only resumes storage bucket with per-student RLS — plus FormQuestion TypeScript type updated with source_key field**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-09T20:14:41Z
- **Completed:** 2026-04-09T20:15:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created SQL migration with all 5 required sections: profile columns, source_key on questions (with CHECK), source_key on answers, resumes storage bucket, and 3 storage RLS policies
- Updated FormQuestion TypeScript type to include `source_key: string | null` — all other exports unchanged
- Storage bucket configured as private with PDF-only MIME restriction and 10MB file size limit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration** - `f17f968` (feat)
2. **Task 2: Add source_key to FormQuestion type** - `133485c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `supabase/migrations/20260409000000_student_profile_autofill.sql` - Full schema delta for Phase 1: profile columns, source_key columns, storage bucket, RLS policies
- `src/lib/application-forms.ts` - FormQuestion type extended with `source_key: string | null`

## Decisions Made
- Used `source_key` as a separate additive text column (not a new `type` enum value) — avoids requiring DROP + ADD of the `club_application_form_questions.type` CHECK constraint, which is a table-level lock on Postgres 15
- `resume_url` stores the Storage path (`{user_id}/resume.pdf`), not a signed URL — signed URLs expire after 1 hour; generate at display time via `createSignedUrl`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration will be applied via `supabase db push` or Supabase hosted migration runner.

## Next Phase Readiness
- Schema foundation is complete — all downstream plans in Phase 1 can proceed
- Plan 01-02 (profile editor): profiles table has bio, phone, linkedin_url, resume_url columns ready
- Plan 01-03 (auto-fill): club_application_form_questions has source_key column + CHECK constraint; FormQuestion type updated
- Plan 01-04 (snapshot): club_application_submission_answers has source_key column
- Note: source_key on existing form questions defaults to null — club admins must configure source_key via the portal form editor (Plan 01-02 or later) to activate auto-fill for their questions

---
*Phase: 01-student-profile-auto-fill*
*Completed: 2026-04-09*
