import Link from "next/link";

import { getPortalContext } from "@/lib/portal";

import { bulkUpdateApplicants } from "./actions";

type Application = {
  id: string;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  applied_at: string | null;
  created_at: string;
  application_source: "tracked" | "native" | "external_csv";
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

const STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
} as const;

const STATUS_BADGE = {
  interested:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  applied:
    "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  interview:
    "inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
  decision:
    "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
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

function averageScore(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
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
    message?: string;
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const { supabase, club, membership, user } = await getPortalContext(slug);
  const { status, decision, q, year, major, message, error } = await searchParams;

  const { data: reviewerAssignments } = membership.role === "reviewer"
    ? await supabase
        .from("club_reviewer_assignments")
        .select("application_id")
        .eq("reviewer_user_id", user.id)
        .eq("club_id", club.id)
    : { data: [] };

  let query = supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, applied_at, created_at, application_source, external_full_name, external_email, external_year, external_major, profiles(full_name, email, year, major)",
    )
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

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

  const reviewMap = new Map<string, number[]>();
  for (const review of reviewRows ?? []) {
    const current = reviewMap.get(review.application_id) ?? [];
    current.push(
      review.problem_solving,
      review.coding_ability,
      review.technical_knowledge,
      review.communication,
    );
    reviewMap.set(review.application_id, current);
  }

  const reviewAggregates = new Map<string, ReviewAggregate>();
  for (const application of allApplications) {
    const scores = reviewMap.get(application.id) ?? [];
    reviewAggregates.set(application.id, {
      application_id: application.id,
      average: averageScore(scores),
      count: scores.length / 4,
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

  const counts = {
    interested: allApplications.filter((application) => application.status === "interested").length,
    applied: allApplications.filter((application) => application.status === "applied").length,
    interview: allApplications.filter((application) => application.status === "interview").length,
    decision: allApplications.filter((application) => application.status === "decision").length,
  };

  return (
    <main className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(counts).map(([key, count]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              {STATUS_LABELS[key as keyof typeof STATUS_LABELS]}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Apply filters
          </button>
        </form>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {membership.role === "admin" ? (
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <select
                name="status"
                defaultValue=""
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">No decision change</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
            </div>
            <button
              formAction={bulkUpdateApplicants.bind(null, slug)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Bulk update selected
            </button>
          </div>
        ) : null}

        {filteredApplications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No applicants match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {membership.role === "admin" ? (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Select
                    </th>
                  ) : null}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Applicant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Year / Major
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Applied
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => {
                  const aggregate = reviewAggregates.get(application.id);
                  return (
                    <tr key={application.id} className="border-b border-slate-100 last:border-0">
                      {membership.role === "admin" ? (
                        <td className="px-4 py-3">
                          <input name="application_ids" type="checkbox" value={application.id} />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {applicantField(application, "full_name") ?? "Unknown applicant"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {applicantField(application, "email") ?? "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {[applicantField(application, "year"), applicantField(application, "major")]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={STATUS_BADGE[application.status]}>
                            {STATUS_LABELS[application.status]}
                          </span>
                          <span className="text-xs capitalize text-slate-500">
                            {application.decision_status ?? "pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {aggregate?.average ? `${aggregate.average}/10` : "—"}
                        {aggregate?.count ? (
                          <span className="ml-1 text-xs text-slate-400">({aggregate.count})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {SOURCE_LABELS[application.application_source]}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(application.applied_at ?? application.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portal/${slug}/applicants/${application.id}`}
                          className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
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
      </form>
    </main>
  );
}
