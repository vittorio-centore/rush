import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

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

type Club = {
  id: string;
  slug: string;
  name: string;
  recruiting_status: string;
  category: string | null;
};

type Deadline = {
  title: string;
  deadline_at: string;
  clubs: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Layout handles auth redirect, but we still need the user for queries.
  // If somehow called without auth, return nothing (layout will have redirected).
  if (!data.user) {
    return null;
  }

  const user = data.user;

  // Fetch user profile for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .limit(1)
    .single();

  const displayName =
    profile?.full_name ??
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.length > 0
      ? user.user_metadata.full_name
      : user.email) ??
    "Student";

  // Fetch followed clubs (up to 6)
  const { data: followRows } = await supabase
    .from("user_follows")
    .select("club_id, clubs(id, slug, name, recruiting_status, category)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const followedClubs: Club[] = (followRows ?? []).flatMap((row) => {
    const c = row.clubs;
    if (!c) return [];
    const club = Array.isArray(c) ? c[0] : c;
    if (!club) return [];
    return [club as Club];
  });

  const followedClubIds = followedClubs.map((c) => c.id);

  // Fetch upcoming deadlines for followed clubs
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

  return (
    <div className="flex flex-col gap-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, {displayName}</p>
      </div>

      {/* Followed clubs section */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Followed clubs
        </p>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                const statusClass =
                  STATUS_COLORS[club.recruiting_status] ?? STATUS_COLORS.unknown;
                const statusLabel =
                  STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status;
                return (
                  <li
                    key={club.id}
                    className="flex items-center px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-900 flex-1">
                      {club.name}
                    </span>
                    {club.category && (
                      <span className="text-xs text-slate-400 mr-4">
                        {club.category}
                      </span>
                    )}
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
        {followedClubs.length > 0 && (
          <div className="mt-2 text-right">
            <Link
              href="/dashboard/follows"
              className="text-xs text-blue-600 hover:underline"
            >
              See all followed clubs →
            </Link>
          </div>
        )}
      </section>

      {/* Upcoming deadlines section */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Upcoming deadlines
        </p>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {upcomingDeadlines.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              {followedClubIds.length === 0
                ? "Follow clubs to see their deadlines here."
                : "No upcoming deadlines for your followed clubs."}
            </div>
          ) : (
            <ul>
              {upcomingDeadlines.map((d, i) => {
                const clubData = Array.isArray(d.clubs) ? d.clubs[0] : d.clubs;
                const days = daysUntil(d.deadline_at);
                const isUrgent = days <= 7;
                return (
                  <li
                    key={i}
                    className="flex items-center px-4 py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      {clubData && (
                        <span className="text-sm font-medium text-slate-900 mr-2">
                          {clubData.name}
                        </span>
                      )}
                      <span className="text-sm text-slate-500">{d.title}</span>
                    </div>
                    <span className="text-xs text-slate-400 mr-3 shrink-0">
                      {new Date(d.deadline_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {isUrgent && (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20 shrink-0">
                        {relativeDate(d.deadline_at)}
                      </span>
                    )}
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
