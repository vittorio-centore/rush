# Architecture Patterns

**Project:** Rush — Campus Club Platform
**Dimension:** New milestone features (portal editor, pipeline, admin onboarding, auto-fill)
**Researched:** 2026-04-08
**Confidence:** HIGH — based on full schema read (all 9 migrations), full codebase read

---

## What Already Exists (Anchor Points)

The schema and application layer are mature. These structures are stable and the new features must extend them, not replace them:

- `clubs` — canonical club record; `slug` is the routing key
- `user_applications` — central applicant record; already carries `status` (pipeline bucket), `decision_status`, `stage_id` (FK to `club_pipeline_stages`), `decision_label_id`
- `club_pipeline_stages` — per-club named stages with `status_bucket` enum and `position`; `stage_id` on `user_applications` already links here
- `club_application_forms` / sections / questions / options — full form builder exists
- `club_application_submissions` / answers — submitted answers exist
- `profiles` — `full_name`, `major`, `year`, `interests` present; no `bio`, `phone`, `linkedin`, or resume fields yet
- `club_admin_memberships` — `role in ('admin', 'reviewer')`; no platform-level admin role yet
- `getPortalContext(slug)` in `src/lib/portal.ts` — single auth+authorization entry point for all portal routes

---

## Component Boundaries

### 1. Portal Theme Engine

**What it does:** Stores per-club visual configuration (colors, hero image, layout variant) and renders it on the public club page at `src/app/clubs/[slug]/page.tsx`.

**Boundary:**
- Write path: `src/app/portal/[slug]/design/actions.ts` (new Server Action file)
- Read path: `src/app/clubs/[slug]/page.tsx` (Server Component, already exists — add theme read)
- Storage: `club_portal_themes` table (one row per club, see schema sketch below)
- CSS delivery: Inline CSS variables injected into the page `<head>` at SSR time — no runtime JS required, no separate CSS file per club

**Communicates with:**
- `clubs` table (1:1 relationship)
- `src/lib/portal.ts` for write authorization
- Public club page layout for read rendering

**Does NOT interact with:** application pipeline, student profiles, admin workflow

---

### 2. Application Pipeline (Stage Transitions + Audit Trail)

**What it does:** Tracks applicant movement through club-defined stages, records who moved them and when, exposes history to both student and club.

**Boundary:**
- Write path: existing `src/app/portal/[slug]/applicants/[applicationId]/actions.ts` — extend with `moveToStage(applicationId, stageId)` action
- Read path: portal applicant detail page (existing) + student dashboard application tracker (existing `src/app/dashboard/page.tsx`)
- Storage: `application_stage_transitions` table (append-only log, see schema sketch)
- Stage definitions: already in `club_pipeline_stages` — no new table needed for stage config

**Communicates with:**
- `user_applications.stage_id` — current stage pointer (already exists, just needs to be kept updated)
- `application_stage_transitions` — new log table for history
- `src/lib/email.ts` — triggered on `decision` bucket transition to send decision notification emails
- Student dashboard for status visibility

**Does NOT interact with:** portal theme, admin onboarding

---

### 3. Student Profile Auto-Fill

**What it does:** Shared profile fields (`full_name`, `major`, `year`, `bio`) pre-populate the native application form; club-specific questions stack on top.

**Boundary:**
- Write path: `src/app/dashboard/profile/actions.ts` (new or extend existing profile edit)
- Read path: `src/app/clubs/[slug]/apply/ApplicationForm.tsx` — Server Component reads `profiles` row and seeds form initial values
- Storage: extend `profiles` table with `bio text`, `phone text`, `linkedin_url text` columns (optional fields)
- No new table — `profiles` already has `full_name`, `major`, `year`

**The auto-fill contract:** Profile fields map to "system question types" on the form. A question with `type = 'profile_field'` and `source_key = 'major'` is pre-filled from `profiles.major` at render time. Clubs cannot delete these question types from a published form — they can only toggle visibility.

