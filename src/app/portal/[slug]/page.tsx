import Link from "next/link";

import { getPortalContext } from "@/lib/portal";
import {
  colorTokenClasses,
  computeWeightedScore,
  normalizeDecisionWeights,
} from "@/lib/recruiter-decisions";

import BulkActionBar from "./BulkActionBar";

type Application = {
  id: string;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  applied_at: string | null;
  created_at: string;
  application_source: "tracked" | "native" | "external_csv";
  stage_id: string | null;
  decision_label_id: string | null;
  external_full_name: string | null;
  external_email: string | null;
  external_year: string | null;
  external_major: string | null;
  profiles:
    | {
        full_name: string | null;
        email: string | null;
        year: string | null;
        major: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
        year: string | null;
        major: string | null;
      }[]
    | null;
};

type ReviewAggregate = {
  application_id: string;
  average: number | null;
  count: number;
};

type ReviewRow = {
  application_id: string;
  problem_solving: number;
  coding_ability: number;
  technical_knowledge: number;
  communication: number;
};

type Stage = {
  id: string;
  label: string;
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
};

type DecisionLabel = {
  id: string;
  label: string;
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted";
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
};

const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
} as const;

const STATUS_BADGE = {
  interested:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed",
  applied:
    "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2.5 py-0.5 text-xs font-medium text-brand-oxblood",
  interview:
    "inline-flex items-center rounded-control bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-status-interview",
  decision:
    "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2.5 py-0.5 text-xs font-medium text-brand-oxblood",
} as const;

const SOURCE_LABELS = {
  tracked: "Tracker only",
  native: "Rush native",
  external_csv: "CSV import",
} as const;

function getProfile(application: Application) {
  if (!application.profiles) {
    return null;
  }

  return Array.isArray(application.profiles)
    ? application.profiles[0] ?? null
    : application.profiles;
}

