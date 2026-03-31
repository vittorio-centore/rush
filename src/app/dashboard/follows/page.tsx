import Link from "next/link";
import { redirect } from "next/navigation";

import { unfollowClub } from "@/app/clubs/[slug]/actions";
import { createClient } from "@/lib/supabase/server";

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

type Club = {
  id: string;
  slug: string;
  name: string;
  recruiting_status: string;
  category: string | null;
};

export default async function FollowsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const { data: followRows } = await supabase
    .from("user_follows")
    .select("club_id, clubs(id, slug, name, recruiting_status, category)")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false });

  const followedClubs: Club[] = (followRows ?? []).flatMap((row) => {
    const c = row.clubs;
    if (!c) return [];
    const club = Array.isArray(c) ? c[0] : c;
    if (!club) return [];
    return [club as Club];
  });

  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Followed Clubs</h1>
        <p className="mt-1 text-sm text-slate-500">
          {followedClubs.length} {followedClubs.length === 1 ? "club" : "clubs"} followed
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {followedClubs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">You haven&apos;t followed any clubs yet.</p>
          <Link
            href="/clubs"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Browse clubs →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {followedClubs.map((club, i) => {
            const unfollowWithId = unfollowClub.bind(null, club.id);
            return (
              <div
                key={club.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${
                  i < followedClubs.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{club.name}</p>
                  {club.category && (
                    <p className="text-xs text-slate-400 mt-0.5">{club.category}</p>
                  )}
                </div>
                <span className={STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown}>
                  {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
                </span>
                <Link
                  href={`/clubs/${club.slug}`}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
                >
                  View
                </Link>
                <form>
                  <button
                    type="submit"
                    formAction={unfollowWithId}
                    className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    Unfollow
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
