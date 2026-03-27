create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  year text,
  major text,
  interests text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(trim(email)) > 0)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  tags text[] not null default '{}',
  category text,
  website_url text,
  instagram_url text,
  contact_email text,
  application_mode text not null default 'none',
  application_url text,
  recruiting_status text not null default 'unknown',
  verified boolean not null default false,
  source text not null default 'manual',
  source_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(trim(slug)) > 0),
  check (char_length(trim(name)) > 0),
  check (application_mode in ('none', 'external', 'native')),
  check (recruiting_status in ('unknown', 'open', 'closed', 'rolling')),
  check (source in ('manual', 'maize_pages', 'import'))
);

create table public.club_deadlines (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  title text not null,
  deadline_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(trim(title)) > 0)
);

create table public.club_claims (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  message text,
  reviewed_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  check (status in ('pending', 'approved', 'rejected'))
);

create table public.club_admin_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, user_id),
  check (role in ('admin', 'reviewer'))
);

create table public.user_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, club_id)
);

create table public.user_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  status text not null default 'interested',
  decision_status text not null default 'pending',
  notes text not null default '',
  essay_draft text not null default '',
  applied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, club_id),
  check (status in ('interested', 'applied', 'interview', 'decision')),
  check (decision_status in ('pending', 'accepted', 'rejected', 'waitlisted'))
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  club_id uuid references public.clubs (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (event_type in ('view', 'click', 'follow', 'apply'))
);

create index clubs_recruiting_status_idx on public.clubs (recruiting_status);
create index clubs_source_idx on public.clubs (source);

create index club_deadlines_club_id_idx on public.club_deadlines (club_id);
create index club_deadlines_deadline_at_idx on public.club_deadlines (deadline_at);
create index club_deadlines_active_deadline_idx on public.club_deadlines (is_active, deadline_at);

create index club_claims_club_id_idx on public.club_claims (club_id);
create index club_claims_user_id_idx on public.club_claims (user_id);
create index club_claims_status_idx on public.club_claims (status);

create index club_admin_memberships_user_id_idx
  on public.club_admin_memberships (user_id);

create index user_follows_club_id_idx on public.user_follows (club_id);

create index user_applications_club_id_idx on public.user_applications (club_id);
create index user_applications_status_idx on public.user_applications (status);
create index user_applications_decision_status_idx
  on public.user_applications (decision_status);

create index events_user_created_at_idx on public.events (user_id, created_at desc);
create index events_club_created_at_idx on public.events (club_id, created_at desc);
create index events_type_created_at_idx on public.events (event_type, created_at desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_clubs_updated_at
before update on public.clubs
for each row
execute function public.set_updated_at();

create trigger set_user_applications_updated_at
before update on public.user_applications
for each row
execute function public.set_updated_at();
