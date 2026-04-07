import Link from "next/link";
import { redirect } from "next/navigation";

import {
  isMissingSchemaColumn,
  normalizeApplicationSource,
} from "@/lib/supabase/compat";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { deleteApplication } from "./actions";

type ApplicationStatus = "interested" | "applied" | "interview" | "decision";
type DecisionStatus = "pending" | "accepted" | "rejected" | "waitlisted";

interface Club {
  id: string;
  slug: string;
  name: string;
  category: string | null;
}

interface Application {
  id: string;
  status: ApplicationStatus;
  decision_status: DecisionStatus | null;
  created_at: string;
  applied_at: string | null;
  application_source: "tracked" | "native" | "external_csv";
  clubs: Club | Club[] | null;
}

function getClub(app: Application): Club | null {
  if (!app.clubs) return null;
  return Array.isArray(app.clubs) ? app.clubs[0] ?? null : app.clubs;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Saved",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  interested:
    "inline-flex items-center rounded-control bg-slate-100 px-2 py-0.5 text-xs font-medium text-status-closed ring-1 ring-inset ring-status-closed/20",
  applied:
    "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2 py-0.5 text-xs font-medium text-brand-oxblood ring-1 ring-inset ring-brand-oxblood/18",
  interview:
    "inline-flex items-center rounded-control bg-amber-50 px-2 py-0.5 text-xs font-medium text-status-interview ring-1 ring-inset ring-status-interview/20",
  decision:
    "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2 py-0.5 text-xs font-medium text-brand-oxblood ring-1 ring-inset ring-brand-oxblood/18",
};

const DECISION_BADGE: Record<DecisionStatus, string> = {
  pending:
    "inline-flex items-center rounded-control bg-slate-100 px-2 py-0.5 text-xs font-medium text-status-closed ring-1 ring-inset ring-status-closed/20",
  accepted:
    "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2 py-0.5 text-xs font-medium text-brand-oxblood ring-1 ring-inset ring-brand-oxblood/18",
  rejected:
    "inline-flex items-center rounded-control bg-red-50 px-2 py-0.5 text-xs font-medium text-status-rejected ring-1 ring-inset ring-status-rejected/20",
  waitlisted:
    "inline-flex items-center rounded-control bg-amber-50 px-2 py-0.5 text-xs font-medium text-status-interview ring-1 ring-inset ring-status-interview/20",
};

const VISIBLE_STATUS_ORDER = [
  "applied",
  "interview",
  "decision",
] as const satisfies readonly ApplicationStatus[];

const SOURCE_BADGE: Record<Application["application_source"], string> = {
  tracked:
    "rounded-control border border-border-warm bg-white px-2 py-0.5 text-xs text-ink-muted",
  native:
    "rounded-control border border-brand-oxblood/18 bg-brand-oxblood-soft px-2 py-0.5 text-xs text-brand-oxblood",
  external_csv:
    "rounded-control border border-status-interview/20 bg-amber-50 px-2 py-0.5 text-xs text-status-interview",
};

const SOURCE_LABEL: Record<Application["application_source"], string> = {
  tracked: "Tracker only",
  native: "Submitted in Rush",
  external_csv: "Imported by club",
};

