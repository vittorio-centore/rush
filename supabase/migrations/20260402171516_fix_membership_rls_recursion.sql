create or replace function public.is_club_admin(
  p_club_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = p_club_id
      and cam.user_id = p_user_id
      and cam.role = 'admin'
  );
$$;

revoke all on function public.is_club_admin(uuid, uuid) from public;
grant execute on function public.is_club_admin(uuid, uuid) to authenticated;
grant execute on function public.is_club_admin(uuid, uuid) to service_role;

drop policy if exists "Club admins can view memberships for their clubs"
  on public.club_admin_memberships;

create policy "Club admins can view memberships for their clubs"
on public.club_admin_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_club_admin(public.club_admin_memberships.club_id, auth.uid())
);
