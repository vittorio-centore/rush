"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function followClub(clubId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const { error: followError } = await supabase
    .from("user_follows")
    .insert({ user_id: data.user.id, club_id: clubId });

  if (followError && followError.code !== "23505") {
    console.error("followClub failed:", followError.message);
    return;
  }

  if (!followError) {
    await supabase.from("events").insert({
      user_id: data.user.id,
      club_id: clubId,
      event_type: "follow",
    });
  }

  revalidatePath("/clubs/[slug]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/follows");
}

export async function unfollowClub(clubId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const { data: removedRows, error: unfollowError } = await supabase
    .from("user_follows")
    .delete()
    .select("id")
    .eq("user_id", data.user.id)
    .eq("club_id", clubId);

  if (unfollowError) {
    console.error("unfollowClub failed:", unfollowError.message);
    return;
  }

  if ((removedRows ?? []).length > 0) {
    await supabase.from("events").insert({
      user_id: data.user.id,
      club_id: clubId,
      event_type: "unfollow",
    });
  }

  revalidatePath("/clubs/[slug]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/follows");
}
