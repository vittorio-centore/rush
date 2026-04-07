import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/platform-admin";

import { approveClaim, rejectClaim } from "./actions";

type ClaimRow = {
  id: string;
  club_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  clubs: {
    slug: string;
    name: string;
  } | {
    slug: string;
    name: string;
  }[] | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet reviewed";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { supabase } = await requirePlatformAdmin();
  const { message, error } = await searchParams;

  const { data: pendingClaims, error: pendingError } = await supabase
    .from("club_claims")
    .select("id, club_id, user_id, status, message, submitted_at, reviewed_at, reviewed_by, clubs(name, slug)")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (pendingError) {
    throw new Error(pendingError.message);
  }

  const { data: recentClaims, error: recentError } = await supabase
    .from("club_claims")
    .select("id, club_id, user_id, status, message, submitted_at, reviewed_at, reviewed_by, clubs(name, slug)")
    .neq("status", "pending")
    .order("reviewed_at", { ascending: false })
    .limit(8);

  if (recentError) {
    throw new Error(recentError.message);
  }

  const profileIds = Array.from(
    new Set([...(pendingClaims ?? []), ...(recentClaims ?? [])].map((claim) => claim.user_id)),
  );

  const { data: profiles, error: profileError } = profileIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", profileIds)
    : { data: [] as ProfileRow[], error: null };

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="flex flex-col gap-6">
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

      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Claims inbox
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Approve the first admin, then get out of the way.
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pending claims are for the first club admin. After approval, that club can manage
                additional admins and reviewers inside its own portal settings.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pending
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                {pendingClaims?.length ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          {pendingClaims?.length ? (
            <div className="space-y-4">
              {pendingClaims.map((claim) => {
                const club = Array.isArray(claim.clubs) ? claim.clubs[0] : claim.clubs;
                const profile = profileMap.get(claim.user_id);

                return (
                  <article
                    key={claim.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {club?.name ?? "Unknown club"}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">
                            {profile?.full_name ?? profile?.email ?? "Unknown claimant"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{profile?.email ?? "No email found"}</p>
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-slate-700">
                          {claim.message?.trim() || "No message provided."}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                            Submitted {formatDate(claim.submitted_at)}
                          </span>
                          {club?.slug ? (
                            <Link
                              href={`/clubs/${club.slug}`}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
                            >
                              Open club page
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <form>
                          <button
                            formAction={approveClaim.bind(null, claim.id)}
                            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
                          >
                            Approve
                          </button>
                        </form>
                        <form>
                          <button
                            formAction={rejectClaim.bind(null, claim.id)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-slate-950">No pending claims.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                When a club submits its first admin request, it will land here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-5 sm:px-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Recent decisions
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Last reviewed claims
          </h2>
        </div>

        <div className="divide-y divide-slate-200/80">
          {recentClaims?.length ? (
            recentClaims.map((claim) => {
              const club = Array.isArray(claim.clubs) ? claim.clubs[0] : claim.clubs;
              const profile = profileMap.get(claim.user_id);

              return (
                <div
                  key={claim.id}
                  className="flex flex-col gap-3 px-6 py-4 text-sm text-slate-700 sm:px-7 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {profile?.full_name ?? profile?.email ?? "Unknown claimant"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {club?.name ?? "Unknown club"} • {claim.status}
                    </p>
                  </div>
                  <p className="text-slate-500">{formatDate(claim.reviewed_at)}</p>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-8 text-sm text-slate-600 sm:px-7">No reviewed claims yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
