import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type ApplicationStatus = "interested" | "applied" | "interview" | "decision";
type DecisionStatus = "pending" | "accepted" | "rejected" | "waitlisted";

interface Profile {
  full_name: string | null;
  email: string | null;
  year: string | null;
  major: string | null;
}

interface Application {
  id: string;
  status: ApplicationStatus;
  decision_status: DecisionStatus | null;
  applied_at: string | null;
  created_at: string;
  profiles: Profile | Profile[] | null;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  interview: "Interview",
  decision: "Decision",
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  interested:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  applied:
    "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  interview:
    "inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
  decision:
    "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
};

const DECISION_BADGE: Record<DecisionStatus, string> = {
  pending:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
  accepted:
    "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  rejected:
    "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  waitlisted:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
};

const ALL_STATUSES: ApplicationStatus[] = [
  "interested",
  "applied",
  "interview",
  "decision",
];

function getProfile(app: Application): Profile | null {
  if (!app.profiles) return null;
  return Array.isArray(app.profiles) ? (app.profiles[0] ?? null) : app.profiles;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const { status: statusFilter } = await searchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  // Fetch club by slug
  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, category")
    .eq("slug", slug)
    .single();

  if (!club) {
    notFound();
  }

  // Check admin membership
  const { data: membership } = await supabase
    .from("club_admin_memberships")
    .select("id, role")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  // Fetch applicants
  let query = supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, applied_at, created_at, profiles(full_name, email, year, major)",
    )
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  const validStatuses: ApplicationStatus[] = [
    "interested",
    "applied",
    "interview",
    "decision",
  ];
  const activeFilter =
    statusFilter && validStatuses.includes(statusFilter as ApplicationStatus)
      ? (statusFilter as ApplicationStatus)
      : null;

  if (activeFilter) {
    query = query.eq("status", activeFilter);
  }

  const { data: applications } = await query;
  const apps = (applications ?? []) as Application[];

  return (
    <main>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Dashboard
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
              {membership.role}
            </span>
          </div>
          {club.category && (
            <p className="mt-1 text-sm text-slate-600">{club.category}</p>
          )}
        </div>
      </div>

      {/* Status filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/portal/${slug}`}
          className={
            !activeFilter
              ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          }
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/portal/${slug}?status=${s}`}
            className={
              activeFilter === s
                ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            }
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Applicant list */}
      {apps.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <p className="py-12 text-center text-sm text-slate-400">
            {activeFilter
              ? `No applicants with status "${STATUS_LABELS[activeFilter]}".`
              : "No applicants yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Name
                </th>
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Email
                </th>
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Year / Major
                </th>
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Status
                </th>
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Decision
                </th>
                <th className="text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3 text-left">
                  Applied
                </th>
                <th className="sr-only px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => {
                const profile = getProfile(app);
                return (
                  <tr
                    key={app.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">
                        {profile?.full_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">
                        {profile?.email ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">
                        {[profile?.year, profile?.major]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[app.status]}>
                        {STATUS_LABELS[app.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {app.decision_status ? (
                        <span className={DECISION_BADGE[app.decision_status]}>
                          {app.decision_status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">
                        {formatDate(app.applied_at ?? app.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/portal/${slug}/applicants/${app.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
