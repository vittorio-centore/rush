---
phase: 01-student-profile-auto-fill
plan: 02
subsystem: profile
tags: [profile, storage, resume, forms]
dependency_graph:
  requires: [01-01]
  provides: [PROF-01, PROF-02]
  affects: [dashboard/profile]
tech_stack:
  added: []
  patterns:
    - Client Component with direct Supabase Storage upload
    - Server Action with user ownership validation for storage paths
    - Signed URL generated at display time (never stored)
key_files:
  created:
    - src/app/dashboard/profile/ResumeUpload.tsx
  modified:
    - src/app/dashboard/profile/page.tsx
    - src/app/dashboard/profile/actions.ts
decisions:
  - Storage path stored in profiles.resume_url, not signed URL — signed URLs expire after 1 hour
  - LinkedIn URL validated server-side (must start with https://) — no DB constraint needed
  - Client-side PDF validation (type + 10 MB) for early feedback; bucket enforces server-side
metrics:
  duration: "2 minutes"
  completed: "2026-04-09"
  tasks_completed: 2
  files_modified: 3
---

# Phase 1 Plan 02: Profile Bio, Phone, LinkedIn, and Resume Upload Summary

**One-liner:** Bio textarea, phone tel input, LinkedIn URL input, and PDF resume upload via Supabase Storage with signed URL display — profile editor now satisfies PROF-01 and PROF-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Expand profile page and updateProfile action with bio, phone, linkedin_url fields | 2070683 | page.tsx, actions.ts |
| 2 | Create ResumeUpload Client Component for PDF upload to Supabase Storage | fbb20d6 | ResumeUpload.tsx |

## What Was Built

### Task 1: Profile fields expansion

**`src/app/dashboard/profile/actions.ts`:**
- Added `bio`, `phone`, `linkedinUrl` extraction from FormData
- Added LinkedIn URL validation: must start with `https://` or redirect with error
- Extended `.update({...})` to persist `bio`, `phone`, `linkedin_url` (all nullable)
- Added `saveResumeUrl(storagePath: string)` Server Action:
  - Validates authenticated user
  - Validates `storagePath.startsWith("{userId}/")` to prevent path traversal
  - Updates `profiles.resume_url` with the storage path
  - Calls `revalidatePath` on both profile and dashboard routes

**`src/app/dashboard/profile/page.tsx`:**
- Extended Supabase query to select `bio, phone, linkedin_url, resume_url`
- Added import for `ResumeUpload` component
- Added bio textarea (4 rows), phone tel input, linkedin_url url input after Interests field
- Added `<ResumeUpload userId={data.user.id} currentResumePath={profile?.resume_url ?? null} />` after the form

### Task 2: ResumeUpload Client Component

**`src/app/dashboard/profile/ResumeUpload.tsx`:**
- `"use client"` boundary for browser-side Storage interaction
- Props: `userId: string`, `currentResumePath: string | null`
- `useEffect` fetches signed URL for existing resume on mount (1-hour TTL)
- `handleFileChange` validates PDF type and 10 MB size limit before upload
- Uploads to `resumes/{userId}/resume.pdf` with `upsert: true` (overwrite on re-upload)
- Calls `saveResumeUrl` Server Action after successful upload
- Generates fresh signed URL after upload to show download link
- States: idle, uploading, success, error with appropriate UI messages

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/app/dashboard/profile/page.tsx` — exists, contains bio/phone/linkedin_url fields and ResumeUpload
- [x] `src/app/dashboard/profile/actions.ts` — exists, contains saveResumeUrl and new fields in updateProfile
- [x] `src/app/dashboard/profile/ResumeUpload.tsx` — exists, "use client", correct import paths
- [x] Commit 2070683 — Task 1
- [x] Commit fbb20d6 — Task 2

## Self-Check: PASSED