async function loadApplications(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const primary = await supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, created_at, applied_at, application_source, clubs(id, slug, name, category)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return (primary.data ?? []) as Application[];
  }

  if (!isMissingSchemaColumn(primary.error, "application_source")) {
    console.error("Failed to load applications:", primary.error.message);
    return [];
  }

  const fallback = await supabase
    .from("user_applications")
    .select("id, status, decision_status, created_at, applied_at, clubs(id, slug, name, category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fallback.error) {
    console.error("Failed to load applications:", fallback.error.message);
    return [];
  }

  return (fallback.data ?? []).map((row) => ({
    ...row,
    application_source: normalizeApplicationSource(undefined),
  })) as Application[];
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;

  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const apps = await loadApplications(serviceSupabase, authData.user.id);
  const trackedApps = apps.filter((app) => app.status !== "interested");
  const savedInsteadCount = apps.length - trackedApps.length;

  const grouped = VISIBLE_STATUS_ORDER.reduce<Record<(typeof VISIBLE_STATUS_ORDER)[number], Application[]>>(
    (acc, status) => {
      acc[status] = trackedApps.filter((a) => a.status === status);
      return acc;
    },
    { applied: [], interview: [], decision: [] },
  );

  const visibleError =
    error === 'infinite recursion detected in policy for relation "club_admin_memberships"'
      ? null
      : error;

  return (
    <main className="flex flex-col gap-6">
      <section className="rounded-[1.5rem] border border-border-warm bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
              Applications
            </p>
            <h1 className="mt-3 text-[2.6rem] leading-[0.94] tracking-[-0.05em] text-ink">
              Application tracker
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
              This tracker starts once you are actively applying. Clubs you are still considering now belong in Saved clubs.
            </p>
          </div>

          <div className="min-w-0 rounded-[1.25rem] border border-border-warm bg-[#f7f5f2] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
              Before you apply
            </p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Use Saved clubs for organizations you are still evaluating. Move here once you have submitted or started a real application process.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/dashboard/follows"
                className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-3 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
              >
                Open saved clubs
              </Link>
              <Link
                href="/clubs"
                className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-5 py-3 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-brand-oxblood"
              >
                Browse directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-[1.25rem] border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {visibleError ? (
        <div className="rounded-[1.25rem] border border-status-rejected/25 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {visibleError}
        </div>
      ) : null}
      {savedInsteadCount > 0 ? (
        <div className="rounded-[1.25rem] border border-border-warm bg-surface-cool px-4 py-3 text-sm text-ink-muted">
          {savedInsteadCount} pre-application {savedInsteadCount === 1 ? "club is" : "clubs are"} now shown in Saved clubs instead of this tracker.
        </div>
      ) : null}

      {trackedApps.length === 0 ? (
        <section className="rounded-[1.75rem] border border-border-warm bg-white px-6 py-8">
          <p className="text-sm leading-7 text-ink-muted">
            No active applications yet. Save clubs while you are deciding, then use this tracker once you have applied.
          </p>
          <Link
            href="/dashboard/follows"
            className="mt-4 inline-flex items-center text-sm font-medium text-brand-oxblood transition-colors hover:text-ink"
          >
            Open saved clubs →
          </Link>
        </section>
      ) : (
        <section className="overflow-x-auto">
          <div className="grid min-w-[980px] gap-5 lg:grid-cols-3">
            {VISIBLE_STATUS_ORDER.map((status) => (
              <section
                key={status}
                className="rounded-[1.5rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#faf8f7_100%)] p-4"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border-warm pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                      {STATUS_LABELS[status]}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {grouped[status].length} {grouped[status].length === 1 ? "club" : "clubs"}
                    </p>
                  </div>
                  <span className="rounded-full border border-border-warm bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    {grouped[status].length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {grouped[status].length === 0 ? (
                    <div className="rounded-[1.15rem] border border-dashed border-border-warm px-4 py-5 text-sm text-ink-muted">
                      Nothing here yet.
                    </div>
                  ) : (
                    grouped[status].map((app) => {
                      const club = getClub(app);

                      return (
                        <article
                          key={app.id}
                          className="rounded-[1.15rem] border border-border-warm bg-white p-4 transition-[var(--transition-interact)] hover:-translate-y-0.5"
                        >
                          <div>
                            {club ? (
                              <Link
                                href={`/dashboard/applications/${app.id}`}
                                className="text-base font-medium text-ink transition-colors hover:text-brand-oxblood"
                              >
                                {club.name}
                              </Link>
                            ) : (
                              <span className="text-base font-medium text-ink-muted">Unknown club</span>
                            )}
                            {club?.category ? (
                              <p className="mt-1 text-sm text-ink-muted">{club.category}</p>
                            ) : null}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</span>
                            <span className={SOURCE_BADGE[app.application_source]}>
                              {SOURCE_LABEL[app.application_source]}
                            </span>
                            {status === "decision" && app.decision_status ? (
                              <span className={`capitalize ${DECISION_BADGE[app.decision_status]}`}>
                                {app.decision_status}
                              </span>
                            ) : null}
                          </div>

                          {app.applied_at ? (
                            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink-muted">
                              Submitted{" "}
                              {new Date(app.applied_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          ) : null}

                          <div className="mt-4 flex items-center justify-between border-t border-border-warm pt-3">
                            <Link
                              href={`/dashboard/applications/${app.id}`}
                              className="text-sm font-medium text-brand-oxblood transition-colors hover:text-ink"
                            >
                              Open
                            </Link>
                            <form>
                              <input type="hidden" name="application_id" value={app.id} />
                              <button
                                formAction={deleteApplication}
                                className="text-sm font-medium text-ink-muted transition-colors hover:text-status-rejected"
                              >
                                Remove
                              </button>
                            </form>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
