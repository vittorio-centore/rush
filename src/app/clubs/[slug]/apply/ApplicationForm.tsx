"use client";

import { useState } from "react";

import { isQuestionVisible, type AnswerMap } from "@/lib/application-forms";

type FormOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

type FormQuestion = {
  id: string;
  type: "short_text" | "long_text" | "single_select" | "multi_select";
  label: string;
  help_text: string | null;
  placeholder: string | null;
  is_required: boolean;
  position: number;
  condition_question_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
  options: FormOption[];
};

type FormSection = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  questions: FormQuestion[];
};

type Props = {
  sections: FormSection[];
  initialAnswers: AnswerMap;
  submitButtonText: string;
  formAction: (formData: FormData) => void;
};

export default function ApplicationForm({
  sections,
  initialAnswers,
  submitButtonText,
  formAction,
}: Props) {
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {sections.map((section) => (
        <section
          key={section.id}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            {section.description ? (
              <p className="mt-1 text-sm text-slate-500">{section.description}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            {section.questions.map((question) => {
              if (!isQuestionVisible(question, answers)) {
                return null;
              }

              const fieldName = `question_${question.id}`;
              const value = answers[question.id];

              return (
                <div key={question.id} className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-800">
                    {question.label}
                    {question.is_required ? (
                      <span className="ml-1 text-red-500">*</span>
                    ) : null}
                  </label>
                  {question.help_text ? (
                    <p className="text-xs text-slate-500">{question.help_text}</p>
                  ) : null}

                  {question.type === "short_text" ? (
                    <input
                      name={fieldName}
                      required={question.is_required}
                      defaultValue={typeof value === "string" ? value : ""}
                      placeholder={question.placeholder ?? ""}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  ) : null}

                  {question.type === "long_text" ? (
                    <textarea
                      name={fieldName}
                      required={question.is_required}
                      defaultValue={typeof value === "string" ? value : ""}
                      placeholder={question.placeholder ?? ""}
                      rows={5}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  ) : null}

                  {question.type === "single_select" ? (
                    <select
                      name={fieldName}
                      required={question.is_required}
                      defaultValue={typeof value === "string" ? value : ""}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    >
                      <option value="">Select an option</option>
                      {question.options.map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {question.type === "multi_select" ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                      {question.options.map((option) => {
                        const selected = Array.isArray(value) ? value : [];
                        return (
                          <label key={option.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              name={fieldName}
                              type="checkbox"
                              value={option.value}
                              defaultChecked={selected.includes(option.value)}
                              onChange={(event) => {
                                const current = Array.isArray(answers[question.id])
                                  ? [...(answers[question.id] as string[])]
                                  : [];

                                if (event.target.checked) {
                                  setAnswer(question.id, [...current, option.value]);
                                } else {
                                  setAnswer(
                                    question.id,
                                    current.filter((entry) => entry !== option.value),
                                  );
                                }
                              }}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-brand-action px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
        >
          {submitButtonText}
        </button>
      </div>
    </form>
  );
}
