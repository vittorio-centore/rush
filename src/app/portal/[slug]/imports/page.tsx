import { requirePortalAdmin } from "@/lib/portal";

import { importApplicants } from "./actions";

type ImportBatch = {
  id: string;
  file_name: string;
  status: "processing" | "completed" | "failed";
  total_rows: number;
  imported_rows: number;
  error_rows: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export default async function PortalImportsPage({
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
    .from("club_application_import_batches")
    .select(
      "id, file_name, status, total_rows, imported_rows, error_rows, created_at, completed_at, error_message",
    )
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  const batches = (data ?? []) as ImportBatch[];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">External applicant import</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV export from an external application system to populate the recruiter portal.
        </p>

        {message ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Required CSV columns</p>
          <p className="mt-1 text-sm text-slate-600">
            `full_name`, `email`
          </p>
          <p className="mt-3 text-sm font-medium text-slate-900">Optional CSV columns</p>
          <p className="mt-1 text-sm text-slate-600">
            `year`, `major`, `status`, `decision_status`, `notes`, `applied_at`
          </p>
        </div>

        <form className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 p-4">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-700"
          />
          <button
            formAction={importApplicants.bind(null, slug)}
            className="inline-flex w-fit items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Import applicants
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {batches.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No import batches yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((batch) => (
              <div key={batch.id} className="p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{batch.file_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(batch.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                    {batch.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Rows: {batch.total_rows}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Imported: {batch.imported_rows}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Errors: {batch.error_rows}
                  </div>
                </div>
                {batch.error_message ? (
                  <p className="mt-3 text-sm text-red-600">{batch.error_message}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
