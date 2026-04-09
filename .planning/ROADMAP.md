# Roadmap: Rush

## Overview

Rush completes four product surfaces to make the platform launchable: student profile auto-fill (reduces per-application friction), a multi-stage application pipeline with submission confirmation email (closes the recruitment loop for clubs), a visual portal editor (the acquisition driver clubs demo during onboarding), and admin onboarding with access gating (prevents unapproved clubs from going live). Each phase delivers a self-contained, verifiable capability. Phases 1 and 3 are independent and can be worked in parallel; Phase 4 must be complete before production traffic.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Student Profile & Auto-Fill** - Students enrich their profiles and have shared fields pre-populated into every club application
- [ ] **Phase 2: Application Pipeline & Notifications** - Club officers move applicants through stages; students see their stage; submission triggers a confirmation email
- [ ] **Phase 3: Visual Portal Editor** - Club officers customize their public page with accent color, hero image, section toggles, and layout variant
- [ ] **Phase 4: Admin Onboarding & Launch Readiness** - Platform admin approves clubs before they go live; unapproved clubs cannot access portal write operations

## Phase Details

### Phase 1: Student Profile & Auto-Fill
**Goal**: Students can enrich their profiles and have shared fields pre-populated into every club application they open
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04
**Success Criteria** (what must be TRUE):
  1. Student can add bio, phone number, and LinkedIn URL to their profile from the profile editor
  2. Student can upload a resume PDF and see it stored and accessible from their profile
  3. When a student opens a club application, name, major, year, and bio fields are already filled in from their profile
  4. After submitting, the auto-filled answers are frozen — editing the profile does not change what was submitted
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Schema migration: profile columns, source_key columns, resumes storage bucket
- [ ] 01-02-PLAN.md — Profile editor: bio, phone, LinkedIn fields + resume PDF upload
- [x] 01-03-PLAN.md — Auto-fill merge into applications + source_key snapshot provenance

### Phase 2: Application Pipeline & Notifications
**Goal**: Club officers can move applicants through pipeline stages, students can see their current stage, and submitting an application triggers an immediate confirmation email
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, NOTF-01
**Success Criteria** (what must be TRUE):
  1. Club officer can move an applicant from one pipeline stage to another (submit → review → interview → decision) from the portal
  2. Each stage transition is permanently recorded — no transition can be overwritten or deleted
  3. Student can see the name of their current pipeline stage on their application tracker dashboard
  4. Student receives an email confirmation immediately after submitting a club application
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Schema migration: profile columns, source_key columns, resumes storage bucket
- [ ] 01-02-PLAN.md — Profile editor: bio, phone, LinkedIn fields + resume PDF upload
- [ ] 01-03-PLAN.md — Auto-fill merge into applications + source_key snapshot provenance

### Phase 3: Visual Portal Editor
**Goal**: Club officers can customize their public-facing club page with brand colors, a hero image, section visibility controls, and layout choice — rendered safely via SSR CSS variables
**Depends on**: Nothing (parallelizable with Phase 1)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria** (what must be TRUE):
  1. Club officer can pick an accent color from a color picker and see it applied to buttons, headers, and highlights on the public club page
  2. Club officer can upload a hero/banner image and see it displayed at the top of their public club page
  3. Club officer can toggle individual content sections (About, Officers, Gallery) on or off, and the public page reflects the change
  4. Club officer can switch between layout variants (e.g. minimal vs. full) and the public page renders the chosen layout
  5. Theme is stored as structured named columns — no free-form CSS can be injected onto the public unauthenticated page
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Schema migration: profile columns, source_key columns, resumes storage bucket
- [ ] 01-02-PLAN.md — Profile editor: bio, phone, LinkedIn fields + resume PDF upload
- [ ] 01-03-PLAN.md — Auto-fill merge into applications + source_key snapshot provenance
**UI hint**: yes

### Phase 4: Admin Onboarding & Launch Readiness
**Goal**: A platform admin can review, approve, or reject club claims; unapproved clubs are visible in discovery but locked out of portal write operations; platform is safe for production traffic
**Depends on**: Phases 1, 2, 3 (must complete before production launch)
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04
**Success Criteria** (what must be TRUE):
  1. Platform admin can view all clubs and their onboarding status (unclaimed, pending, approved, rejected) from the admin dashboard
  2. Platform admin can approve or reject a pending club claim request, and the club officer is notified of the outcome
  3. A club without an approved admin appears in discovery and recommendations but cannot access the portal editor or trigger email sends
  4. Any attempt to perform a portal write operation without an approved admin is blocked at the server — not just hidden in the UI
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Schema migration: profile columns, source_key columns, resumes storage bucket
- [ ] 01-02-PLAN.md — Profile editor: bio, phone, LinkedIn fields + resume PDF upload
- [ ] 01-03-PLAN.md — Auto-fill merge into applications + source_key snapshot provenance

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 (Phase 3 may be worked in parallel with Phase 1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Student Profile & Auto-Fill | 2/3 | In Progress|  |
| 2. Application Pipeline & Notifications | 0/? | Not started | - |
| 3. Visual Portal Editor | 0/? | Not started | - |
| 4. Admin Onboarding & Launch Readiness | 0/? | Not started | - |
