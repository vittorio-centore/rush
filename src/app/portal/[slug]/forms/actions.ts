"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function saveFormSettings(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

  const title = getString(formData, "title") || "Application form";
  const description = getString(formData, "description");
  const submitButtonText = getString(formData, "submit_button_text") || "Submit application";
  const status = getString(formData, "status") || "draft";

  const { error } = await supabase
    .from("club_application_forms")
    .upsert(
      {
        club_id: club.id,
        title,
        description: description || null,
        submit_button_text: submitButtonText,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id" },
    );

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Form+settings+saved.`);
}

export async function addSection(slug: string, formData: FormData) {
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
    condition_question_id: conditionQuestionId || null,
    condition_operator: conditionOperator || null,
    condition_value: conditionValue || null,
  });

  if (error) {
    redirect(`/portal/${slug}/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidateFormPaths(slug);
  redirect(`/portal/${slug}/forms?message=Question+added.`);
}

export async function updateQuestion(slug: string, questionId: string, formData: FormData) {
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

  const { error } = await supabase
    .from("club_application_form_questions")
    .update({
      type,
      label,
      help_text: helpText || null,
      placeholder: placeholder || null,
      is_required: isRequired,
      position,
      condition_question_id: conditionQuestionId || null,
      condition_operator: conditionOperator || null,
      condition_value: conditionValue || null,
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
