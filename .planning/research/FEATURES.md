# Feature Landscape: Rush — Campus Club Recruitment Platform

**Domain:** Two-sided campus recruitment marketplace (clubs recruit, students apply)
**Researched:** 2026-04-08
**Confidence note:** Web search was unavailable. All findings are grounded in (1) direct codebase analysis of Rush's existing implementation, (2) training knowledge of CampusGroups, OrgSync/Engage, Presence, Handshake, and ATS platforms (knowledge current as of August 2025, marked MEDIUM confidence), and (3) first-principles reasoning about the domain. No claims are stated as authoritative beyond what the code itself verifies.

---

## What Already Exists in Rush (Verified from Code)

Understanding what is built prevents re-speccing built things as "table stakes to add."

| Capability | Status | Notes |
|------------|--------|-------|
| Club directory with slug pages | Built | `src/app/clubs/[slug]/page.tsx` |
| Student auth (OTP magic link) | Built | Supabase auth |
| Student dashboard: follow tracking, application tracker | Built | `src/app/dashboard/` |
| ML-powered club recommendations | Built | FastAPI sidecar, fallback to popular |
| Custom application form builder | Built | Sections, questions, conditional visibility |
| Deadline management + reminder emails | Built | Resend, cron route |
| CSV import for bulk applicants | Built | `src/app/portal/[slug]/imports/` |
| Club claim flow | Built | `club_claims` table, but approval UI is missing |
| Pipeline stages schema | Built | `club_pipeline_stages` table, status buckets: interested → applied → interview → decision |
| Decision labels schema | Built | `club_decision_labels` — accepted/rejected/waitlisted/pending |
| Recruiter scorecard (4-dimension) | Built | `problem_solving`, `coding_ability`, `technical_knowledge`, `communication` |
| Reviewer assignment | Built | `assignReviewer`, `saveReviewerScorecard` server actions |
| Weighted scoring + decision templates | Built | `recruiter-decisions.ts`, 3 presets |
| Saved recruiter views (filter sets) | Built | `club_saved_recruiter_views` |
| Bulk applicant status update | Built | `bulkUpdateApplicants` |
| Application source tracking | Built | `tracked` / `native` / `external_csv` |

---

## Table Stakes

Features that users of a campus club platform expect. Absence causes abandonment or creates support escalation.

### Student-Facing Table Stakes

| Feature | Why Expected | Complexity | Gap Status |
|---------|--------------|------------|------------|
| Searchable / filterable club directory | First thing any student tries on arrival | Low | Built |
| Application status visibility | "Where am I in the process?" — asked constantly | Low | Built (interested/applied/interview/decision) |
| Know when decisions are sent | Students check incessantly; no visibility = trust collapse | Low | **Missing — decision notification emails not yet wired** |
| Accept/reject/waitlist outcome notification | Students expect an email; silence reads as ghost | Low | **Missing — decision emails exist in schema, not triggered** |
| Pre-filled profile across applications | Re-entering name/major/year for each club is table stakes friction | Low-Med | **Missing — profile auto-fill not wired to apply flow** |
| Deadline reminders | Forgetting a deadline is the #1 student complaint | Low | Built |
| Mobile-readable club page | Students discover on phones; unusable mobile = no apply | Low-Med | Present via Tailwind responsive, not an editor gap |
| Persistent application draft | Losing essay text on navigation is fatal UX | Low | Present (essay_draft column exists on user_applications) |

### Club-Facing (Recruiter) Table Stakes

| Feature | Why Expected | Complexity | Gap Status |
|---------|--------------|------------|------------|
| Applicant list with status | Core operational need — who applied | Low | Built |
| Move applicants through stages | Without this, pipeline stages are cosmetic | Low-Med | **Missing — stage transition UI exists but no notification fires, no student visibility update wired** |
| Send decision emails (accept/reject/waitlist) | Clubs want to close the loop inside the tool | Low-Med | **Missing — schema exists, emails not triggered** |
| Custom application form | Clubs have unique questions; Google Forms parity is minimum | Med | Built |
| Filter/sort applicants | Reviewing 200 apps without filters is unusable | Low | Built (saved views, score sort) |
| Recruiter scoring / notes | At minimum, pass/fail per reviewer | Med | Built (4-dimension scorecard) |
| Club profile page with branding | "What does our page look like?" — every club asks this | Med | Basic page built; **visual editor missing** |
| Deadline management | "When does recruiting close?" must be controllable | Low | Built |

### Admin / Platform Table Stakes

