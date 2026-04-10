# Phase 2: Application Pipeline & Notifications - Research

**Researched:** 2026-04-10
**Domain:** Supabase RLS + append-only audit tables, Resend email, Next.js 16 Server Actions, student-visible pipeline stage release toggle
**Confidence:** HIGH

## Summary

Phase 2 extends an already-functioning pipeline UI. The `updateApplicantStatus` server action and `club_pipeline_stages` table exist and work — this phase's job is: (1) hook an append-only audit log into that action, (2) add `is_released` to `club_pipeline_stages` and expose it in the decisions/pipeline settings UI, (3) teach the student tracker to read the "last released stage" instead of raw status, and (4) fire a Resend confirmation email from `submitNativeApplication` after a successful insert.

No third-party libraries are needed beyond what is already installed (`resend` ^6.9.4 is present). All four requirements map cleanly to four focused work streams that each touch a small number of files. The trickiest piece is the student-visible stage logic (D-06): a student sees their current stage only if it is `is_released = true`; otherwise they see the label of the most recently released stage they passed through, falling back to the generic `status` bucket label. This requires querying the `club_application_stage_transitions` table client-side for the student, which means the audit table must also be selectable by the application owner — that constraint drives the RLS design.

`nyquist_validation` is disabled in `.planning/config.json`, so no test infrastructure section is required.

**Primary recommendation:** Implement in three plans — (A) schema migration, (B) portal-side audit log + release toggle UI, (C) student tracker display + confirmation email.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Create a `club_application_stage_transitions` table as an append-only audit log. No row can be updated or deleted — RLS should enforce this.
**D-02:** Columns: `application_id`, `from_stage_id` (nullable — null on initial placement), `to_stage_id`, `changed_by_user_id`, `changed_at`, `notes` (text, nullable).
**D-03:** Audit log visible to club officers only — displayed as a "Stage history" section on `/portal/[slug]/applicants/[id]`. Students do not see it.
**D-04:** Insert a transition record when `stage_id` changes; if it does not change, no record is inserted.
**D-05:** Stage visibility to students is not real-time. Each `club_pipeline_stages` row gets an `is_released` boolean (default `false`). Officers flip this per-stage in portal pipeline settings.
**D-06:** Student tracker logic: show current stage label only if `is_released = true`; otherwise show label of last released stage they passed through; fall back to generic `status` bucket label.
**D-07:** When an officer marks a stage released (`is_released = true`), all students currently assigned to that stage immediately see that stage's label.
**D-08:** Release toggle lives in portal pipeline settings alongside the stage list/order.
**D-09:** Fire the confirmation email from `submitNativeApplication` immediately after a successful submission insert.
**D-10:** Email content: club name, confirmation that application was received, submission timestamp, CTA link to `/dashboard`.
**D-11:** Visual style: dark stone background (`#1c1917`), amber Rush wordmark, table-based layout, stone/amber palette — match `buildEmailHtml` in `src/lib/email.ts`.
**D-12:** Use existing Resend client pattern (`RESEND_API_KEY` env var, `from: "Rush <noreply@rush.app>"`).

### Claude's Discretion

- Schema details for `club_application_stage_transitions` (indexes, foreign key constraints, RLS policies).
- Whether `is_released` lives on `club_pipeline_stages` directly or in a separate table.
- Exact UI treatment for the stage history panel on the applicant detail page.
- Email subject line wording.
- Whether releasing a stage also triggers any email (out of scope).

### Deferred Ideas (OUT OF SCOPE)

- NOTF-02: Stage-transition notification email to student — v2
- NOTF-03: Accept/reject/waitlist decision email — v2
- PIPE-04: Interview time slot scheduling — v2
- Batch release: releasing all stages at once — not in scope for Phase 2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | Club officer can move an applicant through pipeline stages (submit → review → interview → decision) | `updateApplicantStatus` already exists; needs audit log insert hooked in |
| PIPE-02 | Each stage transition recorded in append-only audit log | New `club_application_stage_transitions` table; RLS blocks UPDATE/DELETE |
| PIPE-03 | Student can see their current pipeline stage on their application tracker | `is_released` column on `club_pipeline_stages`; student tracker reads released-stage logic |
| NOTF-01 | Student receives email confirmation immediately after submitting a club application | Hook into `submitNativeApplication` after successful insert; Resend already installed |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | App Router, Server Actions | Project framework |
| @supabase/ssr | ^0.9.0 | Server-side Supabase client | Established pattern via `createClient()` |
| resend | ^6.9.4 | Transactional email | Already used in `src/lib/email.ts` |
| react | 19.2.4 | UI rendering | Project framework |
| tailwindcss | ^4 | Styling | Project CSS framework |

