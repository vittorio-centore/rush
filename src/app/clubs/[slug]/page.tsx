import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addApplication } from "@/app/dashboard/applications/actions";
import { TrackedAnchor, TrackedLink } from "@/components/TrackedLink";
import SiteHeader from "@/components/SiteHeader";
import { insertEvent } from "@/lib/events";
import {
  isMissingSchemaColumn,
  normalizeApplicationSource,
  normalizeTargetYears,
} from "@/lib/supabase/compat";
import { createClient } from "@/lib/supabase/server";
import FollowButton from "./FollowButton";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ message?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: club } = await supabase
    .from("clubs")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!club) {
    return { title: "Club not found | Rush" };
  }

  return {
    title: `${club.name} | Rush`,
    description: club.description ?? undefined,
    openGraph: {
      title: `${club.name} | Rush`,
      description: club.description ?? undefined,
    },
  };
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Status unknown",
};

const STATUS_BADGE: Record<string, string> = {
  open: "inline-flex items-center rounded-control bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-status-open ring-1 ring-inset ring-status-open/20",
  closed:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed ring-1 ring-inset ring-border/60",
  rolling:
    "inline-flex items-center rounded-control bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-status-interview ring-1 ring-inset ring-status-interview/20",
  unknown:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-border/60",
};

const APP_MODE_LABELS: Record<string, string> = {
  external: "Apply externally",
  native: "Apply on Rush",
  none: "No application",
};

const TRACKER_STATUS_LABELS: Record<string, string> = {
  interested: "Planning",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

const TRACKER_SOURCE_LABELS: Record<string, string> = {
  tracked: "Tracker only",
  native: "Submitted in Rush",
  external_csv: "Imported by club",
};

type RelatedClub = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  recruiting_status: string;
  verified: boolean | null;
};

type ClubRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  website_url: string | null;
  instagram_url: string | null;
  contact_email: string | null;
  target_years: string[] | null;
  application_mode: string;
  application_url: string | null;
  recruiting_status: string;
  verified: boolean | null;
};

type TrackerApplication = {
  id: string;
  status: string;
  decision_status: string | null;
  application_source: string;
};

function mapClubRecord(value: unknown, includeTargetYears: boolean): ClubRecord {
  const row = value as Omit<ClubRecord, "target_years"> & { target_years?: unknown };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tags: row.tags,
    category: row.category,
    website_url: row.website_url,
    instagram_url: row.instagram_url,
    contact_email: row.contact_email,
    target_years: includeTargetYears ? normalizeTargetYears(row.target_years) : null,
    application_mode: row.application_mode,
    application_url: row.application_url,
    recruiting_status: row.recruiting_status,
    verified: row.verified,
  };
}

function mapTrackerApplication(value: unknown): TrackerApplication {
  const row = value as Omit<TrackerApplication, "application_source"> & {
    application_source?: string | null;
  };

  return {
    id: row.id,
    status: row.status,
    decision_status: row.decision_status,
    application_source: normalizeApplicationSource(row.application_source),
  };
}

async function loadClubRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slugOrId: string,
) {
  const selectWithTargetYears =
    "id, slug, name, description, tags, category, website_url, instagram_url, contact_email, target_years, application_mode, application_url, recruiting_status, verified";
  const fallbackSelect =
    "id, slug, name, description, tags, category, website_url, instagram_url, contact_email, application_mode, application_url, recruiting_status, verified";

  const loadBy = async (column: "slug" | "id", selectClause: string) =>
    supabase.from("clubs").select(selectClause).eq(column, slugOrId).maybeSingle();

  const primary = await loadBy("slug", selectWithTargetYears);
  if (!primary.error && primary.data) {
    return mapClubRecord(primary.data, true);
  }

  if (primary.error && !isMissingSchemaColumn(primary.error, "target_years")) {
    console.error("Failed to load club by slug:", primary.error.message);
  }

  if (isMissingSchemaColumn(primary.error, "target_years")) {
    const fallback = await loadBy("slug", fallbackSelect);
    if (!fallback.error && fallback.data) {
      return mapClubRecord(fallback.data, false);
    }
  }

  const byIdPrimary = await loadBy("id", selectWithTargetYears);
  if (!byIdPrimary.error && byIdPrimary.data) {
    return mapClubRecord(byIdPrimary.data, true);
  }

  if (byIdPrimary.error && !isMissingSchemaColumn(byIdPrimary.error, "target_years")) {
    console.error("Failed to load club by id:", byIdPrimary.error.message);
  }

  if (isMissingSchemaColumn(byIdPrimary.error, "target_years")) {
    const byIdFallback = await loadBy("id", fallbackSelect);
    if (!byIdFallback.error && byIdFallback.data) {
      return mapClubRecord(byIdFallback.data, false);
    }
  }

  return null;
}