| Feature | Why Expected | Complexity | Gap Status |
|---------|--------------|------------|------------|
| Club approval / onboarding gate | Without this, any bad actor can claim a club | Low-Med | **Missing — claim approval UI exists in DB (`club_claims`), but no admin review screen** |
| Platform-wide club discovery | Every club visible; none hidden by error | Low | Built for verified clubs; onboarding controls "live" status |
| Email deliverability (no unsubscribe = compliance risk) | CAN-SPAM requires unsubscribe | Low | **Missing — CONCERNS.md confirms deadline emails have no unsubscribe** |

---

## Differentiators

Features that give Rush a competitive edge over generic solutions (Google Forms, Airtable, Instagram DMs).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ML-powered club recommendations | No other campus platform does personalized discovery; reduces student search fatigue | High | Built — needs rollout enabled |
| Visual portal editor (Squarespace-style) | Clubs own their identity; looks like a real org, not a generic form | High | **Net-new, largest build in this milestone** |
| Unified application tracker (student-side) | Students manage all clubs in one place; Handshake does this for jobs, nothing does it for clubs | Med | Built |
| Multi-stage pipeline with club-customizable stages | Generic ATS has this; campus platforms don't | Med | Schema built, UI partial |
| Weighted scoring templates | Saves clubs hours of manual scoring calibration | Med | Built |
| Auto-fill profile across applications | Reduces per-application friction to near zero | Low-Med | **Missing — schema exists, wiring is the work** |
| Behavioral recommendation telemetry | Recommendations improve over time; competitive moat | High | Built (events table, nightly pipeline) |
| Club claim flow with admin approval | Platform credibility: only real orgs get pages | Low-Med | DB built, UI gap |

---

## Anti-Features

Things to deliberately not build in this milestone (and likely beyond).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Drag-and-drop block editor (Notion/Webflow-style) | Scope explosion; clubs don't need arbitrary layout; maintenance nightmare | Use a constrained theme picker: hero image + color scheme + section toggle. CSS variable overrides cover 95% of club needs with 10% of the complexity. |
| In-platform messaging (DMs, inbox) | Clubs want async chat; this is Slack/email territory; adds real-time infra requirements | Let clubs communicate outcomes via decision notification emails. Post-acceptance comms stay off-platform. |
| Slack / Discord integration | Webhook complexity, auth scope changes, per-club OAuth setup. Out of scope per PROJECT.md. | Decision emails serve the same handoff purpose. |
| Payment / dues collection | Stripe integration, PCI compliance, accounting workflows. Out of scope per PROJECT.md. | Reference Stripe Checkout as a future phase if validated. |
| Multi-university tenancy | RLS isolation per university, subdomain routing, billing per institution — massive scope | Stay single-campus. Add a `university_id` FK to clubs/profiles tables as a future-proof column only if needed. |
| AI essay feedback / writing assistant | Scope creep; shifts platform from application tracker to tutor. Adds LLM cost and latency. | Students write their own essays; form builder handles question structure. |
| Interview scheduling / calendar sync | Google Calendar OAuth, availability matching, Calendly-style UX — all substantial builds. | Stage transitions signal "interview" status; clubs book outside Rush for now. |
| Video submission / async interview | S3 storage, video encoding pipeline, playback infrastructure — engineering-heavy. | Out of scope until demand is validated post-launch. |
| Public voting on applicants | Problematic fairness optics, FERPA adjacency, inconsistent standards club-to-club. | Keep scoring internal to club reviewers only. |
| Waitlist self-management (student accepts/declines waitlist) | Adds a second student-action state machine that isn't needed for v1 | Club decides who comes off waitlist; student receives notification only. |

---

## The Multi-Stage Application Pipeline: What "Complete" Looks Like

This section defines the full feature surface of a correct multi-stage pipeline — both what Rush already has and what is missing.

### Stage Model

Rush already has the right data model:

```
status buckets:  interested → applied → interview → decision
stage_id:        points to club_pipeline_stages (custom stage within a bucket)
decision_status: pending | accepted | rejected | waitlisted
decision_label:  points to club_decision_labels (custom label within a decision status)
```

### Stage Transitions

**What exists:** `updateApplicantStatus` server action sets `status` and `stage_id` on `user_applications`.

**What is missing to call the pipeline "complete":**

| Transition Event | Required Behavior | Currently Present |
|-----------------|-------------------|-------------------|
| Club moves applicant to interview stage | Student sees status update in dashboard | No — status is stored but no student-visible trigger |
| Club moves applicant to decision stage | Student sees status update | No |
| Club sets decision_status to accepted | Student receives accept email | No — email not triggered |
| Club sets decision_status to rejected | Student receives reject email | No |
| Club sets decision_status to waitlisted | Student receives waitlist email | No |
| Bulk decision send | All applicants in a label get notified in one action | No |
| Student views current stage name | Dashboard shows named stage (e.g. "Technical Round"), not just bucket | No — dashboard shows bucket only |

### Notification Requirements per Stage

