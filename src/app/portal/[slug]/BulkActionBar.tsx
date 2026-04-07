"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { colorTokenClasses } from "@/lib/recruiter-decisions";
import { bulkUpdateApplicants } from "./actions";

type Stage = {
  id: string;
  label: string;
  color_token: string;
};

type DecisionLabel = {
  id: string;
  label: string;
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted";
  color_token: string;
};

export type ApplicationRow = {
  id: string;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  stage_id: string | null;
  decision_label_id: string | null;
  full_name: string | null;
  email: string | null;
  year: string | null;
  major: string | null;
  campus_involvement?: string | null;
  headshot_url?: string | null;
  application_source: "tracked" | "native" | "external_csv";
  applied_at: string | null;
  created_at: string;
  score: number | null;
  review_count: number;
};

type Props = {
  slug: string;
  isAdmin: boolean;
  stages: Stage[];
  decisionLabels: DecisionLabel[];
  applications: ApplicationRow[];
  stageById: Record<string, Stage>;
  decisionLabelById: Record<string, DecisionLabel>;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  prevPageHref: string | null;
  nextPageHref: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionHref?: string | null;
  emptyActionLabel?: string | null;
};

const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
} as const;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDecisionBadge(
  decisionStatus: "pending" | "accepted" | "rejected" | "waitlisted" | null,
) {
  switch (decisionStatus) {
    case "accepted":
      return (
        <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">
          Accepted
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          Rejected
        </span>
      );
    case "waitlisted":
      return (
        <span className="inline-flex items-center rounded-full border border-gray-400 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
          Waitlisted
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-400">
          Pending
        </span>
      );
  }
}

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ScorePill({ score, reviewCount }: { score: number | null; reviewCount: number }) {
  if (score === null) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-bold tabular-nums text-gray-900">
        {score.toFixed(1)}
      </span>
      <span className="text-xs text-gray-400">/10</span>
      {reviewCount > 0 ? (
        <span className="ml-1 text-xs text-gray-400">({reviewCount})</span>
      ) : null}
    </div>
  );
}

export default function BulkActionBar({
  slug,
  isAdmin,
  stages,
  decisionLabels,
  applications,
  stageById,
  decisionLabelById,
  currentPage,
  totalPages,
  totalCount,
  prevPageHref,
  nextPageHref,
  emptyTitle = "No applicants in view",
  emptyDescription = "Add applicants, import a CSV, or clear the active filters to reopen the queue.",
  emptyActionHref = null,
  emptyActionLabel = null,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(applications.map((a) => a.id)) : new Set());
    },
    [applications],
  );

  const selectedCount = selectedIds.size;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      {/* Bulk action bar — slides in when items are selected */}
      {isAdmin ? (
        <div
          className={`overflow-hidden transition-all duration-200 ${
            selectedCount > 0 ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-gray-900 px-5 py-3">
            <form className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="redirect_to" value={`/portal/${slug}`} />
              {Array.from(selectedIds).map((id) => (
                <input key={id} type="hidden" name="application_ids" value={id} />
              ))}

              <span className="shrink-0 text-sm font-semibold text-white">
                {selectedCount} selected
              </span>

              <div className="flex flex-1 flex-wrap gap-2">
                {stages.length > 0 ? (
                  <select
                    name="stage_id"
                    defaultValue=""
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/40"
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
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/40"
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
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/40"
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
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/40"
                  >
                    <option value="">No label change</option>
                    {decisionLabels.map((dl) => (
                      <option key={dl.id} value={dl.id}>
                        {dl.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <button
                formAction={bulkUpdateApplicants.bind(null, slug)}
                className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 shrink-0"
              >
                Apply to selected
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-white/60 transition-colors hover:text-white shrink-0"
              >
                Clear
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Table */}
      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-18 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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
                d="M7 4.75h10A2.25 2.25 0 0119.25 7v10A2.25 2.25 0 0117 19.25H7A2.25 2.25 0 014.75 17V7A2.25 2.25 0 017 4.75z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 9.25h6.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 12h6.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 14.75H12" />
            </svg>
          </div>
          <h3 className="mt-5 text-lg font-semibold text-slate-950">{emptyTitle}</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{emptyDescription}</p>
          {emptyActionHref && emptyActionLabel ? (
            <Link
              href={emptyActionHref}
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {emptyActionLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {isAdmin ? (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                      checked={selectedCount === applications.length && applications.length > 0}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Applicant
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Year / Major
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Decision
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Applied
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((application) => {
                const isPending =
                  !application.decision_status || application.decision_status === "pending";
                const stage = application.stage_id ? stageById[application.stage_id] ?? null : null;
                const decisionLabel = application.decision_label_id
                  ? decisionLabelById[application.decision_label_id] ?? null
                  : null;
                const isSelected = selectedIds.has(application.id);

                return (
                  <tr
                    key={application.id}
                    className={`group transition-colors ${
                      isPending ? "border-l-2 border-l-gray-400" : ""
                    } ${isSelected ? "bg-gray-50" : "hover:bg-gray-50/60"}`}
                  >
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${application.full_name ?? "applicant"}`}
                          className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                          checked={isSelected}
                          onChange={(e) => toggleId(application.id, e.target.checked)}
                        />
                      </td>
                    ) : null}

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {getInitials(application.full_name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {application.full_name ?? "Unknown applicant"}
                          </p>
                          <p className="text-xs text-gray-400">{application.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500">
                      {[application.year, application.major].filter(Boolean).join(" · ") || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {stage ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${colorTokenClasses(stage.color_token as "slate" | "blue" | "amber" | "green" | "rose" | "violet")}`}
                        >
                          {stage.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {STATUS_LABELS[application.status]}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {decisionLabel ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${colorTokenClasses(decisionLabel.color_token as "slate" | "blue" | "amber" | "green" | "rose" | "violet")}`}
                          >
                            {decisionLabel.label}
                          </span>
                        ) : (
                          getDecisionBadge(application.decision_status)
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <ScorePill score={application.score} reviewCount={application.review_count} />
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                      {formatDate(application.applied_at ?? application.created_at)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/portal/${slug}/applicants/${application.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-900 hover:bg-gray-900 hover:text-white"
                      >
                        Review <span aria-hidden>→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {applications.length > 0 && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
          <span className="text-xs text-gray-500">
            Page {currentPage} of {totalPages} &middot; {totalCount} applicants
          </span>
          <div className="flex items-center gap-2">
            {prevPageHref ? (
              <Link
                href={prevPageHref}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-300">
                Previous
              </span>
            )}
            {nextPageHref ? (
              <Link
                href={nextPageHref}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-300">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
