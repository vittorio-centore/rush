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
      <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">Deadlines</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Set the dates students see on the public club page and keep the recruiting calendar clear.
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
        </div>

        <div className="px-6 py-6 sm:px-7">
          <form className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px_auto]">
            <input
              name="title"
              placeholder="Application deadline"
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            />
            <input
              name="deadline_at"
              type="datetime-local"
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
            />
            <button
              formAction={createDeadline.bind(null, slug)}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Add deadline
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        {deadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-slate-100 text-slate-700">
              <svg
                aria-hidden="true"
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.75 4.75v2.5m8.5-2.5v2.5M5.5 8.25h13a1.75 1.75 0 011.75 1.75v8.25A1.75 1.75 0 0118.5 20h-13a1.75 1.75 0 01-1.75-1.75V10A1.75 1.75 0 015.5 8.25z"
                />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">No deadlines yet</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Add the key dates students need to trust the recruiting timeline and plan their application work.
            </p>
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