function applicantField(application: Application, key: "full_name" | "email" | "year" | "major") {
  const profile = getProfile(application);

  if (profile?.[key]) {
    return profile[key];
  }

  const externalKey =
    key === "full_name"
      ? "external_full_name"
      : key === "email"
        ? "external_email"
        : key === "year"
          ? "external_year"
          : "external_major";

  return application[externalKey];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) {
    return "—";
  }

  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    status?: string;
    decision?: string;
    q?: string;
    year?: string;
    major?: string;
    page?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const { supabase, club, membership, user } = await getPortalContext(slug);
  const { status, decision, q, year, major, page, message, error } = await searchParams;

  const [reviewerAssignmentsResponse, settingsResponse, stagesResponse, decisionLabelsResponse] =
    await Promise.all([
      membership.role === "reviewer"
        ? supabase
            .from("club_reviewer_assignments")
            .select("application_id")
            .eq("reviewer_user_id", user.id)
            .eq("club_id", club.id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("club_decision_settings")
        .select(
          "weight_problem_solving, weight_coding_ability, weight_technical_knowledge, weight_communication",
        )
        .eq("club_id", club.id)
        .maybeSingle(),
      supabase
        .from("club_pipeline_stages")
        .select("id, label, color_token")
        .eq("club_id", club.id)
        .order("position"),
      supabase
        .from("club_decision_labels")
        .select("id, label, decision_status, color_token")
        .eq("club_id", club.id)
        .order("position"),
    ]);

  const reviewerAssignments = reviewerAssignmentsResponse.data ?? [];
  const stages = (stagesResponse.data ?? []) as Stage[];
  const decisionLabels = (decisionLabelsResponse.data ?? []) as DecisionLabel[];
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const decisionLabelById = new Map(decisionLabels.map((label) => [label.id, label]));
  const weights = normalizeDecisionWeights(
    settingsResponse.data
      ? {
          problem_solving: settingsResponse.data.weight_problem_solving,
          coding_ability: settingsResponse.data.weight_coding_ability,
          technical_knowledge: settingsResponse.data.weight_technical_knowledge,
          communication: settingsResponse.data.weight_communication,
        }
      : null,
  );

  let query = supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, applied_at, created_at, application_source, stage_id, decision_label_id, external_full_name, external_email, external_year, external_major, profiles(full_name, email, year, major)",
    )
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  if (status && ["interested", "applied", "interview", "decision"].includes(status)) {
    query = query.eq("status", status);
  }

  if (decision && ["pending", "accepted", "rejected", "waitlisted"].includes(decision)) {
    query = query.eq("decision_status", decision);
  }

  if (membership.role === "reviewer") {
    const assignedIds = (reviewerAssignments ?? []).map((assignment) => assignment.application_id);
    if (assignedIds.length === 0) {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("id", assignedIds);
    }
  }

  const { data } = await query;
  const allApplications = (data ?? []) as Application[];

  const { data: reviewRows } = allApplications.length
    ? await supabase
        .from("club_application_reviews")
        .select(
          "application_id, problem_solving, coding_ability, technical_knowledge, communication",
        )
        .in("application_id", allApplications.map((application) => application.id))
    : { data: [] };

  const reviewMap = new Map<string, ReviewRow[]>();
  for (const review of (reviewRows ?? []) as ReviewRow[]) {
    const current = reviewMap.get(review.application_id) ?? [];
    current.push(review);
    reviewMap.set(review.application_id, current);
  }

  const reviewAggregates = new Map<string, ReviewAggregate>();
  for (const application of allApplications) {
    const scores = reviewMap.get(application.id) ?? [];
    reviewAggregates.set(application.id, {
      application_id: application.id,
      average: computeWeightedScore(scores, weights),
      count: scores.length,
    });
  }

  const years = Array.from(
    new Set(allApplications.map((application) => applicantField(application, "year")).filter(Boolean)),
  ) as string[];
  const majors = Array.from(
    new Set(allApplications.map((application) => applicantField(application, "major")).filter(Boolean)),
  ) as string[];

  const filteredApplications = allApplications.filter((application) => {
    const matchesStatus = !status || application.status === status;
    const matchesDecision = !decision || application.decision_status === decision;
    const matchesYear = !year || applicantField(application, "year") === year;
    const matchesMajor = !major || applicantField(application, "major") === major;
    const name = applicantField(application, "full_name") ?? "";
    const email = applicantField(application, "email") ?? "";
    const matchesQuery =
      !q ||
      name.toLowerCase().includes(q.toLowerCase()) ||
      email.toLowerCase().includes(q.toLowerCase());

    return matchesStatus && matchesDecision && matchesYear && matchesMajor && matchesQuery;
  });

  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const currentPage = Math.min(pageNumber, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleApplications = filteredApplications.slice(pageStart, pageStart + pageSize);

  function buildPageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (decision) params.set("decision", decision);
    if (q) params.set("q", q);
    if (year) params.set("year", year);
    if (major) params.set("major", major);
    params.set("page", String(nextPage));
    return `/portal/${slug}?${params.toString()}`;
  }

  const counts = {
    interested: allApplications.filter((application) => application.status === "interested").length,
    applied: allApplications.filter((application) => application.status === "applied").length,
    interview: allApplications.filter((application) => application.status === "interview").length,
    decision: allApplications.filter((application) => application.status === "decision").length,
  };

  return (
    <main className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(counts).map(([key, count]) => (
          <div key={key} className="rounded-card border border-border bg-white p-5 shadow-card">
            <p className="text-sm font-medium text-ink-muted">
              {STATUS_LABELS[key as keyof typeof STATUS_LABELS]}
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink">{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-card border border-border bg-white p-5 shadow-card">
        <form className="grid gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="decision"
            defaultValue={decision ?? ""}
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">All decisions</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
          <select
            name="year"
            defaultValue={year ?? ""}
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">All years</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            name="major"
            defaultValue={major ?? ""}
            className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          >
            <option value="">All majors</option>
            {majors.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
          >
            Apply filters
          </button>
        </form>
      </div>

      {/* Applicants table */}
      <form className="rounded-card border border-border bg-white shadow-card">
        {membership.role === "admin" ? (
          <BulkActionBar slug={slug} stages={stages} decisionLabels={decisionLabels} />
        ) : null}

        {filteredApplications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-muted">
            No applicants match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-border bg-surface-cool">
                  {membership.role === "admin" ? (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Select
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Year / Major
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Applied
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleApplications.map((application) => {
                  const aggregate = reviewAggregates.get(application.id);
                  return (
                    <tr
                      key={application.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-surface-cool"
                    >
                      {membership.role === "admin" ? (
                        <td className="px-4 py-3">
                          <input name="application_ids" type="checkbox" value={application.id} />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {applicantField(application, "full_name") ?? "Unknown applicant"}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {applicantField(application, "email") ?? "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">
                        {[applicantField(application, "year"), applicantField(application, "major")]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {application.stage_id && stageById.get(application.stage_id) ? (
                            <span
                              className={`inline-flex items-center rounded-control px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(stageById.get(application.stage_id)!.color_token)}`}
                            >
                              {stageById.get(application.stage_id)!.label}
                            </span>
                          ) : (
                            <span className={STATUS_BADGE[application.status]}>
                              {STATUS_LABELS[application.status]}
                            </span>
                          )}
                          <span className="text-xs capitalize text-ink-muted">
                            {application.decision_label_id &&
                            decisionLabelById.get(application.decision_label_id)
                              ? decisionLabelById.get(application.decision_label_id)!.label
                              : application.decision_status ?? "pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">
                        {aggregate?.average ? `${aggregate.average}/10` : "—"}
                        {aggregate?.count ? (
                          <span className="ml-1 text-xs text-ink-muted">({aggregate.count})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">
                        {SOURCE_LABELS[application.application_source]}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">
                        {formatDate(application.applied_at ?? application.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portal/${slug}/applicants/${application.id}`}
                          className="text-sm font-medium text-brand-action transition-colors hover:text-[#1F2937]"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredApplications.length > 0 && totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-ink-muted">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={buildPageHref(currentPage - 1)}
                  className="rounded-control border border-border px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-cool hover:text-ink"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-control border border-border px-3 py-1.5 text-ink-muted/40">
                  Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={buildPageHref(currentPage + 1)}
                  className="rounded-control border border-border px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-cool hover:text-ink"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-control border border-border px-3 py-1.5 text-ink-muted/40">
                  Next
                </span>
              )}
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}