**Advance to interview stage:**
- Email: "You've moved to the interview stage at [Club Name]. Stay tuned for next steps."
- Dashboard: Stage badge updates (bucket: interview)

**Advance to decision stage:**
- Email: Optional — some clubs skip pre-decision notice; configurable per club
- Dashboard: Stage badge updates (bucket: decision)

**Decision: accepted:**
- Email: Subject "You've been accepted to [Club Name]!" — club-customizable body or template
- Dashboard: Decision badge = "Accepted", green

**Decision: rejected:**
- Email: Subject "Update on your application to [Club Name]" — neutral language
- Dashboard: Decision badge = "Not accepted"

**Decision: waitlisted:**
- Email: Subject "You're on the waitlist for [Club Name]"
- Dashboard: Decision badge = "Waitlisted"

**Notification triggers (medium confidence):**
- Notifications should be opt-in at the club level (club chooses "send emails on accept" toggle)
- Bulk send: Club reviews all acceptances on the decisions page, clicks "Send notifications" — one Resend batch, not one-by-one
- Idempotency guard: Track notification-sent timestamp per `user_applications` row to prevent duplicate sends

### What "Complete" Requires (Gaps Only)

1. `notification_sent_at` column (or separate `application_notifications` table) to guard against duplicate sends
2. Decision email templates (accept / reject / waitlist) — can reuse existing Resend + `src/lib/email.ts` pattern
3. Server action: `sendDecisionNotifications(clubId, decisionLabelId)` — bulk send for all applicants under a label
4. Server action: `sendStageNotification(applicationId)` — individual send on manual stage advance (optional, club-configurable)
5. Student dashboard: display `stage_id → stage.label` (the custom stage name) instead of or alongside the bucket name
6. Notification opt-in toggle per club (stored on `clubs` or `club_decision_settings`)

---

## Student Profile Auto-Fill

### What Exists
`profiles` table has: `full_name`, `email`, `year`, `major`, `interests[]`. The `user_applications` table has `external_*` columns for CSV-imported applicants. The apply page (`src/app/clubs/[slug]/apply/`) exists but currently does not pre-populate form fields from profile.

### What "Auto-fill" Means in Practice

1. When a student opens an application form, any form question whose `label` maps to a canonical profile field (name, major, year, email) is pre-populated from `profiles`.
2. Mapping is by question type and label — a `short_text` question labeled "Major" or "What is your major?" gets the student's `profiles.major` value injected.
3. Student can override the pre-fill; it's a default, not a lock.
4. Club's custom questions (GPA, why this club, project experience) never auto-fill.

### Complexity Notes

- Canonical field matching can be heuristic (label keyword match) or explicit (a `profile_field` enum column on `form_questions`). The explicit approach is cleaner and avoids false matches — add `profile_field: 'name' | 'email' | 'year' | 'major' | null` to the form questions schema.
- Auto-fill runs client-side in `ApplicationForm.tsx` after the page loads, or server-side pre-renders field defaults — either works. Server-side is simpler given the App Router RSC pattern.

---

## Visual Portal Editor: Feature Scope

The largest net-new feature in this milestone. The goal is club brand ownership without general-purpose CMS complexity.

### What Clubs Actually Need (from domain knowledge, MEDIUM confidence)

Observation from comparable platforms (CampusGroups, Presence): clubs care about three things in order of priority:
1. Hero image / cover photo
2. Club colors / accent color
3. Section visibility (show/hide: about, deadlines, team, gallery, FAQ)

They do not care about arbitrary layout re-ordering, custom fonts, or pixel-precise positioning.

### Recommended Scope for "Squarespace-style" Editor

| Control | What It Does | Complexity |
|---------|--------------|------------|
| Hero image upload | Cover photo displayed at top of club page | Med (needs file upload to Supabase Storage) |
| Primary accent color | Hex picker — sets button color, tag color, header accent | Low (CSS variable override stored in clubs table) |
| About section | Rich text (markdown or simple WYSIWYG) replacing plain `description` | Med |
| Section toggles | Show/hide: deadlines, social links, tags, contact email | Low |
| Logo / avatar image | Small circular image for club identity | Med (same upload infra as hero) |

**Out of scope for this editor:** drag-and-drop reordering, custom HTML/CSS injection, multi-page sites, embedded widgets.

**Storage:** Supabase Storage bucket (`club-assets`) — already supported by `@supabase/supabase-js`. No new infra needed.

**Data model addition:** New columns on `clubs` table: `hero_image_url`, `logo_url`, `accent_color` (hex string), `show_deadlines_section`, `show_social_section` (booleans).

### Risk Flag

The key complexity question is whether a "live preview" iframe or split-pane editor is required, or whether changes are applied and saved with a separate "preview" link. The split-pane preview approach requires a client component that re-renders the public club page with unsaved state — more complex. The preview-link approach is simpler and sufficient for v1.

