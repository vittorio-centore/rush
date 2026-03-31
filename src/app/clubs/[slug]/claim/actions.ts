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
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingClaim) {
    redirect(
      `/clubs/${slug}/claim?error=You+already+have+a+pending+claim.`,
    );
  }

  await supabase.from("club_claims").insert({
    club_id: clubId,
    user_id: userId,
    status: "pending",
    message,
  });

  redirect(
    `/clubs/${slug}/claim?message=Claim+submitted.+We+will+review+it+shortly.`,
  );
}
