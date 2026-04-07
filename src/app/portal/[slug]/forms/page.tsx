import Link from "next/link";

import {
  getPortalCapabilities,
  getPortalFeatureUnavailableMessage,
} from "@/lib/portal-features";
import { requirePortalAdmin } from "@/lib/portal";

import {
  addOption,
  addQuestion,
  addSection,
  deleteOption,
  deleteQuestion,
  deleteSection,
  saveFormSettings,
  updateOption,
  updateQuestion,
  updateSection,
} from "./actions";

type FormRecord = {
  id: string;
  title: string;
  description: string | null;
  submit_button_text: string;
  status: "draft" | "published";
};

type SectionRecord = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

type QuestionRecord = {
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

type OptionRecord = {
  id: string;
  question_id: string;
  label: string;
  value: string;
  position: number;
};

const QUESTION_TYPES: Array<QuestionRecord["type"]> = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
];

const CONDITION_OPERATORS = [
  { value: "", label: "No condition" },
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "includes", label: "Includes" },
  { value: "not_includes", label: "Does not include" },
];

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-[var(--transition-interact)] focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900";
const PANEL_CLASS =
  "overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]";
const SOFT_PANEL_CLASS = "rounded-[24px] border border-slate-200 bg-slate-50/80";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-50";
const DANGER_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-red-100";

