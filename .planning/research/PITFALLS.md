# Domain Pitfalls

**Domain:** Campus club recruitment platform (Rush)
**Researched:** 2026-04-08
**Scope:** Visual portal editor, multi-stage pipeline, decision emails, admin onboarding

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or security incidents.

---

### Pitfall 1: XSS via User-Controlled CSS in the Portal Editor

**What goes wrong:** Clubs can customize colors, fonts, and layout. If any CSS value is stored and rendered as a raw `style` attribute or injected into a `<style>` block without sanitization, an attacker (or misconfigured club) can inject `expression()` (IE), `url("javascript:...")`, or break out of attribute context entirely. In a Next.js RSC context, `dangerouslySetInnerHTML` with a club-supplied CSS blob is a direct XSS vector.

**Why it happens:** The simplest implementation — store the CSS string, inject it into the page — skips sanitization because "it's just CSS, not HTML." But CSS has its own injection surface: `content` property, `@import`, custom property exfiltration through `var()` in attribute selectors, and font-face `src` URLs.

**Consequences:** Any student visiting a club's public page is exposed. Because the public club portal pages (`/clubs/[slug]`) are accessible to unauthenticated users, blast radius is the entire student body.

**Prevention:**
- Never store or render free-form CSS strings. Store only design tokens: a restricted set of named values (`primary_color: "#4f46e5"`, `hero_image_url: "..."`, `font_family: "inter"`).
- Render tokens server-side by mapping them to Tailwind CSS variables or inline style properties using an allowlist: `style={{ "--club-primary": sanitizedHexColor }}`. Never interpolate raw user input into `<style>` tags.
- For hex colors, validate with `/^#[0-9a-fA-F]{6}$/`. For URLs (hero images), validate as absolute HTTPS URLs pointing to an allowed CDN (Supabase Storage bucket) — reject all `data:` and `javascript:` URIs.
- If you must accept rich layout data (block positions, etc.), store it as a typed JSON schema (`BlockLayout[]`), validate each field on write via Zod in the Server Action, and render blocks by mapping over the schema server-side — never `eval` or `dangerouslySetInnerHTML` the schema.

**Warning signs:**
- Any `dangerouslySetInnerHTML` used to render club-supplied content.
- Any `<style>` tag populated from a database column.
- CSS stored as a raw string rather than as a JSON object of typed tokens.

**Phase:** Visual portal editor — address before the editor is exposed to any clubs.

---

### Pitfall 2: Hydration Mismatch from Editor State Rendered via RSC

**What goes wrong:** The portal editor has two distinct rendering contexts: the public club page (Server Component, pre-rendered for students) and the in-editor live preview (Client Component, hydrated in the browser for the admin). If the same layout/theme data is rendered by both RSC and client-side code, subtle differences — timezone formatting of dates, random IDs for drag-and-drop keys, or `Math.random()` in block key generation — cause React hydration errors that silently corrupt the rendered DOM or throw during rehydration in production.

**Why it happens:** Editors almost always use `useId()`, `uuid()`, or drag-handle state that is client-only. When the same component tree is also used for the SSR'd public page, those values diverge between server output and client hydration.

**Consequences:** The public club portal page renders broken or flickers on load. In Next.js App Router, a hydration mismatch in a subtree will not crash the page but will cause a silent client-side re-render that defeats SSR caching. If IDs used as React keys mismatch, the entire subtree unmounts and remounts.

**Prevention:**
- Maintain a strict boundary: the **public portal page** (`src/app/clubs/[slug]/page.tsx`) is a Server Component that renders from the stored, committed layout. The **editor preview** is a separate Client Component tree with its own transient state.
- Never share drag-and-drop keys, editor selection state, or any `useId()`-generated values between the two trees.
- Use `suppressHydrationWarning` only as a last resort and only on specific leaf elements (e.g., timestamps), never on block containers.
- Wrap editor-only libraries (`dnd-kit`, `@dnd-kit/sortable`) in `dynamic(() => import(...), { ssr: false })` to ensure they never run during SSR.

