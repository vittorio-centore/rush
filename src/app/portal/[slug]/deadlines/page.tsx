import { requirePortalAdmin } from "@/lib/portal";

import { createDeadline, toggleDeadline, updateDeadline } from "./actions";

type Deadline = {
  id: string;
  title: string;
  deadline_at: string;
  is_active: boolean;
};

export default async function PortalDeadlinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { supabase, club } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

  const { data } = await supabase
    .from("club_deadlines")
    .select("id, title, deadline_at, is_active")
    .eq("club_id", club.id)
    .order("deadline_at");

  const deadlines = (data ?? []) as Deadline[];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Deadlines</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create and manage the dates students see on your public club page.
        </p>

        {message ? (
          <div className="mt-4 rounded-lg border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px_auto]">
          <input
            name="title"
            placeholder="Application deadline"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          />
          <input
            name="deadline_at"
            type="datetime-local"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
          />
          <button
            formAction={createDeadline.bind(null, slug)}
            className="inline-flex items-center justify-center rounded-lg bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
          >
            Add deadline
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {deadlines.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No deadlines yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {deadlines.map((deadline) => (
              <div key={deadline.id} className="p-6">
                <form className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto] lg:items-center">
                  <input
                    name="title"
                    defaultValue={deadline.title}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                  />
                  <input
                    name="deadline_at"
                    type="datetime-local"
                    defaultValue={deadline.deadline_at.slice(0, 16)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                  />
                  <button
                    formAction={updateDeadline.bind(null, slug, deadline.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Save
                  </button>
                  <button
                    formAction={toggleDeadline.bind(null, slug, deadline.id, deadline.is_active)}
                    className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      deadline.is_active
                        ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border border-brand-oxblood/20 bg-brand-oxblood-soft text-brand-oxblood hover:bg-[#efe3e4]"
                    }`}
                  >
                    {deadline.is_active ? "Archive" : "Restore"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
