import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import RecommendationRail from "./RecommendationRail";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Status unknown",
};

const STATUS_COLORS: Record<string, string> = {
  open: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  closed: "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  rolling: "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  unknown: "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
};

const APPLICATION_STATUS_BADGE = {
  interested:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  applied:
    "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  interview:
    "inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
  decision:
    "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
} as const;

const APPLICATION_STATUS_LABELS = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
} as const;

const APPLICATION_SOURCE_LABELS = {
  tracked: "Tracker only",
  native: "Submitted in Rush",
  external_csv: "Imported by club",
} as const;

function daysUntil(dateStr: string): number {
  const now = new Date();
  const deadline = new Date(dateStr);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function relativeDate(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  if (days > 0) return `in ${days} days`;
  return "passed";
}

function getRecord<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

type Club = {
  id: string;
  slug: string;
  name: string;
  recruiting_status: string;
  category: string | null;
};

type ApplicationPreview = {
  id: string;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  application_source: "tracked" | "native" | "external_csv";
  clubs: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type Deadline = {
  title: string;
  deadline_at: string;
  clubs: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return null;
  }

  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, year, major, interests")
    .eq("id", user.id)
    .limit(1)
    .single();

  const displayName =
    profile?.full_name ??
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.length > 0
      ? user.user_metadata.full_name
      : user.email) ??
    "Student";

  const { data: followRows } = await supabase
    .from("user_follows")
    .select("club_id, clubs(id, slug, name, recruiting_status, category)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const followedClubs: Club[] = (followRows ?? []).flatMap((row) => {
    const club = getRecord(row.clubs);
    return club ? [club as Club] : [];
  });

  const followedClubIds = followedClubs.map((club) => club.id);

  const { data: applicationRows } = await supabase
    .from("user_applications")
    .select("id, status, decision_status, application_source, clubs(name, slug)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(4);

  const recentApplications = (applicationRows ?? []) as ApplicationPreview[];

  let upcomingDeadlines: Deadline[] = [];
  if (followedClubIds.length > 0) {
    const { data: deadlineRows } = await supabase
      .from("club_deadlines")
      .select("title, deadline_at, clubs(name, slug)")
      .in("club_id", followedClubIds)
      .eq("is_active", true)
      .gt("deadline_at", new Date().toISOString())
      .order("deadline_at")
      .limit(5);

    upcomingDeadlines = (deadlineRows ?? []) as Deadline[];
  }

  const profileReady = Boolean(profile?.full_name && profile?.year && profile?.major);
  const interestsCount = Array.isArray(profile?.interests) ? profile.interests.length : 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Student dashboard
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Keep your Rush season organized in one place: follow clubs, track application stages,
              and stay ahead of the next deadline.
            </p>

            {!profileReady || interestsCount === 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Complete your profile</p>
                <p className="mt-1 text-sm text-amber-800">
                  Add your year, major, and interests so clubs and future recommendations have cleaner context.
                </p>
                <Link
                  href="/dashboard/profile"
                  className="mt-3 inline-flex items-center text-sm font-medium text-amber-900 hover:text-amber-950"
                >
                  Finish profile →
                </Link>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Following</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{followedClubs.length}</p>
              <p className="mt-1 text-sm text-slate-500">clubs in your watchlist</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Applications</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{recentApplications.length}</p>
              <p className="mt-1 text-sm text-slate-500">recent items in your tracker</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Upcoming deadlines</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{upcomingDeadlines.length}</p>
              <p className="mt-1 text-sm text-slate-500">for followed clubs</p>
            </div>
          </div>
        </div>
      </section>

      <RecommendationRail userId={user.id} />

      <section className="grid gap-4 lg:grid-cols-3">
        <Link
          href="/clubs"
          className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Discover</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Browse club directory</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Search organizations, filter by category or tag, and open public recruiting pages.
          </p>
        </Link>
        <Link
          href="/dashboard/applications"
          className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Track</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Manage applications</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep statuses, essay drafts, and decisions together instead of scattering them across notes apps.
          </p>
        </Link>
        <Link
          href="/dashboard/follows"
          className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Stay ahead</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Watch deadlines</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Follow clubs you care about and keep the most urgent deadlines visible on one screen.
          </p>
        </Link>
      </section>

      {recentApplications.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Recent applications
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Jump back into the clubs already in motion.
              </p>
            </div>
            <Link
              href="/dashboard/applications"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Open full tracker →
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {recentApplications.map((application) => {
              const club = getRecord(application.clubs);

              return (
                <Link
                  key={application.id}
                  href={`/dashboard/applications/${application.id}`}
                  className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {club?.name ?? "Unknown club"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {APPLICATION_SOURCE_LABELS[application.application_source]}
                      </p>
                    </div>
                    <span className={APPLICATION_STATUS_BADGE[application.status]}>
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {application.status === "decision" && application.decision_status
                        ? `Decision: ${application.decision_status}`
                        : "Continue tracking"}
                    </span>
                    <span>Open →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {followedClubs.length === 0 && recentApplications.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Get started in three steps</p>
          <ol className="mt-3 grid gap-3 lg:grid-cols-3">
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Browse clubs and follow the ones you care about.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Add applications to your tracker when recruiting starts.
            </li>
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Keep notes, deadlines, and outcomes updated in Rush.
            </li>
          </ol>
        </section>
      ) : null}

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Followed clubs
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {followedClubs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              You haven&apos;t followed any clubs yet.{" "}
              <Link href="/clubs" className="text-blue-600 hover:underline">
                Browse clubs
              </Link>
            </div>
          ) : (
            <ul>
              {followedClubs.map((club) => {
                const statusClass = STATUS_COLORS[club.recruiting_status] ?? STATUS_COLORS.unknown;
                const statusLabel = STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status;
                return (
                  <li
                    key={club.id}
                    className="flex items-center border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <span className="flex-1 text-sm font-medium text-slate-900">
                      {club.name}
                    </span>
                    {club.category ? (
                      <span className="mr-4 text-xs text-slate-400">{club.category}</span>
                    ) : null}
                    <span className={`mr-4 ${statusClass}`}>{statusLabel}</span>
                    <Link
                      href={`/clubs/${club.slug}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {followedClubs.length > 0 ? (
          <div className="mt-2 text-right">
            <Link
              href="/dashboard/follows"
              className="text-xs text-blue-600 hover:underline"
            >
              See all followed clubs →
            </Link>
          </div>
        ) : null}
      </section>

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Upcoming deadlines
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {upcomingDeadlines.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {followedClubIds.length === 0
                ? "Follow clubs to see their deadlines here."
                : "No upcoming deadlines for your followed clubs."}
            </div>
          ) : (
            <ul>
              {upcomingDeadlines.map((deadline, index) => {
                const club = getRecord(deadline.clubs);
                const days = daysUntil(deadline.deadline_at);
                const isUrgent = days <= 7;

                return (
                  <li
                    key={`${deadline.title}-${index}`}
                    className="flex items-center border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      {club ? (
                        <Link
                          href={`/clubs/${club.slug}`}
                          className="mr-2 text-sm font-medium text-slate-900 transition-colors hover:text-blue-600"
                        >
                          {club.name}
                        </Link>
                      ) : null}
                      <span className="text-sm text-slate-500">{deadline.title}</span>
                    </div>
                    <span className="mr-3 shrink-0 text-xs text-slate-400">
                      {new Date(deadline.deadline_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={
                        isUrgent
                          ? "inline-flex shrink-0 items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20"
                          : "inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300/60"
                      }
                    >
                      {relativeDate(deadline.deadline_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
