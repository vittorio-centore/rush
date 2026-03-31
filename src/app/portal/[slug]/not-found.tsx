import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-xs font-medium uppercase text-slate-400">404</p>
      <h1 className="text-2xl font-bold text-slate-900">Portal not found</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        This club portal doesn&apos;t exist or you don&apos;t have access.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