**Communicates with:**
- `profiles` table (read at apply page load)
- `club_application_form_questions` — needs new `type` enum value `'profile_field'` and new column `source_key text` for the field name
- `club_application_submission_answers` — profile-field answers still stored per-submission (snapshot at apply time, so future profile edits do not retroactively change past submissions)

**Does NOT interact with:** pipeline, portal theme, admin workflow

---

### 4. Admin Onboarding Workflow

**What it does:** Platform-level admin (not club admin) reviews and approves clubs before they appear on the public directory. Extends the existing `club_claims` flow.

**Boundary:**
- Write path: `src/app/admin/clubs/[id]/actions.ts` (new route subtree)
- Read path: `src/app/admin/clubs/page.tsx` (new) — lists pending clubs
- Authorization guard: new `requirePlatformAdmin()` helper in `src/lib/admin.ts` — checks a `platform_role` column on `profiles` or a separate `platform_admins` table (see schema sketch)
- Status gating: `clubs.verified` boolean already exists; `clubs.recruiting_status` gates discoverability; add `clubs.onboarding_status` to track the approval state distinctly from recruiting

**Communicates with:**
- `clubs` table (status updates)
- `club_claims` table (existing claim approval machinery — reuse `approve_claim_fn` migration)
- New `platform_admins` table (see schema)
- Resend email (`src/lib/email.ts`) — notify club officer when approved/rejected

**Does NOT interact with:** pipeline internals, student profiles, portal themes (those are post-approval concerns)

---

## Data Flow

### Portal Theme Write/Read

```
Club officer in portal editor
  → POST to Server Action (portal/[slug]/design/actions.ts)
    → requirePortalAdmin(slug) — existing guard
      → upsert club_portal_themes WHERE club_id = $1
        → revalidatePath('/clubs/[slug]')

Student/visitor loading club page
  → Server Component clubs/[slug]/page.tsx
    → SELECT theme FROM club_portal_themes WHERE club_id = $1
      → inject CSS variables into <style> tag in <head>
        → all theme tokens available via CSS var(--club-primary), etc.
```

**No client-side theming JS.** The visual editor itself runs client-side (live preview), but the rendered public page is pure SSR CSS variables — zero JavaScript overhead for visitors.

---

### Stage Transition Write/Read

```
Club officer clicks "Move to Interview"
  → Server Action moveToStage(applicationId, targetStageId)
    → requirePortalAdmin(slug)
      → BEGIN transaction
          UPDATE user_applications SET stage_id = $targetStageId
          INSERT INTO application_stage_transitions (application_id, from_stage_id, to_stage_id, moved_by, moved_at)
        → COMMIT
      → IF target stage is in 'decision' bucket → trigger decision email

Student views application tracker
  → dashboard page.tsx queries user_applications JOIN club_pipeline_stages
    → returns current stage label and status_bucket
    → stage history available via application_stage_transitions for detail view
```

**Note on `from_stage_id`:** On the very first transition (from "no stage"), `from_stage_id` is null. This is intentional — null means "entered pipeline from interested state."

---

### Auto-Fill Write/Read

```
Student saves profile
  → Server Action in dashboard/profile/actions.ts
    → UPDATE profiles SET full_name, major, year, bio, ... WHERE id = auth.uid()

Student navigates to clubs/[slug]/apply
  → Server Component reads profiles WHERE id = auth.uid()
    → reads club_application_form_questions WHERE type = 'profile_field'
      → seeds React form initial values from profile fields
        → student sees pre-filled fields, can edit before submit
          → on submit, answers stored in club_application_submission_answers (snapshot)
```

---

### Admin Onboarding Write/Read

