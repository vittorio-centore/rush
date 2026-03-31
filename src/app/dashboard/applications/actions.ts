"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addApplication(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const clubId = getString(formData, "club_id");

  if (!clubId) {
    redirect("/dashboard/applications?error=Please select a club.");
  }

  const { error } = await supabase.from("user_applications").insert({
    user_id: data.user.id,
    club_id: clubId,
    status: "interested",
    decision_status: "pending",
  });

  if (error && error.code !== "23505") {
    // 23505 = unique violation — already exists, silently ignore
    redirect(
      `/dashboard/applications?error=${encodeURIComponent(error.message)}`,
    );
  }

  await supabase.from("events").insert({
    user_id: data.user.id,
    club_id: clubId,
    event_type: "apply",
    metadata: { source: "tracked" },
  });

  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}

export async function deleteApplication(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const applicationId = getString(formData, "application_id");

  if (!applicationId) {
    redirect("/dashboard/applications?error=Missing application ID.");
  }

  const { error } = await supabase
    .from("user_applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", data.user.id);

  if (error) {
    redirect(
      `/dashboard/applications?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}
