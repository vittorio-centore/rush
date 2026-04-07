alter table public.profiles
  add column if not exists phone_number text;

alter table public.club_admin_memberships
  drop constraint if exists club_admin_memberships_role_check;

alter table public.club_admin_memberships
  add constraint club_admin_memberships_role_check
  check (role in ('admin', 'reviewer', 'member'));

create table if not exists public.club_application_member_notes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  application_id uuid not null references public.user_applications (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  flag_status text not null default 'neutral',
  note_text text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, author_user_id),
  check (flag_status in ('neutral', 'green', 'red'))
);

create index if not exists club_application_member_notes_application_idx
  on public.club_application_member_notes (application_id, created_at desc);

create index if not exists club_application_member_notes_author_idx
  on public.club_application_member_notes (author_user_id, created_at desc);

drop trigger if exists set_club_application_member_notes_updated_at
  on public.club_application_member_notes;

create trigger set_club_application_member_notes_updated_at
before update on public.club_application_member_notes
for each row
execute function public.set_updated_at();
