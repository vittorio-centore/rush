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

  await supabase.from("user_follows").insert({ user_id: data.user.id, club_id: clubId });
  await supabase.from("events").insert({
    user_id: data.user.id,
    club_id: clubId,
    event_type: "follow",
  });

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

  await supabase
    .from("user_follows")
    .delete()
    .eq("user_id", data.user.id)
    .eq("club_id", clubId);

  revalidatePath("/clubs/[slug]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/follows");
}
