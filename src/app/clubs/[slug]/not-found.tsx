import Link from "next/link";

export default function ClubNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 sm:px-10 lg:px-12 min-h-screen bg-slate-50">
      <p className="text-xs font-medium text-slate-400 uppercase">
        404
      </p>
      <h1 className="text-2xl font-bold text-slate-900 text-balance text-center">
        Club not found
      </h1>
      <p className="max-w-md text-center text-sm leading-7 text-slate-500">
        This club page doesn&apos;t exist. It may have been removed or the URL
        might be incorrect.
      </p>
      <Link
        href="/clubs"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Back to directory
      </Link>
    </main>
  );
}
