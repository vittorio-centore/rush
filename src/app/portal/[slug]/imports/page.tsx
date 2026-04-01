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
      <div className="rounded-card border border-border bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-ink">External applicant import</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Upload a CSV export from an external application system to populate the recruiter portal.
        </p>

        {message ? (
          <div className="mt-4 rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-card border border-border bg-surface-cool p-4">
          <p className="text-sm font-medium text-ink">Required CSV columns</p>
          <p className="mt-1 text-sm text-ink-muted">`full_name`, `email`</p>
          <p className="mt-3 text-sm font-medium text-ink">Optional CSV columns</p>
          <p className="mt-1 text-sm text-ink-muted">
            `year`, `major`, `status`, `decision_status`, `notes`, `applied_at`
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-muted">
              Show sample CSV
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-control border border-border bg-white p-3 text-xs text-ink-muted">
{`full_name,email,year,major,status,decision_status,notes,applied_at
Jane Doe,janedoe@umich.edu,Junior,Computer Science,applied,pending,Strong design background,2026-09-12T18:00:00Z
John Smith,johnsmith@umich.edu,Sophomore,Economics,interview,pending,Met at mass meeting,2026-09-10T18:00:00Z`}
            </pre>
          </details>
        </div>

        <form className="mt-5 flex flex-col gap-4 rounded-card border border-border p-4">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-ink-muted"
          />
          <button
            formAction={importApplicants.bind(null, slug)}
            className="inline-flex w-fit items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
          >
            Import applicants
          </button>
        </form>
      </div>

      <div className="rounded-card border border-border bg-white shadow-card">
        {batches.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-muted">
            No import batches yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {batches.map((batch) => (
              <div key={batch.id} className="p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{batch.file_name}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {new Date(batch.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-control bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-status-closed">
                    {batch.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-control border border-border bg-surface-cool px-3 py-2 text-sm text-ink-muted">
                    Rows: {batch.total_rows}
                  </div>
                  <div className="rounded-control border border-border bg-surface-cool px-3 py-2 text-sm text-ink-muted">
                    Imported: {batch.imported_rows}
                  </div>
                  <div className="rounded-control border border-border bg-surface-cool px-3 py-2 text-sm text-ink-muted">
                    Errors: {batch.error_rows}
                  </div>
                </div>
                {batch.error_message ? (
                  <p className="mt-3 text-sm text-status-rejected">{batch.error_message}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