```
Club officer submits claim (existing flow)
  → club_claims row created (status = 'pending')

Platform admin loads /admin/clubs
  → requirePlatformAdmin() — checks platform_admins table
    → lists clubs WHERE onboarding_status = 'pending_approval'

Platform admin approves
  → Server Action in admin/clubs/[id]/actions.ts
    → UPDATE clubs SET onboarding_status = 'approved', verified = true
    → UPDATE club_claims SET status = 'approved', reviewed_by, reviewed_at
    → send approval email via src/lib/email.ts
    → revalidatePath('/clubs') — club now visible in directory
```

---

## Schema Sketches for New Tables

### `club_portal_themes` (portal editor)

```sql
create table public.club_portal_themes (
  club_id            uuid primary key references public.clubs (id) on delete cascade,
  -- Layout
  layout_variant     text not null default 'standard'
                     check (layout_variant in ('standard', 'hero', 'minimal')),
  -- Color palette (CSS custom property values)
  color_primary      text not null default '#3b82f6',   -- hex or tailwind token
  color_secondary    text not null default '#f1f5f9',
  color_accent       text not null default '#0ea5e9',
  color_text         text not null default '#0f172a',
  color_bg           text not null default '#ffffff',
  -- Hero section
  hero_image_url     text,
  hero_headline      text,
  hero_subheadline   text,
  -- Brand
  logo_url           text,
  -- Raw overrides (escape hatch for future flexibility)
  custom_css_vars    jsonb not null default '{}'::jsonb,
  -- Lifecycle
  published          boolean not null default false,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);
```

**Design rationale:** Structured columns (not a single `config jsonb`) because:
1. Each column is individually indexable and patchable without deserializing the full blob
2. Tailwind CSS v4 (already in use) works best with CSS custom properties injected at the page level — named columns map directly to `--club-*` variable names
3. `custom_css_vars jsonb` as an escape hatch handles future fields without a migration
4. No versioning for v1 — clubs can freely overwrite; version history adds complexity not needed at launch

**No block-based layout storage.** The portal editor is a theme picker + content editor, not a drag-and-drop block composer. Storing layout as structured columns is sufficient and far simpler than a block tree JSON. If block-based layouts are needed later, add a `layout_blocks jsonb` column without restructuring the table.

---

### `application_stage_transitions` (pipeline audit trail)

```sql
create table public.application_stage_transitions (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.user_applications (id) on delete cascade,
  club_id          uuid not null references public.clubs (id) on delete cascade,
  from_stage_id    uuid references public.club_pipeline_stages (id) on delete set null,
  to_stage_id      uuid not null references public.club_pipeline_stages (id) on delete restrict,
  moved_by         uuid not null references auth.users (id) on delete set null,
  note             text,
  moved_at         timestamptz not null default timezone('utc', now()),
  -- Derived snapshot columns (denormalized for history integrity)
  from_stage_key   text,
  to_stage_key     text
);

create index application_stage_transitions_application_idx
  on public.application_stage_transitions (application_id, moved_at desc);
create index application_stage_transitions_club_moved_at_idx
  on public.application_stage_transitions (club_id, moved_at desc);
```

**Design rationale:**
- Append-only log — never update, never delete (except cascade on application delete)
- `from_stage_key` / `to_stage_key` are denormalized string snapshots so history remains readable even if stage labels are renamed
- `on delete restrict` on `to_stage_id` prevents deleting a stage that has transitions pointing to it — protects audit integrity
- `from_stage_id` nullable — entry from interested state has no prior stage
- `club_id` denormalized onto transitions for efficient per-club audit queries without joining through `user_applications`

**Do NOT add `status` or `decision_status` snapshots** — `user_applications.status` is always current and `club_pipeline_stages.status_bucket` gives the bucket. The transition log records movement, not state duplication.

---

### `profiles` additions (auto-fill)

```sql
alter table public.profiles
  add column bio          text,
  add column phone        text,
  add column linkedin_url text,
  add column resume_url   text;  -- Supabase Storage URL, optional
```

**No new table.** Profiles are 1:1 with auth users and already exist. Adding nullable columns is the right approach — no migration complexity, no join required at form render.

---