---

## Admin Onboarding / Approval Flow

### What "Full Campus Launch Readiness" Requires

The `club_claims` table already exists with `pending | approved | rejected` status. The `approve_claim_fn` migration exists. CONCERNS.md confirms the approval UI is missing.

| Capability | Required | Gap |
|------------|----------|-----|
| Admin sees list of pending claims | Yes | Missing — no `/admin` route exists |
| Admin approves claim → applicant becomes club admin | Yes | DB function exists (`approve_claim_fn`), no UI |
| Admin rejects claim with reason | Yes | Missing |
| New club submission by officers who don't see their club yet | Yes (clubs may not be seeded yet) | Partially present via claim flow; needs "suggest a club" path |
| Platform admin can toggle club visibility (live vs staging) | Yes | Missing — no `is_live` or `status` flag on clubs beyond `verified` boolean |
| Club sees its approval status | Yes | Missing — no status feedback in claim flow post-submission |

**Scope of admin interface for launch:** A minimal `/admin` route protected by a super-admin role check (not club membership). Needs: pending claims list, approve/reject action, club live/not-live toggle. This is a low-feature but high-trust surface.

**Admin role model:** A new `is_platform_admin` boolean on `profiles`, or a separate `platform_admins` table. The former is simpler; the latter is more auditable.

---

## Feature Dependencies

```
Profile auto-fill → profiles table (built) + apply form pre-population (missing)

Decision notifications → decision email templates + notification_sent_at guard + trigger in stage-transition actions

Stage transitions (student-visible) → stage notifications OR at minimum: dashboard reads stage_id.label (not just status bucket)

Visual portal editor → Supabase Storage bucket + new clubs columns (hero_image_url, accent_color, etc.) + portal settings UI

Admin onboarding flow → admin role model (new) + /admin route + claim review UI + club live/staging toggle

Full campus launch → Admin onboarding flow (all clubs approved/live) + decision notifications (clubs can close recruitment loop) + profile auto-fill (reduces friction at scale)
```

---

## MVP Recommendation for This Milestone

Priority order based on user impact and dependency ordering:

1. **Profile auto-fill** — low complexity, high friction reduction, builds on existing schema. Do first.
2. **Decision notification emails** — schema is 80% there (Resend is already integrated). Send emails on accept/reject/waitlist. Required for clubs to actually close recruitment.
3. **Admin onboarding flow** — without this, the platform cannot go live. A club with no approval path means anyone can impersonate an org. Blocking dependency on "full campus launch."
4. **Multi-stage pipeline: student visibility** — wire `stage_id → stage.label` into the student dashboard. Without this, the pipeline stages are invisible to the person they're meant to serve.
5. **Visual portal editor** — highest complexity, but the feature clubs will show off during onboarding. Scope to: hero image, accent color, section toggles. Defer live-preview iframe to a follow-up.

**Defer:**
- Interview scheduling — clubs use existing tools; adds calendar OAuth scope
- Waitlist self-serve accept/decline — not needed for v1 close-loop
- Editor live-preview pane — preview link is sufficient for launch

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Decision email sends | Duplicate sends if triggered multiple times; no idempotency guard exists | Add `notification_sent_at` to `user_applications` before wiring send triggers |
| Visual portal editor | Hero image upload requires Supabase Storage bucket setup and RLS policies — this is infrastructure, not just UI | Create the Storage bucket and policies in a migration before building the upload UI |
| Admin onboarding flow | Super-admin role check must not reuse `club_admin_memberships` (that's per-club) — needs a separate platform-admin mechanism | Use `is_platform_admin boolean` on profiles or a dedicated `platform_admins` table; check this on the admin route layout |
| Profile auto-fill | Heuristic label matching is fragile; a question labeled "What's your favorite year?" will misfire | Use an explicit `profile_field` enum on `form_questions` rather than label substring matching |
| Campus launch readiness | Clubs that were seeded (not claimed) have no admin; need an initial admin bootstrap path | The `approve_claim_fn` function handles this; ensure it's called during seeding or provide a CLI for it |
| Unsubscribe compliance | Decision emails join deadline reminders as CAN-SPAM/GDPR risk with no unsubscribe | Add a one-click unsubscribe token (stored in a `email_unsubscribes` table) to both email types before launch |

---

## Sources

- Direct codebase analysis: migrations, server actions, page components, `recruiter-decisions.ts`, `CONCERNS.md`, `ARCHITECTURE.md`
- Training knowledge of CampusGroups, OrgSync/Engage (now Campus Labs Engage), Presence, and Handshake (MEDIUM confidence — knowledge current as of August 2025, unverified against current product state)
- Domain reasoning from ATS platform patterns (Greenhouse, Lever) applied to campus context
- PROJECT.md requirements specification