export default async function PortalFormsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const capabilities = await getPortalCapabilities(slug);
  const { supabase, club } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

  if (!capabilities.formBuilder) {
    return (
      <div className="flex flex-col gap-6">
        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className={PANEL_CLASS}>
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Form builder
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Native applications are unavailable on this database.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {getPortalFeatureUnavailableMessage("formBuilder")}
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className={SOFT_PANEL_CLASS}>
              <div className="p-5">
                <p className="text-sm font-semibold text-slate-950">What to do for now</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Use an external application link in settings.</li>
                  <li>Keep club deadlines and public copy up to date.</li>
                  <li>Return here after the recruiter portal migrations are applied.</li>
                </ul>
              </div>
            </div>

            <div className={SOFT_PANEL_CLASS}>
              <div className="flex h-full flex-col justify-between gap-5 p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Recommended path</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Switch the club to an external application flow until the native form tables
                    are available.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/portal/${slug}/settings`} className={PRIMARY_BUTTON_CLASS}>
                    Open settings
                  </Link>
                  <Link href={`/portal/${slug}`} className={SECONDARY_BUTTON_CLASS}>
                    Back to applicants
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { data: formData } = await supabase
    .from("club_application_forms")
    .select("id, title, description, submit_button_text, status")
    .eq("club_id", club.id)
    .maybeSingle();

  const form = formData as FormRecord | null;

  const { data: sectionsData } = form
    ? await supabase
        .from("club_application_form_sections")
        .select("id, title, description, position")
        .eq("form_id", form.id)
        .order("position")
    : { data: [] };

  const sectionIds = (sectionsData ?? []).map((section) => section.id);

  const { data: questionsData } =
    form && sectionIds.length > 0
      ? await supabase
          .from("club_application_form_questions")
          .select(
            "id, section_id, type, label, help_text, placeholder, is_required, position, condition_question_id, condition_operator, condition_value",
          )
          .in("section_id", sectionIds)
          .order("position")
      : { data: [] };

  const { data: optionsData } =
    questionsData && questionsData.length > 0
      ? await supabase
          .from("club_application_form_options")
          .select("id, question_id, label, value, position")
          .in(
            "question_id",
            questionsData.map((question) => question.id),
          )
          .order("position")
      : { data: [] };

  const sections = (sectionsData ?? []) as SectionRecord[];
  const questions = (questionsData ?? []) as QuestionRecord[];
  const options = (optionsData ?? []) as OptionRecord[];

  const questionsBySection = new Map<string, QuestionRecord[]>();
  for (const question of questions) {
    const current = questionsBySection.get(question.section_id) ?? [];
    current.push(question);
    questionsBySection.set(question.section_id, current);
  }

  const optionsByQuestion = new Map<string, OptionRecord[]>();
  for (const option of options) {
    const current = optionsByQuestion.get(option.question_id) ?? [];
    current.push(option);
    optionsByQuestion.set(option.question_id, current);
  }

  const conditionalQuestionCount = questions.filter((question) => question.condition_question_id).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className={PANEL_CLASS}>
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Form builder
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                  Shape the native application.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep the student flow short, readable, and specific to how this club actually
                  recruits.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  {club.application_mode === "native"
                    ? "Native applications on"
                    : club.application_mode === "external"
                      ? "External applications active"
                      : "Applications disabled"}
                </span>
                <span
                  className={`rounded-full border px-3 py-1.5 ${
                    form?.status === "published"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {form?.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200/80 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Sections</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {sections.length}
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Questions</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {questions.length}
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Logic rules</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {conditionalQuestionCount}
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Answer options</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {options.length}
              </p>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-7">
            {message ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-600">
                  Form title
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={form?.title ?? "Application form"}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label
                  htmlFor="submit_button_text"
                  className="mb-1 block text-sm font-medium text-slate-600"
                >
                  Submit button text
                </label>
                <input
                  id="submit_button_text"
                  name="submit_button_text"
                  defaultValue={form?.submit_button_text ?? "Submit application"}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="lg:col-span-2">
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-medium text-slate-600"
                >
                  Form description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={form?.description ?? ""}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-600">
                  Form status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={form?.status ?? "draft"}
                  className={INPUT_CLASS}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="flex items-end">
                <button formAction={saveFormSettings.bind(null, slug)} className={PRIMARY_BUTTON_CLASS}>
                  Save form settings
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className={`${PANEL_CLASS} px-6 py-6 sm:px-7`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Builder notes
          </p>
          <div className="mt-4 space-y-4">
            <div className={SOFT_PANEL_CLASS}>
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-slate-950">Keep the first screen short</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Ask for signal, not ceremony. Move anything optional or conditional below the
                  first required questions.
                </p>
              </div>
            </div>
            <div className={SOFT_PANEL_CLASS}>
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-slate-950">Use logic sparingly</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Conditional questions work best for role-specific follow-up, not for hiding core
                  application requirements.
                </p>
              </div>
            </div>
            <div className={SOFT_PANEL_CLASS}>
              <div className="px-5 py-4">
                <p className="text-sm font-semibold text-slate-950">Match the public promise</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep the form copy aligned with the club page so students do not feel like they
                  entered a different application system.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {form ? (
        <>
          <section className={`${PANEL_CLASS} px-6 py-6 sm:px-7`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Add section
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  Break the form into clear blocks.
                </h3>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-600">
                Separate motivation, experience, and logistics so students can scan the application
                before they commit to filling it out.
              </p>
            </div>

            <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_140px_auto]">
              <input type="hidden" name="form_id" value={form.id} />
              <input name="title" placeholder="Section title" className={INPUT_CLASS} />
              <input
                name="description"
                placeholder="Section description"
                className={INPUT_CLASS}
              />
              <input
                name="position"
                type="number"
                defaultValue={sections.length}
                className={INPUT_CLASS}
              />
              <button formAction={addSection.bind(null, slug)} className={PRIMARY_BUTTON_CLASS}>
                Add section
              </button>
            </form>
          </section>

          <div className="flex flex-col gap-5">
            {sections.map((section) => {
              const sectionQuestions = questionsBySection.get(section.id) ?? [];
              return (
                <div key={section.id} className={PANEL_CLASS}>
                  <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Section
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950">
                          {section.title}
                        </h3>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                        {sectionQuestions.length} question{sectionQuestions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <form className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto_auto]">
                      <input
                        name="title"
                        defaultValue={section.title}
                        className={INPUT_CLASS}
                      />
                      <input
                        name="description"
                        defaultValue={section.description ?? ""}
                        className={INPUT_CLASS}
                      />
                      <input
                        name="position"
                        type="number"
                        defaultValue={section.position}
                        className={INPUT_CLASS}
                      />
                      <button formAction={updateSection.bind(null, slug, section.id)} className={SECONDARY_BUTTON_CLASS}>
                        Save
                      </button>
                      <button formAction={deleteSection.bind(null, slug, section.id)} className={DANGER_BUTTON_CLASS}>
                        Delete
                      </button>
                    </form>
                  </div>

                  <div className="px-6 py-6 sm:px-7">
                    <div className="flex flex-col gap-5">
                    {sectionQuestions.map((question) => {
                      const questionOptions = optionsByQuestion.get(question.id) ?? [];
                      const supportsOptions =
                        question.type === "single_select" || question.type === "multi_select";

                      return (
                        <div
                          key={question.id}
                          className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
                        >
                          <form className="grid gap-4 lg:grid-cols-2">
                            <div className="lg:col-span-2">
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Question label
                              </label>
                              <input name="label" defaultValue={question.label} className={INPUT_CLASS} />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Type
                              </label>
                              <select name="type" defaultValue={question.type} className={INPUT_CLASS}>
                                {QUESTION_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Position
                              </label>
                              <input
                                name="position"
                                type="number"
                                defaultValue={question.position}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Help text
                              </label>
                              <input
                                name="help_text"
                                defaultValue={question.help_text ?? ""}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Placeholder
                              </label>
                              <input
                                name="placeholder"
                                defaultValue={question.placeholder ?? ""}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Condition question
                              </label>
                              <select
                                name="condition_question_id"
                                defaultValue={question.condition_question_id ?? ""}
                                className={INPUT_CLASS}
                              >
                                <option value="">Always visible</option>
                                {questions
                                  .filter((candidate) => candidate.id !== question.id)
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Condition operator
                              </label>
                              <select
                                name="condition_operator"
                                defaultValue={question.condition_operator ?? ""}
                                className={INPUT_CLASS}
                              >
                                {CONDITION_OPERATORS.map((operator) => (
                                  <option key={operator.value} value={operator.value}>
                                    {operator.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Condition value
                              </label>
                              <input
                                name="condition_value"
                                defaultValue={question.condition_value ?? ""}
                                className={INPUT_CLASS}
                              />
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <input
                                name="is_required"
                                type="checkbox"
                                defaultChecked={question.is_required}
                                className="rounded border-slate-300"
                              />
                              Required
                            </label>
                            <div className="flex flex-wrap gap-3 lg:col-span-2">
                              <button formAction={updateQuestion.bind(null, slug, question.id)} className={SECONDARY_BUTTON_CLASS}>
                                Save question
                              </button>
                              <button formAction={deleteQuestion.bind(null, slug, question.id)} className={DANGER_BUTTON_CLASS}>
                                Delete question
                              </button>
                            </div>
                          </form>

                          {supportsOptions ? (
                            <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                                Options
                              </p>
                              <div className="mt-3 flex flex-col gap-3">
                                {questionOptions.map((option) => (
                                  <form
                                    key={option.id}
                                    className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto_auto]"
                                  >
                                    <input
                                      name="label"
                                      defaultValue={option.label}
                                      className={INPUT_CLASS}
                                    />
                                    <input
                                      name="value"
                                      defaultValue={option.value}
                                      className={INPUT_CLASS}
                                    />
                                    <input
                                      name="position"
                                      type="number"
                                      defaultValue={option.position}
                                      className={INPUT_CLASS}
                                    />
                                    <button formAction={updateOption.bind(null, slug, option.id)} className={SECONDARY_BUTTON_CLASS}>
                                      Save
                                    </button>
                                    <button formAction={deleteOption.bind(null, slug, option.id)} className={DANGER_BUTTON_CLASS}>
                                      Delete
                                    </button>
                                  </form>
                                ))}
                              </div>

                              <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]">
                                <input
                                  name="label"
                                  placeholder="Option label"
                                  className={INPUT_CLASS}
                                />
                                <input
                                  name="value"
                                  placeholder="Option value"
                                  className={INPUT_CLASS}
                                />
                                <input
                                  name="position"
                                  type="number"
                                  defaultValue={questionOptions.length}
                                  className={INPUT_CLASS}
                                />
                                <button formAction={addOption.bind(null, slug, question.id)} className={SECONDARY_BUTTON_CLASS}>
                                  Add option
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {/* Add question */}
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                      <h4 className="text-sm font-semibold text-slate-950">Add question</h4>
                      <form className="mt-4 grid gap-3 lg:grid-cols-2">
                        <input
                          name="label"
                          placeholder="Why do you want to join?"
                          className={INPUT_CLASS}
                        />
                        <select
                          name="type"
                          defaultValue="short_text"
                          className={INPUT_CLASS}
                        >
                          {QUESTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <input
                          name="help_text"
                          placeholder="Optional help text"
                          className={INPUT_CLASS}
                        />
                        <input
                          name="placeholder"
                          placeholder="Optional placeholder"
                          className={INPUT_CLASS}
                        />
                        <input
                          name="position"
                          type="number"
                          defaultValue={sectionQuestions.length}
                          className={INPUT_CLASS}
                        />
                        <select
                          name="condition_question_id"
                          defaultValue=""
                          className={INPUT_CLASS}
                        >
                          <option value="">Always visible</option>
                          {questions.map((question) => (
                            <option key={question.id} value={question.id}>
                              {question.label}
                            </option>
                          ))}
                        </select>
                        <select
                          name="condition_operator"
                          defaultValue=""
                          className={INPUT_CLASS}
                        >
                          {CONDITION_OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                        <input
                          name="condition_value"
                          placeholder="Condition value"
                          className={INPUT_CLASS}
                        />
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            name="is_required"
                            type="checkbox"
                            className="rounded border-slate-300"
                          />
                          Required
                        </label>
                        <div className="lg:col-span-2">
                          <button formAction={addQuestion.bind(null, slug, section.id)} className={PRIMARY_BUTTON_CLASS}>
                            Add question
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <section className={`${PANEL_CLASS} px-6 py-16 text-center sm:px-7`}>
          <div className="mx-auto max-w-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-slate-100 text-slate-700">
              <svg
                aria-hidden="true"
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.75 6.25h8.5M7.75 10.75h8.5M7.75 15.25h5.25M6.5 3.75h11A1.75 1.75 0 0119.25 5.5v13A1.75 1.75 0 0117.5 20.25h-11A1.75 1.75 0 014.75 18.5v-13A1.75 1.75 0 016.5 3.75z"
                />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">No form shell yet</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Save the form settings above to create the native application shell, then sections and
              questions will open underneath.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