async function loadTrackerApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clubId: string,
) {
  const primary = await supabase
    .from("user_applications")
    .select("id, status, decision_status, application_source")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (!primary.error) {
    return primary.data ? mapTrackerApplication(primary.data) : null;
  }

  if (!isMissingSchemaColumn(primary.error, "application_source")) {
    console.error("Failed to load tracker application:", primary.error.message);
    return null;
  }

  const fallback = await supabase
    .from("user_applications")
    .select("id, status, decision_status")
    .eq("user_id", userId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (fallback.error) {
    console.error("Failed to load tracker application:", fallback.error.message);
    return null;
  }

  if (!fallback.data) {
    return null;
  }

  return mapTrackerApplication(fallback.data);
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const deadline = new Date(dateStr);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ClubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { message, error } = resolvedSearchParams;
  const supabase = await createClient();

  const club = await loadClubRecord(supabase, slug);

  if (!club) {
    notFound();
  }

  let relatedQuery = supabase
    .from("clubs")
    .select("id, slug, name, category, recruiting_status, verified")
    .neq("id", club.id)
    .limit(3);

  if (club.category) {
    relatedQuery = relatedQuery.eq("category", club.category);
  }

  const [{ data: activeDeadlines }, { data: authData }, { data: relatedClubsData }] =
    await Promise.all([
    supabase
      .from("club_deadlines")
      .select("id, title, deadline_at")
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("deadline_at"),
    supabase.auth.getUser(),
    relatedQuery.order("verified", { ascending: false }).order("name"),
  ]);

  const user = authData.user;
  const relatedClubs = (relatedClubsData ?? []) as RelatedClub[];

  let isFollowing = false;
  let application: TrackerApplication | null = null;

  if (user) {
    const [followResult, applicationData] = await Promise.all([
      supabase
        .from("user_follows")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", club.id)
        .maybeSingle(),
      loadTrackerApplication(supabase, user.id, club.id),
    ]);

    isFollowing = !!followResult.data;
    application = applicationData;

    // Log view event (fire and forget)
    void insertEvent(supabase, {
      userId: user.id,
      clubId: club.id,
      eventType: "view",
      metadata: { surface: "club_page" },
    });
  }

  const allDeadlines = activeDeadlines ?? [];
  const isRecruiting =
    club.recruiting_status === "open" || club.recruiting_status === "rolling";
  const isNativeApplication = club.application_mode === "native";
  const applyHref = isNativeApplication ? `/clubs/${club.slug ?? slug}/apply` : club.application_url;
  const applyLabel = isNativeApplication ? "Apply on Rush" : "Apply externally";

  return (
    <div className="min-h-screen bg-surface-warm">
      <SiteHeader isAuthenticated={!!user} />
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
        {/* Breadcrumb */}
        <Link
          href="/clubs"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted hover:text-ink transition-colors"
        >
          ← Club directory
        </Link>

        {/* Feedback banners */}
        {message ? (
          <div className="mb-6 rounded-control border border-brand-secondary/30 bg-teal-50 px-4 py-3 text-sm text-status-open">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-6 rounded-control border border-status-rejected/30 bg-red-50 px-4 py-3 text-sm text-status-rejected">
            {error}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Club header card */}
            <div className="rounded-container border border-border-warm bg-white p-6 shadow-card sm:p-8">
              {/* Title row */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-action">
                    Organization profile
                  </p>
                  <h1
                    className="text-3xl font-semibold leading-tight text-ink sm:text-4xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {club.name}
                    {club.verified && (
                      <span
                        className="ml-2 align-middle inline-flex items-center rounded-control bg-teal-50 px-2 py-0.5 text-xs font-medium text-status-open ring-1 ring-inset ring-status-open/20"
                        title="Verified club"
                      >
                        Verified
                      </span>
                    )}
                  </h1>
                  {club.category && (
                    <p className="text-sm font-medium text-ink-muted">
                      {club.category}
                    </p>
                  )}
                </div>

                {/* Badges + follow */}
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={
                      STATUS_BADGE[club.recruiting_status as string] ??
                      STATUS_BADGE.unknown
                    }
                  >
                    {STATUS_LABELS[club.recruiting_status] ??
                      club.recruiting_status}
                  </span>
                  <span className="inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-border/60">
                    {APP_MODE_LABELS[club.application_mode] ??
                      "Application info unavailable"}
                  </span>
                  {user ? (
                    <FollowButton clubId={club.id} isFollowing={isFollowing} />
                  ) : (
                    <Link
                      href="/auth"
                      className="inline-flex items-center justify-center rounded-control border border-brand-action px-4 py-2 text-sm font-medium text-brand-action hover:bg-brand-action/5 transition-colors"
                    >
                      Follow
                    </Link>
                  )}
                </div>
              </div>

              {/* Description */}
              {club.description && (
                <p className="mt-6 text-base leading-relaxed text-ink-muted">
                  {club.description}
                </p>
              )}

              {/* Tags */}
              {club.tags && (club.tags as string[]).length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(club.tags as string[]).map((t) => (
                    <TrackedLink
                      key={t}
                      href={`/clubs?tag=${encodeURIComponent(t)}`}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "club_directory_tag",
                      }}
                      className="rounded-control border border-border-warm bg-surface-cool px-2.5 py-1 text-xs text-ink-muted hover:border-border hover:text-ink transition-colors"
                    >
                      {t}
                    </TrackedLink>
                  ))}
                </div>
              )}

              {/* Target years */}
              {Array.isArray(club.target_years) && club.target_years.length > 0 ? (
                <div className="mt-6 rounded-card border border-border-warm bg-surface-cool px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Best fit
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    This club usually recruits{" "}
                    <span className="font-medium text-ink">
                      {club.target_years.join(", ")}
                    </span>
                    .
                  </p>
                </div>
              ) : null}
            </div>

            {/* Primary apply CTA — shown when recruiting is active */}
            {isRecruiting && applyHref && (
              <div className="rounded-card border border-border-warm bg-surface-cool p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Applications are open
                    </p>
                    <p className="text-xs text-ink-muted">
                      {isNativeApplication
                        ? "Submit your application directly through Rush."
                        : "This club accepts applications on an external platform."}
                    </p>
                  </div>
                  {isNativeApplication ? (
                    <TrackedLink
                      href={applyHref}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "native_application",
                      }}
                      className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                    >
                      {applyLabel} →
                    </TrackedLink>
                  ) : (
                    <TrackedAnchor
                      href={applyHref}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "application_url",
                      }}
                      className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                    >
                      {applyLabel} ↗
                    </TrackedAnchor>
                  )}
                </div>
              </div>
            )}

            {/* Deadline urgency block — amber left accent to anchor visual hierarchy */}
            {allDeadlines.length > 0 && (
              <div className="rounded-card border border-border-warm bg-white p-5 shadow-card border-l-4 border-l-brand-primary">
                <h2
                  className="mb-4 text-base font-semibold text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Upcoming deadlines
                </h2>
                <ul className="space-y-3">
                  {allDeadlines.map((d) => {
                    const days = daysUntil(d.deadline_at);
                    const isPast = days < 0;
                    const isUrgent = !isPast && days <= 7;
                    return (
                      <li
                        key={d.id}
                        className={`flex items-start gap-3 rounded-control px-3 py-2.5 ${
                          isUrgent
                            ? "border-l-4 border-l-brand-primary bg-amber-50"
                            : "border border-border-warm bg-surface-cool"
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-ink">{d.title}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {new Date(d.deadline_at).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        {isPast ? (
                          <span className="shrink-0 text-xs font-medium text-ink-muted">Passed</span>
                        ) : days === 0 ? (
                          <span className="shrink-0 text-sm font-semibold text-status-urgent">Today</span>
                        ) : (
                          <span className={`shrink-0 text-xs font-medium ${isUrgent ? "text-status-urgent" : "text-ink-muted"}`}>
                            {days}d left
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Links — no shadow, purely informational */}
            {(club.website_url || club.instagram_url) && (
              <div className="rounded-card border border-border-warm bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink">
                  Links
                </h2>
                <div className="flex flex-wrap gap-3">
                  {club.website_url && (
                    <TrackedAnchor
                      href={club.website_url}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "website_url",
                      }}
                      className="inline-flex items-center justify-center rounded-control border border-border-warm bg-surface-cool px-4 py-2 text-sm font-medium text-ink hover:border-border hover:bg-white transition-colors"
                    >
                      Website ↗
                    </TrackedAnchor>
                  )}
                  {club.instagram_url && (
                    <TrackedAnchor
                      href={club.instagram_url}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "instagram_url",
                      }}
                      className="inline-flex items-center justify-center rounded-control border border-border-warm bg-surface-cool px-4 py-2 text-sm font-medium text-ink hover:border-border hover:bg-white transition-colors"
                    >
                      Instagram ↗
                    </TrackedAnchor>
                  )}
                </div>
              </div>
            )}

            {relatedClubs.length > 0 ? (
              <div className="rounded-card border border-border-warm bg-surface-cool p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2
                      className="text-base font-semibold text-ink"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Related clubs
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      Keep exploring similar orgs without going back to square one.
                    </p>
                  </div>
                  <Link
                    href={club.category ? `/clubs?category=${encodeURIComponent(club.category)}` : "/clubs"}
                    className="text-sm font-medium text-brand-action transition-colors hover:text-[#1F2937]"
                  >
                    Browse more →
                  </Link>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {relatedClubs.map((relatedClub) => (
                    <TrackedLink
                      key={relatedClub.id}
                      href={`/clubs/${relatedClub.slug ?? relatedClub.id}`}
                      clubId={relatedClub.id}
                      metadata={{
                        surface: "club_page",
                        target: "related_club_page",
                      }}
                      className="group rounded-card border border-border-warm bg-white p-4 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-brand-action">
                            {relatedClub.name}
                          </p>
                          {relatedClub.category ? (
                            <p className="mt-1 text-xs text-ink-muted">{relatedClub.category}</p>
                          ) : null}
                        </div>
                        {relatedClub.verified ? (
                          <span className="rounded-control bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-status-open ring-1 ring-inset ring-status-open/20">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span
                          className={`shrink-0 ${STATUS_BADGE[relatedClub.recruiting_status] ?? STATUS_BADGE.unknown}`}
                        >
                          {STATUS_LABELS[relatedClub.recruiting_status] ?? relatedClub.recruiting_status}
                        </span>
                        <span className="text-xs font-medium text-brand-action">Open page →</span>
                      </div>
                    </TrackedLink>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Sidebar ── */}
          <div className="order-first space-y-4 lg:order-none">
            {/* Your workflow */}
            <div className="rounded-card border border-border-warm bg-white p-5 shadow-card">
              <h2
                className="mb-3 text-base font-semibold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Your workflow
              </h2>

              {!user ? (
                <>
                  <p className="mb-4 text-sm text-ink-muted">
                    Sign in to follow this club, add it to your tracker, and
                    submit applications through Rush when available.
                  </p>
                  <Link
                    href="/auth"
                    className="inline-flex w-full items-center justify-center rounded-control bg-brand-action px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                  >
                    Sign in to continue
                  </Link>
                </>
              ) : application ? (
                <div className="space-y-4">
                  <div className="rounded-card border border-border-warm bg-surface-cool p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-control bg-white px-2.5 py-0.5 text-xs font-medium text-ink ring-1 ring-inset ring-border/70">
                        {TRACKER_STATUS_LABELS[application.status] ??
                          application.status}
                      </span>
                      <span className="inline-flex items-center rounded-control bg-brand-action/10 px-2.5 py-0.5 text-xs font-medium text-brand-action ring-1 ring-inset ring-brand-action/20">
                        {TRACKER_SOURCE_LABELS[application.application_source] ??
                          application.application_source}
                      </span>
                      {application.status === "decision" &&
                      application.decision_status ? (
                        <span className="inline-flex items-center rounded-control bg-white px-2.5 py-0.5 text-xs font-medium capitalize text-ink ring-1 ring-inset ring-border/70">
                          {application.decision_status}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-ink-muted">
                      This club is already in your tracker. Keep your notes
                      updated or continue the application flow from here.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/dashboard/applications/${application.id}`}
                      className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                    >
                      Open tracker
                    </Link>
                    {isNativeApplication ? (
                      <TrackedLink
                        href={`/clubs/${slug}/apply`}
                        clubId={club.id}
                        metadata={{
                          surface: "club_page",
                          target: "native_application",
                        }}
                        className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-warm transition-colors"
                      >
                        {application.application_source === "native"
                          ? "Edit Rush submission"
                          : "Apply on Rush"}
                      </TrackedLink>
                    ) : applyHref ? (
                      <TrackedAnchor
                        href={applyHref}
                        clubId={club.id}
                        metadata={{
                          surface: "club_page",
                          target: "application_url",
                        }}
                        className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-warm transition-colors"
                      >
                        Open external application ↗
                      </TrackedAnchor>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">
                    Save this club into your personal tracker so deadlines,
                    notes, and application progress live in one place.
                  </p>

                  {/* Disabled apply button when recruiting is closed */}
                  {!isRecruiting && applyHref && (
                    <div className="rounded-control border border-border bg-surface-cool px-4 py-2.5 text-center">
                      <span className="text-sm text-ink-muted">
                        Deadline passed
                      </span>
                    </div>
                  )}

                  <form>
                    <input type="hidden" name="club_id" value={club.id} />
                    <input
                      type="hidden"
                      name="redirect_to"
                      value={`/clubs/${slug}`}
                    />
                    <button
                      formAction={addApplication}
                      className="inline-flex w-full items-center justify-center rounded-control bg-brand-action px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                    >
                      Add to tracker
                    </button>
                  </form>

                  {isNativeApplication && isRecruiting ? (
                    <TrackedLink
                      href={`/clubs/${slug}/apply`}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "native_application",
                      }}
                      className="inline-flex w-full items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-warm transition-colors"
                    >
                      Apply on Rush
                    </TrackedLink>
                  ) : applyHref && isRecruiting ? (
                    <TrackedAnchor
                      href={applyHref}
                      clubId={club.id}
                      metadata={{
                        surface: "club_page",
                        target: "application_url",
                      }}
                      className="inline-flex w-full items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-warm transition-colors"
                    >
                      Open external application ↗
                    </TrackedAnchor>
                  ) : null}
                </div>
              )}
            </div>

            {/* Deadlines sidebar widget (compact) — no shadow, static info */}
            <div className="rounded-card border border-border-warm bg-surface-cool p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Deadlines
              </h2>
              {allDeadlines.length === 0 ? (
                <p className="text-sm text-ink-muted">No upcoming deadlines.</p>
              ) : (
                <ul className="space-y-2.5">
                  {allDeadlines.map((d) => {
                    const days = daysUntil(d.deadline_at);
                    const isPast = days < 0;
                    const isUrgent = !isPast && days <= 7;
                    return (
                      <li
                        key={d.id}
                        className={`flex flex-col gap-0.5 ${
                          isUrgent ? "pl-2 border-l-2 border-l-brand-primary" : ""
                        }`}
                      >
                        <span className="text-sm font-medium text-ink">
                          {d.title}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {new Date(d.deadline_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {!isPast && (
                            days === 0 ? (
                              <span className="ml-2 text-sm font-semibold text-status-urgent">today</span>
                            ) : (
                              <span className={`ml-2 font-medium ${isUrgent ? "text-status-urgent" : "text-ink-muted"}`}>
                                {`in ${days} day${days === 1 ? "" : "s"}`}
                              </span>
                            )
                          )}
                          {isPast && (
                            <span className="ml-2 text-ink-muted">passed</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Claim — no shadow, static informational block */}
            <div className="rounded-card border border-border-warm bg-surface-cool p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink">
                Is this your club?
              </h2>
              <p className="mb-4 text-xs text-ink-muted">
                Claim this page to manage your profile, post deadlines, and
                review applicants.
              </p>
              <Link
                href={`/clubs/${slug}/claim`}
                className="text-sm font-medium text-brand-action hover:underline"
              >
                Claim this club →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
