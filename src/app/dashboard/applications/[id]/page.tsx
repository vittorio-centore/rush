import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  isMissingSchemaColumn,
  normalizeApplicationSource,
} from "@/lib/supabase/compat";
import { createClient } from "@/lib/supabase/server";

import { deleteApplication, updateApplication } from "./actions";

type ApplicationStatus = "interested" | "applied" | "interview" | "decision";
type DecisionStatus = "pending" | "accepted" | "rejected" | "waitlisted";

interface Club {
  id: string;
  slug: string | null;
  name: string;
}

interface Application {
  id: string;
  status: ApplicationStatus;
  decision_status: DecisionStatus | null;
  notes: string | null;
  essay_draft: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string | null;
  application_source: "tracked" | "native" | "external_csv";
  clubs: Club | Club[] | null;
}

function getClub(app: Application): Club | null {
  if (!app.clubs) return null;
  return Array.isArray(app.clubs) ? app.clubs[0] ?? null : app.clubs;
}

const STATUS_FLOW = ["interested", "applied", "interview", "decision"] as const;

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Planning",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

const STATUS_COPY: Record<ApplicationStatus, string> = {
  interested: "Actively planning your next move",
  applied: "Application submitted",
  interview: "Interview process",
  decision: "Final outcome",
};

const SOURCE_LABEL: Record<Application["application_source"], string> = {
  tracked: "Tracker only",
  native: "Rush native application",
  external_csv: "Imported by club",
};

const DECISION_LABEL: Record<DecisionStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
};