No new packages needed. All capabilities are present.

**Environment variables confirmed present:**
- `RESEND_API_KEY` — present in `.env.local`
- `NEXT_PUBLIC_APP_URL` — present in `.env.local`

---

## Architecture Patterns

### Established Project Patterns (must follow exactly)

**Server Actions for all mutations** — no separate API routes. Every write goes through a `"use server"` file co-located with the page.

**`getPortalContext(slug)`** — use for any portal action that may be performed by admin or reviewer. **`requirePortalAdmin(slug)`** — use when the action is admin-only (settings, stage release toggle).

**`redirect()` on error/success** — never return error objects from Server Actions; always redirect with `?error=` or `?message=` query params.

**`revalidatePath()`** — call after every mutation for all affected paths.

**Supabase RLS enforced on every table** — never trust client-supplied IDs without a `.eq("club_id", club.id)` guard.

### Pattern 1: Append-Only Audit Table via RLS

**What:** A table where INSERT is allowed but UPDATE and DELETE are blocked at the RLS layer. No `updated_at` trigger. No soft-delete flag.

**When to use:** Any immutable record — stage transitions, audit events.

**RLS recipe:**
```sql
-- Only allow INSERT, never UPDATE or DELETE
alter table public.club_application_stage_transitions enable row level security;

-- Club officers can view transitions for their club's applications
create policy "Club officers can view stage transitions"
on public.club_application_stage_transitions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_applications ua
    join public.club_admin_memberships cam on cam.club_id = ua.club_id
    where ua.id = public.club_application_stage_transitions.application_id
      and cam.user_id = auth.uid()
  )
);

-- Club admins can insert transitions (server action already validates auth, belt-and-suspenders)
create policy "Club admins can insert stage transitions"
on public.club_application_stage_transitions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_applications ua
    join public.club_admin_memberships cam on cam.club_id = ua.club_id
    where ua.id = public.club_application_stage_transitions.application_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);
-- No UPDATE policy → updates blocked
-- No DELETE policy → deletes blocked
```

**Student read access for released-stage logic:**
```sql
-- Students can read transitions for their own applications (needed to compute last-released-stage)
create policy "Students can view their own stage transitions"
on public.club_application_stage_transitions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_applications ua
    where ua.id = public.club_application_stage_transitions.application_id
      and ua.user_id = auth.uid()
  )
);
```

### Pattern 2: Stage Transition Insert in `updateApplicantStatus`

**What:** After a successful `user_applications` UPDATE, compare the new `stage_id` to the previous value; insert a transition row only if they differ.

**Key implementation detail:** Fetch the application's current `stage_id` BEFORE the update, then compare:

```typescript
// In updateApplicantStatus, before the UPDATE:
const { data: current } = await supabase
  .from("user_applications")
  .select("stage_id")
  .eq("id", applicationId)
  .eq("club_id", club.id)
  .maybeSingle();

const previousStageId = current?.stage_id ?? null;

// ... perform the update ...

// After successful update, insert transition if stage changed:
if (stageId !== previousStageId) {
  await supabase.from("club_application_stage_transitions").insert({
    application_id: applicationId,
    from_stage_id: previousStageId,
    to_stage_id: stageId,
    changed_by_user_id: user.id,
    notes: notes || null,  // reuse the notes field from the form
  });
}
```

**Pitfall:** Do NOT use `notes` from the applicant's internal notes field as the transition note — these are separate concerns. The CONTEXT.md says `notes` on the transition is optional and officer-provided as a reason for the move. Consider a separate `transition_notes` form field, or omit notes from the transition insert if the form only has one notes field.

### Pattern 3: `is_released` Column on `club_pipeline_stages`