### `club_application_form_questions` additions (profile-field type)

```sql
alter table public.club_application_form_questions
  drop constraint club_application_form_questions_type_check,
  add constraint club_application_form_questions_type_check
    check (type in ('short_text', 'long_text', 'single_select', 'multi_select', 'profile_field')),
  add column source_key text;  -- 'full_name' | 'major' | 'year' | 'bio' | 'phone' | 'linkedin_url'

-- Enforce: profile_field questions must have source_key
alter table public.club_application_form_questions
  add constraint profile_field_requires_source_key
    check (type != 'profile_field' or source_key is not null);
```

**Auto-fill contract:** `profile_field` questions are auto-inserted when a club enables native applications. They can be reordered but not deleted from a published form. The `ApplicationForm.tsx` component reads the student's `profiles` row and seeds `source_key` values as form defaults.

---

### `platform_admins` (admin onboarding)

```sql
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now())
);
```

**Why a separate table, not a column on `profiles`:**
- `profiles` is readable by club admins (existing RLS policy) — platform admin status must not leak through that policy
- A separate table with its own RLS (service_role only for insert/delete, owner-only for select) isolates the privilege cleanly
- Platform admin set is tiny; no join performance concern

**`clubs` additions for onboarding:**
```sql
alter table public.clubs
  add column onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'approved', 'rejected'));
```

