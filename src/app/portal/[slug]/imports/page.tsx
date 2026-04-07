import Link from "next/link";

import {
  getPortalCapabilities,
  getPortalFeatureUnavailableMessage,
} from "@/lib/portal-features";
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

const PANEL_CLASS =
  "overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]";

export default async function PortalImportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const capabilities = await getPortalCapabilities(slug);
  const { supabase, club } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

  if (!capabilities.imports) {
    return (
      <div className="flex flex-col gap-6">
        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className={PANEL_CLASS}>
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Imports
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              CSV imports are unavailable on this database.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {getPortalFeatureUnavailableMessage("imports")}
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Current fallback</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The applicant queue can still show legacy Rush applications, but imported external
                applicants cannot be stored until the recruiter portal schema is installed.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-slate-950">Next step</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Apply the recruiter portal migrations, then return here to upload CSV batches.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/portal/${slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Back to applicants
                </Link>
                <Link
                  href={`/portal/${slug}/settings`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Open settings
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { data } = await supabase
    .from("club_application_import_batches")
    .select(
      "id, file_name, status, total_rows, imported_rows, error_rows, created_at, completed_at, error_message",
    )
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  const batches = (data ?? []) as ImportBatch[];
  const completedCount = batches.filter((batch) => batch.status === "completed").length;
  const failedCount = batches.filter((batch) => batch.status === "failed").length;
  const processingCount = batches.filter((batch) => batch.status === "processing").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
        <div className={PANEL_CLASS}>
          <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Imports
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                  Bring external applicants into the queue.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upload a clean CSV from another system and keep the recruiter workspace aligned
                  with the real applicant list.
                </p>
              </div>

              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                {batches.length} batch{batches.length === 1 ? "" : "es"} recorded
              </span>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200/80 sm:grid-cols-3">
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {completedCount}
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Processing</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {processingCount}
              </p>
            </div>
            <div className="bg-white px-6 py-5">
              <p className="text-sm font-medium text-slate-500">Failed</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">
                {failedCount}
              </p>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-7">
            {message ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Upload CSV export</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Use one file per batch so the history stays easy to audit.
                  </p>
                </div>
              </div>
              <input
                name="file"
                type="file"
                accept=".csv,text/csv"
                className="mt-5 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
              <button
                formAction={importApplicants.bind(null, slug)}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Import applicants
              </button>
            </form>
          </div>
        </div>

        <aside className={`${PANEL_CLASS} px-6 py-6 sm:px-7`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            CSV format
          </p>
          <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-sm font-semibold text-slate-950">Required columns</p>
            <p className="mt-2 text-sm text-slate-600">
              <code>full_name</code>, <code>email</code>
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-950">Optional columns</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <code>year</code>, <code>major</code>, <code>status</code>,{" "}
              <code>decision_status</code>, <code>notes</code>, <code>applied_at</code>
            </p>
          </div>

          <details className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Show sample CSV
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
{`full_name,email,year,major,status,decision_status,notes,applied_at
Jane Doe,janedoe@umich.edu,Junior,Computer Science,applied,pending,Strong design background,2026-09-12T18:00:00Z
John Smith,johnsmith@umich.edu,Sophomore,Economics,interview,pending,Met at mass meeting,2026-09-10T18:00:00Z`}
            </pre>
          </details>
        </aside>
      </section>

      <section className={PANEL_CLASS}>
        <div className="border-b border-slate-200/80 px-6 py-5 sm:px-7">
          <h3 className="text-xl font-semibold text-slate-950">Import history</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Track every upload so recruiters know what made it into the portal and what needs
            another pass.
          </p>
        </div>
        {batches.length === 0 ? (
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
                  d="M6.5 5.25h11A1.75 1.75 0 0119.25 7v10A1.75 1.75 0 0117.5 18.75h-11A1.75 1.75 0 014.75 17V7A1.75 1.75 0 016.5 5.25z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.25h7.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12.25h7.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15.25h4.5" />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">No import batches yet</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              Upload the first CSV once you want external applicants to appear in the recruiter
              queue.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((batch) => (
              <div key={batch.id} className="p-6 sm:px-7">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{batch.file_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(batch.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                      batch.status === "completed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : batch.status === "failed"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {batch.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Rows: {batch.total_rows}
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Imported: {batch.imported_rows}
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Errors: {batch.error_rows}
                  </div>
                </div>
                {batch.error_message ? (
                  <p className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {batch.error_message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
