import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  open: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  closed: "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  rolling: "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  unknown: "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
};

const APP_MODE_LABELS: Record<string, string> = {
  external: "Apply externally",
  native: "Apply on Rush",
  none: "No application",
};

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

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!club) {
    notFound();
  }

  // Fetch deadlines and auth state in parallel now that we have club.id
  const [{ data: activeDeadlines }, { data: authData }] = await Promise.all([
    supabase
      .from("club_deadlines")
      .select("id, title, deadline_at")
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("deadline_at"),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;

  let isFollowing = false;
  if (user) {
    const { data: follow } = await supabase
      .from("user_follows")
      .select("id")
      .eq("user_id", user.id)
      .eq("club_id", club.id)
      .maybeSingle();
    isFollowing = !!follow;

    // Log view event (fire and forget)
    void supabase.from("events").insert({
      user_id: user.id,
      club_id: club.id,
      event_type: "view",
    });
  }

  const allDeadlines = activeDeadlines ?? [];
  const isNativeApplication = club.application_mode === "native";
  const applyHref = isNativeApplication ? `/clubs/${club.slug}/apply` : club.application_url;
  const applyLabel = isNativeApplication ? "Apply on Rush" : "Apply externally";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 lg:px-12">
      {/* Back */}
      <Link
        href="/clubs"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        ← Club directory
      </Link>

      {message ? (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    {club.name}
                  </h1>
                  {club.verified && (
                    <span
                      className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
                      title="Verified club"
                    >
                      Verified
                    </span>
                  )}
                </div>
                {club.category && (
                  <p className="text-xs font-medium text-slate-500">
                    {club.category}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={STATUS_BADGE[club.recruiting_status as string] ?? STATUS_BADGE.unknown}
                >
                  {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
                </span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300/60">
                  {APP_MODE_LABELS[club.application_mode] ?? "Application info unavailable"}
                </span>
                {user ? (
                  <FollowButton clubId={club.id} isFollowing={isFollowing} />
                ) : (
                  <Link
                    href="/auth"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Follow
                  </Link>
                )}
              </div>
            </div>

            {club.description && (
              <p className="mt-6 text-base text-slate-600 leading-relaxed">
                {club.description}
              </p>
            )}

            {club.tags && (club.tags as string[]).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {(club.tags as string[]).map((t) => (
                  <Link
                    key={t}
                    href={`/clubs?tag=${encodeURIComponent(t)}`}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Links */}
          {(club.website_url || club.instagram_url || applyHref) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-xs font-medium text-slate-500 mb-3">
                Links
              </h2>
              <div className="flex flex-wrap gap-3">
                {club.website_url && (
                  <a
                    href={club.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Website ↗
                  </a>
                )}
                {club.instagram_url && (
                  <a
                    href={club.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Instagram ↗
                  </a>
                )}
                {applyHref && (isNativeApplication ? (
                  <Link
                    href={applyHref}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    {applyLabel} →
                  </Link>
                ) : (
                  <a
                    href={applyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    {applyLabel} ↗
                  </a>
                ))}
              </div>
              {club.application_mode && club.application_mode !== "none" && (
                <p className="mt-3 text-xs text-slate-500">
                  {APP_MODE_LABELS[club.application_mode] ?? club.application_mode}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Deadlines */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-xs font-medium text-slate-500 mb-3">
              Deadlines
            </h2>
            {allDeadlines.length === 0 ? (
              <p className="text-sm text-slate-400">No upcoming deadlines.</p>
            ) : (
              <ul className="space-y-3">
                {allDeadlines.map((d) => {
                  const days = daysUntil(d.deadline_at);
                  const isPast = days < 0;
                  return (
                    <li key={d.id} className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-slate-900">
                        {d.title}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(d.deadline_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {!isPast && (
                          <span
                            className={`ml-2 ${days <= 7 ? "text-red-600 font-medium" : "text-slate-500"}`}
                          >
                            {days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
                          </span>
                        )}
                        {isPast && (
                          <span className="ml-2 text-slate-400">passed</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Claim */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Is this your club?
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Claim this page to manage your profile, post deadlines, and
              review applicants.
            </p>
            <Link
              href={`/clubs/${slug}/claim`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Claim this club →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