**Decision (Claude's Discretion):** Add `is_released` directly to `club_pipeline_stages` table (not a separate table). This keeps joins simple and the migration minimal. A separate table would only be justified if release history mattered — it does not for Phase 2.

```sql
alter table public.club_pipeline_stages
  add column if not exists is_released boolean not null default false;
```

No trigger needed. Officers toggle it; the column persists. RLS is already in place — the existing admin policy covers UPDATE on this table.

### Pattern 4: Student Tracker Released-Stage Logic

**What:** The student sees the "most recently released stage they passed through," not their current internal stage.

**Implementation approach:**

Option A (recommended): Query `club_application_stage_transitions` joined with `club_pipeline_stages` to find the highest-`changed_at` transition where `to_stage_id` maps to a released stage. Fall back to `status` bucket if none found.

```typescript
// In student dashboard application query:
// 1. Fetch the application's stage_id and status
// 2. Check if current stage is released → show it
// 3. If not released, query transitions to find the last released stage the student passed through
// 4. Fall back to status bucket label

async function getVisibleStageLabel(
  supabase: SupabaseClient,
  applicationId: string,
  currentStageId: string | null,
  statusBucket: string,
): Promise<string> {
  if (currentStageId) {
    const { data: stage } = await supabase
      .from("club_pipeline_stages")
      .select("label, is_released")
      .eq("id", currentStageId)
      .maybeSingle();

    if (stage?.is_released) return stage.label;
  }

  // Walk transition history to find last released stage
  const { data: transitions } = await supabase
    .from("club_application_stage_transitions")
    .select("to_stage_id, changed_at, club_pipeline_stages!to_stage_id(label, is_released)")
    .eq("application_id", applicationId)
    .order("changed_at", { ascending: false });

  for (const t of transitions ?? []) {
    const stage = Array.isArray(t.club_pipeline_stages)
      ? t.club_pipeline_stages[0]
      : t.club_pipeline_stages;
    if (stage?.is_released) return stage.label;
  }

  // Fall back to generic bucket label
  const BUCKET_LABELS: Record<string, string> = {
    interested: "Interested",
    applied: "Applied",
    interview: "Interview",
    decision: "Decision",
  };
  return BUCKET_LABELS[statusBucket] ?? statusBucket;
}
```

**Performance note:** This makes 1–2 additional queries per application card on the dashboard. For Phase 2 (small applicant counts), this is acceptable. If it becomes a bottleneck later, a DB view or materialized computed column is the optimization path.

### Pattern 5: Confirmation Email via Resend

**What:** Call `sendApplicationConfirmation()` from `src/lib/email.ts` immediately after the successful submission insert in `submitNativeApplication`. Use the same Resend client pattern as `sendDeadlineReminder`.

**Where to fire it:** After `club_application_submission_answers` insert succeeds, before the `events.insert` calls, before `redirect`. Email failure must NOT block the submission — log the error but let the redirect proceed.

```typescript
// In submitNativeApplication, after successful answer insert:
const emailResult = await sendApplicationConfirmation(
  authData.user.email!,
  club.name,
  now, // submission timestamp
);
if (emailResult.error) {
  // Non-fatal: log but do not redirect with error
  console.error("Confirmation email failed:", emailResult.error);
}
// Then continue to events.insert and redirect
```

**Note on `console.error`:** The global rules flag `console.log` but `console.error` for genuine server-side error logging in server actions is acceptable. If the project uses a logger, use that instead.

**Email function signature to add to `src/lib/email.ts`:**
```typescript
export async function sendApplicationConfirmation(
  to: string,
  clubName: string,
  submittedAt: string, // ISO timestamp
): Promise<{ error: Error | null }>
```

**Email HTML pattern** — replicate `buildEmailHtml` from `src/lib/email.ts`:
- `body` background: `#1c1917`
- Rush wordmark: `color:#fcd34d`, `font-size:12px`, `font-weight:700`, `letter-spacing:0.2em`
- Card border: `border:1px solid #292524`, `border-radius:16px`
- Body text: `color:#f5f5f4` (headings), `color:#a8a29e` (secondary)
- CTA button: `background:#fcd34d`, `color:#1c1917`, `border-radius:999px`
- Sender: `"Rush <noreply@rush.app>"`

### Pattern 6: Release Toggle UI in Portal Pipeline Settings

**Where:** The `decisions` page (`/portal/[slug]/decisions`) already manages the stage list. The release toggle belongs alongside each stage row in that UI, not in general settings.

**UI treatment:** Add a toggle switch (checkbox styled as a toggle) for each stage row in the stage list. Submit via a new server action `updateStageRelease(slug, stageId, isReleased)` that does a simple `supabase.from("club_pipeline_stages").update({ is_released: isReleased })`.

**Stage history panel** — on the applicant detail page, add a "Stage history" section at the bottom of the right column (after reviewer assignments, admin-only). Render the transitions in reverse chronological order showing: from-label → to-label, officer name, timestamp, optional note.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP integration | Resend (already installed) | Already integrated with working dark template |
| Append-only enforcement | Application-layer insert-only flag | Postgres RLS (no UPDATE/DELETE policy) | Database enforces at the storage layer — cannot be bypassed by app code bugs |
| Stage ordering | Custom sorting logic | `position` column on `club_pipeline_stages`, `.order("position")` | Already established schema pattern |
| Auth guard | Re-implementing membership checks | `getPortalContext` / `requirePortalAdmin` | Already handles redirect, membership lookup |

---

## Common Pitfalls

### Pitfall 1: Stale `stage_id` Read Race

**What goes wrong:** If the audit log insert reads `stage_id` after the UPDATE has already run, you get `previousStageId === stageId` (no diff) and no transition is logged.

**How to avoid:** Read the current `stage_id` BEFORE the UPDATE in `updateApplicantStatus`. The current code reads the stage to validate it but does not capture the current application stage — add that fetch before the update.

**Warning signs:** Stage history is empty even after multiple officer moves.

### Pitfall 2: RLS Blocks Student from Reading Transitions

**What goes wrong:** The student tracker's released-stage query silently returns empty rows because the student does not have a SELECT policy on `club_application_stage_transitions`.

**How to avoid:** Add a student SELECT policy scoped to `ua.user_id = auth.uid()` (see Pattern 1 above).

**Warning signs:** Student always sees generic status bucket label even when stages are released.

### Pitfall 3: Email Blocks Submission Redirect

**What goes wrong:** `sendApplicationConfirmation` throws or Resend times out, and the `await` causes the entire `submitNativeApplication` server action to crash before `redirect()` is called — student sees a 500 and thinks their application failed.

**How to avoid:** Wrap the email call in a try/catch (or check `.error` on the result) and let the redirect proceed regardless. Email failure is non-fatal.

**Warning signs:** Student reports submission failed; check server logs for Resend errors.

### Pitfall 4: Transition Notes vs. Applicant Notes Collision

**What goes wrong:** The applicant detail form has an "Internal notes" `textarea` named `notes`. If the same field is passed as the transition note, every save-without-stage-change or notes-only edit creates spurious "no transition" records (guarded by the diff check) but also wires up the wrong UX intention.

**How to avoid:** Either (a) leave transition notes null and never collect them from the form (simplest, matches D-02's "optional"), or (b) add a separate `transition_notes` field that only appears when the officer is changing the stage. Do not reuse the applicant `notes` field.

### Pitfall 5: `is_released` Toggle Breaks Existing Stage Queries

**What goes wrong:** Adding `is_released` to the migration but forgetting to select it in portal queries causes TypeScript errors or stale-data bugs when the toggle is rendered.

**How to avoid:** Update all `select("id, label, status_bucket, color_token")` calls on `club_pipeline_stages` to include `is_released` in the column list wherever the toggle will be displayed or the released-stage logic runs.

### Pitfall 6: `unique (club_id, position)` Constraint Blocks Stage Updates

**What goes wrong:** The existing `club_pipeline_stages` migration has `unique (club_id, position)`. Adding `is_released` via `ALTER TABLE` is safe and does not touch this constraint. But if any future work in this phase tries to reorder stages as part of the release toggle UI, the unique constraint on position will error.

**How to avoid:** The release toggle only updates `is_released` — do not update `position` in the same action.

---

## Code Examples

### Migration: New Table + Column

```sql
-- Phase 2 migration
alter table public.club_pipeline_stages
  add column if not exists is_released boolean not null default false;

create table public.club_application_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.user_applications (id) on delete cascade,
  from_stage_id uuid references public.club_pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.club_pipeline_stages (id) on delete set null,
  changed_by_user_id uuid not null references auth.users (id) on delete cascade,
  changed_at timestamptz not null default timezone('utc', now()),
  notes text
  -- No updated_at: append-only
);

create index club_application_stage_transitions_application_idx
  on public.club_application_stage_transitions (application_id, changed_at desc);

create index club_application_stage_transitions_to_stage_idx
  on public.club_application_stage_transitions (to_stage_id);
```

### Server Action: Update Stage Release Toggle

```typescript
export async function updateStageRelease(
  slug: string,
  stageId: string,
  formData: FormData,
) {
  const { supabase, club } = await requirePortalAdmin(slug);
  const isReleased = formData.get("is_released") === "true";

  const { error } = await supabase
    .from("club_pipeline_stages")
    .update({ is_released: isReleased })
    .eq("id", stageId)
    .eq("club_id", club.id);

  if (error) {
    redirect(`/portal/${slug}/decisions?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/decisions`);
  redirect(`/portal/${slug}/decisions?message=Stage+visibility+updated.`);
}
```

### Stage Transition Insert (in `updateApplicantStatus`)

```typescript
// BEFORE the update:
const { data: currentApp } = await supabase
  .from("user_applications")
  .select("stage_id")
  .eq("id", applicationId)
  .eq("club_id", club.id)
  .maybeSingle();

const previousStageId = currentApp?.stage_id ?? null;

// ... existing validate + update logic unchanged ...

// AFTER successful update, if stage changed:
if (stageId !== previousStageId) {
  await supabase.from("club_application_stage_transitions").insert({
    application_id: applicationId,
    from_stage_id: previousStageId,
    to_stage_id: stageId,
    changed_by_user_id: user.id,
    notes: null, // Phase 2: no transition-specific note collection
  });
}
```

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `RESEND_API_KEY` | NOTF-01 email | Confirmed present in `.env.local` | No action needed |
| `NEXT_PUBLIC_APP_URL` | Email CTA link | Confirmed present in `.env.local` | Already used in `email.ts` |
| Supabase (local/remote) | All DB operations | Established in Phase 1 | No change needed |

No missing dependencies. No blockers.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Student sees raw `status` bucket | Student sees released stage label from `club_pipeline_stages.is_released` | Phase 2 adds this column + logic |
| `updateApplicantStatus` has no audit trail | Each stage change writes to `club_application_stage_transitions` | Append-only via RLS |
| No submission email | `sendApplicationConfirmation` fires from `submitNativeApplication` | New function in `src/lib/email.ts` |

---

## Open Questions

1. **Transition notes UX**
   - What we know: D-02 says `notes` is optional on the transition row. The form already has an "Internal notes" textarea for applicant-level notes.
   - What's unclear: Should the officer be able to add a reason for the stage move? If yes, a separate field is needed in the pipeline control form.
   - Recommendation: Omit transition notes collection in Phase 2 (insert `notes: null` always). Add as a v2 enhancement if officers request it. This keeps the form unchanged.

2. **Student-facing tracker display location**
   - What we know: Both `src/app/dashboard/applications/page.tsx` (kanban) and `src/app/dashboard/applications/[id]/page.tsx` (detail) need updating per CONTEXT.md.
   - What's unclear: Does the kanban card need to show the released stage label, or just the detail page? The kanban currently shows the `status` column heading, not a stage name.
   - Recommendation: Show released stage label in the detail page pipeline section (replaces the static status flow); on the kanban card, add the stage label as a secondary badge if a released stage exists. Both locations should be updated per CONTEXT.md canonical refs.

---

## Project Constraints (from CLAUDE.md)

The `CLAUDE.md` file references `AGENTS.md` which states:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

**Investigation:** `node_modules/next/dist/docs/` does not exist in this project. Next.js 16.2.1 was released after training data cutoff. The following known-current patterns have been confirmed by reading existing working code in the codebase rather than relying on training assumptions:

- `params` and `searchParams` in page components are `Promise<{...}>` — must be awaited (confirmed in all page files)
- Server Actions use `"use server"` directive at the top of the file, NOT inline
- `redirect()` and `revalidatePath()` import from `"next/cache"` and `"next/navigation"` respectively (confirmed in all action files)
- `formAction={action.bind(null, ...args)}` pattern for passing args to server actions (confirmed in portal pages)

**Planner directive:** Do not use patterns from Next.js 13-15. Verify any Next.js API against existing working files in `src/app/` before using it.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `src/app/clubs/[slug]/apply/actions.ts` — `submitNativeApplication` — exact insertion point for email trigger
- Direct codebase read: `src/app/portal/[slug]/applicants/[applicationId]/actions.ts` — `updateApplicantStatus` — exact insertion point for audit log
- Direct codebase read: `src/lib/email.ts` — `sendDeadlineReminder`, `buildEmailHtml` — email template to replicate
- Direct codebase read: `supabase/migrations/20260331223000_recruiter_decision_workspace.sql` — confirmed `club_pipeline_stages` schema, existing RLS pattern
- Direct codebase read: `src/lib/recruiter-decisions.ts` — `colorTokenClasses` — badge utility for stage history display

### Secondary (MEDIUM confidence)
- `package.json` — confirmed `resend ^6.9.4` installed, Next.js 16.2.1, React 19.2.4
- `.env.local` (key names only, not values) — confirmed `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL` are set

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in `package.json`, env vars confirmed present
- Architecture: HIGH — all patterns read directly from working production code in the repo
- Pitfalls: HIGH — derived from examining actual code paths and schema constraints
- Student-stage logic: MEDIUM — correct in design but the exact Supabase join syntax for `club_pipeline_stages!to_stage_id` foreign key alias may need verification against Supabase JS client docs at implementation time

**Research date:** 2026-04-10
**Valid until:** 60 days (stable stack, no fast-moving dependencies)
