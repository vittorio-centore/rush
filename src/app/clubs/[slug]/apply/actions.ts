"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getArrayAnswer,
  getTextAnswer,
  isQuestionVisible,
  type AnswerMap,
  type FormQuestion,
} from "@/lib/application-forms";
import { createEventInsert } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = FormQuestion & {
  section_id: string;
};

export async function submitNativeApplication(slug: string, formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect(`/auth?message=Sign+in+to+apply+through+Rush.`);
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("id, slug, application_mode")
    .eq("slug", slug)
    .single();

  if (!club || club.application_mode !== "native") {
    redirect(`/clubs/${slug}`);
  }

  const { data: form } = await supabase
    .from("club_application_forms")
    .select("id, status")
    .eq("club_id", club.id)
    .eq("status", "published")
    .maybeSingle();

  if (!form) {
    redirect(`/clubs/${slug}?error=This+club+is+not+accepting+native+applications+yet.`);
  }

  const { data: sections } = await supabase
    .from("club_application_form_sections")
    .select("id")
    .eq("form_id", form.id);

  const sectionIds = (sections ?? []).map((section) => section.id);
  const { data: questionsData } = sectionIds.length
    ? await supabase
        .from("club_application_form_questions")
        .select(
          "id, section_id, type, label, help_text, placeholder, is_required, position, condition_question_id, condition_operator, condition_value",
        )
        .in("section_id", sectionIds)
        .order("position")
    : { data: [] };

  const questions = (questionsData ?? []) as QuestionRow[];
  const answers: AnswerMap = {};

  for (const question of questions) {
    answers[question.id] =
      question.type === "multi_select"
        ? getArrayAnswer(formData, question.id)
        : getTextAnswer(formData, question.id);
  }

  for (const question of questions) {
    if (!isQuestionVisible(question, answers)) {
      continue;
    }

    const value = answers[question.id];
    const isEmpty =
      Array.isArray(value) ? value.length === 0 : typeof value !== "string" || value.length === 0;

    if (question.is_required && isEmpty) {
      redirect(`/clubs/${slug}/apply?error=${encodeURIComponent(`"${question.label}" is required.`)}`);
    }
  }

  const { data: existingApplication } = await supabase
    .from("user_applications")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  let applicationId = existingApplication?.id;

  if (applicationId) {
    const { error } = await supabase
      .from("user_applications")
      .update({
        status: "applied",
        decision_status: "pending",
        application_source: "native",
        applied_at: now,
        updated_at: now,
      })
      .eq("id", applicationId);

    if (error) {
      redirect(`/clubs/${slug}/apply?error=${encodeURIComponent(error.message)}`);
    }
  } else {
    const { data: application, error } = await supabase
      .from("user_applications")
      .insert({
        club_id: club.id,
        user_id: authData.user.id,
        status: "applied",
        decision_status: "pending",
        application_source: "native",
        applied_at: now,
      })
      .select("id")
      .single();

    if (error || !application) {
      redirect(`/clubs/${slug}/apply?error=${encodeURIComponent(error?.message ?? "Unable to submit application.")}`);
    }

    applicationId = application.id;
  }

  const { data: submission } = await supabase
    .from("club_application_submissions")
    .upsert(
      {
        form_id: form.id,
        club_id: club.id,
        user_id: authData.user.id,
        application_id: applicationId,
        updated_at: now,
      },
      { onConflict: "application_id" },
    )
    .select("id")
    .single();

  if (!submission) {
    redirect(`/clubs/${slug}/apply?error=Unable+to+save+application+answers.`);
  }

  await supabase
    .from("club_application_submission_answers")
    .delete()
    .eq("submission_id", submission.id);

  const answerRows = questions
    .filter((question) => isQuestionVisible(question, answers))
    .map((question) => {
      const value = answers[question.id];
      return {
        submission_id: submission.id,
        question_id: question.id,
        answer_text: Array.isArray(value) ? null : value,
        answer_values: Array.isArray(value) ? value : [],
      };
    });

  if (answerRows.length > 0) {
    const { error } = await supabase
      .from("club_application_submission_answers")
      .insert(answerRows);

    if (error) {
      redirect(`/clubs/${slug}/apply?error=${encodeURIComponent(error.message)}`);
    }
  }

  await supabase.from("events").insert([
    createEventInsert({
      userId: authData.user.id,
      clubId: club.id,
      eventType: "apply",
      metadata: {
        surface: "club_application",
        source: "native",
      },
    }),
    createEventInsert({
      userId: authData.user.id,
      clubId: club.id,
      eventType: "native_apply",
      metadata: {
        surface: "club_application",
      },
    }),
  ]);

  revalidatePath(`/clubs/${slug}`);
  revalidatePath(`/clubs/${slug}/apply`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/applications");
  redirect(`/dashboard/applications?message=Application+submitted+through+Rush.`);
}
