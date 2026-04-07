"use client";

import { useState } from "react";

import { saveReviewerScorecard } from "./actions";

type Props = {
  slug: string;
  applicationId: string;
  currentReview: {
    problem_solving: number;
    coding_ability: number;
    technical_knowledge: number;
    communication: number;
    notes: string | null;
  } | null;
};

const FIELDS = [
  { label: "Problem solving", name: "problem_solving" },
  { label: "Coding ability", name: "coding_ability" },
  { label: "Technical knowledge", name: "technical_knowledge" },
  { label: "Communication", name: "communication" },
] as const;

export default function ScorecardForm({ slug, applicationId, currentReview }: Props) {
  const defaultScores = {
    problem_solving: currentReview?.problem_solving ?? 7,
    coding_ability: currentReview?.coding_ability ?? 7,
    technical_knowledge: currentReview?.technical_knowledge ?? 7,
    communication: currentReview?.communication ?? 7,
  };

  const [scores, setScores] = useState(defaultScores);

  return (
    <form className="mt-5 flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map(({ label, name }) => (
          <div key={name}>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={name} className="text-xs font-semibold text-gray-600">
                {label}
              </label>
              <span className="text-sm font-bold tabular-nums text-gray-900">
                {scores[name]}/10
              </span>
            </div>
            <input
              id={name}
              name={name}
              type="range"
              min={1}
              max={10}
              value={scores[name]}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [name]: Number(e.target.value) }))
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-gray-900"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="review_notes" className="mb-1.5 block text-xs font-semibold text-gray-600">
          Review notes
        </label>
        <textarea
          id="review_notes"
          name="review_notes"
          rows={4}
          defaultValue={currentReview?.notes ?? ""}
          placeholder="Strengths, concerns, overall impression…"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
      </div>

      <button
        formAction={saveReviewerScorecard.bind(null, slug, applicationId)}
        className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
      >
        {currentReview ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}
