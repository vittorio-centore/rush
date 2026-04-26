-- Phase 1: Student Profile Auto-Fill
-- Adds profile columns, source_key columns, resumes storage bucket, and RLS policies

-- 1. Profile columns — four new nullable columns on profiles
alter table public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists linkedin_url text,
  add column if not exists resume_url text;
-- resume_url stores the Storage path, e.g. "{user_id}/resume.pdf" (NOT a signed URL)

-- 2. source_key on club_application_form_questions — for auto-fill mapping
alter table public.club_application_form_questions
  add column if not exists source_key text;

alter table public.club_application_form_questions
  add constraint club_application_form_questions_source_key_check
  check (source_key is null or source_key in ('full_name', 'major', 'year', 'bio'));

-- 3. source_key on club_application_submission_answers — for snapshot provenance
alter table public.club_application_submission_answers
  add column if not exists source_key text;

-- 4. Resumes storage bucket — private, PDF-only, 10MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- 5. Storage RLS policies — students manage their own resume

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
