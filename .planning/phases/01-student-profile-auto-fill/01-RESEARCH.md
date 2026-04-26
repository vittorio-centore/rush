# Phase 1: Student Profile & Auto-Fill - Research

**Researched:** 2026-04-08
**Domain:** Supabase Storage upload, profile schema extension, Server Component pre-seeding, answer snapshotting
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Student can add bio, phone number, and LinkedIn URL to their profile | Profile editor (`src/app/dashboard/profile/`) already exists with full_name/year/major fields. Needs three new columns in `profiles` table + form fields added. |
| PROF-02 | Student can upload a resume PDF stored in Supabase Storage | No Supabase Storage bucket exists in migrations yet. Requires creating a `resumes` bucket, RLS policy, and a Client Component file upload interaction (upload direct-to-Storage from browser). Resume URL stored as a new column on `profiles`. |
| PROF-03 | Profile fields (name, major, year, bio) auto-populate into any club application at open time | The apply page (`src/app/clubs/[slug]/apply/page.tsx`) loads `initialAnswers` from prior submissions. The pattern for pre-seeding answers already exists — it just needs to be extended to seed from profile when no prior answer exists for a profile-mapped question. |
| PROF-04 | Auto-filled answers snapshot into `club_application_submission_answers` at submit — profile edits do not retroactively change submitted applications | The submission action (`src/app/clubs/[slug]/apply/actions.ts`) already deletes and re-inserts all answer rows at submit time. Adding a `source_key` column to `club_application_submission_answers` is sufficient to track auto-fill provenance without changing the snapshot semantics. |
</phase_requirements>

---

## Summary

Phase 1 is additive schema work plus small incremental changes to two existing files. The infrastructure is already in place: the profile editor, the application form, and the submission action all exist. The core work is (1) three new nullable columns on `profiles`, (2) a Supabase Storage bucket for resume PDFs, (3) a `source_key` column on `club_application_submission_answers` to track auto-fill provenance, (4) extending the apply page to seed answers from profile when no prior submission exists, and (5) adding bio/phone/LinkedIn fields to the profile editor.

The most architecturally sensitive task is PROF-03: the auto-population. The correct pattern is Server Component pre-seeding — the `page.tsx` fetches the user's profile and merges profile values into `initialAnswers` for any question whose `source_key` maps to a profile field, before passing them to the `ApplicationForm` Client Component. This is the exact same pattern the page already uses for loading prior answers. Auto-filled values are rendered as editable (not locked) fields — the student can override them. At submit time the Server Action writes them as regular rows; no special handling at submit is required.

The `source_key` column on `club_application_submission_answers` is optional for launch correctness but required to satisfy PROF-04's intent — the plan should include it so reviewers can distinguish auto-filled answers from manually typed ones, and so the snapshot isolation guarantee is explicit in the schema rather than assumed.

**Primary recommendation:** Two-migration approach — migration A adds columns to `profiles`; migration B adds `source_key` to `club_application_submission_answers` and updates the `club_application_form_questions` type CHECK to include `'profile_field'`. Keep the Storage bucket creation in migration A. No new npm packages are needed for any of the four requirements.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.100.1 | Storage bucket upload, profile updates | Already in codebase; browser client already instantiated |
| `@supabase/ssr` | ^0.9.0 | Server-side profile fetch for pre-seeding | Already in codebase; server client pattern established |
| Next.js App Router | 16.2.1 | Server Component page, Server Action mutations | All existing mutations follow this pattern |
| Tailwind CSS | ^4 | UI form fields | All existing profile editor fields use Tailwind |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `<input type="file">` | — | Resume upload UI | No third-party file picker needed; simple PDF-only input is sufficient |
| Supabase Storage JS SDK | (part of supabase-js) | `supabase.storage.from('resumes').upload(...)` | Called from a Client Component after user selects file |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Storage upload in Client Component | Server Action with `multipart/form-data` | Client upload is faster (no double-copy through server), simpler code; preferred for binary blobs |
| `profile_field` question type enum | Heuristic label matching | Explicit enum is unambiguous and survives label renames; always prefer |

