import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-xs font-medium uppercase text-slate-400">404</p>
      <h1 className="text-2xl font-bold text-slate-900">Application not found</h1>
      <p className="text-sm text-slate-500">
        This application doesn&apos;t exist or you don&apos;t have permission to view it.
      </p>
      <Link
        href="/dashboard/applications"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        ← Back to applications
      </Link>
    </main>
  );
}
