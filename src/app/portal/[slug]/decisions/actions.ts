"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DECISION_TEMPLATES,
  type ColorToken,
} from "@/lib/recruiter-decisions";
import { requirePortalAdmin } from "@/lib/portal";

const VALID_STATUSES = ["interested", "applied", "interview", "decision"] as const;
const VALID_DECISIONS = ["pending", "accepted", "rejected", "waitlisted"] as const;
const VALID_COLORS = ["slate", "blue", "amber", "green", "rose", "violet"] as const;
const VALID_SORTS = ["weighted_score_desc", "applied_at_desc", "name_asc"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string, fallback = 0) {
  const raw = getString(formData, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildRedirect(slug: string, message?: string, error?: string) {
  const params = new URLSearchParams();
  if (message) {
    params.set("message", message);
  }
  if (error) {
    params.set("error", error);
  }
  const query = params.toString();
  return query ? `/portal/${slug}/decisions?${query}` : `/portal/${slug}/decisions`;
}

function revalidateDecisionPaths(slug: string) {
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/applicants`);
  revalidatePath(`/portal/${slug}/decisions`);
}

export async function applyDecisionTemplate(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);
  const templateKey = getString(formData, "template_key");
  const template = DECISION_TEMPLATES.find((item) => item.key === templateKey);

  if (!template) {
    redirect(buildRedirect(slug, undefined, "Choose a valid template."));
  }

  const now = new Date().toISOString();

  await supabase.from("club_pipeline_stages").delete().eq("club_id", club.id);
  await supabase.from("club_decision_labels").delete().eq("club_id", club.id);

  const { error: stagesError } = await supabase.from("club_pipeline_stages").insert(
    template.stages.map((stage) => ({
      club_id: club.id,
      key: stage.key,
      label: stage.label,
      status_bucket: stage.status_bucket,
      color_token: stage.color_token,
      position: stage.position,
      updated_at: now,
    })),
  );

  if (stagesError) {
    redirect(buildRedirect(slug, undefined, stagesError.message));
  }

  const { error: labelsError } = await supabase.from("club_decision_labels").insert(
    template.decision_labels.map((label) => ({
      club_id: club.id,
      key: label.key,
      label: label.label,
      decision_status: label.decision_status,
      color_token: label.color_token,
      position: label.position,
      updated_at: now,
    })),
  );

  if (labelsError) {
    redirect(buildRedirect(slug, undefined, labelsError.message));
  }

  const { error: settingsError } = await supabase.from("club_decision_settings").upsert(
    {
      club_id: club.id,
      target_acceptances: template.target_acceptances,
      waitlist_target: template.waitlist_target,
      weight_problem_solving: template.weights.problem_solving,
      weight_coding_ability: template.weights.coding_ability,
      weight_technical_knowledge: template.weights.technical_knowledge,
      weight_communication: template.weights.communication,
      updated_at: now,
    },
    { onConflict: "club_id" },
  );

  if (settingsError) {
    redirect(buildRedirect(slug, undefined, settingsError.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, `${template.name} applied.`));
}

export async function saveDecisionSettings(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const targetAcceptances = Math.max(0, getNumber(formData, "target_acceptances"));
  const waitlistTarget = Math.max(0, getNumber(formData, "waitlist_target"));
  const weightProblemSolving = Math.max(1, getNumber(formData, "weight_problem_solving", 1));
  const weightCodingAbility = Math.max(1, getNumber(formData, "weight_coding_ability", 1));
  const weightTechnicalKnowledge = Math.max(
    1,
    getNumber(formData, "weight_technical_knowledge", 1),
  );
  const weightCommunication = Math.max(1, getNumber(formData, "weight_communication", 1));

  const { error } = await supabase.from("club_decision_settings").upsert(
    {
      club_id: club.id,
      target_acceptances: targetAcceptances,
      waitlist_target: waitlistTarget,
      weight_problem_solving: weightProblemSolving,
      weight_coding_ability: weightCodingAbility,
      weight_technical_knowledge: weightTechnicalKnowledge,
      weight_communication: weightCommunication,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "club_id" },
  );

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Decision settings saved."));
}

export async function addPipelineStage(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const key = getString(formData, "key");
  const label = getString(formData, "label");
  const statusBucket = getString(formData, "status_bucket");
  const colorToken = getString(formData, "color_token");
  const position = Math.max(0, getNumber(formData, "position"));

  if (!key || !label) {
    redirect(buildRedirect(slug, undefined, "Stage key and label are required."));
  }

  if (!VALID_STATUSES.includes(statusBucket as (typeof VALID_STATUSES)[number])) {
    redirect(buildRedirect(slug, undefined, "Choose a valid stage bucket."));
  }

  if (!VALID_COLORS.includes(colorToken as ColorToken)) {
    redirect(buildRedirect(slug, undefined, "Choose a valid stage color."));
  }

  const { error } = await supabase.from("club_pipeline_stages").insert({
    club_id: club.id,
    key,
    label,
    status_bucket: statusBucket,
    color_token: colorToken,
    position,
  });

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Pipeline stage added."));
}

export async function updatePipelineStage(slug: string, stageId: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const key = getString(formData, "key");
  const label = getString(formData, "label");
  const statusBucket = getString(formData, "status_bucket");
  const colorToken = getString(formData, "color_token");
  const position = Math.max(0, getNumber(formData, "position"));

  if (!key || !label) {
    redirect(buildRedirect(slug, undefined, "Stage key and label are required."));
  }

  if (!VALID_STATUSES.includes(statusBucket as (typeof VALID_STATUSES)[number])) {
    redirect(buildRedirect(slug, undefined, "Choose a valid stage bucket."));
  }

  if (!VALID_COLORS.includes(colorToken as ColorToken)) {
    redirect(buildRedirect(slug, undefined, "Choose a valid stage color."));
  }

  const { error } = await supabase
    .from("club_pipeline_stages")
    .update({
      key,
      label,
      status_bucket: statusBucket,
      color_token: colorToken,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stageId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Pipeline stage updated."));
}

export async function deletePipelineStage(slug: string, stageId: string) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_pipeline_stages")
    .delete()
    .eq("id", stageId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Pipeline stage deleted."));
}

export async function addDecisionLabel(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const key = getString(formData, "key");
  const label = getString(formData, "label");
  const decisionStatus = getString(formData, "decision_status");
  const colorToken = getString(formData, "color_token");
  const position = Math.max(0, getNumber(formData, "position"));

  if (!key || !label) {
    redirect(buildRedirect(slug, undefined, "Decision key and label are required."));
  }

  if (!VALID_DECISIONS.includes(decisionStatus as (typeof VALID_DECISIONS)[number])) {
    redirect(buildRedirect(slug, undefined, "Choose a valid decision status."));
  }

  if (!VALID_COLORS.includes(colorToken as ColorToken)) {
    redirect(buildRedirect(slug, undefined, "Choose a valid label color."));
  }

  const { error } = await supabase.from("club_decision_labels").insert({
    club_id: club.id,
    key,
    label,
    decision_status: decisionStatus,
    color_token: colorToken,
    position,
  });

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Decision label added."));
}

export async function updateDecisionLabel(slug: string, labelId: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const key = getString(formData, "key");
  const label = getString(formData, "label");
  const decisionStatus = getString(formData, "decision_status");
  const colorToken = getString(formData, "color_token");
  const position = Math.max(0, getNumber(formData, "position"));

  if (!key || !label) {
    redirect(buildRedirect(slug, undefined, "Decision key and label are required."));
  }

  if (!VALID_DECISIONS.includes(decisionStatus as (typeof VALID_DECISIONS)[number])) {
    redirect(buildRedirect(slug, undefined, "Choose a valid decision status."));
  }

  if (!VALID_COLORS.includes(colorToken as ColorToken)) {
    redirect(buildRedirect(slug, undefined, "Choose a valid label color."));
  }

  const { error } = await supabase
    .from("club_decision_labels")
    .update({
      key,
      label,
      decision_status: decisionStatus,
      color_token: colorToken,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", labelId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Decision label updated."));
}

export async function deleteDecisionLabel(slug: string, labelId: string) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_decision_labels")
    .delete()
    .eq("id", labelId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Decision label deleted."));
}

export async function saveRecruiterView(slug: string, formData: FormData) {
  const { supabase, club, user } = await requirePortalAdmin(slug);

  const name = getString(formData, "name");
  const stageId = getString(formData, "stage_id");
  const decisionStatus = getString(formData, "decision_status");
  const minimumScore = Math.max(0, getNumber(formData, "minimum_score"));
  const showOnlyUnreviewed = getString(formData, "show_only_unreviewed") === "on";
  const sort = getString(formData, "sort");
  const position = Math.max(0, getNumber(formData, "position"));

  if (!name) {
    redirect(buildRedirect(slug, undefined, "Saved view name is required."));
  }

  if (sort && !VALID_SORTS.includes(sort as (typeof VALID_SORTS)[number])) {
    redirect(buildRedirect(slug, undefined, "Choose a valid sort order."));
  }

  const { error } = await supabase.from("club_saved_recruiter_views").insert({
    club_id: club.id,
    created_by: user.id,
    name,
    position,
    filters: {
      stage_id: stageId || null,
      decision_status: decisionStatus || null,
      minimum_score: minimumScore || null,
      show_only_unreviewed: showOnlyUnreviewed,
      sort: sort || "weighted_score_desc",
    },
  });

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Saved view added."));
}

export async function deleteRecruiterView(slug: string, viewId: string) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_saved_recruiter_views")
    .delete()
    .eq("id", viewId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Saved view deleted."));
}

export async function updateStageRelease(slug: string, stageId: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);
  const isReleased = formData.get("is_released") === "true";

  const { error } = await supabase
    .from("club_pipeline_stages")
    .update({ is_released: isReleased })
    .eq("id", stageId)
    .eq("club_id", club.id);

  if (error) {
    redirect(buildRedirect(slug, undefined, error.message));
  }

  revalidateDecisionPaths(slug);
  redirect(buildRedirect(slug, "Stage visibility updated."));
}