The existing `verified` boolean maps to approved clubs visible in directory. `onboarding_status` tracks the admin workflow state independently — a club can be `approved` in onboarding and `verified = true` (fully live), or `approved` and `verified = false` (approved but officers haven't finished setup).

---

## Suggested Build Order (Phase Dependencies)

The four features have a clear dependency structure that should drive phase sequencing:

```
Phase 1: Profile + Auto-fill
  Depends on: nothing new — extends existing profiles table and form questions
  Unlocks: better application quality before pipeline work begins
  Risk: LOW — additive schema changes only

Phase 2: Pipeline Stage Transitions + Notifications
  Depends on: club_pipeline_stages (already exists), profiles for email addresses
  Unlocks: full ATS workflow; decision emails need this to know which stage triggers notification
  Risk: MEDIUM — requires careful transaction handling on stage moves; email trigger logic

Phase 3: Portal Theme Editor
  Depends on: nothing else in this milestone — fully independent
  Unlocks: launch readiness / club acquisition (visual identity matters for adoption)
  Risk: MEDIUM — client-side live preview editor is the most net-new UI work

Phase 4: Admin Onboarding Workflow
  Depends on: clubs table onboarding_status, platform_admins table
  Unlocks: controlled club launch — must be last since it gates all clubs going live
  Risk: LOW — mostly CRUD + email; authorization pattern mirrors existing portal guards
```

Phases 1 and 3 can be built in parallel. Phase 2 must precede go-live since decision notifications depend on stage transitions. Phase 4 can be developed in parallel with 1-3 but gates production launch.

---

## Patterns to Follow (Consistent With Existing Architecture)

### Server-side theme injection pattern

At `src/app/clubs/[slug]/page.tsx` (Server Component):

```typescript
// Read theme row
const { data: theme } = await supabase
  .from('club_portal_themes')
  .select('color_primary, color_secondary, ...')
  .eq('club_id', club.id)
  .maybeSingle()

// Inject as CSS variables
const cssVars = theme ? buildCssVars(theme) : defaultCssVars()

return (
  <>
    <style>{`:root { ${cssVars} }`}</style>
    <ClubPageLayout ... />
  </>
)
```

No runtime JS, no CSS-in-JS library needed. Tailwind v4 already supports CSS variables in `theme()` and arbitrary value syntax.

### Transactional stage move pattern (Server Action)

```typescript
// In portal/[slug]/applicants/[applicationId]/actions.ts
export async function moveApplicationToStage(
  applicationId: string,
  targetStageId: string
) {
  const { supabase, club } = await requirePortalAdmin(slug)

  // Single RPC to keep transition atomic
  await supabase.rpc('move_application_stage', {
    p_application_id: applicationId,
    p_target_stage_id: targetStageId,
    p_moved_by: user.id,
  })

  revalidatePath(`/portal/${slug}/applicants/${applicationId}`)
}
```

Implement `move_application_stage` as a Postgres function (security definer) that UPDATE + INSERT in one transaction — prevents partial writes where `user_applications` is updated but the audit row is not inserted.

### Authorization for admin routes

Mirror the existing `getPortalContext` pattern:

```typescript
// src/lib/admin.ts
export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/auth')

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (!adminRow) notFound()

  return { supabase, user: authData.user }
}
```

---

## Anti-Patterns to Avoid

### Storing layout as a block tree JSON blob

Block trees (Notion/Sanity-style `[{ type: 'hero', props: {...} }, ...]`) require a custom renderer, versioning logic, migration tooling, and drag-and-drop infrastructure. The requirement is a "Squarespace-style visual editor" for branding — not arbitrary content management. Structured columns + CSS variables deliver that with a fraction of the complexity.

If genuine block composition is needed later, it can be added as `layout_blocks jsonb` alongside the structured columns — the table design above explicitly reserves `custom_css_vars jsonb` as a forward-compatibility valve.

### Storing stage history in `user_applications` columns

Adding `previous_stage_id`, `stage_changed_at`, `interview_scheduled_at` as nullable columns to `user_applications` destroys queryability and creates schema drift as stages proliferate. A dedicated `application_stage_transitions` append-only log is the correct relational pattern — it supports full audit, timeline display, and per-stage duration analytics without table-wide column proliferation.

### Putting platform admin role in `profiles`

The `profiles` table has an RLS policy that allows club admins to read profiles of their applicants. Any `platform_role` column added to `profiles` would be readable by all club admins. A separate `platform_admins` table with restricted RLS (no authenticated-role select policy) ensures platform privilege never leaks into club-scoped queries.

### Profile auto-fill via client-side pre-fill only

Filling form fields from a client-side fetch introduces a flash (fields appear empty then fill in), requires an extra round-trip, and fails for users with slow connections. Seed the profile values in the Server Component that renders the application form — the fields arrive pre-filled in the initial HTML with no visible delay.

### Rebuilding `getPortalContext` for admin routes

The admin onboarding route subtree (`src/app/admin/`) should have its own `requirePlatformAdmin()` guard modeled after `getPortalContext`, not a modified version of `getPortalContext`. They serve different authorization domains — conflating them creates a single function that checks both club membership and platform admin status, which is harder to audit and test independently.

---

## RLS Policy Shapes for New Tables

| Table | Read | Write |
|-------|------|-------|
| `club_portal_themes` | anon + authenticated (published = true only for public read; full read for club admin) | club admin only |
| `application_stage_transitions` | club admin members (via club_id) + application owner (user_id on user_applications) | club admin only (or service_role for RPC) |
| `platform_admins` | owner only (user_id = auth.uid()) | service_role only |

---

## Scalability Notes

All new features operate within the existing per-club data isolation model (club_id on every row, RLS enforced at DB layer). No cross-club data access is introduced. The append-only transitions log will grow linearly with applicant volume but is indexed on `(application_id, moved_at desc)` and `(club_id, moved_at desc)` — both access patterns are covered.

Portal themes are a single row per club — no pagination, no aggregation. Theme reads are O(1) per page load.

The `profile_field` question type adds a single join at form render time (`profiles` WHERE `id = auth.uid()`) — negligible cost.

---

## Sources

- Full schema read: `supabase/migrations/` (all 9 files, 2026-04-07)
- Full codebase read: `src/lib/portal.ts`, `src/app/portal/[slug]/`, `src/app/clubs/[slug]/`
- Confidence: HIGH — all recommendations derived directly from existing code and schema, no external sources needed for architectural decisions that must fit this specific codebase
