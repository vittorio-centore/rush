"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
type ApplicationStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string): value is ApplicationStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

export async function updateApplication(
  applicationId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const status = getString(formData, "status");
  const decisionStatus = getString(formData, "decision_status") || "pending";
  const notes = getString(formData, "notes");
  const essayDraft = getString(formData, "essay_draft");

  if (!isValidStatus(status)) {
    redirect(
      `/dashboard/applications/${applicationId}?error=${encodeURIComponent("Invalid status value.")}`,
    );
  }

  // Fetch current row to check applied_at
  const { data: current, error: fetchError } = await supabase
    .from("user_applications")
    .select("applied_at")
    .eq("id", applicationId)
    .eq("user_id", authData.user.id)
    .single();

  if (fetchError || !current) {
    redirect("/dashboard/applications?error=Application not found.");
  }

  const updatePayload: Record<string, unknown> = {
    status,
    decision_status: decisionStatus,
    notes,
    essay_draft: essayDraft,
    updated_at: new Date().toISOString(),
  };

  // Set applied_at only when transitioning to 'applied' for the first time
  if (status === "applied" && !current.applied_at) {
    updatePayload.applied_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("user_applications")
    .update(updatePayload)
    .eq("id", applicationId)
    .eq("user_id", authData.user.id);

  if (error) {
    redirect(
      `/dashboard/applications/${applicationId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}

export async function deleteApplication(formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
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
    .eq("user_id", authData.user.id);

  if (error) {
    redirect(
      `/dashboard/applications?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}
