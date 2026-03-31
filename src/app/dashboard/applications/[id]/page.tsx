import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { deleteApplication, updateApplication } from "./actions";

interface Club {
  id: string;
  slug: string;
  name: string;
}

interface Application {
  id: string;
  status: string;
  decision_status: string | null;
  notes: string | null;
  essay_draft: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string | null;
  clubs: Club | Club[] | null;
}

function getClub(app: Application): Club | null {
  if (!app.clubs) return null;
  return Array.isArray(app.clubs) ? app.clubs[0] ?? null : app.clubs;
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const { message, error } = await searchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const { data: application } = await supabase
    .from("user_applications")
    .select("*, clubs(id, slug, name)")
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .single();

  if (!application) {
    notFound();
  }

  const app = application as Application;
  const club = getClub(app);

  return (
    <main className="flex flex-col gap-5 max-w-2xl">
      <div>
        <Link
          href="/dashboard/applications"
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Applications
        </Link>
        <div className="mt-3">
          {club ? (
            <h1 className="text-2xl font-bold text-slate-900">
              <Link href={`/clubs/${club.slug}`} className="hover:text-blue-600 transition-colors">
                {club.name}
              </Link>
            </h1>
          ) : (
            <h1 className="text-2xl font-bold text-slate-400">Unknown Club</h1>
          )}
        </div>
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

      <form className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={app.status}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="interested">Interested</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="decision">Decision</option>
          </select>
        </div>

        {app.status === "decision" && (
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
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={app.notes ?? ""}
            rows={4}
            placeholder="Contacts, interview tips, deadlines…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label htmlFor="essay_draft" className="block text-sm font-medium text-slate-700 mb-1">
            Essay draft
          </label>
          <textarea
            id="essay_draft"
            name="essay_draft"
            defaultValue={app.essay_draft ?? ""}
            rows={10}
            placeholder="Draft your application essay here…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formAction={updateApplication.bind(null, id) as any}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Save changes
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-900 mb-1">Remove application</p>
        <p className="text-xs text-slate-400 mb-4">
          Permanently removes this from your tracker.
        </p>
        <form>
          <input type="hidden" name="application_id" value={app.id} />
          <button
            formAction={deleteApplication}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Remove application
          </button>
        </form>
      </div>
    </main>
  );
}