### Installation
No new packages required. All libraries are already present.

---

## Architecture Patterns

### Recommended Project Structure

No new directories are needed. All changes fit into existing files and one new migration file.

```
supabase/migrations/
└── 20260409XXXXXX_student_profile_autofill.sql   # new

src/app/dashboard/profile/
├── page.tsx          # add bio, phone, linkedin fields + resume upload UI
└── actions.ts        # add bio, phone, linkedin to updateProfile + uploadResume action

src/app/clubs/[slug]/apply/
└── page.tsx          # merge profile values into initialAnswers for profile-mapped questions
```

### Pattern 1: Profile Column Extension

Add nullable columns to `profiles` without breaking existing RLS or the existing `updateProfile` action. The action already handles nullable values correctly (`year: year || null`).

**Migration:**
```sql
alter table public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists linkedin_url text,
  add column if not exists resume_url text;
```

No CHECK constraints needed on these — they are all nullable free-text. `linkedin_url` validation belongs in the Server Action, not the DB constraint (validates HTTPS prefix).

### Pattern 2: Supabase Storage Bucket for Resumes

Supabase Storage buckets created via migration (SQL) are durable and version-controlled. The bucket must be private (not public) — resume access is gated to the owning student and club admins who have an application from that student.

**Migration:**
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,  -- 10 MB
  array['application/pdf']
)
on conflict (id) do nothing;
```

**Storage RLS policy** — student can upload/read their own resume; no anonymous access:
```sql
create policy "Students can upload their own resume"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can read their own resume"
on storage.objects for select
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Students can replace their own resume"
on storage.objects for update
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

**Path convention:** `resumes/{user_id}/resume.pdf` — one resume per student, overwrite on re-upload.

**Client Component upload pattern:**
```typescript
// src/app/dashboard/profile/ResumeUpload.tsx  ("use client")
const supabase = createClient();  // browser client
const { data, error } = await supabase.storage
  .from('resumes')
  .upload(`${userId}/resume.pdf`, file, { upsert: true, contentType: 'application/pdf' });

// After upload, get the public/signed URL and save to profiles.resume_url via Server Action
const { data: { publicUrl } } = supabase.storage
  .from('resumes')
  .getPublicUrl(`${userId}/resume.pdf`);
// NOTE: bucket is private — use createSignedUrl for display, not publicUrl
```

Because the bucket is private, generate a signed URL when the student wants to view/download their resume. Store only the storage path in `profiles.resume_url`, not the signed URL (signed URLs expire).

**Corrected pattern — store path, not signed URL:**
```typescript
// profiles.resume_url stores the storage path: "{user_id}/resume.pdf"
// Display in UI: supabase.storage.from('resumes').createSignedUrl(path, 3600)
```

### Pattern 3: Auto-Population at Form Open (PROF-03)

The apply page (`src/app/clubs/[slug]/apply/page.tsx`) already builds `initialAnswers` from prior submission rows. Extend this to merge in profile values for any question that maps to a profile field.

The mechanism: add a `source_key` column to `club_application_form_questions` so a question can declare `source_key = 'full_name'` (or `major`, `year`, `bio`). The Server Component reads the student's profile and merges profile values into `initialAnswers` for questions with a matching `source_key`, but only if there is no prior submitted answer for that question.

```typescript
// In page.tsx (Server Component), after loading profile and existingAnswersData:
const profileValues: Record<string, string> = {
  full_name: profile?.full_name ?? '',
  major: profile?.major ?? '',
  year: profile?.year ?? '',
  bio: profile?.bio ?? '',
};

const initialAnswers: AnswerMap = Object.fromEntries(
  (existingAnswersData ?? []).map((a) => [
    a.question_id,
    Array.isArray(a.answer_values) && a.answer_values.length > 0
      ? a.answer_values
      : a.answer_text ?? '',
  ])
);

// Merge profile values for unset profile-mapped questions
for (const question of questions) {
  if (
    question.source_key &&
    profileValues[question.source_key] !== undefined &&
    initialAnswers[question.id] === undefined
  ) {
    initialAnswers[question.id] = profileValues[question.source_key];
  }
}
```

