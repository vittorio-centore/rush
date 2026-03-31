import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import ApplicationForm from "./ApplicationForm";
import { submitNativeApplication } from "./actions";

type FormOption = {
  id: string;
  question_id: string;
  label: string;
  value: string;
  position: number;
};

type FormQuestion = {
  id: string;
  section_id: string;
  type: "short_text" | "long_text" | "single_select" | "multi_select";
  label: string;
  help_text: string | null;
  placeholder: string | null;
  is_required: boolean;
  position: number;
  condition_question_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
};

type FormSection = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

export default async function ClubApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect(`/auth?message=Sign+in+to+apply+through+Rush.`);
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, application_mode, application_url")
    .eq("slug", slug)
    .single();

  if (!club) {
    notFound();
  }

  if (club.application_mode !== "native") {
    redirect(club.application_url ? club.application_url : `/clubs/${slug}`);
  }

  const { data: form } = await supabase
    .from("club_application_forms")
    .select("id, title, description, submit_button_text, status")
    .eq("club_id", club.id)
    .eq("status", "published")
    .maybeSingle();

  if (!form) {
    redirect(`/clubs/${slug}?error=This+club+does+not+have+a+published+Rush+application+yet.`);
  }

  const { data: sectionsData } = await supabase
    .from("club_application_form_sections")
    .select("id, title, description, position")
    .eq("form_id", form.id)
    .order("position");

  const sections = (sectionsData ?? []) as FormSection[];
  const sectionIds = sections.map((section) => section.id);

  const { data: questionsData } = sectionIds.length
    ? await supabase
        .from("club_application_form_questions")
        .select(
          "id, section_id, type, label, help_text, placeholder, is_required, position, condition_question_id, condition_operator, condition_value",
        )
        .in("section_id", sectionIds)
        .order("position")
    : { data: [] };

  const questions = (questionsData ?? []) as FormQuestion[];
  const questionIds = questions.map((question) => question.id);

  const { data: optionsData } = questionIds.length
    ? await supabase
        .from("club_application_form_options")
        .select("id, question_id, label, value, position")
        .in("question_id", questionIds)
        .order("position")
    : { data: [] };

  const options = (optionsData ?? []) as FormOption[];

  const { data: existingApplication } = await supabase
    .from("user_applications")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const { data: existingSubmission } = existingApplication
    ? await supabase
        .from("club_application_submissions")
        .select("id")
        .eq("application_id", existingApplication.id)
        .maybeSingle()
    : { data: null };

  const { data: existingAnswersData } = existingSubmission
    ? await supabase
        .from("club_application_submission_answers")
        .select("question_id, answer_text, answer_values")
        .eq("submission_id", existingSubmission.id)
    : { data: [] };

  const initialAnswers = Object.fromEntries(
    (existingAnswersData ?? []).map((answer) => [
      answer.question_id,
      Array.isArray(answer.answer_values) && answer.answer_values.length > 0
        ? answer.answer_values
        : answer.answer_text ?? "",
    ]),
  );

  const optionsByQuestion = new Map<string, FormOption[]>();
  for (const option of options) {
    const current = optionsByQuestion.get(option.question_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.question_id, current);
  }

  const sectionsWithQuestions = sections.map((section) => ({
    ...section,
    questions: questions
      .filter((question) => question.section_id === section.id)
      .map((question) => ({
        ...question,
        options: optionsByQuestion.get(question.id) ?? [],
      })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12 sm:px-10 lg:px-12">
      <div>
        <Link
          href={`/clubs/${slug}`}
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← Back to {club.name}
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{form.title}</h1>
        {form.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">{form.description}</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <ApplicationForm
        sections={sectionsWithQuestions}
        initialAnswers={initialAnswers}
        submitButtonText={form.submit_button_text}
        formAction={submitNativeApplication.bind(null, slug)}
      />
    </main>
  );
}
