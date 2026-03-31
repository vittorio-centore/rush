import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { updateApplicantStatus } from "./actions";

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
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  profiles: Profile | Profile[] | null;
}

function getProfile(app: Application): Profile | null {
  if (!app.profiles) return null;
  return Array.isArray(app.profiles) ? (app.profiles[0] ?? null) : app.profiles;
}

export default async function ApplicantPage({
  params,
}: {
  params: Promise<{ slug: string; applicationId: string }>;
}) {
  const { slug, applicationId } = await params;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, category")
    .eq("slug", slug)
    .single();

  if (!club) notFound();

  const { data: membership } = await supabase
    .from("club_admin_memberships")
    .select("id, role")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!membership) notFound();

  const { data: application } = await supabase
    .from("user_applications")
    .select("*, profiles(full_name, email, year, major)")
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .single();

  if (!application) notFound();

  const app = application as Application;
  const profile = getProfile(app);

  return (
    <main>
      <Link
        href={`/portal/${slug}`}
        className="mb-6 inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        ← All applicants
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {profile?.full_name ?? "Unknown Applicant"}
        </h1>
        {profile?.email && (
          <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Applicant info */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-4">Applicant info</p>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-slate-400">Full name</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{profile?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Email</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900 break-all">{profile?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Year</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{profile?.year ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Major</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{profile?.major ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Edit form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-4">Update status</p>
          <form className="flex flex-col gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={app.status}
                required
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="interested">Interested</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="decision">Decision</option>
              </select>
            </div>
            <div>
              <label htmlFor="decision_status" className="block text-sm font-medium text-slate-700 mb-1">
                Decision
              </label>
              <select
                id="decision_status"
                name="decision_status"
                defaultValue={app.decision_status ?? "pending"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={app.notes ?? ""}
                placeholder="Internal notes about this applicant…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              formAction={updateApplicantStatus.bind(null, slug, applicationId)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Save changes
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
