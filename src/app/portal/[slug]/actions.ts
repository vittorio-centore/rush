"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPortalContext } from "@/lib/portal";

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
const VALID_DECISIONS = ["pending", "accepted", "rejected", "waitlisted"] as const;

export async function bulkUpdateApplicants(slug: string, formData: FormData) {
  const { supabase, club, membership } = await getPortalContext(slug);

  if (membership.role !== "admin") {
    redirect(`/portal/${slug}`);
  }

  const applicationIds = formData
    .getAll("application_ids")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  const status = formData.get("status");
  const decisionStatus = formData.get("decision_status");

  if (applicationIds.length === 0) {
    redirect(`/portal/${slug}?error=Select+at+least+one+applicant.`);
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof status === "string" && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    updatePayload.status = status;
  }

  if (
    typeof decisionStatus === "string" &&
    VALID_DECISIONS.includes(decisionStatus as (typeof VALID_DECISIONS)[number])
  ) {
    updatePayload.decision_status = decisionStatus;
  }

  const { error } = await supabase
    .from("user_applications")
    .update(updatePayload)
    .eq("club_id", club.id)
    .in("id", applicationIds);

  if (error) {
    redirect(`/portal/${slug}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}`);
  redirect(`/portal/${slug}?message=Applicants+updated.`);
}
