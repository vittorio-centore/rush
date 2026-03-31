-- approve_claim: atomically approve a club claim and create admin membership
CREATE OR REPLACE FUNCTION public.approve_claim(claim_id uuid, admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_club_id uuid;
  v_user_id uuid;
BEGIN
  SELECT club_id, user_id INTO v_club_id, v_user_id
  FROM public.club_claims
  WHERE id = claim_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found: %', claim_id;
  END IF;

  UPDATE public.club_claims
  SET status = 'approved', reviewed_by = admin_user_id
  WHERE id = claim_id;

  INSERT INTO public.club_admin_memberships (club_id, user_id, role)
  VALUES (v_club_id, v_user_id, 'admin')
  ON CONFLICT (club_id, user_id) DO NOTHING;
END;
$$;
