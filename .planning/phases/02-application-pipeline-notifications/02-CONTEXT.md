# Phase 2: Application Pipeline & Notifications - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers:
1. Club officers can move applicants through named pipeline stages (PIPE-01) — the portal already has `updateApplicantStatus` with `stage_id`; this phase wires in an audit log and ensures the UX is complete.
2. Every stage transition is recorded in an append-only audit log visible to club officers (PIPE-02).
3. Students see their current pipeline stage on the tracker — but visibility is officer-controlled via a per-stage release toggle, not real-time (PIPE-03, extended).
4. Students receive an email confirmation immediately on submitting a native Rush application (NOTF-01).

</domain>

<decisions>
## Implementation Decisions

### Audit Log (PIPE-02)
- **D-01:** Create a `club_application_stage_transitions` table (or similarly named) as an append-only audit log. No row can be updated or deleted — RLS should enforce this.
- **D-02:** Columns: `application_id`, `from_stage_id` (nullable — null on initial placement), `to_stage_id`, `changed_by_user_id`, `changed_at`, `notes` (text, nullable — optional reason the officer provides).
- **D-03:** Audit log is visible to **club officers only** — displayed as a "Stage history" section on the applicant detail page (`/portal/[slug]/applicants/[id]`). Students do not see it.
- **D-04:** When `updateApplicantStatus` runs and the `stage_id` changes, insert a transition record. If `stage_id` does not change (officer saved without moving), no record is inserted.

### Student Stage Visibility (PIPE-03 — officer-controlled release)
- **D-05:** Stage visibility to students is **not real-time**. Each `club_pipeline_stages` row gets an `is_released` boolean (default `false`). Officers flip this toggle per-stage in portal pipeline settings.
- **D-06:** Student tracker logic: a student's visible stage is the label of their current `stage_id` **only if** that stage has `is_released = true`. If their current stage is not yet released, show the label of the last released stage they passed through, or fall back to the generic `status` bucket label if no released stage applies.
- **D-07:** When an officer marks a stage as released (flips `is_released = true`), all students currently assigned to that stage immediately see that stage's label on their tracker.
- **D-08:** Release toggle lives in portal pipeline settings (alongside the stage list/order). Simple toggle switch per stage row.

### Confirmation Email (NOTF-01)
- **D-09:** Fire the confirmation email from the `submitNativeApplication` server action immediately after a successful submission insert.
- **D-10:** Email content: club name, confirmation that application was received, submission timestamp, CTA link to `/dashboard`.
- **D-11:** Visual style: match the existing dark/stone theme in `src/lib/email.ts` — dark stone background (`#1c1917`), amber Rush wordmark, table-based layout, stone/amber color palette.
- **D-12:** Use the existing Resend client pattern (`RESEND_API_KEY` env var, `from: "Rush <noreply@rush.app>"` or similar consistent sender).

### Claude's Discretion
- Schema details for `club_application_stage_transitions` (indexes, foreign key constraints, RLS policies).
- Whether `is_released` lives on `club_pipeline_stages` directly or in a separate table.
- Exact UI treatment for the stage history panel on the applicant detail page.
- Email subject line wording.
- Whether releasing a stage also triggers any email (out of scope for NOTF-01; v2 NOTF-02).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria (PIPE-01, PIPE-02, PIPE-03, NOTF-01)
- `.planning/REQUIREMENTS.md` — Acceptance criteria detail for each requirement ID

### Existing Portal Pipeline Code
- `src/app/portal/[slug]/applicants/[applicationId]/actions.ts` — `updateApplicantStatus` — this is where stage transitions are triggered; audit log insert hooks in here
- `src/app/portal/[slug]/applicants/[applicationId]/page.tsx` — applicant detail page; stage history section goes here
- `src/lib/recruiter-decisions.ts` — `StageTemplate`, `ColorToken` types, `colorTokenClasses` utility

### Student Tracker
- `src/app/dashboard/applications/page.tsx` — applications kanban; add `stage_id` join to expose released stage label
- `src/app/dashboard/applications/[id]/page.tsx` — application detail; show released stage in pipeline section

### Email Infrastructure
- `src/lib/email.ts` — `sendDeadlineReminder` — reference for Resend client, dark stone HTML template, amber CTA button pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `colorTokenClasses(color)` in `src/lib/recruiter-decisions.ts` — maps color tokens to Tailwind badge classes; reuse for stage history badges
- `sendDeadlineReminder` in `src/lib/email.ts` — Resend client setup and HTML template structure to replicate for confirmation email
- `updateApplicantStatus` in portal actions — already validates `stage_id` against `club_pipeline_stages`; hook audit log insert here

### Established Patterns
- Server Actions for all mutations — no separate API layer
- `getPortalContext(slug)` for portal auth guard — all portal actions use this
- `revalidatePath` after mutations, `redirect` on error/success — existing pattern in all portal actions
- Dark stone email HTML template (inline styles, no CSS classes) — matches `buildEmailHtml` pattern

### Integration Points
- `club_pipeline_stages` table already exists with `id`, `label`, `status_bucket`, `color_token`, `position`, `club_id`
- `user_applications.stage_id` already set by `updateApplicantStatus`
- New table `club_application_stage_transitions` connects to `user_applications` and `club_pipeline_stages`
- `is_released` column on `club_pipeline_stages` must be added via migration
- Portal settings page (`/portal/[slug]/settings`) is where the release toggle UI should live — check existing settings structure

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants all applicants in a stage to see the update **at the same time** — this is why officer-controlled release is required rather than real-time visibility.
- Student tracker should show "last released stage label" (not current internal stage) until the officer releases the next stage. If no stage is released, fall back to generic `status` bucket name.

</specifics>

<deferred>
## Deferred Ideas

- NOTF-02: Stage-transition notification email to student — v2 requirement, not Phase 2
- NOTF-03: Accept/reject/waitlist decision email — v2 requirement, not Phase 2
- PIPE-04: Interview time slot scheduling — v2 requirement, not Phase 2
- Batch release: releasing all stages at once (e.g., end-of-rush wave) — not in scope for Phase 2, could be added later

</deferred>

---

*Phase: 02-application-pipeline-notifications*
*Context gathered: 2026-04-10*
