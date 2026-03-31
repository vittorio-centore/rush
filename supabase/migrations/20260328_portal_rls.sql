-- Replace the narrow profiles SELECT policy with one that also covers club admins
DROP POLICY IF EXISTS "Profiles are viewable by their owner" ON public.profiles;
DROP POLICY IF EXISTS "Club admins can view applicant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner or club admins" ON public.profiles;

CREATE POLICY "Profiles are viewable by owner or club admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_applications ua
    JOIN public.club_admin_memberships cam ON cam.club_id = ua.club_id
    WHERE ua.user_id = profiles.id
      AND cam.user_id = auth.uid()
  )
);

-- Allow club admins to view applications for their clubs
DROP POLICY IF EXISTS "Club admins can view applications for their clubs" ON public.user_applications;

CREATE POLICY "Club admins can view applications for their clubs"
ON public.user_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_admin_memberships cam
    WHERE cam.club_id = user_applications.club_id
      AND cam.user_id = auth.uid()
  )
);

-- Allow club admins to update applications for their clubs
DROP POLICY IF EXISTS "Club admins can update applications for their clubs" ON public.user_applications;

CREATE POLICY "Club admins can update applications for their clubs"
ON public.user_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.club_admin_memberships cam
    WHERE cam.club_id = user_applications.club_id
      AND cam.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_admin_memberships cam
    WHERE cam.club_id = user_applications.club_id
      AND cam.user_id = auth.uid()
  )
);
