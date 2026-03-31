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

  const rawStatus = formData.get("status");
  const rawDecisionStatus = formData.get("decision_status");
  const notes = getString(formData, "notes");

  if (!rawStatus || !VALID_STATUSES.includes(rawStatus as ApplicationStatus)) {
    redirect(`/portal/${slug}/applicants/${applicationId}?error=Invalid+status.`);
  }

  const status = rawStatus as ApplicationStatus;
  const decisionStatus: DecisionStatus =
    rawDecisionStatus && VALID_DECISION_STATUSES.includes(rawDecisionStatus as DecisionStatus)
      ? (rawDecisionStatus as DecisionStatus)
      : "pending";

  await supabase
    .from("user_applications")
    .update({
      status,
      decision_status: decisionStatus,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("club_id", club.id);

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

  await supabase
    .from("club_reviewer_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("application_id", applicationId);

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
