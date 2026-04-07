import Link from "next/link";

import { getPortalCapabilities } from "@/lib/portal-features";
import { getPortalContext } from "@/lib/portal";
import {
  colorTokenClasses,
  computeWeightedScore,
  normalizeDecisionWeights,
} from "@/lib/recruiter-decisions";
import {
  isMissingAnySchemaColumn,
  normalizeApplicationSource,
  type SchemaErrorLike,
} from "@/lib/supabase/compat";

import BulkActionBar, { type ApplicationRow } from "./BulkActionBar";

type ApplicantProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  year: string | null;
  major: string | null;
  campus_involvement?: string | null;
  headshot_url?: string | null;
};

type ApplicantLookup = {
  external_full_name?: string | null;
  external_email?: string | null;
  external_year?: string | null;
  external_major?: string | null;
  profiles:
    | ApplicantProfile
    | ApplicantProfile[]
    | null;
};

type Application = ApplicantLookup & {
  id: string;
  user_id: string | null;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  applied_at: string | null;
  created_at: string;
  application_source: "tracked" | "native" | "external_csv";
  stage_id: string | null;
  decision_label_id: string | null;
};

type MetadataRow = {
  user_id: string | null;
  external_year?: string | null;
  external_major?: string | null;
};
type ProfileRow = ApplicantProfile & { id: string };

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

const STATUS_VALUES = ["interested", "applied", "interview", "decision"] as const;
const DECISION_VALUES = ["pending", "accepted", "rejected", "waitlisted"] as const;
const EMPTY_APPLICATION_ID = "00000000-0000-0000-0000-000000000000";
const PAGE_SIZE = 50;
const APPLICATION_SELECT =
  "id, user_id, status, decision_status, applied_at, created_at, application_source, stage_id, decision_label_id, external_full_name, external_email, external_year, external_major";
const REVIEW_SELECT =
  "application_id, problem_solving, coding_ability, technical_knowledge, communication";
const METADATA_SELECT = "user_id, external_year, external_major";
const LEGACY_APPLICATION_SELECT =
  "id, user_id, status, decision_status, applied_at, created_at";
const LEGACY_METADATA_SELECT = "user_id";
const VIEW_MODES = ["list", "gallery", "rounds"] as const;

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

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function decisionDisplay(
  application: ApplicationRow,
  decisionLabelById: Record<string, DecisionLabel>,
) {
  const decisionLabel = application.decision_label_id
    ? decisionLabelById[application.decision_label_id] ?? null
    : null;

  if (decisionLabel) {
    return decisionLabel.label;
  }

  return application.decision_status
    ? application.decision_status.charAt(0).toUpperCase() + application.decision_status.slice(1)
    : "Pending";
}

function statusOrStageDisplay(
  application: ApplicationRow,
  stageById: Record<string, Stage>,
) {
  const stage = application.stage_id ? stageById[application.stage_id] ?? null : null;
  return stage?.label ?? STATUS_LABELS[application.status];
}

function profileAccentClass(
  application: ApplicationRow,
  stageById: Record<string, Stage>,
  decisionLabelById: Record<string, DecisionLabel>,
) {
  const stage = application.stage_id ? stageById[application.stage_id] ?? null : null;
  if (stage) {
    return colorTokenClasses(stage.color_token);
  }
  const decisionLabel = application.decision_label_id
    ? decisionLabelById[application.decision_label_id] ?? null
    : null;
  if (decisionLabel) {
    return colorTokenClasses(decisionLabel.color_token);
  }
  return "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200";
}

