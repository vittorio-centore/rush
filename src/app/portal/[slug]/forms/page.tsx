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
  "rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action";

export default async function PortalFormsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { supabase, club } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

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

  return (
    <div className="flex flex-col gap-6">
      {/* Form settings card */}
      <div className="rounded-card border border-border bg-white p-6 shadow-card">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-ink">Native application form</h2>
            {form ? (
              <span
                className={`inline-flex items-center rounded-control px-2.5 py-0.5 text-xs font-medium ${
                  form.status === "published"
                    ? "bg-brand-oxblood-soft text-brand-oxblood"
                    : "bg-slate-100 text-status-closed"
                }`}
              >
                {form.status === "published" ? "Published" : "Draft"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Build the Rush-hosted form students see when this club uses native applications.
          </p>
        </div>

        {message ? (
          <div className="mb-4 rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
            {error}
          </div>
        ) : null}

        <form className="grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-muted">
              Form title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={form?.title ?? "Application form"}
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>
          <div>
            <label
              htmlFor="submit_button_text"
              className="mb-1 block text-sm font-medium text-ink-muted"
            >
              Submit button text
            </label>
            <input
              id="submit_button_text"
              name="submit_button_text"
              defaultValue={form?.submit_button_text ?? "Submit application"}
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>
          <div className="lg:col-span-2">
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-ink-muted"
            >
              Form description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={form?.description ?? ""}
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-medium text-ink-muted">
              Form status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={form?.status ?? "draft"}
              className={`w-full ${INPUT_CLASS}`}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <button
              formAction={saveFormSettings.bind(null, slug)}
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
            >
              Save form settings
            </button>
          </div>
        </form>
      </div>

      {!form ? null : (
        <>
          {/* Add section */}
          <div className="rounded-card border border-border bg-white p-5 shadow-card">
            <h3 className="mb-4 text-sm font-semibold text-ink">Add section</h3>
            <form className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]">
              <input type="hidden" name="form_id" value={form.id} />
              <input
                name="title"
                placeholder="Section title"
                className={INPUT_CLASS}
              />
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
              <button
                formAction={addSection.bind(null, slug)}
                className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
              >
                Add section
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-5">
            {sections.map((section) => {
              const sectionQuestions = questionsBySection.get(section.id) ?? [];
              return (
                <div
                  key={section.id}
                  className="rounded-card border border-border bg-white p-6 shadow-card"
                >
                  <div className="flex flex-col gap-4 border-b border-border pb-5">
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
                      <button
                        formAction={updateSection.bind(null, slug, section.id)}
                        className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
                      >
                        Save
                      </button>
                      <button
                        formAction={deleteSection.bind(null, slug, section.id)}
                        className="inline-flex items-center justify-center rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-status-rejected transition-colors hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  <div className="mt-5 flex flex-col gap-5">
                    {sectionQuestions.map((question) => {
                      const questionOptions = optionsByQuestion.get(question.id) ?? [];
                      const supportsOptions =
                        question.type === "single_select" || question.type === "multi_select";

                      return (
                        <div
                          key={question.id}
                          className="rounded-control border border-border bg-surface-cool p-4"
                        >
                          <form className="grid gap-4 lg:grid-cols-2">
                            <div className="lg:col-span-2">
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Question label
                              </label>
                              <input
                                name="label"
                                defaultValue={question.label}
                                className={`w-full ${INPUT_CLASS}`}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Type
                              </label>
                              <select
                                name="type"
                                defaultValue={question.type}
                                className={`w-full ${INPUT_CLASS}`}
                              >
                                {QUESTION_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Position
                              </label>
                              <input
                                name="position"
                                type="number"
                                defaultValue={question.position}
                                className={`w-full ${INPUT_CLASS}`}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Help text
                              </label>
                              <input
                                name="help_text"
                                defaultValue={question.help_text ?? ""}
                                className={`w-full ${INPUT_CLASS}`}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Placeholder
                              </label>
                              <input
                                name="placeholder"
                                defaultValue={question.placeholder ?? ""}
                                className={`w-full ${INPUT_CLASS}`}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Condition question
                              </label>
                              <select
                                name="condition_question_id"
                                defaultValue={question.condition_question_id ?? ""}
                                className={`w-full ${INPUT_CLASS}`}
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
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Condition operator
                              </label>
                              <select
                                name="condition_operator"
                                defaultValue={question.condition_operator ?? ""}
                                className={`w-full ${INPUT_CLASS}`}
                              >
                                {CONDITION_OPERATORS.map((operator) => (
                                  <option key={operator.value} value={operator.value}>
                                    {operator.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                                Condition value
                              </label>
                              <input
                                name="condition_value"
                                defaultValue={question.condition_value ?? ""}
                                className={`w-full ${INPUT_CLASS}`}
                              />
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-ink">
                              <input
                                name="is_required"
                                type="checkbox"
                                defaultChecked={question.is_required}
                                className="rounded border-border"
                              />
                              Required
                            </label>
                            <div className="flex flex-wrap gap-3 lg:col-span-2">
                              <button
                                formAction={updateQuestion.bind(null, slug, question.id)}
                                className="inline-flex items-center justify-center rounded-control border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-cool"
                              >
                                Save question
                              </button>
                              <button
                                formAction={deleteQuestion.bind(null, slug, question.id)}
                                className="inline-flex items-center justify-center rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-status-rejected transition-colors hover:bg-red-100"
                              >
                                Delete question
                              </button>
                            </div>
                          </form>

                          {supportsOptions ? (
                            <div className="mt-4 rounded-control border border-border bg-white p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
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
                                    <button
                                      formAction={updateOption.bind(null, slug, option.id)}
                                      className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
                                    >
                                      Save
                                    </button>
                                    <button
                                      formAction={deleteOption.bind(null, slug, option.id)}
                                      className="inline-flex items-center justify-center rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-status-rejected transition-colors hover:bg-red-100"
                                    >
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
                                <button
                                  formAction={addOption.bind(null, slug, question.id)}
                                  className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
                                >
                                  Add option
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {/* Add question */}
                    <div className="rounded-control border border-dashed border-border bg-surface-cool p-4">
                      <h4 className="text-sm font-semibold text-ink">Add question</h4>
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
                        <label className="inline-flex items-center gap-2 text-sm text-ink">
                          <input
                            name="is_required"
                            type="checkbox"
                            className="rounded border-border"
                          />
                          Required
                        </label>
                        <div className="lg:col-span-2">
                          <button
                            formAction={addQuestion.bind(null, slug, section.id)}
                            className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
                          >
                            Add question
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
