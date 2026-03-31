"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPortalContext } from "@/lib/portal";

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
const VALID_DECISION_STATUSES = ["pending", "accepted", "rejected", "waitlisted"] as const;

type ApplicationStatus = (typeof VALID_STATUSES)[number];
type DecisionStatus = (typeof VALID_DECISION_STATUSES)[number];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getScore(formData: FormData, key: string) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : 0;
}

export async function updateApplicantStatus(
  slug: string,
  applicationId: string,
  formData: FormData,
) {
  const { supabase, club, membership } = await getPortalContext(slug);

  if (membership.role !== "admin") {
    redirect(`/portal/${slug}`);
  }

  const rawStageId = getString(formData, "stage_id");
  const rawDecisionLabelId = getString(formData, "decision_label_id");
  const rawStatus = formData.get("status");
  const rawDecisionStatus = formData.get("decision_status");
  const notes = getString(formData, "notes");

  let status: ApplicationStatus | null = null;
  let stageId: string | null = null;

  if (rawStageId) {
    const { data: stage } = await supabase
      .from("club_pipeline_stages")
      .select("id, status_bucket")
      .eq("id", rawStageId)
      .eq("club_id", club.id)
      .maybeSingle();

    if (!stage) {
      redirect(`/portal/${slug}/applicants/${applicationId}?error=Choose+a+valid+pipeline+stage.`);
    }

    stageId = stage.id;
    status = stage.status_bucket as ApplicationStatus;
  }

  if (!status && (!rawStatus || !VALID_STATUSES.includes(rawStatus as ApplicationStatus))) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Invalid+status.`);
  }

  if (!status) {
    status = rawStatus as ApplicationStatus;
  }

  let decisionStatus: DecisionStatus = "pending";
  let decisionLabelId: string | null = null;

  if (rawDecisionLabelId) {
    const { data: decisionLabel } = await supabase
      .from("club_decision_labels")
      .select("id, decision_status")
      .eq("id", rawDecisionLabelId)
      .eq("club_id", club.id)
      .maybeSingle();

    if (!decisionLabel) {
      redirect(`/portal/${slug}/applicants/${applicationId}?error=Choose+a+valid+decision+label.`);
    }

    decisionLabelId = decisionLabel.id;
    decisionStatus = decisionLabel.decision_status as DecisionStatus;
  } else if (
    rawDecisionStatus &&
    VALID_DECISION_STATUSES.includes(rawDecisionStatus as DecisionStatus)
  ) {
    decisionStatus = rawDecisionStatus as DecisionStatus;
  }

  const { data: updated, error: updateError } = await supabase
    .from("user_applications")
    .update({
      status,
      decision_status: decisionStatus,
      stage_id: stageId,
      decision_label_id: decisionLabelId,
      notes,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .maybeSingle();

  if (updateError || !updated) {
    redirect(
      `/portal/${slug}/applicants/${applicationId}?error=${encodeURIComponent(
        updateError?.message ?? "Unable to update applicant.",
      )}`,
    );
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/applicants/${applicationId}`);
  redirect(`/portal/${slug}/applicants/${applicationId}?message=Applicant+status+updated.`);
}

export async function assignReviewer(
  slug: string,
  applicationId: string,
  formData: FormData,
) {
  const { supabase, club, membership, user } = await getPortalContext(slug);

  if (membership.role !== "admin") {
    redirect(`/portal/${slug}`);
  }

  const reviewerUserId = getString(formData, "reviewer_user_id");

  if (!reviewerUserId) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Choose+a+reviewer.`);
  }

  const { data: application } = await supabase
    .from("user_applications")
    .select("id")
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .maybeSingle();

  if (!application) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Applicant+not+found+for+this+club.`);
  }

  const { data: reviewerMembership } = await supabase
    .from("club_admin_memberships")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", reviewerUserId)
    .in("role", ["admin", "reviewer"])
    .maybeSingle();

  if (!reviewerMembership) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Reviewer+must+be+a+club+member.`);
  }

  const { error } = await supabase.from("club_reviewer_assignments").insert({
    club_id: club.id,
    application_id: applicationId,
    reviewer_user_id: reviewerUserId,
    assigned_by: user.id,
  });

  if (error) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/applicants/${applicationId}`);
  redirect(`/portal/${slug}/applicants/${applicationId}?message=Reviewer+assigned.`);
}

export async function unassignReviewer(
  slug: string,
  applicationId: string,
  assignmentId: string,
) {
  const { supabase, membership } = await getPortalContext(slug);

  if (membership.role !== "admin") {
    redirect(`/portal/${slug}`);
  }

  const { data: removed, error: removeError } = await supabase
    .from("club_reviewer_assignments")
    .delete()
    .select("id")
    .eq("id", assignmentId)
    .eq("application_id", applicationId)
    .maybeSingle();

  if (removeError || !removed) {
    redirect(
      `/portal/${slug}/applicants/${applicationId}?error=${encodeURIComponent(
        removeError?.message ?? "Reviewer assignment not found.",
      )}`,
    );
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/applicants/${applicationId}`);
  redirect(`/portal/${slug}/applicants/${applicationId}?message=Reviewer+removed.`);
}

export async function saveReviewerScorecard(
  slug: string,
  applicationId: string,
  formData: FormData,
) {
  const { supabase, club, membership, user } = await getPortalContext(slug);

  const { data: application } = await supabase
    .from("user_applications")
    .select("id")
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .maybeSingle();

  if (!application) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Applicant+not+found+for+this+club.`);
  }

  const { data: assignment } = await supabase
    .from("club_reviewer_assignments")
    .select("id")
    .eq("application_id", applicationId)
    .eq("reviewer_user_id", user.id)
    .maybeSingle();

  if (membership.role !== "admin" && !assignment) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=You+are+not+assigned+to+this+applicant.`);
  }

  const problemSolving = getScore(formData, "problem_solving");
  const codingAbility = getScore(formData, "coding_ability");
  const technicalKnowledge = getScore(formData, "technical_knowledge");
  const communication = getScore(formData, "communication");
  const notes = getString(formData, "review_notes");

  const values = [problemSolving, codingAbility, technicalKnowledge, communication];
  if (values.some((value) => value < 1 || value > 10)) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Scores+must+be+between+1+and+10.`);
  }

  const { error } = await supabase
    .from("club_application_reviews")
    .upsert(
      {
        club_id: club.id,
        application_id: applicationId,
        reviewer_user_id: user.id,
        problem_solving: problemSolving,
        coding_ability: codingAbility,
        technical_knowledge: technicalKnowledge,
        communication,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "application_id,reviewer_user_id" },
    );

  if (error) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/applicants/${applicationId}`);
  redirect(`/portal/${slug}/applicants/${applicationId}?message=Review+saved.`);
}
