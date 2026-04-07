import Link from "next/link";

import { bulkUpdateApplicants } from "@/app/portal/[slug]/actions";
import {
  addDecisionLabel,
  addPipelineStage,
  applyDecisionTemplate,
  deleteDecisionLabel,
  deletePipelineStage,
  deleteRecruiterView,
  saveDecisionSettings,
  saveRecruiterView,
  updateDecisionLabel,
  updatePipelineStage,
} from "@/app/portal/[slug]/decisions/actions";
import {
  getPortalCapabilities,
  getPortalFeatureUnavailableMessage,
} from "@/lib/portal-features";
import {
  colorTokenClasses,
  computeWeightedScore,
  DECISION_TEMPLATES,
  normalizeDecisionWeights,
} from "@/lib/recruiter-decisions";
import { requirePortalAdmin } from "@/lib/portal";

type Stage = {
  id: string;
  key: string;
  label: string;
  status_bucket: "interested" | "applied" | "interview" | "decision";
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
  position: number;
};

type DecisionLabel = {
  id: string;
  key: string;
  label: string;
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted";
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
  position: number;
};

type DecisionSettings = {
  target_acceptances: number;
  waitlist_target: number;
  weight_problem_solving: number;
  weight_coding_ability: number;
  weight_technical_knowledge: number;
  weight_communication: number;
};

type SavedView = {
  id: string;
  name: string;
  position: number;
  filters: {
    stage_id?: string | null;
    decision_status?: string | null;
    minimum_score?: number | null;
    show_only_unreviewed?: boolean;
    sort?: "weighted_score_desc" | "applied_at_desc" | "name_asc";
  } | null;
};

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

type ReviewRow = {
  application_id: string;
  problem_solving: number;
  coding_ability: number;
  technical_knowledge: number;
  communication: number;
};

const COLOR_OPTIONS = ["slate", "blue", "amber", "green", "rose", "violet"] as const;
const STATUS_OPTIONS = ["interested", "applied", "interview", "decision"] as const;
const DECISION_OPTIONS = ["pending", "accepted", "rejected", "waitlisted"] as const;
const PANEL_CLASS =
  "rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]";
const SOFT_PANEL_CLASS = "rounded-[24px] border border-slate-200 bg-slate-50/80";
const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-[var(--transition-interact)] focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-50";
const DANGER_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-red-100";

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

function scoreBadge(score: number | null) {
  if (score === null) {
    return "text-ink-muted";
  }
  if (score >= 8.5) {
    return "text-brand-oxblood";
  }
  if (score >= 7) {
    return "text-brand-action";
  }
  if (score >= 6) {
    return "text-amber-700";
  }
  return "text-rose-700";
}

