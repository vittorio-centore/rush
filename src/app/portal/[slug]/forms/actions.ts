"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getPortalCapabilities,
  getPortalFeatureUnavailableMessage,
} from "@/lib/portal-features";
import { requirePortalAdmin } from "@/lib/portal";

const VALID_QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
] as const;
const VALID_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "includes",
  "not_includes",
] as const;
const VALID_FORM_STATUSES = ["draft", "published"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function revalidateFormPaths(slug: string) {
  revalidatePath(`/portal/${slug}/forms`);
  revalidatePath(`/clubs/${slug}/apply`);
  revalidatePath(`/clubs/${slug}`);
}

async function ensureFormBuilder(slug: string) {
  const capabilities = await getPortalCapabilities(slug);

  if (!capabilities.formBuilder) {
    redirect(
      `/portal/${slug}/forms?error=${encodeURIComponent(
        getPortalFeatureUnavailableMessage("formBuilder"),
      )}`,
    );
  }
}

async function getPublishValidationError(
  supabase: Awaited<ReturnType<typeof requirePortalAdmin>>["supabase"],
  formId: string | null,
) {
  if (!formId) {
    return "Add at least one section and one question before publishing.";
  }

  const { data: sectionsData } = await supabase
    .from("club_application_form_sections")
    .select("id")
    .eq("form_id", formId);

  const sectionIds = (sectionsData ?? []).map((section) => section.id);
  if (sectionIds.length === 0) {
    return "Add at least one section and one question before publishing.";
  }

  const { data: questionsData } = await supabase
    .from("club_application_form_questions")
    .select("id, type")
    .in("section_id", sectionIds);

  const questions = questionsData ?? [];
  if (questions.length === 0) {
    return "Add at least one section and one question before publishing.";
  }

  const selectQuestionIds = questions
    .filter((question) => question.type === "single_select" || question.type === "multi_select")
    .map((question) => question.id);

  if (selectQuestionIds.length === 0) {
    return null;
  }

  const { data: optionsData } = await supabase
    .from("club_application_form_options")
    .select("question_id")
    .in("question_id", selectQuestionIds);

  const optionQuestionIds = new Set((optionsData ?? []).map((option) => option.question_id));
  const missingOptions = selectQuestionIds.filter((questionId) => !optionQuestionIds.has(questionId));

  if (missingOptions.length > 0) {
    return "Every single-select and multi-select question needs at least one option before publishing.";
  }

  return null;
}

function validateCondition(
  slug: string,
  formPath: string,
  questionId: string | null,
  conditionQuestionId: string,
  conditionOperator: string,
  conditionValue: string,
) {
  if (!conditionQuestionId) {
    return {
      condition_question_id: null,
      condition_operator: null,
      condition_value: null,
    };
  }

  if (questionId && conditionQuestionId === questionId) {
    redirect(`${formPath}?error=Questions+cannot+depend+on+themselves.`);
  }

  if (
    !VALID_CONDITION_OPERATORS.includes(
      conditionOperator as (typeof VALID_CONDITION_OPERATORS)[number],
    )
  ) {
    redirect(`${formPath}?error=Choose+a+valid+condition+operator.`);
  }

  if (!conditionValue) {
    redirect(`${formPath}?error=Conditional+questions+need+a+condition+value.`);
  }

  return {
    condition_question_id: conditionQuestionId,
    condition_operator: conditionOperator,
    condition_value: conditionValue,
  };
}

export async function saveFormSettings(slug: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase, club } = await requirePortalAdmin(slug);

  const title = getString(formData, "title") || "Application form";
  const description = getString(formData, "description");
  const submitButtonText = getString(formData, "submit_button_text") || "Submit application";
  const requestedStatus = getString(formData, "status");
  const status = VALID_FORM_STATUSES.includes(requestedStatus as (typeof VALID_FORM_STATUSES)[number])
    ? requestedStatus
    : "draft";

  const { data: existingForm } = await supabase
    .from("club_application_forms")
    .select("id")
    .eq("club_id", club.id)
    .maybeSingle();

  const publishValidationError =
    status === "published"
      ? await getPublishValidationError(supabase, existingForm?.id ?? null)
      : null;
  const persistedStatus = publishValidationError ? "draft" : status;

  const { error } = await supabase
    .from("club_application_forms")
    .upsert(
      {
        club_id: club.id,
        title,
        description: description || null,
        submit_button_text: submitButtonText,
        status: persistedStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id" },
    );

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  if (publishValidationError) {
    redirect(
      `/portal/${slug}/forms?error=${encodeURIComponent(`Saved as draft. ${publishValidationError}`)}`,
    );
  }
  redirect(`/portal/${slug}/forms?message=Form+settings+saved.`);
}

export async function addSection(slug: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const formId = getString(formData, "form_id");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const position = getNumber(formData, "position");

  if (!formId || !title) {
    redirect(`/portal/${slug}/forms?error=Section+title+is+required.`);
  }

  const { error } = await supabase.from("club_application_form_sections").insert({
    form_id: formId,
    title,
    description: description || null,
    position,
  });

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Section+added.`);
}

export async function updateSection(slug: string, sectionId: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const position = getNumber(formData, "position");

  if (!title) {
    redirect(`/portal/${slug}/forms?error=Section+title+is+required.`);
  }

  const { error } = await supabase
    .from("club_application_form_sections")
    .update({
      title,
      description: description || null,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Section+updated.`);
}

