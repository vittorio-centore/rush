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
  const { supabase, club } = await requirePortalAdmin(slug);

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
        <div className="rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-card border border-border bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Accepted</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{acceptedCount}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Waitlist</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{waitlistCount}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Target seats</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{targetAcceptances}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Seats remaining</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{seatsRemaining}</p>
          <p className="mt-1 text-xs text-ink-muted">Waitlist target: {waitlistTarget}</p>
        </div>
      </section>

      <section className="rounded-card border border-border bg-white p-6 shadow-card">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Preset templates</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Start with a tuned recruiting workflow, then customize stages and labels for your club.
            </p>
          </div>
          <Link
            href={`/portal/${slug}`}
            className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Back to applicants →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {DECISION_TEMPLATES.map((template) => (
            <div key={template.key} className="rounded-card border border-border bg-surface-cool p-5">
              <p className="text-sm font-semibold text-ink">{template.name}</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{template.description}</p>
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
                <button
                  formAction={applyDecisionTemplate.bind(null, slug)}
                  className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
                >
                  Apply {template.name}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-card border border-border bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-ink">Rubric and capacity</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Control how final score is calculated and how many candidates you plan to take.
          </p>

          <form className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Target accepts</label>
              <input
                name="target_acceptances"
                type="number"
                min={0}
                defaultValue={targetAcceptances}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Waitlist target</label>
              <input
                name="waitlist_target"
                type="number"
                min={0}
                defaultValue={waitlistTarget}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Problem solving weight</label>
              <input
                name="weight_problem_solving"
                type="number"
                min={1}
                defaultValue={weights.problem_solving}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Coding ability weight</label>
              <input
                name="weight_coding_ability"
                type="number"
                min={1}
                defaultValue={weights.coding_ability}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Technical knowledge weight</label>
              <input
                name="weight_technical_knowledge"
                type="number"
                min={1}
                defaultValue={weights.technical_knowledge}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-muted">Communication weight</label>
              <input
                name="weight_communication"
                type="number"
                min={1}
                defaultValue={weights.communication}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                formAction={saveDecisionSettings.bind(null, slug)}
                className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
              >
                Save decision settings
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-card border border-border bg-white p-6 shadow-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Saved recruiter views</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Save final-cut slices like &quot;Needs discussion&quot; or &quot;High-scoring shortlist&quot;.
              </p>
            </div>
            {activeView ? (
              <Link
                href={`/portal/${slug}/decisions`}
                className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Clear view
              </Link>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {savedViews.length === 0 ? (
              <p className="text-sm text-ink-muted">No saved views yet.</p>
            ) : (
              savedViews.map((savedView) => (
                <div key={savedView.id} className="flex items-center gap-2 rounded-full border border-border bg-surface-cool px-3 py-1.5">
                  <Link
                    href={`/portal/${slug}/decisions?view=${savedView.id}`}
                    className={`text-sm font-medium ${activeView?.id === savedView.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                  >
                    {savedView.name}
                  </Link>
                  <form>
                    <button
                      formAction={deleteRecruiterView.bind(null, slug, savedView.id)}
                      className="text-xs font-medium text-status-rejected transition-colors hover:text-red-700"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <form className="mt-5 grid gap-4 lg:grid-cols-3">
            <input
              name="name"
              placeholder="View name"
              className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            />
            <select
              name="stage_id"
              defaultValue=""
              className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            >
              <option value="">Any stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
            <select
              name="decision_status"
              defaultValue=""
              className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            >
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
              className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            />
            <select
              name="sort"
              defaultValue="weighted_score_desc"
              className="rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            >
              <option value="weighted_score_desc">Sort by weighted score</option>
              <option value="applied_at_desc">Sort by applied date</option>
              <option value="name_asc">Sort by name</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-control border border-border bg-surface-cool px-3 py-2 text-sm text-ink-muted">
              <input type="checkbox" name="show_only_unreviewed" className="h-4 w-4" />
              Show only unreviewed
            </label>
            <input type="hidden" name="position" value={savedViews.length} />
            <div className="lg:col-span-3">
              <button
                formAction={saveRecruiterView.bind(null, slug)}
                className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-border hover:text-ink"
              >
                Save recruiter view
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-card border border-border bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-ink">Pipeline stages</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Rename stages to match your actual process while keeping the legacy status bucket underneath.
          </p>

          <form className="mt-5 grid gap-3 lg:grid-cols-5">
            <input name="key" placeholder="stage_key" className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
            <input name="label" placeholder="Stage label" className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
            <select name="status_bucket" defaultValue="applied" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="color_token" defaultValue="green" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input name="position" type="number" defaultValue={stages.length} className="w-20 rounded-control border border-border px-3 py-2 text-sm text-ink" />
              <button formAction={addPipelineStage.bind(null, slug)} className="rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink-muted hover:bg-border hover:text-ink">
                Add
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-col gap-3">
            {stages.length === 0 ? (
              <p className="text-sm text-ink-muted">Apply a preset or add your first stage.</p>
            ) : (
              stages.map((stage) => (
                <form key={stage.id} className="grid gap-3 rounded-card border border-border bg-surface-cool p-4 lg:grid-cols-[1fr_1.3fr_1fr_1fr_120px_auto_auto]">
                  <input name="key" defaultValue={stage.key} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <input name="label" defaultValue={stage.label} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <select name="status_bucket" defaultValue={stage.status_bucket} className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select name="color_token" defaultValue={stage.color_token} className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <input name="position" type="number" defaultValue={stage.position} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <button formAction={updatePipelineStage.bind(null, slug, stage.id)} className="rounded-control border border-border bg-white px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-cool">
                    Save
                  </button>
                  <button formAction={deletePipelineStage.bind(null, slug, stage.id)} className="rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-status-rejected hover:bg-red-100">
                    Delete
                  </button>
                </form>
              ))
            )}
          </div>
        </div>

        <div className="rounded-card border border-border bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-ink">Decision labels</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Customize the final language you use instead of forcing every club into the same accepted/waitlist/reject wording.
          </p>

          <form className="mt-5 grid gap-3 lg:grid-cols-5">
            <input name="key" placeholder="offer_key" className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
            <input name="label" placeholder="Label" className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
            <select name="decision_status" defaultValue="accepted" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
              {DECISION_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="color_token" defaultValue="green" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input name="position" type="number" defaultValue={decisionLabels.length} className="w-20 rounded-control border border-border px-3 py-2 text-sm text-ink" />
              <button formAction={addDecisionLabel.bind(null, slug)} className="rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink-muted hover:bg-border hover:text-ink">
                Add
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-col gap-3">
            {decisionLabels.length === 0 ? (
              <p className="text-sm text-ink-muted">Apply a preset or add your first decision label.</p>
            ) : (
              decisionLabels.map((label) => (
                <form key={label.id} className="grid gap-3 rounded-card border border-border bg-surface-cool p-4 lg:grid-cols-[1fr_1.3fr_1fr_1fr_120px_auto_auto]">
                  <input name="key" defaultValue={label.key} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <input name="label" defaultValue={label.label} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <select name="decision_status" defaultValue={label.decision_status} className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                    {DECISION_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select name="color_token" defaultValue={label.color_token} className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <input name="position" type="number" defaultValue={label.position} className="rounded-control border border-border px-3 py-2 text-sm text-ink" />
                  <button formAction={updateDecisionLabel.bind(null, slug, label.id)} className="rounded-control border border-border bg-white px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-cool">
                    Save
                  </button>
                  <button formAction={deleteDecisionLabel.bind(null, slug, label.id)} className="rounded-control border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-status-rejected hover:bg-red-100">
                    Delete
                  </button>
                </form>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-border bg-white shadow-card">
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Decision table</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Use weighted score, custom stages, and custom labels to move a final class together.
            </p>
          </div>
          {activeView ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-status-closed">
              View: {activeView.name}
            </span>
          ) : null}
        </div>

        <form>
          <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center">
            <input type="hidden" name="redirect_to" value={bulkRedirectTo} />
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <select name="stage_id" defaultValue="" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                <option value="">No stage change</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
              <select name="decision_label_id" defaultValue="" className="rounded-control border border-border px-3 py-2 text-sm text-ink">
                <option value="">No decision label change</option>
                {decisionLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              formAction={bulkUpdateApplicants.bind(null, slug)}
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
            >
              Apply bulk decision update
            </button>
          </div>

          {applicants.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-muted">
              No applicants match this decision view.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-cool">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Applicant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Decision</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Weighted score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Reviews</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Applied</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((application) => (
                    <tr key={application.id} className="border-b border-border last:border-0 hover:bg-surface-cool">
                      <td className="px-4 py-3">
                        <input name="application_ids" type="checkbox" value={application.id} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {applicantField(application, "full_name") ?? "Unknown applicant"}
                          </p>
                          <p className="text-xs text-ink-muted">
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
                          <span className="text-sm text-ink-muted">{application.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {application.decisionLabel ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(application.decisionLabel.color_token)}`}>
                            {application.decisionLabel.label}
                          </span>
                        ) : (
                          <span className="text-sm capitalize text-ink-muted">
                            {application.decision_status ?? "pending"}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${scoreBadge(application.weightedScore)}`}>
                        {application.weightedScore === null ? "—" : `${application.weightedScore}/10`}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">{application.reviewCount}</td>
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
