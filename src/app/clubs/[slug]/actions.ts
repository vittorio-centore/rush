"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { insertEvent } from "@/lib/events";
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
    await insertEvent(supabase, {
      userId: data.user.id,
      clubId,
      eventType: "follow",
      metadata: { surface: "club_page" },
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

  const { data: removedPlanningRows, error: planningDeleteError } = await supabase
    .from("user_applications")
    .delete()
    .select("id")
    .eq("user_id", data.user.id)
    .eq("club_id", clubId)
    .eq("status", "interested");

  if (planningDeleteError) {
    console.error("unfollowClub planning cleanup failed:", planningDeleteError.message);
  }

  if ((removedRows ?? []).length > 0 || (removedPlanningRows ?? []).length > 0) {
    await insertEvent(supabase, {
      userId: data.user.id,
      clubId,
      eventType: "unfollow",
      metadata: { surface: "club_page" },
    });
  }

  revalidatePath("/clubs/[slug]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/follows");
  revalidatePath("/dashboard/applications");
}
