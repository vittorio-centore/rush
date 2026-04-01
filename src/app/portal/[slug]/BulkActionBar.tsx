"use client";

import { useState, useCallback } from "react";

import { bulkUpdateApplicants } from "./actions";

interface Stage {
  id: string;
  label: string;
}

interface DecisionLabel {
  id: string;
  label: string;
}

interface BulkActionBarProps {
  slug: string;
  stages: Stage[];
  decisionLabels: DecisionLabel[];
}

const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
} as const;

export default function BulkActionBar({ slug, stages, decisionLabels }: BulkActionBarProps) {
  const [selectedCount, setSelectedCount] = useState(0);

  const handleFormChange = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.type === "checkbox" && target.name === "application_ids") {
      const form = target.closest("form");
      if (form) {
        const checked = form.querySelectorAll<HTMLInputElement>(
          'input[name="application_ids"]:checked',
        );
        setSelectedCount(checked.length);
      }
    }
  }, []);

  return (
    <div
      className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center"
      onChange={handleFormChange}
    >
      <input type="hidden" name="redirect_to" value={`/portal/${slug}`} />
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        {stages.length > 0 ? (
          <select
            name="stage_id"
            defaultValue=""
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">No stage change</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          name="status"
          defaultValue=""
          className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
        >
          <option value="">No status change</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="decision_status"
          defaultValue=""
          className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
        >
          <option value="">No decision change</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="waitlisted">Waitlisted</option>
        </select>
        {decisionLabels.length > 0 ? (
          <select
            name="decision_label_id"
            defaultValue=""
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">No decision label change</option>
            {decisionLabels.map((decisionLabel) => (
              <option key={decisionLabel.id} value={decisionLabel.id}>
                {decisionLabel.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {selectedCount > 0 ? (
          <span className="text-sm font-medium text-ink-muted">{selectedCount} selected</span>
        ) : null}
        <button
          formAction={bulkUpdateApplicants.bind(null, slug)}
          disabled={selectedCount === 0}
          aria-disabled={selectedCount === 0}
          className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bulk update selected
        </button>
      </div>
    </div>
  );
}
