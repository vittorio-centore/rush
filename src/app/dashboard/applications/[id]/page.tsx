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
  application_source: "tracked" | "native" | "external_csv";
  clubs: Club | Club[] | null;
}

function getClub(app: Application): Club | null {
  if (!app.clubs) return null;
  return Array.isArray(app.clubs) ? app.clubs[0] ?? null : app.clubs;
}

const STATUS_FLOW = ["interested", "applied", "interview", "decision"] as const;

const STATUS_COPY: Record<(typeof STATUS_FLOW)[number], string> = {
  interested: "Saved for later",
  applied: "Application submitted",
  interview: "Interview process",
  decision: "Final outcome",
};

const SOURCE_LABEL: Record<Application["application_source"], string> = {
  tracked: "Tracker only",
  native: "Rush native application",
  external_csv: "Imported by club",
};

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
    .select("id, status, decision_status, notes, essay_draft, applied_at, created_at, updated_at, application_source, clubs(id, slug, name)")
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .single();

  if (!application) {
    notFound();
  }

  const app = application as Application;
  const club = getClub(app);
  const currentStageIndex = STATUS_FLOW.indexOf(app.status as (typeof STATUS_FLOW)[number]);

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

      <form
        action={updateApplication.bind(null, id)}
        className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Application source</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{SOURCE_LABEL[app.application_source]}</p>
            {app.application_source === "native" && club ? (
              <Link
                href={`/clubs/${club.slug}/apply`}
                className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Edit Rush submission →
              </Link>
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Timeline</p>
            <p className="mt-1 text-sm text-slate-900">
              Added{" "}
              {new Date(app.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {app.applied_at ? (
              <p className="mt-1 text-sm text-slate-900">
                Submitted{" "}
                {new Date(app.applied_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Not marked as submitted yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-slate-700">Pipeline</p>
          <div className="grid gap-2 sm:grid-cols-4">
            {STATUS_FLOW.map((status, index) => {
              const isActive = app.status === status;
              const isComplete = currentStageIndex >= 0 && index <= currentStageIndex;

              return (
                <div
                  key={status}
                  className={
                    isActive
                      ? "rounded-xl border border-blue-200 bg-blue-50 p-3"
                      : isComplete
                        ? "rounded-xl border border-slate-300 bg-slate-50 p-3"
                        : "rounded-xl border border-slate-200 bg-white p-3"
                  }
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {status}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{STATUS_COPY[status]}</p>
                </div>
              );
            })}
          </div>
        </div>

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

        <div>
          <label htmlFor="decision_status" className="block text-sm font-medium text-slate-700 mb-1">
            Decision
          </label>
          <select
            id="decision_status"
            name="decision_status"
            defaultValue={app.decision_status ?? "pending"}
            disabled={app.status !== "decision"}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="waitlisted">Waitlisted</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Decisions unlock once the application reaches the final pipeline stage.
          </p>
        </div>

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
            type="submit"
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