**Warning signs:**
- "Text content did not match" or "Prop `id` did not match" errors in the browser console.
- A drag-and-drop library imported directly (not via `dynamic`) at the top of a component that is also used in an RSC tree.
- `Math.random()` or `Date.now()` calls inside component render functions.

**Phase:** Visual portal editor — address during initial architecture of the editor component boundary.

---

### Pitfall 3: Uncontrolled JSON Layout Schema Drift in Supabase

**What goes wrong:** The portal editor stores club layout/theme as a JSONB column (the natural Supabase approach). Over time, the schema of this JSON evolves — blocks are added, renamed, deprecated. Old layout records have shape `v1`, new ones have shape `v2`. Rendering code that doesn't account for both shapes crashes or silently renders empty blocks for clubs that haven't saved since the migration.

**Why it happens:** JSONB columns are schema-less. Unlike Postgres CHECK constraints on text columns, there is no database-level enforcement of JSON shape. A migration that renames `hero_image` to `hero_image_url` in code will silently break every club that saved their layout before the deploy.

**Consequences:** Clubs' public pages render broken hero sections or missing color themes until each club re-saves. This is invisible during development but affects all existing clubs on deploy day.

**Prevention:**
- Version the layout schema from day one: store `{ version: 1, blocks: [...] }`. Write a migration function `migrateLayout(raw: unknown): LayoutV2` that handles all older shapes and runs on read, before rendering.
- Validate the parsed layout with a Zod schema before rendering. On parse failure, fall back to a safe default layout rather than throwing.
- When changing the schema, write a Postgres migration that backfills existing rows: `UPDATE clubs SET layout = jsonb_set(layout, '{version}', '2') WHERE layout->>'version' IS NULL`.
- Keep the Zod schema co-located with the storage migration so both change together.

**Warning signs:**
- A JSONB layout column with no Zod/schema validation on read.
- Layout rendering code that accesses `layout.hero_image` without a nullish fallback.
- No `version` field in the stored layout object.

**Phase:** Visual portal editor — establish schema versioning before the first layout is stored in production.

---

### Pitfall 4: Duplicate Decision Emails on Retry or Concurrent Dispatch

**What goes wrong:** A club admin triggers "Send decisions" for 200 applicants. The Server Action calls Resend in a loop. If the action is retried (network blip, double-click, Vercel function timeout), some emails are sent twice. Students receive two "You've been accepted" emails, which erodes trust in the platform immediately.

**Why it happens:** The existing `deadline_reminder_sends` deduplication table pattern (which Rush already uses for cron reminders) is not yet applied to decision emails. Without an idempotency guard, any retry path re-sends.