async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const primary = await supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, notes, essay_draft, applied_at, created_at, updated_at, application_source, clubs(id, slug, name)",
    )
    .eq("id", applicationId)
    .eq("user_id", userId)
    .single();

  if (!primary.error) {
    return primary.data as Application;
  }

  if (!isMissingSchemaColumn(primary.error, "application_source")) {
    console.error("Failed to load application:", primary.error.message);
    return null;
  }

  const fallback = await supabase
    .from("user_applications")
    .select("id, status, decision_status, notes, essay_draft, applied_at, created_at, updated_at, clubs(id, slug, name)")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .single();

  if (fallback.error) {
    console.error("Failed to load application:", fallback.error.message);
    return null;
  }

  return {
    ...(fallback.data as Omit<Application, "application_source">),
    application_source: normalizeApplicationSource(undefined),
  } satisfies Application;
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const { message, error } = await searchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const application = await loadApplication(supabase, id, authData.user.id);

  if (!application) {
    notFound();
  }

  const app = application as Application;
  const club = getClub(app);
  const currentStageIndex = STATUS_FLOW.indexOf(app.status);
  const updatedLabel = formatLongDate(app.updated_at ?? app.created_at);

  return (
    <main className="flex flex-col gap-8">
      <section className="border-b border-border-warm pb-8">
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center text-sm font-medium text-ink-muted transition-colors hover:text-brand-oxblood"
        >
          Back to tracker
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
              Application record
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl leading-[0.98] tracking-[-0.05em] text-ink">
              {club?.name ?? "Unknown club"}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted">
              Keep your stage, notes, and draft work in one place so the next move is obvious when recruiting picks up.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={getStatusBadgeClass(app.status)}>{STATUS_LABELS[app.status]}</span>
              <span className="inline-flex items-center rounded-full border border-border-warm bg-white px-3 py-1 text-xs font-medium text-ink-muted">
                {SOURCE_LABEL[app.application_source]}
              </span>
              {app.status === "decision" && app.decision_status ? (
                <span className={getDecisionBadgeClass(app.decision_status)}>
                  {DECISION_LABEL[app.decision_status]}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 border-t border-border-warm pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <MetaStat
              label="Last updated"
              value={updatedLabel}
              note="Most recent tracker change"
            />
            <MetaStat
              label="Submitted"
              value={app.applied_at ? formatShortDate(app.applied_at) : "Not yet"}
              note={app.applied_at ? "Application marked as sent" : "Move to Applied when you submit"}
            />
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-[1.25rem] border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[1.25rem] border border-status-rejected/25 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <form action={updateApplication.bind(null, id)} className="space-y-6">
          <SectionBlock
            eyebrow="Stage"
            title="Where this application stands"
            description="Use Planning for clubs you are actively preparing for. Decision stays inactive until the application reaches the final step."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" htmlFor="status">
                <select
                  id="status"
                  name="status"
                  defaultValue={app.status}
                  className={INPUT_CLASS}
                >
                  {STATUS_FLOW.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Decision" htmlFor="decision_status">
                <select
                  id="decision_status"
                  name="decision_status"
                  defaultValue={app.decision_status ?? "pending"}
                  disabled={app.status !== "decision"}
                  className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-surface-warm disabled:text-ink-muted`}
                >
                  {Object.entries(DECISION_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              When you move this to Applied for the first time, Rush stamps a submission date automatically.
            </p>
          </SectionBlock>

          <SectionBlock
            eyebrow="Notes"
            title="Recruiting context"
            description="Keep interview details, contacts, deadlines, and reminders together instead of in a separate notes app."
          >
            <Field label="Notes" htmlFor="notes">
              <textarea
                id="notes"
                name="notes"
                defaultValue={app.notes ?? ""}
                rows={7}
                placeholder="Contacts, interview format, prep notes, timeline changes..."
                className={TEXTAREA_CLASS}
              />
            </Field>
          </SectionBlock>

          <SectionBlock
            eyebrow="Writing"
            title="Essay or short-answer draft"
            description="Use this as a working draft surface before you paste into the club application."
          >
            <Field label="Draft" htmlFor="essay_draft">
              <textarea
                id="essay_draft"
                name="essay_draft"
                defaultValue={app.essay_draft ?? ""}
                rows={14}
                placeholder="Draft your application essay here..."
                className={TEXTAREA_CLASS}
              />
            </Field>
          </SectionBlock>

          <div className="flex items-center justify-between border-t border-border-warm pt-2">
            <p className="text-sm text-ink-muted">
              Save after major stage changes, new interview notes, or draft revisions.
            </p>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
            >
              Save changes
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-[1.75rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#f8f7f6_100%)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
              Progress view
            </p>
            <div className="mt-5 space-y-4">
              {STATUS_FLOW.map((status, index) => {
                const complete = index < currentStageIndex;
                const active = index === currentStageIndex;

                return (
                  <div key={status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold uppercase tracking-[0.16em] ${
                          active
                            ? "border-brand-oxblood/20 bg-brand-oxblood-soft text-brand-oxblood"
                            : complete
                              ? "border-border-warm bg-white text-ink"
                              : "border-border-warm bg-white text-ink-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {index < STATUS_FLOW.length - 1 ? (
                        <span className="mt-2 h-8 w-px bg-border-warm" />
                      ) : null}
                    </div>

                    <div className="pb-4">
                      <p className="text-sm font-medium text-ink">{STATUS_LABELS[status]}</p>
                      <p className="mt-1 text-sm leading-7 text-ink-muted">
                        {STATUS_COPY[status]}
                      </p>
                      {active ? (
                        <span className="mt-2 inline-flex items-center rounded-full bg-brand-oxblood-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-oxblood">
                          Current stage
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border-warm bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
              Timeline
            </p>
            <div className="mt-4 space-y-3">
              <MetaRow label="Added to tracker" value={formatLongDate(app.created_at)} />
              <MetaRow
                label="Marked applied"
                value={app.applied_at ? formatLongDate(app.applied_at) : "Not marked yet"}
              />
              <MetaRow label="Last update" value={updatedLabel} />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border-warm bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
              Quick routes
            </p>
            <div className="mt-4 space-y-3">
              {club ? (
                <QuickLink
                  href={`/clubs/${club.slug ?? club.id}`}
                  label="Open club page"
                  body="Review the organization page and current recruiting details."
                />
              ) : null}
              {app.application_source === "native" && club ? (
                <QuickLink
                  href={`/clubs/${club.slug ?? club.id}/apply`}
                  label="Edit Rush submission"
                  body="Jump back into the native application form."
                />
              ) : null}
              <QuickLink
                href="/dashboard/applications"
                label="Back to tracker"
                body="Return to the full application pipeline."
              />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-status-rejected/20 bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-status-rejected">
              Remove
            </p>
            <p className="mt-3 text-sm leading-7 text-ink-muted">
              Delete this application only if you do not want it in your tracker anymore.
            </p>
            <form className="mt-5">
              <input type="hidden" name="application_id" value={app.id} />
              <button
                formAction={deleteApplication}
                className="inline-flex items-center justify-center rounded-control border border-status-rejected/30 bg-red-50 px-4 py-2.5 text-sm font-medium text-status-rejected transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-red-100"
              >
                Remove application
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

const INPUT_CLASS =
  "w-full rounded-[0.95rem] border border-border-warm bg-white px-3.5 py-3 text-sm text-ink outline-none transition-[var(--transition-interact)] focus:border-brand-action focus:ring-1 focus:ring-brand-action/20";

const TEXTAREA_CLASS =
  "w-full resize-none rounded-[0.95rem] border border-border-warm bg-white px-3.5 py-3 text-sm leading-7 text-ink placeholder:text-ink-muted/60 outline-none transition-[var(--transition-interact)] focus:border-brand-action focus:ring-1 focus:ring-brand-action/20";

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStatusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "interested":
      return "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-status-closed";
    case "applied":
      return "inline-flex items-center rounded-full bg-brand-oxblood-soft px-3 py-1 text-xs font-medium text-brand-oxblood";
    case "interview":
      return "inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-status-interview";
    case "decision":
      return "inline-flex items-center rounded-full bg-brand-oxblood-soft px-3 py-1 text-xs font-medium text-brand-oxblood";
  }
}

function getDecisionBadgeClass(status: DecisionStatus) {
  switch (status) {
    case "pending":
      return "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-status-closed";
    case "accepted":
      return "inline-flex items-center rounded-full bg-brand-oxblood-soft px-3 py-1 text-xs font-medium text-brand-oxblood";
    case "rejected":
      return "inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-status-rejected";
    case "waitlisted":
      return "inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-status-interview";
  }
}

function SectionBlock({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-border-warm bg-white p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl leading-tight tracking-[-0.04em] text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetaStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border-b border-border-warm pb-4 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {label}
      </p>
      <p className="mt-2 text-3xl leading-none tracking-[-0.05em] text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-muted">{note}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-warm pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  label,
  body,
}: {
  href: string;
  label: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[1.15rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#faf8f7_100%)] px-4 py-4 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/16"
    >
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-1 text-sm leading-7 text-ink-muted">{body}</p>
    </Link>
  );
}
