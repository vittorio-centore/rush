"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getPortalCapabilities,
  getPortalFeatureUnavailableMessage,
} from "@/lib/portal-features";
import { getPortalContext } from "@/lib/portal";

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
const VALID_DECISIONS = ["pending", "accepted", "rejected", "waitlisted"] as const;

function buildRedirectTarget(basePath: string, message?: string, error?: string) {
  const [pathname, search = ""] = basePath.split("?");
  const params = new URLSearchParams(search);

  if (message) {
    params.set("message", message);
  } else {
    params.delete("message");
  }

  if (error) {
    params.set("error", error);
  } else {
    params.delete("error");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function bulkUpdateApplicants(slug: string, formData: FormData) {
  const { supabase, club, membership } = await getPortalContext(slug);
  const capabilities = await getPortalCapabilities(slug);

  if (membership.role !== "admin") {
    redirect(`/portal/${slug}`);
  }

  const applicationIds = formData
    .getAll("application_ids")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  const redirectTo =
    typeof formData.get("redirect_to") === "string" && String(formData.get("redirect_to")).trim()
      ? String(formData.get("redirect_to")).trim()
      : `/portal/${slug}`;
  const status = formData.get("status");
  const decisionStatus = formData.get("decision_status");
  const stageId =
    typeof formData.get("stage_id") === "string" ? String(formData.get("stage_id")).trim() : "";
  const decisionLabelId =
    typeof formData.get("decision_label_id") === "string"
      ? String(formData.get("decision_label_id")).trim()
      : "";

  if (applicationIds.length === 0) {
    redirect(buildRedirectTarget(redirectTo, undefined, "Select at least one applicant."));
  }

  if ((stageId || decisionLabelId) && !capabilities.decisionWorkspace) {
    redirect(
      buildRedirectTarget(
        redirectTo,
        undefined,
        getPortalFeatureUnavailableMessage("decisionWorkspace"),
      ),
    );
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (stageId) {
    const { data: stage } = await supabase
      .from("club_pipeline_stages")
      .select("id, status_bucket")
      .eq("id", stageId)
      .eq("club_id", club.id)
      .maybeSingle();

    if (!stage) {
      redirect(buildRedirectTarget(redirectTo, undefined, "Choose a valid pipeline stage."));
    }

    updatePayload.stage_id = stage.id;
    updatePayload.status = stage.status_bucket;
  }

  if (typeof status === "string" && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    updatePayload.status = status;
    if (!stageId) {
      updatePayload.stage_id = null;
    }
  }

  if (decisionLabelId) {
    const { data: decisionLabel } = await supabase
      .from("club_decision_labels")
      .select("id, decision_status")
      .eq("id", decisionLabelId)
      .eq("club_id", club.id)
      .maybeSingle();

    if (!decisionLabel) {
      redirect(buildRedirectTarget(redirectTo, undefined, "Choose a valid decision label."));
    }

    updatePayload.decision_label_id = decisionLabel.id;
    updatePayload.decision_status = decisionLabel.decision_status;
  }

  if (
    typeof decisionStatus === "string" &&
    VALID_DECISIONS.includes(decisionStatus as (typeof VALID_DECISIONS)[number])
  ) {
    updatePayload.decision_status = decisionStatus;
    if (!decisionLabelId) {
      updatePayload.decision_label_id = null;
    }
  }

  if (Object.keys(updatePayload).length === 1) {
    redirect(buildRedirectTarget(redirectTo, undefined, "Choose at least one field to update."));
  }

  const { error } = await supabase
    .from("user_applications")
    .update(updatePayload)
    .eq("club_id", club.id)
    .in("id", applicationIds);

  if (error) {
    redirect(buildRedirectTarget(redirectTo, undefined, error.message));
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/decisions`);
  redirect(buildRedirectTarget(redirectTo, "Applicants updated."));
}
