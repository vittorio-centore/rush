import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { addApplication, deleteApplication } from "./actions";

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
  clubs: Club | Club[] | null;
}

function getClub(app: Application): Club | null {
  if (!app.clubs) return null;
  return Array.isArray(app.clubs) ? app.clubs[0] ?? null : app.clubs;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  interested: "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  applied: "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  interview: "inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
  decision: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
};

const DECISION_BADGE: Record<DecisionStatus, string> = {
  pending: "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  accepted: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  rejected: "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  waitlisted: "inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
};

const STATUS_ORDER: ApplicationStatus[] = [
  "interested",
  "applied",
  "interview",
  "decision",
];

const COLUMN_HEADING: Record<ApplicationStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { message, error } = await searchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const { data: applications } = await supabase
    .from("user_applications")
    .select("id, status, decision_status, created_at, clubs(id, slug, name, category)")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  const apps = (applications ?? []) as Application[];

  const grouped = STATUS_ORDER.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, status) => {
      acc[status] = apps.filter((a) => a.status === status);
      return acc;
    },
    { interested: [], applied: [], interview: [], decision: [] },
  );

  const { data: allClubs } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name");

  const appliedClubIds = new Set(apps.map((a) => getClub(a)?.id).filter(Boolean));
  const availableClubs = (allClubs ?? []).filter(
    (c: { id: string; name: string }) => !appliedClubIds.has(c.id),
  );

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your club applications from interest to decision.
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

      {/* Add application */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500 mb-3">Track a club</p>
        {availableClubs.length === 0 ? (
          <p className="text-sm text-slate-400">
            {allClubs && allClubs.length === 0
              ? "No clubs available yet."
              : "You're already tracking all available clubs."}
          </p>
        ) : (
          <form className="flex items-center gap-3">
            <select
              id="club_id"
              name="club_id"
              required
              className="flex-1 max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a club…</option>
              {availableClubs.map((club: { id: string; name: string }) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <button
              formAction={addApplication}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {apps.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">No applications yet.</p>
          <p className="mt-1 text-xs text-slate-400">Use the form above to start tracking a club.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {COLUMN_HEADING[status]}
                </h2>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {grouped[status].length}
                </span>
              </div>

              {grouped[status].length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-400">None</p>
                </div>
              ) : (
                grouped[status].map((app) => {
                  const club = getClub(app);
                  return (
                    <article
                      key={app.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div>
                        {club ? (
                          <Link
                            href={`/clubs/${club.slug}`}
                            className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                          >
                            {club.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">Unknown club</span>
                        )}
                        {club?.category && (
                          <p className="text-xs text-slate-400 mt-0.5">{club.category}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className={STATUS_BADGE[status]}>
                          {STATUS_LABELS[status]}
                        </span>
                        {status === "decision" && app.decision_status && (
                          <span className={`capitalize ${DECISION_BADGE[app.decision_status]}`}>
                            {app.decision_status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                        <Link
                          href={`/dashboard/applications/${app.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit →
                        </Link>
                        <form className="ml-auto">
                          <input type="hidden" name="application_id" value={app.id} />
                          <button
                            formAction={deleteApplication}
                            className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors"
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
          ))}
        </div>
      )}
    </main>
  );
}