export async function deleteSection(slug: string, sectionId: string) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_application_form_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Section+deleted.`);
}

export async function addQuestion(slug: string, sectionId: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const type = getString(formData, "type");
  const label = getString(formData, "label");
  const helpText = getString(formData, "help_text");
  const placeholder = getString(formData, "placeholder");
  const position = getNumber(formData, "position");
  const isRequired = getString(formData, "is_required") === "on";
  const conditionQuestionId = getString(formData, "condition_question_id");
  const conditionOperator = getString(formData, "condition_operator");
  const conditionValue = getString(formData, "condition_value");

  if (!VALID_QUESTION_TYPES.includes(type as (typeof VALID_QUESTION_TYPES)[number]) || !label) {
    redirect(`/portal/${slug}/forms?error=Question+type+and+label+are+required.`);
  }

  if (
    conditionOperator &&
    !VALID_CONDITION_OPERATORS.includes(
      conditionOperator as (typeof VALID_CONDITION_OPERATORS)[number],
    )
  ) {
    redirect(`/portal/${slug}/forms?error=Invalid+condition+operator.`);
  }

  const { error } = await supabase.from("club_application_form_questions").insert({
    section_id: sectionId,
    type,
    label,
    help_text: helpText || null,
    placeholder: placeholder || null,
    is_required: isRequired,
    position,
    ...validateCondition(
      slug,
      `/portal/${slug}/forms`,
      null,
      conditionQuestionId,
      conditionOperator,
      conditionValue,
    ),
  });

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Question+added.`);
}

export async function updateQuestion(slug: string, questionId: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const type = getString(formData, "type");
  const label = getString(formData, "label");
  const helpText = getString(formData, "help_text");
  const placeholder = getString(formData, "placeholder");
  const position = getNumber(formData, "position");
  const isRequired = getString(formData, "is_required") === "on";
  const conditionQuestionId = getString(formData, "condition_question_id");
  const conditionOperator = getString(formData, "condition_operator");
  const conditionValue = getString(formData, "condition_value");

  if (!VALID_QUESTION_TYPES.includes(type as (typeof VALID_QUESTION_TYPES)[number]) || !label) {
    redirect(`/portal/${slug}/forms?error=Question+type+and+label+are+required.`);
  }

  if (
    conditionOperator &&
    !VALID_CONDITION_OPERATORS.includes(
      conditionOperator as (typeof VALID_CONDITION_OPERATORS)[number],
    )
  ) {
    redirect(`/portal/${slug}/forms?error=Invalid+condition+operator.`);
  }

  const { error } = await supabase
    .from("club_application_form_questions")
    .update({
      type,
      label,
      help_text: helpText || null,
      placeholder: placeholder || null,
      is_required: isRequired,
      position,
      ...validateCondition(
        slug,
        `/portal/${slug}/forms`,
        questionId,
        conditionQuestionId,
        conditionOperator,
        conditionValue,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Question+updated.`);
}

export async function deleteQuestion(slug: string, questionId: string) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_application_form_questions")
    .delete()
    .eq("id", questionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Question+deleted.`);
}

export async function addOption(slug: string, questionId: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const label = getString(formData, "label");
  const value = getString(formData, "value");
  const position = getNumber(formData, "position");

  if (!label || !value) {
    redirect(`/portal/${slug}/forms?error=Option+label+and+value+are+required.`);
  }

  const { error } = await supabase.from("club_application_form_options").insert({
    question_id: questionId,
    label,
    value,
    position,
  });

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Option+added.`);
}

export async function updateOption(slug: string, optionId: string, formData: FormData) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const label = getString(formData, "label");
  const value = getString(formData, "value");
  const position = getNumber(formData, "position");

  if (!label || !value) {
    redirect(`/portal/${slug}/forms?error=Option+label+and+value+are+required.`);
  }

  const { error } = await supabase
    .from("club_application_form_options")
    .update({
      label,
      value,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", optionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Option+updated.`);
}

export async function deleteOption(slug: string, optionId: string) {
  await ensureFormBuilder(slug);
  const { supabase } = await requirePortalAdmin(slug);

  const { error } = await supabase
    .from("club_application_form_options")
    .delete()
    .eq("id", optionId);

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Option+deleted.`);
}
