"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitClaim(slug: string, formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const userId = data.user.id;
  const message = getString(formData, "message");

  if (message.length < 20) {
    redirect(
      `/clubs/${slug}/claim?error=Please+provide+at+least+20+characters+describing+your+role.`,
    );
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .eq("slug", slug)
    .single();

  if (clubError || !club) {
    redirect(`/clubs/${slug}/claim?error=Club+not+found.`);
  }

  const clubId = club.id;

  const { data: existingClaim } = await supabase
    .from("club_claims")
    .select("id, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingClaim?.status === "pending") {
    redirect(
      `/clubs/${slug}/claim?error=You+already+have+a+pending+claim.`,
    );
  }

  if (existingClaim?.status === "approved") {
    redirect(
      `/clubs/${slug}/claim?error=You+already+manage+this+club.`,
    );
  }

  const { error: insertError } = await supabase.from("club_claims").insert({
    club_id: clubId,
    user_id: userId,
    status: "pending",
    message,
  });

  if (insertError) {
    redirect(
      `/clubs/${slug}/claim?error=${encodeURIComponent(insertError.message)}`,
    );
  }

  redirect(
    existingClaim?.status === "rejected"
      ? `/clubs/${slug}/claim?message=Claim+resubmitted.+We+will+review+it+shortly.`
      : `/clubs/${slug}/claim?message=Claim+submitted.+We+will+review+it+shortly.`,
  );
}
