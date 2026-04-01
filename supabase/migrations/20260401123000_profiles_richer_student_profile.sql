alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists campus_involvement text,
  add column if not exists experience_summary text,
  add column if not exists headshot_url text,
  add column if not exists resume_url text,
  add column if not exists linkedin_url text,
  add column if not exists portfolio_url text;
