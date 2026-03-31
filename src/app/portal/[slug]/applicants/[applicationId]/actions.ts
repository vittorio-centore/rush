"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
const VALID_DECISION_STATUSES = ["pending", "accepted", "rejected", "waitlisted"] as const;

type ApplicationStatus = (typeof VALID_STATUSES)[number];
type DecisionStatus = (typeof VALID_DECISION_STATUSES)[number];

export async function updateApplicantStatus(
  slug: string,
  applicationId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  // Parse form values
  const rawStatus = formData.get("status");
  const rawDecisionStatus = formData.get("decision_status");
  const notes = typeof formData.get("notes") === "string"
    ? (formData.get("notes") as string).trim()
    : null;

  // Validate status
  if (!rawStatus || !VALID_STATUSES.includes(rawStatus as ApplicationStatus)) {
    redirect(`/portal/${slug}`);
  }
  const status = rawStatus as ApplicationStatus;

  // Validate decision_status (optional — fall back to pending)
  const decisionStatus: DecisionStatus =
    rawDecisionStatus && VALID_DECISION_STATUSES.includes(rawDecisionStatus as DecisionStatus)
      ? (rawDecisionStatus as DecisionStatus)
      : "pending";

  // Verify club exists
  const { data: club } = await supabase
    .from("clubs")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!club) {
    redirect(`/portal/${slug}`);
  }

  // Verify club membership
  const { data: membership } = await supabase
    .from("club_admin_memberships")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!membership) {
    redirect(`/portal/${slug}`);
  }

  // Update the application
  await supabase
    .from("user_applications")
    .update({
      status,
      decision_status: decisionStatus,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("club_id", club.id);

  revalidatePath(`/portal/${slug}`);
  redirect(`/portal/${slug}`);
}
