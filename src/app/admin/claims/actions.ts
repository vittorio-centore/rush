"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/platform-admin";

async function loadClaimForReview(claimId: string) {
  const { supabase } = await requirePlatformAdmin();

  const { data: claim, error } = await supabase
    .from("club_claims")
    .select("id, club_id, user_id, status, clubs(slug)")
    .eq("id", claimId)
    .maybeSingle();

  if (error || !claim) {
    redirect(`/admin/claims?error=${encodeURIComponent("Claim not found.")}`);
  }

  const clubRecord = Array.isArray(claim.clubs) ? claim.clubs[0] : claim.clubs;

  return {
    supabase,
    claim: {
      id: claim.id,
      club_id: claim.club_id,
      user_id: claim.user_id,
      status: claim.status,
      slug: clubRecord?.slug ?? null,
    },
  };
}

export async function approveClaim(claimId: string) {
  const { user } = await requirePlatformAdmin();
  const { supabase, claim } = await loadClaimForReview(claimId);

  if (claim.status === "approved") {
    redirect("/admin/claims?message=Claim+was+already+approved.");
  }

  const reviewedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("club_claims")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", claim.id);

  if (updateError) {
    redirect(`/admin/claims?error=${encodeURIComponent(updateError.message)}`);
  }

  const { error: membershipError } = await supabase.from("club_admin_memberships").upsert(
    {
      club_id: claim.club_id,
      user_id: claim.user_id,
      role: "admin",
    },
    { onConflict: "club_id,user_id" },
  );

  if (membershipError) {
    redirect(`/admin/claims?error=${encodeURIComponent(membershipError.message)}`);
  }

  revalidatePath("/admin/claims");

  if (claim.slug) {
    revalidatePath(`/clubs/${claim.slug}/claim`);
    revalidatePath(`/portal/${claim.slug}`);
    revalidatePath(`/portal/${claim.slug}/settings`);
  }

  redirect("/admin/claims?message=Claim+approved.+Club+admin+access+granted.");
}

export async function rejectClaim(claimId: string) {
  const { user } = await requirePlatformAdmin();
  const { supabase, claim } = await loadClaimForReview(claimId);

  if (claim.status === "rejected") {
    redirect("/admin/claims?message=Claim+was+already+rejected.");
  }

  const { error } = await supabase
    .from("club_claims")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claim.id);

  if (error) {
    redirect(`/admin/claims?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/claims");

  if (claim.slug) {
    revalidatePath(`/clubs/${claim.slug}/claim`);
  }

  redirect("/admin/claims?message=Claim+rejected.");
}
