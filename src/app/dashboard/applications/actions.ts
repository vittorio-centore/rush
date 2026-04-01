"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { insertEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildRedirect(basePath: string, message?: string, error?: string) {
  const params = new URLSearchParams();

  if (message) {
    params.set("message", message);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function addApplication(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const clubId = getString(formData, "club_id");
  const redirectTo = getString(formData, "redirect_to") || "/dashboard/applications";

  if (!clubId) {
    redirect(buildRedirect(redirectTo, undefined, "Please select a club."));
  }

  const { error } = await supabase.from("user_applications").insert({
    user_id: data.user.id,
    club_id: clubId,
    status: "interested",
    decision_status: "pending",
  });

  if (error && error.code !== "23505") {
    // 23505 = unique violation — already exists, silently ignore
    redirect(buildRedirect(redirectTo, undefined, error.message));
  }

  if (!error) {
    await insertEvent(supabase, {
      userId: data.user.id,
      clubId,
      eventType: "apply_add",
      metadata: {
        surface: redirectTo === "/dashboard/applications" ? "dashboard_applications" : "club_page",
        source: "tracked",
      },
    });
  }

  revalidatePath("/dashboard/applications");
  redirect(
    buildRedirect(
      redirectTo,
      error?.code === "23505"
        ? "This club is already in your tracker."
        : redirectTo === "/dashboard/applications"
          ? undefined
          : "Added to your tracker.",
    ),
  );
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