function buildQueryHref(
  slug: string,
  params: {
    status?: string;
    decision?: string;
    q?: string;
    year?: string;
    major?: string;
    page?: string | number;
    view?: string;
  },
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.decision) search.set("decision", params.decision);
  if (params.q) search.set("q", params.q);
  if (params.year) search.set("year", params.year);
  if (params.major) search.set("major", params.major);
  if (params.view) search.set("view", params.view);
  if (params.page) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/portal/${slug}?${query}` : `/portal/${slug}`;
}

function groupApplicationsForRounds(
  applications: ApplicationRow[],
  stages: Stage[],
) {
  if (stages.length > 0) {
    const groups = stages.map((stage) => ({
      key: stage.id,
      label: stage.label,
      description: `${applications.filter((application) => application.stage_id === stage.id).length} in this round`,
      applications: applications.filter((application) => application.stage_id === stage.id),
      tone: colorTokenClasses(stage.color_token),
    }));

    const unassigned = applications.filter((application) => !application.stage_id);
    if (unassigned.length > 0) {
      groups.unshift({
        key: "unassigned",
        label: "Unassigned",
        description: "Applicants without a custom round yet",
        applications: unassigned,
        tone: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200",
      });
    }

    return groups;
  }

  return STATUS_VALUES.map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    description: `${applications.filter((application) => application.status === status).length} in this bucket`,
    applications: applications.filter((application) => application.status === status),
    tone: "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200",
  }));
}

function enrichApplicantProfile(
  profile: Pick<ApplicantProfile, "id" | "full_name" | "email" | "year" | "major"> &
    Partial<ApplicantProfile>,
): ApplicantProfile {
  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    email: profile.email ?? null,
    year: profile.year ?? null,
    major: profile.major ?? null,
    campus_involvement: profile.campus_involvement ?? null,
    headshot_url: profile.headshot_url ?? null,
  };
}

function getProfile(application: ApplicantLookup) {
  if (!application.profiles) {
    return null;
  }

  return Array.isArray(application.profiles)
    ? application.profiles[0] ?? null
    : application.profiles;
}

function applicantField(
  application: ApplicantLookup,
  key: "full_name" | "email" | "year" | "major",
) {
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

  return application[externalKey] ?? null;
}

function mapApplication(
  value: unknown,
  includeAdvancedFields: boolean,
): Application {
  const row = value as Partial<Application> & {
    profiles: ApplicantLookup["profiles"];
  };

  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    status: row.status as Application["status"],
    decision_status: (row.decision_status as Application["decision_status"]) ?? null,
    applied_at: row.applied_at ?? null,
    created_at: row.created_at ?? new Date(0).toISOString(),
    application_source: normalizeApplicationSource(row.application_source),
    stage_id: includeAdvancedFields ? row.stage_id ?? null : null,
    decision_label_id: includeAdvancedFields ? row.decision_label_id ?? null : null,
    external_full_name: includeAdvancedFields ? row.external_full_name ?? null : null,
    external_email: includeAdvancedFields ? row.external_email ?? null : null,
    external_year: includeAdvancedFields ? row.external_year ?? null : null,
    external_major: includeAdvancedFields ? row.external_major ?? null : null,
    profiles: row.profiles ?? null,
  };
}

async function attachProfiles<T extends { user_id: string | null; profiles?: ApplicantLookup["profiles"] }>(
  supabase: Awaited<ReturnType<typeof getPortalContext>>["supabase"],
  rows: T[],
): Promise<T[]> {
  const userIds = Array.from(
    new Set(
      rows
        .map((row) => row.user_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const selectAttempts = [
    {
      select: "id, full_name, email, year, major, campus_involvement, headshot_url",
      missingColumns: ["campus_involvement", "headshot_url"],
    },
    {
      select: "id, full_name, email, year, major",
      missingColumns: [],
    },
  ] as const;

  let profilesData: ApplicantProfile[] = [];
  let lastError: SchemaErrorLike | null = null;

  if (userIds.length) {
    for (const attempt of selectAttempts) {
      const response = await supabase.from("profiles").select(attempt.select).in("id", userIds);

      if (!response.error) {
        profilesData = ((response.data ?? []) as unknown as Array<
          Pick<ApplicantProfile, "id" | "full_name" | "email" | "year" | "major"> &
            Partial<ApplicantProfile>
        >).map(enrichApplicantProfile);
        lastError = null;
        break;
      }

      lastError = response.error;

      if (
        attempt.missingColumns.length === 0 ||
        !isMissingAnySchemaColumn(response.error, [...attempt.missingColumns])
      ) {
        throw new Error(response.error.message ?? "Failed to load applicant profiles.");
      }
    }
  }

  if (lastError) {
    throw new Error(lastError.message ?? "Failed to load applicant profiles.");
  }

  const profileById = new Map(
    (profilesData as ProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => ({
    ...row,
    profiles: row.user_id ? profileById.get(row.user_id) ?? null : null,
  }));
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
    view?: string;
    message?: string;
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const { supabase, club, membership, user } = await getPortalContext(slug);
  const capabilities = await getPortalCapabilities(slug);
  const { status, decision, q, year, major, page, view, message, error } = await searchParams;

  const [reviewerAssignmentsResponse, settingsResponse, stagesResponse, decisionLabelsResponse] =
    await Promise.all([
      membership.role === "reviewer" && capabilities.reviewerTools
        ? supabase
            .from("club_reviewer_assignments")
            .select("application_id")
            .eq("reviewer_user_id", user.id)
            .eq("club_id", club.id)
        : Promise.resolve({ data: [] }),
      capabilities.decisionWorkspace
        ? supabase
        .from("club_decision_settings")
        .select(
          "weight_problem_solving, weight_coding_ability, weight_technical_knowledge, weight_communication",
        )
        .eq("club_id", club.id)
        .maybeSingle()
        : Promise.resolve({ data: null }),
      capabilities.decisionWorkspace
        ? supabase
        .from("club_pipeline_stages")
        .select("id, label, color_token")
        .eq("club_id", club.id)
        .order("position")
        : Promise.resolve({ data: [] }),
      capabilities.decisionWorkspace
        ? supabase
        .from("club_decision_labels")
        .select("id, label, decision_status, color_token")
        .eq("club_id", club.id)
        .order("position")
        : Promise.resolve({ data: [] }),
    ]);

  const reviewerAssignments = reviewerAssignmentsResponse.data ?? [];
  const stages = (stagesResponse.data ?? []) as Stage[];
  const decisionLabels = (decisionLabelsResponse.data ?? []) as DecisionLabel[];
  const stageById: Record<string, Stage> = Object.fromEntries(
    stages.map((stage) => [stage.id, stage]),
  );
  const decisionLabelById: Record<string, DecisionLabel> = Object.fromEntries(
    decisionLabels.map((label) => [label.id, label]),
  );
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

  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const activeView = VIEW_MODES.includes((view ?? "list") as (typeof VIEW_MODES)[number])
    ? ((view ?? "list") as (typeof VIEW_MODES)[number])
    : "list";
  const assignedIds = reviewerAssignments.map((assignment) => assignment.application_id);
  const hasAdvancedFilters = Boolean(q || year || major);
  const applicationSelect = capabilities.advancedApplications
    ? APPLICATION_SELECT
    : LEGACY_APPLICATION_SELECT;
  const metadataSelect = capabilities.advancedApplications
    ? METADATA_SELECT
    : LEGACY_METADATA_SELECT;

  function buildApplicationsQuery(select: string, ordered = false, count?: "exact", head = false) {
    let query = count
      ? supabase.from("user_applications").select(select, { count, head })
      : supabase.from("user_applications").select(select);

    query = query.eq("club_id", club.id);

    if (status && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      query = query.eq("status", status);
    }

    if (decision && DECISION_VALUES.includes(decision as (typeof DECISION_VALUES)[number])) {
      query = query.eq("decision_status", decision);
    }

    if (membership.role === "reviewer") {
      query = query.in("id", assignedIds.length > 0 ? assignedIds : [EMPTY_APPLICATION_ID]);
    }

    if (ordered) {
      query = query.order("created_at", { ascending: false });
    }

    return query;
  }

  const countResponsesPromise = Promise.all(
    STATUS_VALUES.map((value) =>
      buildApplicationsQuery("id", false, "exact", true).eq("status", value),
    ),
  );

  let visibleApplications: Application[] = [];
  let years: string[] = [];
  let majors: string[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let currentPage = 1;
  let counts: Record<(typeof STATUS_VALUES)[number], number> = {
    interested: 0,
    applied: 0,
    interview: 0,
    decision: 0,
  };

  if (hasAdvancedFilters) {
    const [{ data }, countResponses] = await Promise.all([
      buildApplicationsQuery(applicationSelect, true),
      countResponsesPromise,
    ]);

    const allApplications = await attachProfiles(
      supabase,
      (data ?? []).map((row) => mapApplication(row, capabilities.advancedApplications)),
    );
    const filteredApplications = allApplications.filter((application) => {
      const matchesYear = !year || applicantField(application, "year") === year;
      const matchesMajor = !major || applicantField(application, "major") === major;
      const name = applicantField(application, "full_name") ?? "";
      const email = applicantField(application, "email") ?? "";
      const matchesQuery =
        !q ||
        name.toLowerCase().includes(q.toLowerCase()) ||
        email.toLowerCase().includes(q.toLowerCase());

      return matchesYear && matchesMajor && matchesQuery;
    });

    years = Array.from(
      new Set(
        allApplications
          .map((application) => applicantField(application, "year"))
          .filter(Boolean),
      ),
    ) as string[];
    majors = Array.from(
      new Set(
        allApplications
          .map((application) => applicantField(application, "major"))
          .filter(Boolean),
      ),
    ) as string[];

    totalCount = filteredApplications.length;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    currentPage = Math.min(pageNumber, totalPages);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    visibleApplications = filteredApplications.slice(pageStart, pageStart + PAGE_SIZE);

    counts = STATUS_VALUES.reduce<Record<(typeof STATUS_VALUES)[number], number>>(
      (accumulator, value, index) => {
        accumulator[value] = countResponses[index]?.count ?? 0;
        return accumulator;
      },
      {
        interested: 0,
        applied: 0,
        interview: 0,
        decision: 0,
      },
    );
  } else {
    const requestedPageStart = (pageNumber - 1) * PAGE_SIZE;
    const [{ data: pageData, count }, { data: metadataData }, countResponses] = await Promise.all([
      buildApplicationsQuery(applicationSelect, true, "exact").range(
        requestedPageStart,
        requestedPageStart + PAGE_SIZE - 1,
      ),
      buildApplicationsQuery(metadataSelect),
      countResponsesPromise,
    ]);

    totalCount = count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    currentPage = Math.min(pageNumber, totalPages);
    visibleApplications = await attachProfiles(
      supabase,
      (pageData ?? []).map((row) => mapApplication(row, capabilities.advancedApplications)),
    );

    if (currentPage !== pageNumber) {
      const correctedPageStart = (currentPage - 1) * PAGE_SIZE;
      const { data: correctedPageData } = await buildApplicationsQuery(
        applicationSelect,
        true,
      ).range(correctedPageStart, correctedPageStart + PAGE_SIZE - 1);
      visibleApplications = await attachProfiles(
        supabase,
        (correctedPageData ?? []).map((row) =>
          mapApplication(row, capabilities.advancedApplications),
        ),
      );
    }

    const metadataRows = await attachProfiles(
      supabase,
      (((metadataData ?? []) as unknown) as MetadataRow[]).map((row) => ({
        ...row,
        profiles: null,
      })),
    );
    years = Array.from(
      new Set(
        metadataRows
          .map((application) => applicantField(application, "year"))
          .filter(Boolean),
      ),
    ) as string[];
    majors = Array.from(
      new Set(
        metadataRows
          .map((application) => applicantField(application, "major"))
          .filter(Boolean),
      ),
    ) as string[];

    counts = STATUS_VALUES.reduce<Record<(typeof STATUS_VALUES)[number], number>>(
      (accumulator, value, index) => {
        accumulator[value] = countResponses[index]?.count ?? 0;
        return accumulator;
      },
      {
        interested: 0,
        applied: 0,
        interview: 0,
        decision: 0,
      },
    );
  }

  const { data: reviewRows } = capabilities.reviewerTools && visibleApplications.length
    ? await supabase
        .from("club_application_reviews")
        .select(REVIEW_SELECT)
        .in(
          "application_id",
          visibleApplications.map((application) => application.id),
        )
    : { data: [] };

  const reviewMap = new Map<string, ReviewRow[]>();
  for (const review of (reviewRows ?? []) as ReviewRow[]) {
    const current = reviewMap.get(review.application_id) ?? [];
    current.push(review);
    reviewMap.set(review.application_id, current);
  }

  const filtersActive = Boolean(status || decision || q || year || major);
  const emptyTitle = filtersActive
    ? "No applicants match these filters"
    : "No applicants in this workspace yet";
  const emptyDescription = filtersActive
    ? "Widen the search, switch filters, or clear the view to reopen the full queue."
    : "This club has a portal, but the queue is still empty. Bring in a CSV batch or open applications before review starts.";
  const emptyActionHref = filtersActive
    ? `/portal/${slug}`
    : capabilities.imports
      ? `/portal/${slug}/imports`
      : `/portal/${slug}/settings`;
  const emptyActionLabel = filtersActive
    ? "Clear filters"
    : capabilities.imports
      ? "Import applicants"
      : "Open settings";
  const compatibilityMode =
    !capabilities.advancedApplications ||
    !capabilities.decisionWorkspace ||
    !capabilities.reviewerTools ||
    !capabilities.imports;

  const applicationRows: ApplicationRow[] = visibleApplications.map((application) => {
    const scores = reviewMap.get(application.id) ?? [];
    const score = computeWeightedScore(scores, weights);
    return {
      id: application.id,
      status: application.status,
      decision_status: application.decision_status,
      stage_id: application.stage_id,
      decision_label_id: application.decision_label_id,
      full_name: applicantField(application, "full_name"),
      email: applicantField(application, "email"),
      year: applicantField(application, "year"),
      major: applicantField(application, "major"),
      campus_involvement: getProfile(application)?.campus_involvement ?? null,
      headshot_url: getProfile(application)?.headshot_url ?? null,
      application_source: application.application_source,
      applied_at: application.applied_at,
      created_at: application.created_at,
      score,
      review_count: scores.length,
    };
  });
  const roundGroups = groupApplicationsForRounds(applicationRows, stages);

  return (
    <main className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {compatibilityMode ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Portal compatibility mode</p>
          <p className="mt-2 leading-6">
            This database is missing part of the newer recruiter portal schema. Basic applicant
            browsing and legacy status updates still work, but custom pipeline labels, scorecards,
            and CSV imports are unavailable until the portal migrations are applied.
          </p>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Applicant workspace
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                  Review the live queue.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Search the pool, keep the pipeline legible, and only use bulk actions when you
                  have a real slice ready to move.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  In view
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">
                  {totalCount}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200/80 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(counts).map(([key, count]) => (
              <div key={key} className="bg-white px-6 py-5">
                <p className="text-sm font-medium text-slate-500">
                  {STATUS_LABELS[key as keyof typeof STATUS_LABELS]}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Workspace
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Switch between fast triage, bigger profile cards, and a round-by-round board.
              </p>
            </div>
            {filtersActive ? (
              <Link
                href={buildQueryHref(slug, { view: activeView })}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
              >
                Clear all
              </Link>
            ) : null}
          </div>

          <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {VIEW_MODES.map((mode) => (
              <Link
                key={mode}
                href={buildQueryHref(slug, {
                  status,
                  decision,
                  q,
                  year,
                  major,
                  view: mode,
                })}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === mode
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {mode === "list" ? "List" : mode === "gallery" ? "Gallery" : "Rounds"}
              </Link>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-500">
            {activeView === "list"
              ? "Best for bulk actions and quick scanning."
              : activeView === "gallery"
                ? "Bigger cards for face-name-memory and fast discussion."
                : "Board view grouped by the current pipeline order."}
          </p>

          <form className="mt-5 grid gap-3">
            <input type="hidden" name="view" value={activeView} />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name or email"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                name="status"
                defaultValue={status ?? ""}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
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
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
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
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
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
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
              >
                <option value="">All majors</option>
                {majors.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Apply filters
            </button>
          </form>
        </div>
      </section>

      {activeView === "list" ? (
        <BulkActionBar
          slug={slug}
          isAdmin={membership.role === "admin"}
          stages={stages}
          decisionLabels={decisionLabels}
          applications={applicationRows}
          stageById={stageById}
          decisionLabelById={decisionLabelById}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          prevPageHref={
            currentPage > 1
              ? buildQueryHref(slug, {
                  status,
                  decision,
                  q,
                  year,
                  major,
                  view: activeView,
                  page: currentPage - 1,
                })
              : null
          }
          nextPageHref={
            currentPage < totalPages
              ? buildQueryHref(slug, {
                  status,
                  decision,
                  q,
                  year,
                  major,
                  view: activeView,
                  page: currentPage + 1,
                })
              : null
          }
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyActionHref={emptyActionHref}
          emptyActionLabel={emptyActionLabel}
        />
      ) : applicationRows.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-[28px] border border-slate-200/90 bg-white px-6 py-18 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-slate-100 text-slate-700">
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
        </section>
      ) : activeView === "gallery" ? (
        <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200/80 px-6 py-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Gallery view</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Scan faces, school context, and current stage before you open the full record.
                </p>
              </div>
              <p className="text-sm text-slate-500">
                {totalCount} applicants in this slice
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3">
            {applicationRows.map((application) => (
              <Link
                key={application.id}
                href={`/portal/${slug}/applicants/${application.id}`}
                className="group rounded-[24px] border border-slate-200 bg-white p-4 transition-[var(--transition-interact)] hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                {application.headshot_url ? (
                  <div className="h-52 w-full overflow-hidden rounded-[1.25rem] border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={application.headshot_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="flex h-52 w-full items-center justify-center rounded-[1.25rem] border border-slate-200 bg-slate-100 text-5xl font-semibold text-slate-700">
                    {getInitials(application.full_name)}
                  </div>
                )}

                <div className="mt-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-950">
                      {application.full_name ?? "Unknown applicant"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {application.email ?? "No email added"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${profileAccentClass(application, stageById, decisionLabelById)}`}
                  >
                    {statusOrStageDisplay(application, stageById)}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                  {application.campus_involvement ?? "No quick involvement summary added yet."}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      School
                    </p>
                    <p className="mt-1.5 text-xs text-slate-900">
                      {[application.year, application.major].filter(Boolean).join(" · ") || "No school info"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Decision
                    </p>
                    <p className="mt-1.5 text-xs text-slate-900">
                      {decisionDisplay(application, decisionLabelById)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Score
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                      {application.score === null ? "—" : application.score.toFixed(1)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {application.review_count} review{application.review_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 transition-colors group-hover:text-slate-950">
                    Open profile →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <span className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildQueryHref(slug, {
                      status,
                      decision,
                      q,
                      year,
                      major,
                      view: activeView,
                      page: currentPage - 1,
                    })}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Previous
                  </Link>
                ) : null}
                {currentPage < totalPages ? (
                  <Link
                    href={buildQueryHref(slug, {
                      status,
                      decision,
                      q,
                      year,
                      major,
                      view: activeView,
                      page: currentPage + 1,
                    })}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200/80 px-6 py-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Round board</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Stay in the current round. Open full applications only when a card needs deeper context.
                </p>
              </div>
              <p className="text-sm text-slate-500">
                Ordered by your current pipeline
              </p>
            </div>
          </div>

          <div className="overflow-x-auto px-6 py-6">
            <div className="flex min-w-max gap-4">
              {roundGroups.map((group) => (
                <div
                  key={group.key}
                  className="flex w-[320px] shrink-0 flex-col rounded-[24px] border border-slate-200 bg-slate-50/80"
                >
                  <div className="border-b border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{group.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${group.tone}`}>
                        {group.applications.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {group.applications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
                        No applicants in this round.
                      </div>
                    ) : (
                      group.applications.map((application) => (
                        <Link
                          key={application.id}
                          href={`/portal/${slug}/applicants/${application.id}`}
                          className="rounded-[20px] border border-slate-200 bg-white p-4 transition-[var(--transition-interact)] hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                        >
                          <div className="flex items-center gap-3">
                            {application.headshot_url ? (
                              <div className="h-12 w-12 overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={application.headshot_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                                {getInitials(application.full_name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">
                                {application.full_name ?? "Unknown applicant"}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {[application.year, application.major].filter(Boolean).join(" · ") || application.email || "No profile details"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${profileAccentClass(application, stageById, decisionLabelById)}`}>
                              {decisionDisplay(application, decisionLabelById)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {application.score === null ? "No score yet" : `${application.score.toFixed(1)} / 10`}
                            </span>
                          </div>

                          <p className="mt-4 text-xs text-slate-500">
                            Applied {formatDate(application.applied_at ?? application.created_at)}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