This keeps pre-seeding in the Server Component. No client-side logic required.

### Pattern 4: Snapshot Isolation (PROF-04)

The existing `submitNativeApplication` action already snapshots: it deletes and re-inserts all `club_application_submission_answers` rows at every submit. This means the submitted answers are always a point-in-time copy — they do not reference live profile data.

To satisfy PROF-04 explicitly, add a `source_key` column to `club_application_submission_answers`. At submit time, populate `source_key` from the question's `source_key` if the question has one:

```sql
alter table public.club_application_submission_answers
  add column if not exists source_key text;
```

In the action, when building `answerRows`, include the `source_key` from the question:
```typescript
const answerRows = questions
  .filter((q) => isQuestionVisible(q, answers))
  .map((q) => ({
    submission_id: submission.id,
    question_id: q.id,
    answer_text: Array.isArray(answers[q.id]) ? null : answers[q.id] as string,
    answer_values: Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [],
    source_key: q.source_key ?? null,
  }));
```

### Anti-Patterns to Avoid

- **Storing signed URLs in `profiles.resume_url`**: Signed URLs expire (typically 1 hour). Store the storage path instead. Generate signed URLs at display time.
- **Locking auto-filled fields in the UI**: Auto-filled values should be editable. The student must be able to override. Do not render them as `readonly` or `disabled`.
- **Joining `profiles` at submission read time to "reconstruct" submitted answers**: The submitted answer rows are the source of truth. Never join live profile data when displaying submitted answers to club reviewers.
- **Adding `'profile_field'` as a question `type` vs. a `source_key` column**: Using a new `type` value would require changing the type CHECK constraint (dropping and re-adding it) AND changing the `FormQuestion` TypeScript type and all switch statements in the form renderer. Using a separate `source_key` column keeps the type enum stable and is purely additive.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to cloud storage | Custom S3/GCS integration | Supabase Storage (already authenticated, already in stack) | Zero new infrastructure; bucket-level RLS integrates with existing auth |
| PDF validation | Manual MIME type check | Supabase Storage `allowed_mime_types` bucket config | Browser MIME spoofing is possible; Storage enforces server-side |
| Profile field mapping to questions | Heuristic label matching ("does label contain 'Name'?") | Explicit `source_key` column on `club_application_form_questions` | Labels change; explicit mapping never breaks silently |
| Resume viewer in-app | Custom PDF renderer (pdf.js) | Signed URL link that opens in browser tab | Out of scope; browser native PDF rendering is sufficient |

**Key insight:** All four requirements are additive changes to existing infrastructure. No new patterns are required — the profile editor, the apply page, and the submission action are all already the right shape.

---

## Common Pitfalls

### Pitfall 1: Storing signed URLs as `resume_url`
**What goes wrong:** The stored URL becomes a 403 after 1 hour. The student's profile page shows a broken link.
**Why it happens:** `getPublicUrl()` returns a URL-style string that looks valid at first. For private buckets it requires signing.
**How to avoid:** Store only the storage path (`{user_id}/resume.pdf`) in `profiles.resume_url`. Call `createSignedUrl` with a short TTL at display time.
**Warning signs:** Resume link works immediately after upload, breaks when revisited.

### Pitfall 2: CHECK constraint migration on `club_application_form_questions.type`
**What goes wrong:** Attempting to add `'profile_field'` to the `type` column enum requires `DROP CONSTRAINT` + `ADD CONSTRAINT`. This is a table-level lock on Postgres 15 — blocking but non-destructive. On a live database with active reads/writes it can cause brief downtime.
**Why it happens:** Postgres CHECK constraints cannot be altered in-place; they must be dropped and recreated.
**How to avoid:** Do NOT add `'profile_field'` as a question `type`. Use a separate `source_key text` column instead. This is purely additive (no lock required) and avoids modifying the CHECK constraint entirely.
**Warning signs:** If a plan task says "alter the type CHECK constraint", it is using the wrong approach.

