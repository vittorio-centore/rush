create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_deadlines enable row level security;
alter table public.club_claims enable row level security;
alter table public.club_admin_memberships enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_applications enable row level security;
alter table public.events enable row level security;

create policy "Profiles are viewable by their owner"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Profiles can be inserted by their owner"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Profiles can be updated by their owner"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Clubs are viewable by everyone"
on public.clubs
for select
to anon, authenticated
using (true);

create policy "Club deadlines are viewable by everyone"
on public.club_deadlines
for select
to anon, authenticated
using (true);

create policy "Claims are viewable by their submitter"
on public.club_claims
for select
to authenticated
using (user_id = auth.uid());

create policy "Claims can be submitted by authenticated users"
on public.club_claims
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Memberships are viewable by the member"
on public.club_admin_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy "Follows are viewable by their owner"
on public.user_follows
for select
to authenticated
using (user_id = auth.uid());

create policy "Follows can be created by their owner"
on public.user_follows
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Follows can be deleted by their owner"
on public.user_follows
for delete
to authenticated
using (user_id = auth.uid());

create policy "Applications are viewable by their owner"
on public.user_applications
for select
to authenticated
using (user_id = auth.uid());

create policy "Applications can be created by their owner"
on public.user_applications
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Applications can be updated by their owner"
on public.user_applications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Applications can be deleted by their owner"
on public.user_applications
for delete
to authenticated
using (user_id = auth.uid());

create policy "Events are viewable by their owner"
on public.events
for select
to authenticated
using (user_id = auth.uid());

create policy "Events can be created by their owner"
on public.events
for insert
to authenticated
with check (user_id = auth.uid());
