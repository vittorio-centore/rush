# Requirements: Rush

**Defined:** 2026-04-09
**Core Value:** Every club on campus lives on Rush, with a consistent application experience — so students stop hunting across Google Forms and club Instagram pages.

## v1 Requirements

### Student Profile

- [ ] **PROF-01**: Student can add bio, phone number, and LinkedIn URL to their profile
- [ ] **PROF-02**: Student can upload a resume PDF stored in Supabase Storage
- [ ] **PROF-03**: Profile fields (name, major, year, bio) auto-populate into any club application at open time
- [ ] **PROF-04**: Auto-filled answers snapshot into `club_application_submission_answers` at submit — profile edits do not retroactively change submitted applications

### Application Pipeline

- [ ] **PIPE-01**: Club officer can move an applicant through pipeline stages (submit → review → interview → decision)
- [ ] **PIPE-02**: Each stage transition is recorded in an append-only audit log
- [ ] **PIPE-03**: Student can see their current pipeline stage on their application tracker

### Notifications

- [ ] **NOTF-01**: Student receives an email confirmation immediately after submitting a club application

### Portal Editor

- [ ] **EDIT-01**: Club officer can set an accent color (brand color) applied to buttons, headers, and highlights on their public club page
- [ ] **EDIT-02**: Club officer can upload a hero/banner image displayed at the top of their public club page
- [ ] **EDIT-03**: Club officer can toggle content sections (e.g. About, Officers, Gallery) on/off on their public club page
- [ ] **EDIT-04**: Club officer can select a layout variant (e.g. minimal vs. full) for their public club page
- [ ] **EDIT-05**: Theme is stored as structured columns (not free-form CSS) to prevent XSS on the public unauthenticated page

### Admin & Club Onboarding

- [ ] **ADMN-01**: Platform admin can view all clubs and their onboarding status (unclaimed / pending / approved / rejected)
- [ ] **ADMN-02**: Platform admin can approve or reject a club claim request
- [ ] **ADMN-03**: Clubs without an approved admin are visible in discovery and recommendations but cannot access the portal editor
- [ ] **ADMN-04**: `getPortalContext` enforces that the club has an approved admin before permitting any portal write operations

## v2 Requirements

### Notifications

- **NOTF-02**: Student receives email when their application moves to a new pipeline stage
- **NOTF-03**: Student receives accept/reject/waitlist decision email when a club sets a final decision

### Pipeline

- **PIPE-04**: Club officer can configure interview time slots; student selects an available slot from their application tracker

### Portal Editor

- **EDIT-06**: Club officer can add a custom bio/description section with rich text

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-university support | Single campus scope for v1; multi-tenancy adds significant auth and data isolation complexity |
| Third-party visual editor (Craft.js, GrapeJS, Puck) | Scope mismatch + React 19 incompatibility risk; CSS custom properties approach is sufficient |
| Off-platform communication tools | Clubs handle post-decision comms outside Rush for now |
| Payment / dues collection | Not part of the application flow in v1 |
| OAuth login | OTP magic link is sufficient for campus use |
| Free-form CSS input from clubs | XSS vector on public unauthenticated pages; token-based design variables only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 1 | Pending |
| PROF-02 | Phase 1 | Pending |
| PROF-03 | Phase 1 | Pending |
| PROF-04 | Phase 1 | Pending |
| PIPE-01 | Phase 2 | Pending |
| PIPE-02 | Phase 2 | Pending |
| PIPE-03 | Phase 2 | Pending |
| NOTF-01 | Phase 2 | Pending |
| EDIT-01 | Phase 3 | Pending |
| EDIT-02 | Phase 3 | Pending |
| EDIT-03 | Phase 3 | Pending |
| EDIT-04 | Phase 3 | Pending |
| EDIT-05 | Phase 3 | Pending |
| ADMN-01 | Phase 4 | Pending |
| ADMN-02 | Phase 4 | Pending |
| ADMN-03 | Phase 4 | Pending |
| ADMN-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial definition*