### Pitfall 3: Race condition on resume upload — stale `resume_url`
**What goes wrong:** Student uploads a new resume. The Client Component uploads to Storage, then calls a Server Action to save the path to `profiles.resume_url`. If the Server Action fails silently, the Storage object and the profile row are out of sync.
**Why it happens:** Two-step operation (upload + profile update) with no transaction.
**How to avoid:** The Server Action that saves the path should also verify the object exists by checking that `upload()` returned no error before calling the profile update. On the UI, always show the current `resume_url` from the server-rendered page, not from client state.

### Pitfall 4: Auto-filling overrides a previously saved draft answer
**What goes wrong:** Student partially filled the form, saved (submitted), updated their profile, then re-opened the form. Auto-fill overwrites their previous draft.
**Why it happens:** Naive merge puts profile value into `initialAnswers` regardless of whether a prior answer exists.
**How to avoid:** Only auto-fill for a question if `initialAnswers[question.id] === undefined` — i.e., no prior answer row exists for that question. If a prior answer exists, always prefer it. The code pattern in Pattern 3 above enforces this correctly.

### Pitfall 5: `source_key` on questions not populated for existing form questions
**What goes wrong:** After the migration adds `source_key` to `club_application_form_questions`, all existing questions have `source_key = null`. Auto-fill works for new forms but not for forms clubs have already created with name/major/year labels.
**Why it happens:** The migration only adds the column; it does not backfill existing questions.
**How to avoid:** The portal form editor will need a UI affordance for club admins to mark a question as mapping to a profile field. Auto-fill only works for questions explicitly configured by the club admin. This is a design decision to document clearly — do not attempt to auto-detect by label matching.

---

## Schema Delta (Authoritative)

The full schema delta for this phase — what the migration(s) must contain:

### `profiles` table (additive columns)
```sql
alter table public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists linkedin_url text,
  add column if not exists resume_url text;
-- resume_url stores the Storage path, e.g. "{user_id}/resume.pdf"
```

### `club_application_form_questions` table (additive column)
```sql
alter table public.club_application_form_questions
  add column if not exists source_key text;
-- Valid values: 'full_name', 'major', 'year', 'bio'
-- Null means no auto-fill for this question
-- NO changes to the type CHECK constraint
```

### `club_application_submission_answers` table (additive column)
```sql
alter table public.club_application_submission_answers
  add column if not exists source_key text;
-- Populated at submit time from the question's source_key (or null)
-- Records the auto-fill provenance; does not affect query logic
```