**Consequences:** Students receive duplicate accept/reject notifications. For a waitlisted applicant who gets two conflicting emails (one accept, one reject if there's a data race), the damage is severe and requires manual recovery.

**Prevention:**
- Use the same pattern already in `src/lib/email.ts` + `deadline_reminder_sends`. Create a `decision_notification_sends` table with a unique constraint on `(application_id, decision_status)`. Before sending, attempt an INSERT. If it conflicts (already sent for this decision), skip. This must be done as a single atomic operation: INSERT into the sends table and trigger the email inside a Postgres transaction or RPC function.
- Alternatively, use Resend's idempotency key header (`Idempotency-Key: <application_id>-<decision_status>`) which deduplicates at the provider level for 24 hours.
- Never send emails directly from a Next.js Server Action that can be double-invoked. Route bulk sends through a single Postgres RPC that marks rows as "email_queued" before dispatching, and skips any already marked.

**Warning signs:**
- A loop over `user_applications` calling `resend.emails.send()` without first checking a sends table.
- No unique constraint on the sends log for `(application_id, decision_type)`.
- "Send decisions" button that doesn't disable after the first click with no optimistic guard.

**Phase:** Decision notification emails — address before any bulk send capability is exposed.

---

### Pitfall 5: Stage Transition Race Conditions in the Multi-Stage Pipeline

**What goes wrong:** Two club admins (or one admin double-clicking) simultaneously move an applicant from "Applied" to "Interview". Both reads see `status = 'applied'`, both writes succeed, and the `stage_transition_log` (if one exists) records two transitions. Downstream: if stage transitions trigger automated emails ("You've been invited to interview"), the student gets two invitations.

**Why it happens:** `UPDATE user_applications SET stage_id = $1 WHERE id = $2` with no optimistic concurrency control. Supabase's default UPDATE does not check the prior state, so concurrent writes both succeed.

**Consequences:** Duplicate notifications, inconsistent audit log, and a corrupted pipeline state if the two "concurrent" stage transitions move to different target stages.

**Prevention:**
- Use optimistic concurrency on stage transitions: `UPDATE user_applications SET stage_id = $new_stage, updated_at = now() WHERE id = $id AND stage_id = $expected_current_stage`. Check that exactly one row was affected; if zero rows affected, the transition was preempted — surface a "state changed by someone else, please refresh" error to the admin.
- If a stage transition log is added (recommended for audit), insert it inside the same Postgres RPC as the UPDATE, not as a separate Server Action call.
- Disable the stage-move UI control immediately on click (optimistic UI) before the Server Action resolves to prevent double-submission.

**Warning signs:**
- Stage update Server Actions that do not include the current `stage_id` in the WHERE clause.
- No row count check after the UPDATE (i.e., not verifying `count === 1`).
- Stage transitions and notification sends in two separate Server Action calls rather than a single atomic operation.

**Phase:** Multi-stage pipeline — address before stage-triggered notifications are wired up.

---

## Moderate Pitfalls

### Pitfall 6: Notification Spam When a Club Bulk-Advances Applicants

**What goes wrong:** A club moves 80 applicants from "Applied" to "Interview" in one batch operation. Each transition is processed individually, firing one email per applicant. If the batch is processed synchronously in a Server Action, the action times out on Vercel (default 10s limit for App Router Route Handlers; 25s for Server Actions on Pro). If processed asynchronously without rate limiting, 80 emails hit Resend's API simultaneously and the club's sending domain gets flagged for burst sending.

**Prevention:**
- For bulk stage transitions, batch the DB update in a single `UPDATE ... WHERE id = ANY($ids)` call. Do not loop individual updates.
- Send notification emails via a queue mechanism: write email jobs to a `pending_notifications` table, then process via the existing cron infrastructure (`/api/cron/...`) rather than inline in the Server Action. This decouples the admin UI from email delivery latency.
- Add per-club rate limiting on outbound email: no more than N emails per minute from a single club's portal actions, enforced server-side.

**Warning signs:**
- A `for...of` loop over applicant IDs calling `sendDecisionEmail()` inside a Server Action.
- No cron-based dispatch or queue table for transactional decision emails.

**Phase:** Decision notification emails, multi-stage pipeline.

---

### Pitfall 7: `getPortalContext` Not Checking Club `is_active` / Onboarding Status

**What goes wrong:** A club that has been submitted for admin approval but is not yet approved can still be accessed by its admins via `/portal/[slug]`. If the portal allows sending emails or advancing applicants before the club is "live", students may receive communications from a club that hasn't passed review yet (wrong branding, incomplete setup, or a fraudulent claim).

**Why it happens:** `getPortalContext()` in `src/lib/portal.ts` currently checks membership but does not check whether the club has been approved by the platform admin. There is no `is_active` or `onboarding_status` column on `clubs` yet.

**Consequences:** A club claim that is "pending" or "rejected" could still be used to send decision emails to students if any club admin bypasses the UI and knows their slug.

**Prevention:**
- Add an `onboarding_status` column to `clubs` with values: `('pending', 'approved', 'suspended')`. Default to `'pending'` for new claims.
- Update `getPortalContext` to check `club.onboarding_status === 'approved'` before granting access to pipeline, email, and applicant management features. Return a distinct "awaiting approval" page state rather than `notFound()`.
- Add a Postgres CHECK constraint or RLS policy that prevents decision emails from being logged for clubs where `onboarding_status != 'approved'`.

**Warning signs:**
- `club_claims.status = 'approved'` updates the claim but does not also set `clubs.onboarding_status`.
- `getPortalContext` returns a club object with no field indicating its approval state.
- No guard in the "Send decisions" Server Action checking that the club is live.

**Phase:** Admin onboarding flow — address before the club claim/approval pipeline is wired.

---

### Pitfall 8: Profile Auto-Fill Pre-Populating Stale Data into Submitted Applications

**What goes wrong:** A student submits an application with their current profile (major: "Computer Science"). Later, they update their profile to "Information Science". The club sees the original submitted answers — but if the system stores a reference to the profile rather than a snapshot, the displayed answers silently update to the new major, misrepresenting what the student submitted at time of application.

**Why it happens:** Profile auto-fill is tempting to implement as "read from `profiles` at render time" rather than "copy values into submission answers at submit time."

**Consequences:** Clubs reviewing applications see data that differs from what the student actually submitted. This is both a data integrity issue and a fairness problem — a student who updated their major after applying could appear to have a different background than they declared.

**Prevention:**
- At application submit time, snapshot the auto-filled profile fields into `club_application_submission_answers` rows, exactly like custom question answers. Never read live from `profiles` when displaying a submitted application to a reviewer.
- The `profiles` table is the source of truth for the pre-fill UI only (the student's form view before submission). After submit, the answers table owns the record.
- Add a `source` column to `club_application_submission_answers` with values `('profile_autofill', 'manual')` to make the origin auditable.

**Warning signs:**
- Application review UI that joins `profiles` to display the student's major/year instead of reading from `submission_answers`.
- No submission answers rows for profile fields (name, major, year) after a native application is submitted.

**Phase:** Student profile auto-fill.

---

### Pitfall 9: Duplicate Stage `position` Values After Concurrent Stage Reordering

**What goes wrong:** The `club_pipeline_stages` table has a `UNIQUE (club_id, position)` constraint. When an admin reorders stages by drag-and-drop, the implementation typically issues individual UPDATEs: set stage A to position 2, set stage B to position 1. If both UPDATEs are sent in separate round trips, the second UPDATE may violate the unique constraint before the first has committed, causing a transient conflict error.

**Why it happens:** Unique constraints on ordinal positions are validated immediately on each individual UPDATE. A safe reorder requires either a single multi-row UPDATE or a deferred constraint.

**Prevention:**
- Reorder stages in a single Postgres RPC that accepts an array of `{id, position}` pairs and executes all updates within one transaction. This prevents any intermediate state from violating the constraint.
- Alternatively, use a `DEFERRABLE INITIALLY DEFERRED` constraint on `(club_id, position)` so uniqueness is only checked at transaction commit.
- The same pattern applies to `club_decision_labels.position` and any other ordinal-with-unique-constraint table added for the editor (block positions, etc.).

**Warning signs:**
- Drag-and-drop reordering implemented as individual PATCH calls per stage rather than a batch RPC.
- Unique constraint errors appearing in Supabase logs during reorder operations in testing.

**Phase:** Multi-stage pipeline (stage configuration UI), visual portal editor (block reordering).

---

## Minor Pitfalls

### Pitfall 10: Email Unsubscribe Handling — CAN-SPAM / CASL Compliance

**What goes wrong:** Decision emails and deadline reminders go out without a one-click unsubscribe mechanism. Colleges frequently have students in multiple jurisdictions. Even if not legally required for transactional emails under CAN-SPAM (which exempts purely transactional messages), Resend and most ESPs will flag sending domains that receive high complaint rates — and "you didn't get into the club" is an email students are incentivized to mark as spam.

**Prevention:**
- Add an unsubscribe link to all outbound emails. For transactional decision emails, the link should suppress future notifications from that specific club (`club_email_suppressions` table: `(user_id, club_id)`).
- For platform-wide deadline reminders, honor a global `email_opt_out` boolean on `profiles`.
- Use Resend's built-in unsubscribe header support (`List-Unsubscribe` header) where available — it enables one-click unsubscribe in Gmail and Apple Mail, reducing complaint rates.
- Check the domain's spam score in Resend's dashboard before launch; a new sending domain needs warming.

**Warning signs:**
- `sendDeadlineReminder` and future decision email functions that produce no footer with an unsubscribe link.
- No suppression table and no check before sending.

**Phase:** Decision notification emails. Also retrofit deadline reminders before campus launch.

---

### Pitfall 11: Hero Image Upload Stored Outside Supabase Storage Bucket Policy

**What goes wrong:** The portal editor lets clubs upload a hero image. If the image is stored in a public Supabase Storage bucket without an RLS policy tying the object to the club's ID, any authenticated user can overwrite another club's hero image by guessing the path pattern (`/hero/{club_id}.jpg`).

**Prevention:**
- Store hero images at a path that includes the club ID: `portal-assets/{club_id}/hero.{ext}`.
- Enforce Supabase Storage bucket policies: only the club's admin can write to `portal-assets/{club_id}/*`. Public read is fine for serving the image.
- Validate the uploaded file type server-side (magic bytes, not just MIME from the browser) and enforce a maximum file size (2–5 MB) to prevent storage abuse.

**Warning signs:**
- Hero image stored at a flat path without the club ID in the prefix.
- No storage bucket policy; relying solely on the UI to prevent overwrites.

**Phase:** Visual portal editor.

---

### Pitfall 12: `clubs.verified` vs `onboarding_status` Semantic Confusion

**What goes wrong:** The existing `clubs` table has a `verified` boolean column. The admin onboarding flow will add approval logic. If `verified` is repurposed to mean "approved for use on Rush" rather than "this club identity has been confirmed," the semantics blur. A club could be verified (identity confirmed) but suspended, or unverified (just claimed) but accidentally treated as approved.

**Prevention:**
- Keep `verified` for its current meaning (identity confirmation — did we confirm this is the real club?).
- Add a separate `onboarding_status text CHECK ('pending', 'approved', 'suspended')` for platform approval gating.
- Gate portal functionality (email sends, form publishing, public listing) on `onboarding_status = 'approved'`, not on `verified = true`.
- Document the distinction in a comment on each column and in any admin UI that shows both flags.

**Warning signs:**
- Server Actions checking `club.verified` before allowing email dispatch.
- Admin UI that shows a single "approve" toggle that sets `verified = true` with no `onboarding_status` column existing.

**Phase:** Admin onboarding flow.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Visual portal editor — storage | JSON layout schema drift (Pitfall 3) | Version the schema from day one; validate with Zod on read |
| Visual portal editor — rendering | XSS via user CSS (Pitfall 1) | Token-only storage; no free-form CSS strings |
| Visual portal editor — SSR | Hydration mismatch (Pitfall 2) | Strict RSC/client boundary; `dynamic({ ssr: false })` for drag libs |
| Visual portal editor — block order | Duplicate position on reorder (Pitfall 9) | Batch RPC for all reorders |
| Visual portal editor — hero upload | Storage path hijack (Pitfall 11) | Club-scoped storage paths + bucket policy |
| Multi-stage pipeline — transitions | Race condition (Pitfall 5) | Optimistic concurrency WHERE clause |
| Multi-stage pipeline — reordering | Position constraint conflict (Pitfall 9) | Batch RPC for reorders |
| Decision emails — bulk send | Duplicate sends on retry (Pitfall 4) | Sends deduplication table + idempotency key |
| Decision emails — bulk send | Notification spam / timeout (Pitfall 6) | Queue via cron, not inline Server Action loop |
| Decision emails — compliance | No unsubscribe / complaint rate (Pitfall 10) | Suppression table + List-Unsubscribe header |
| Profile auto-fill | Stale data in submitted applications (Pitfall 8) | Snapshot into answers at submit time |
| Admin onboarding — access control | Portal accessible before approval (Pitfall 7) | `onboarding_status` column + guard in `getPortalContext` |
| Admin onboarding — schema | `verified` vs approval confusion (Pitfall 12) | Separate column, documented semantics |

---

## Sources

- Codebase analysis: `src/lib/portal.ts`, `src/lib/email.ts`, `supabase/migrations/` (all 9 migrations)
- Existing pattern reference: `deadline_reminder_sends` deduplication in `src/app/api/cron/deadline-reminders`
- Schema analysis: `user_applications` stage/decision fields, `club_pipeline_stages.position` unique constraint
- Confidence: HIGH for pitfalls derived directly from reading the codebase schema and existing patterns. MEDIUM for email deliverability and CAN-SPAM guidance (standard industry practice, not Rush-specific code).
