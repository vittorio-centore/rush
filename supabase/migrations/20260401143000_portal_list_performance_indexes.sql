create index if not exists user_applications_club_created_at_idx
  on public.user_applications (club_id, created_at desc);

create index if not exists user_applications_club_status_idx
  on public.user_applications (club_id, status);

create index if not exists user_applications_club_decision_status_idx
  on public.user_applications (club_id, decision_status);

create index if not exists club_reviewer_assignments_reviewer_club_application_idx
  on public.club_reviewer_assignments (reviewer_user_id, club_id, application_id);