### Storage (new bucket)
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
```

Plus three storage RLS policies (see Pattern 2 above).

### Existing columns already present (no action needed)
- `profiles.full_name` — present since initial migration
- `profiles.major` — present since initial migration
- `profiles.year` — present since initial migration
- `profiles.email` — present since initial migration

---

## Existing Code: What Already Works

| File | What It Does | Change Required |
|------|-------------|-----------------|
| `src/app/dashboard/profile/page.tsx` | Renders full_name, year, major, interests form fields | Add bio (textarea), phone (text), linkedin_url (text), resume upload section |
| `src/app/dashboard/profile/actions.ts` | `updateProfile` saves full_name, year, major, interests | Add bio, phone, linkedin_url fields; add `uploadResume` action (or separate Server Action) |
| `src/app/clubs/[slug]/apply/page.tsx` | Fetches questions, loads prior answers as `initialAnswers` | Fetch profile, merge profile values into `initialAnswers` for questions with matching `source_key` |
| `src/app/clubs/[slug]/apply/actions.ts` | `submitNativeApplication` — snapshots all answers into submission_answers | Add `source_key` to each answer row from question's `source_key`; no other changes needed |
| `src/lib/application-forms.ts` | `FormQuestion` type, `isQuestionVisible`, `getTextAnswer`, `getArrayAnswer` | Add `source_key: string \| null` to `FormQuestion` type |

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 1 |
|--------------|------------------|-------------------|
| Profile as display-only (name, year, major) | Profile as auto-fill data source | Extend profile editor; add source_key mapping |
| Answer rows point to live question definitions | Answer rows are point-in-time snapshots | `source_key` column makes snapshot provenance explicit |
| No file storage | Supabase Storage bucket needed | Create `resumes` bucket in migration |

---

## Open Questions

1. **Should club admins see the student's resume in the applicant review view?**
   - What we know: `profiles` is readable by club admins via existing RLS policy (for their applicants). Storage objects require explicit RLS.
   - What's unclear: Should club admin storage RLS be added in Phase 1, or is resume-for-reviewers a Phase 2 concern?
   - Recommendation: Add a storage SELECT policy in Phase 1 that allows club admins to read resumes for students who have applied to their club. This keeps storage RLS consistent with profile RLS.

2. **Should `source_key` values on `club_application_form_questions` be constrained by a CHECK?**
   - What we know: Valid values are `'full_name'`, `'major'`, `'year'`, `'bio'`.
   - What's unclear: Is it worth a CHECK constraint vs. application-level validation?
   - Recommendation: Add a CHECK constraint in the migration. It's cheap, and it prevents typos in future portal editor work.

3. **Phone number format validation**
   - What we know: Phone is a new profile field (PROF-01). No format specified.
   - What's unclear: Should we validate format (E.164, US-only, any format)?
   - Recommendation: Accept any non-empty string; do not validate format in v1. Clubs see the raw value in the applicant view.

---

## Environment Availability

Step 2.6: No external dependencies introduced by Phase 1 beyond Supabase Storage, which is part of the existing Supabase project. No new CLI tools or services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (hosted) | Storage bucket, profile queries | Assumed available | — | — |
| Node.js 20.x | Next.js build | Available | 20.20.1 | — |
| pnpm | Package management | Available | 10.32.1 | — |

---

## Project Constraints (from CLAUDE.md)

The project `CLAUDE.md` delegates entirely to `AGENTS.md`, which contains one directive:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Implication for planning:** Any plan task that writes Next.js code (pages, Server Actions, Server Components) must include a step to verify the relevant API in `node_modules/next/dist/docs/` before implementation. This applies to:
- `searchParams` (already async in this codebase — confirmed in existing profile/page.tsx)
- `redirect()` behavior from Server Actions
- `revalidatePath()` usage
- Any new `use client` / `use server` boundary conventions

---

## Sources

### Primary (HIGH confidence — direct codebase read)
- `supabase/migrations/20260327180000_initial_schema.sql` — `profiles` table schema; confirmed columns present/absent
- `supabase/migrations/20260331110000_beta_forms_reviews_imports.sql` — `club_application_form_questions` type CHECK constraint (exact SQL); `club_application_submission_answers` schema
- `src/app/dashboard/profile/page.tsx` — existing profile editor fields and query (`select "full_name, year, major, interests"` — bio/phone/linkedin not selected, confirming they don't exist yet)
- `src/app/dashboard/profile/actions.ts` — existing `updateProfile` action; exact mutation pattern
- `src/app/clubs/[slug]/apply/page.tsx` — existing `initialAnswers` construction pattern; exact location for profile merge
- `src/app/clubs/[slug]/apply/actions.ts` — existing snapshot pattern; exact location for `source_key` population
- `src/lib/application-forms.ts` — `FormQuestion` type definition; confirmed no `source_key` field exists yet
- `.planning/config.json` — `nyquist_validation: false` confirmed (Validation Architecture section omitted per spec)

### Secondary (MEDIUM confidence — prior ecosystem research)
- `.planning/research/SUMMARY.md` — architecture recommendations for this phase; snapshot-on-submit pattern rationale; `source_key` column recommendation

---

## Metadata

**Confidence breakdown:**
- Schema delta: HIGH — read every relevant migration directly
- Architecture patterns: HIGH — derived from reading the actual apply page and submission action
- Pitfalls: HIGH — pitfall 2 (CHECK constraint) verified from migration SQL; others derived from direct code analysis
- Storage RLS: MEDIUM — standard Supabase Storage RLS pattern; bucket does not yet exist so untestable

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack, no fast-moving dependencies)
