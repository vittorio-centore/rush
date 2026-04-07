import Link from "next/link";
import { redirect } from "next/navigation";

import { unfollowClub } from "@/app/clubs/[slug]/actions";
import {
  isMissingSchemaColumn,
  normalizeApplicationSource,
} from "@/lib/supabase/compat";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Updates soon",
};

const STATUS_BADGE: Record<string, string> = {
  open: "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2.5 py-0.5 text-xs font-medium text-brand-oxblood",
  closed:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed",
  rolling:
    "inline-flex items-center rounded-control bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-status-interview",
  unknown:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed",
};

type Club = {
  id: string;
  slug: string;
  name: string;
  recruiting_status: string;
  category: string | null;
  application_id?: string | null;
  application_source?: "tracked" | "native" | "external_csv" | null;
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
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    return club ? [club as Club] : [];
  });

  const primaryPlanningRows = await supabase
    .from("user_applications")
    .select("id, application_source, clubs(id, slug, name, recruiting_status, category)")
    .eq("user_id", data.user.id)
    .eq("status", "interested")
    .order("created_at", { ascending: false });

  const planningRows = !primaryPlanningRows.error
    ? primaryPlanningRows.data ?? []
    : isMissingSchemaColumn(primaryPlanningRows.error, "application_source")
      ? (
          await supabase
            .from("user_applications")
            .select("id, clubs(id, slug, name, recruiting_status, category)")
            .eq("user_id", data.user.id)
            .eq("status", "interested")
            .order("created_at", { ascending: false })
        ).data?.map((row) => ({
          ...row,
          application_source: normalizeApplicationSource(undefined),
        })) ?? []
      : [];

  const mergedClubs = new Map<string, Club>();

  for (const club of followedClubs) {
    mergedClubs.set(club.id, club);
  }

  for (const row of planningRows) {
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    if (!club) {
      continue;
    }

    mergedClubs.set(club.id, {
      ...(club as Club),
      application_id: row.id,
      application_source: (row as { application_source?: Club["application_source"] }).application_source ?? "tracked",
    });
  }

  const savedClubs = Array.from(mergedClubs.values());

  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;
  const openCount = savedClubs.filter((club) => club.recruiting_status === "open").length;
  const planningCount = savedClubs.filter((club) => club.application_id).length;

  return (
    <main className="flex flex-col gap-8">
      <section className="border-b border-border-warm pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
          Saved clubs
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="text-5xl leading-[0.98] tracking-[-0.05em] text-ink">
              Keep pre-application clubs in one list.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted">
              Saved clubs are now the place for organizations you are still considering. Use this list until you actually apply, then move to the application tracker.
            </p>
          </div>
          <div className="grid gap-4 border-t border-border-warm pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <Metric value={savedClubs.length} label="Saved" note="clubs under consideration" />
            <Metric value={openCount} label="Open now" note="actively recruiting" />
            <Metric value={planningCount} label="Moved here" note="older planning items" />
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

      {savedClubs.length === 0 ? (
        <section className="rounded-[1.75rem] border border-border-warm bg-white px-6 py-8">
          <p className="text-sm leading-7 text-ink-muted">
            You do not have any saved clubs yet. Start with the directory and save the clubs you want to revisit before you apply.
          </p>
          <Link
            href="/clubs"
            className="mt-4 inline-flex items-center text-sm font-medium text-brand-oxblood transition-colors hover:text-ink"
          >
            Browse clubs →
          </Link>
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-2xl leading-tight tracking-[-0.03em] text-ink">Saved list</h2>
            <Link
              href="/clubs"
              className="text-sm font-medium text-brand-oxblood transition-colors hover:text-ink"
            >
              Browse directory →
            </Link>
          </div>

          <div className="divide-y divide-border-warm border-y border-border-warm">
            {savedClubs.map((club) => {
              const unfollowWithId = unfollowClub.bind(null, club.id);

              return (
                <div key={club.id} className="grid gap-4 px-1 py-5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                  <div>
                    <p className="text-lg font-medium text-ink">{club.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {club.category ?? "Campus organization"}
                    </p>
                    {club.application_id ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-muted">
                        Previously tracked as planning
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center">
                    <span className={STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown}>
                      {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 lg:justify-end">
                    <Link
                      href={`/clubs/${club.slug ?? club.id}`}
                      className="text-sm font-medium text-brand-oxblood transition-colors hover:text-ink"
                    >
                      View club
                    </Link>
                    <form>
                      <button
                        type="submit"
                        formAction={unfollowWithId}
                        className="text-sm font-medium text-ink-muted transition-colors hover:text-status-rejected"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function Metric({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="border-b border-border-warm pb-4 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {label}
      </p>
      <p className="mt-2 text-4xl leading-none tracking-[-0.05em] text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-muted">{note}</p>
    </div>
  );
}