export default async function PortalDecisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { view, message, error } = await searchParams;
  const capabilities = await getPortalCapabilities(slug);
  const { supabase, club } = await requirePortalAdmin(slug);

  if (!capabilities.decisionWorkspace) {
    return (
      <main className="flex flex-col gap-6">
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

        <section className={`${PANEL_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Decision workspace
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Decision tools are unavailable on this database.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {getPortalFeatureUnavailableMessage("decisionWorkspace")}
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className={SOFT_PANEL_CLASS}>
              <div className="p-5">
                <p className="text-sm font-semibold text-slate-950">What still works</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>Browse applicants from the main queue.</li>
                  <li>Update the legacy status and decision fields on applicant records.</li>
                  <li>Keep deadlines and club settings current while the portal schema is upgraded.</li>
                </ul>
              </div>
            </div>

            <div className={SOFT_PANEL_CLASS}>
              <div className="flex h-full flex-col justify-between gap-5 p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Next step</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Apply the recruiter portal migrations for decisions, forms, imports, and
                    reviews, then reload this page.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/portal/${slug}`} className={PRIMARY_BUTTON_CLASS}>
                    Back to applicants
                  </Link>
                  <Link href={`/portal/${slug}/settings`} className={SECONDARY_BUTTON_CLASS}>
                    Open settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const [
    settingsResponse,
    stagesResponse,
    labelsResponse,
    viewsResponse,
    applicationsResponse,
  ] = await Promise.all([
    supabase
      .from("club_decision_settings")
      .select(
        "target_acceptances, waitlist_target, weight_problem_solving, weight_coding_ability, weight_technical_knowledge, weight_communication",
      )
      .eq("club_id", club.id)
      .maybeSingle(),
    supabase
      .from("club_pipeline_stages")
      .select("id, key, label, status_bucket, color_token, position")
      .eq("club_id", club.id)
      .order("position"),
    supabase
      .from("club_decision_labels")
      .select("id, key, label, decision_status, color_token, position")
      .eq("club_id", club.id)
      .order("position"),
    supabase
      .from("club_saved_recruiter_views")
      .select("id, name, position, filters")
      .eq("club_id", club.id)
      .order("position"),
    supabase
      .from("user_applications")
      .select(
        "id, status, decision_status, applied_at, created_at, application_source, stage_id, decision_label_id, external_full_name, external_email, external_year, external_major, profiles(full_name, email, year, major)",
      )
      .eq("club_id", club.id)
      .order("created_at", { ascending: false }),
  ]);

  const settings = settingsResponse.data as DecisionSettings | null;
  const stages = (stagesResponse.data ?? []) as Stage[];
  const decisionLabels = (labelsResponse.data ?? []) as DecisionLabel[];
  const savedViews = (viewsResponse.data ?? []) as SavedView[];
  const applications = (applicationsResponse.data ?? []) as Application[];

  const reviewRows = applications.length
    ? (
        await supabase
          .from("club_application_reviews")
          .select(
            "application_id, problem_solving, coding_ability, technical_knowledge, communication",
          )
          .in("application_id", applications.map((application) => application.id))
      ).data ?? []
    : [];

  const reviewsByApplication = new Map<string, ReviewRow[]>();
  for (const review of reviewRows as ReviewRow[]) {
    const current = reviewsByApplication.get(review.application_id) ?? [];
    current.push(review);
    reviewsByApplication.set(review.application_id, current);
  }

  const weights = normalizeDecisionWeights(
    settings
      ? {
          problem_solving: settings.weight_problem_solving,
          coding_ability: settings.weight_coding_ability,
          technical_knowledge: settings.weight_technical_knowledge,
          communication: settings.weight_communication,
        }
      : null,
  );

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const labelById = new Map(decisionLabels.map((label) => [label.id, label]));
  const activeView = savedViews.find((savedView) => savedView.id === view) ?? null;
  const activeFilters = activeView?.filters ?? null;

  const applicants = applications
    .map((application) => {
      const reviews = reviewsByApplication.get(application.id) ?? [];
      return {
        ...application,
        weightedScore: computeWeightedScore(reviews, weights),
        reviewCount: reviews.length,
        stage: application.stage_id ? stageById.get(application.stage_id) ?? null : null,
        decisionLabel: application.decision_label_id
          ? labelById.get(application.decision_label_id) ?? null
          : null,
      };
    })
    .filter((application) => {
      if (activeFilters?.stage_id && application.stage_id !== activeFilters.stage_id) {
        return false;
      }
      if (
        activeFilters?.decision_status &&
        (application.decisionLabel?.decision_status ?? application.decision_status ?? "pending") !==
          activeFilters.decision_status
      ) {
        return false;
      }
      if (
        typeof activeFilters?.minimum_score === "number" &&
        (application.weightedScore ?? -1) < activeFilters.minimum_score
      ) {
        return false;
      }
      if (activeFilters?.show_only_unreviewed && application.reviewCount > 0) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const sort = activeFilters?.sort ?? "weighted_score_desc";
      if (sort === "name_asc") {
        return (applicantField(left, "full_name") ?? "").localeCompare(
          applicantField(right, "full_name") ?? "",
        );
      }
      if (sort === "applied_at_desc") {
        return new Date(right.applied_at ?? right.created_at).getTime() -
          new Date(left.applied_at ?? left.created_at).getTime();
      }
      return (right.weightedScore ?? -1) - (left.weightedScore ?? -1);
    });

  const acceptedCount = applicants.filter((application) => {
    return (application.decisionLabel?.decision_status ?? application.decision_status) === "accepted";
  }).length;
  const waitlistCount = applicants.filter((application) => {
    return (application.decisionLabel?.decision_status ?? application.decision_status) === "waitlisted";
  }).length;

  const targetAcceptances = settings?.target_acceptances ?? 0;
  const waitlistTarget = settings?.waitlist_target ?? 0;
  const seatsRemaining = Math.max(0, targetAcceptances - acceptedCount);
  const bulkRedirectTo = activeView
    ? `/portal/${slug}/decisions?view=${activeView.id}`
    : `/portal/${slug}/decisions`;

  return (
    <main className="flex flex-col gap-6">
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

      <section className={`overflow-hidden ${PANEL_CLASS}`}>
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Final decisions
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Work the final class, not the whole pipeline.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use this page for shortlist views, seat targets, and final labels. Workflow setup
                lives below in a separate admin section when you need it.
              </p>
            </div>

            {activeView ? (
              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                View: {activeView.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-px bg-slate-200/80 xl:grid-cols-4">
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Accepted</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{acceptedCount}</p>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Waitlist</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{waitlistCount}</p>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Target seats</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{targetAcceptances}</p>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Seats remaining</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{seatsRemaining}</p>
            <p className="mt-1 text-xs text-slate-500">Waitlist target: {waitlistTarget}</p>
          </div>
        </div>
      </section>

      <section className={`${PANEL_CLASS} px-6 py-5 sm:px-7`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-950">Page guide</p>
            <p className="mt-1 text-sm text-slate-600">
              Most teams should stay in the shortlist section. Open setup only when your process itself needs changes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#shortlist" className={PRIMARY_BUTTON_CLASS}>
              Jump to shortlist
            </a>
            <a href="#views" className={SECONDARY_BUTTON_CLASS}>
              Saved views
            </a>
            <a href="#setup" className={SECONDARY_BUTTON_CLASS}>
              Decision setup
            </a>
          </div>
        </div>
      </section>

      <section id="views" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={`${PANEL_CLASS} p-6`}>
          <h2 className="text-xl font-semibold text-slate-950">Seat targets and rubric</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set the class size and scoring weights used in final-cut discussion.
          </p>

          <form className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Target accepts</label>
              <input
                name="target_acceptances"
                type="number"
                min={0}
                defaultValue={targetAcceptances}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Waitlist target</label>
              <input
                name="waitlist_target"
                type="number"
                min={0}
                defaultValue={waitlistTarget}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Problem solving weight</label>
              <input
                name="weight_problem_solving"
                type="number"
                min={1}
                defaultValue={weights.problem_solving}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Coding ability weight</label>
              <input
                name="weight_coding_ability"
                type="number"
                min={1}
                defaultValue={weights.coding_ability}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Technical knowledge weight</label>
              <input
                name="weight_technical_knowledge"
                type="number"
                min={1}
                defaultValue={weights.technical_knowledge}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Communication weight</label>
              <input
                name="weight_communication"
                type="number"
                min={1}
                defaultValue={weights.communication}
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <button formAction={saveDecisionSettings.bind(null, slug)} className={PRIMARY_BUTTON_CLASS}>
                Save decision settings
              </button>
            </div>
          </form>
        </div>

        <div className={`${PANEL_CLASS} p-6`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Shortlist views</h2>
              <p className="mt-1 text-sm text-slate-600">
                Save slices like &quot;Needs discussion&quot; or &quot;Strong yes&quot; so the team can reopen the same shortlist fast.
              </p>
            </div>
            {activeView ? (
              <Link
                href={`/portal/${slug}/decisions`}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
              >
                Clear view
              </Link>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {savedViews.length === 0 ? (
              <p className="text-sm text-slate-600">No saved views yet.</p>
            ) : (
              savedViews.map((savedView) => (
                <div key={savedView.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <Link
                    href={`/portal/${slug}/decisions?view=${savedView.id}`}
                    className={`text-sm font-medium ${
                      activeView?.id === savedView.id
                        ? "text-slate-950"
                        : "text-slate-500 hover:text-slate-950"
                    }`}
                  >
                    {savedView.name}
                  </Link>
                  <form>
                    <button
                      formAction={deleteRecruiterView.bind(null, slug, savedView.id)}
                      className="text-xs font-medium text-red-600 transition-colors hover:text-red-700"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-3">
            <input name="name" placeholder="View name" className={INPUT_CLASS} />
            <select name="stage_id" defaultValue="" className={INPUT_CLASS}>
              <option value="">Any stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
            <select name="decision_status" defaultValue="" className={INPUT_CLASS}>
              <option value="">Any decision</option>
              {DECISION_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <input
              name="minimum_score"
              type="number"
              min={0}
              step="0.1"
              defaultValue=""
              placeholder="Minimum score"
              className={INPUT_CLASS}
            />
            <select name="sort" defaultValue="weighted_score_desc" className={INPUT_CLASS}>
              <option value="weighted_score_desc">Sort by weighted score</option>
              <option value="applied_at_desc">Sort by applied date</option>
              <option value="name_asc">Sort by name</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <input type="checkbox" name="show_only_unreviewed" className="h-4 w-4" />
              Show only unreviewed
            </label>
            <input type="hidden" name="position" value={savedViews.length} />
            <div className="lg:col-span-3">
              <button formAction={saveRecruiterView.bind(null, slug)} className={SECONDARY_BUTTON_CLASS}>
                Save recruiter view
              </button>
            </div>
          </form>
        </div>
      </section>

      <details id="setup" className={`${PANEL_CLASS} overflow-hidden`}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5 sm:px-7">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Decision setup</h2>
            <p className="mt-1 text-sm text-slate-600">
              Templates, pipeline stages, and custom labels. Most recruiters should only open this when the process itself changes.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            Expand setup
          </span>
        </summary>

        <div className="border-t border-slate-200/80 px-6 py-6 sm:px-7">
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Preset templates</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Start with a tuned recruiting workflow, then customize stages and labels for your club.
                </p>
              </div>
              <Link
                href={`/portal/${slug}`}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-950"
              >
                Back to applicants →
              </Link>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {DECISION_TEMPLATES.map((template) => (
                <div key={template.key} className={`${SOFT_PANEL_CLASS} p-5`}>
                  <p className="text-sm font-semibold text-slate-950">{template.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.stages.map((stage) => (
                      <span
                        key={stage.key}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(stage.color_token)}`}
                      >
                        {stage.label}
                      </span>
                    ))}
                  </div>
                  <form className="mt-5">
                    <input type="hidden" name="template_key" value={template.key} />
                    <button formAction={applyDecisionTemplate.bind(null, slug)} className={PRIMARY_BUTTON_CLASS}>
                      Apply {template.name}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className={`${PANEL_CLASS} p-6`}>
          <h2 className="text-xl font-semibold text-slate-950">Pipeline stages</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add the steps your team actually uses, like Application review, Coffee chat, or Final round.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Use a short internal name, a student-facing label, the matching status bucket, a color,
            and the order you want it to appear in.
          </p>

          <form className="mt-5 grid gap-3 lg:grid-cols-5">
            <input name="key" placeholder="Internal name, like final-round" className={INPUT_CLASS} />
            <input name="label" placeholder="Visible label, like Final round" className={INPUT_CLASS} />
            <select name="status_bucket" defaultValue="applied" className={INPUT_CLASS}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="color_token" defaultValue="green" className={INPUT_CLASS}>
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                name="position"
                type="number"
                defaultValue={stages.length}
                aria-label="Stage order"
                className="w-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-[var(--transition-interact)] focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
              />
              <button formAction={addPipelineStage.bind(null, slug)} className={SECONDARY_BUTTON_CLASS}>
                Add
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-col gap-3">
            {stages.length === 0 ? (
              <p className="text-sm text-slate-600">
                Start with a preset above, or add your first stage here.
              </p>
            ) : (
              stages.map((stage) => (
                <form key={stage.id} className={`grid gap-3 ${SOFT_PANEL_CLASS} p-4 lg:grid-cols-[1fr_1.3fr_1fr_1fr_140px_auto_auto]`}>
                  <input
                    name="key"
                    defaultValue={stage.key}
                    aria-label={`Internal name for ${stage.label}`}
                    className={INPUT_CLASS}
                  />
                  <input
                    name="label"
                    defaultValue={stage.label}
                    aria-label={`Visible label for ${stage.label}`}
                    className={INPUT_CLASS}
                  />
                  <select name="status_bucket" defaultValue={stage.status_bucket} className={INPUT_CLASS}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select name="color_token" defaultValue={stage.color_token} className={INPUT_CLASS}>
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <input
                    name="position"
                    type="number"
                    defaultValue={stage.position}
                    aria-label={`Order for ${stage.label}`}
                    className={INPUT_CLASS}
                  />
                  <button formAction={updatePipelineStage.bind(null, slug, stage.id)} className={SECONDARY_BUTTON_CLASS}>
                    Save
                  </button>
                  <button formAction={deletePipelineStage.bind(null, slug, stage.id)} className={DANGER_BUTTON_CLASS}>
                    Delete
                  </button>
                </form>
              ))
            )}
          </div>
        </div>

        <div className={`${PANEL_CLASS} p-6`}>
          <h2 className="text-xl font-semibold text-slate-950">Decision labels</h2>
          <p className="mt-1 text-sm text-slate-600">
            Customize the final labels your team uses, like Offer, Hold, or Not moving forward.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Each label still maps to a core decision result underneath, so reporting and bulk
            actions stay consistent.
          </p>

          <form className="mt-5 grid gap-3 lg:grid-cols-5">
            <input name="key" placeholder="Internal name, like offer" className={INPUT_CLASS} />
            <input name="label" placeholder="Visible label, like Offer" className={INPUT_CLASS} />
            <select name="decision_status" defaultValue="accepted" className={INPUT_CLASS}>
              {DECISION_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="color_token" defaultValue="green" className={INPUT_CLASS}>
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                name="position"
                type="number"
                defaultValue={decisionLabels.length}
                aria-label="Decision label order"
                className="w-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-[var(--transition-interact)] focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
              />
              <button formAction={addDecisionLabel.bind(null, slug)} className={SECONDARY_BUTTON_CLASS}>
                Add
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-col gap-3">
            {decisionLabels.length === 0 ? (
              <p className="text-sm text-slate-600">
                Start with a preset above, or add your first decision label here.
              </p>
            ) : (
              decisionLabels.map((label) => (
                <form key={label.id} className={`grid gap-3 ${SOFT_PANEL_CLASS} p-4 lg:grid-cols-[1fr_1.3fr_1fr_1fr_140px_auto_auto]`}>
                  <input
                    name="key"
                    defaultValue={label.key}
                    aria-label={`Internal name for ${label.label}`}
                    className={INPUT_CLASS}
                  />
                  <input
                    name="label"
                    defaultValue={label.label}
                    aria-label={`Visible label for ${label.label}`}
                    className={INPUT_CLASS}
                  />
                  <select name="decision_status" defaultValue={label.decision_status} className={INPUT_CLASS}>
                    {DECISION_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select name="color_token" defaultValue={label.color_token} className={INPUT_CLASS}>
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <input
                    name="position"
                    type="number"
                    defaultValue={label.position}
                    aria-label={`Order for ${label.label}`}
                    className={INPUT_CLASS}
                  />
                  <button formAction={updateDecisionLabel.bind(null, slug, label.id)} className={SECONDARY_BUTTON_CLASS}>
                    Save
                  </button>
                  <button formAction={deleteDecisionLabel.bind(null, slug, label.id)} className={DANGER_BUTTON_CLASS}>
                    Delete
                  </button>
                </form>
              ))
            )}
          </div>
        </div>
          </section>
        </div>
      </details>

      <section id="shortlist" className={`overflow-hidden ${PANEL_CLASS}`}>
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Final shortlist</h2>
            <p className="mt-1 text-sm text-slate-600">
              This is the operating surface for the class. Filter, compare, and bulk move the applicants who are still in play.
            </p>
          </div>
          {activeView ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              View: {activeView.name}
            </span>
          ) : null}
        </div>

        <form>
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-5 lg:flex-row lg:items-center">
            <input type="hidden" name="redirect_to" value={bulkRedirectTo} />
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <select name="stage_id" defaultValue="" className={INPUT_CLASS}>
                <option value="">No stage change</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
              <select name="decision_label_id" defaultValue="" className={INPUT_CLASS}>
                <option value="">No decision label change</option>
                {decisionLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.label}
                  </option>
                ))}
              </select>
            </div>
            <button formAction={bulkUpdateApplicants.bind(null, slug)} className={`${PRIMARY_BUTTON_CLASS} lg:min-w-[220px]`}>
              Apply bulk decision update
            </button>
          </div>

          {applicants.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
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
                    d="M4.75 7.5h14.5M7.75 4.75h8.5a2.5 2.5 0 012.5 2.5v9.5a2.5 2.5 0 01-2.5 2.5h-8.5a2.5 2.5 0 01-2.5-2.5v-9.5a2.5 2.5 0 012.5-2.5z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11.25h7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14.25h4" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                No applicants match this decision view
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Adjust the saved view, lower the score threshold, or clear the current decision
                slice to bring candidates back into focus.
              </p>
              <Link
                href={`/portal/${slug}/decisions`}
                className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Clear decision view
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Applicant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Decision</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Weighted score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Reviews</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Applied</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((application) => (
                    <tr key={application.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <input name="application_ids" type="checkbox" value={application.id} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {applicantField(application, "full_name") ?? "Unknown applicant"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {[applicantField(application, "year"), applicantField(application, "major")]
                              .filter(Boolean)
                              .join(" · ") || applicantField(application, "email") || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {application.stage ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(application.stage.color_token)}`}>
                            {application.stage.label}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">{application.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {application.decisionLabel ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(application.decisionLabel.color_token)}`}>
                            {application.decisionLabel.label}
                          </span>
                        ) : (
                          <span className="text-sm capitalize text-slate-500">
                            {application.decision_status ?? "pending"}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${scoreBadge(application.weightedScore)}`}>
                        {application.weightedScore === null ? "—" : `${application.weightedScore}/10`}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{application.reviewCount}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(application.applied_at ?? application.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portal/${slug}/applicants/${application.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
