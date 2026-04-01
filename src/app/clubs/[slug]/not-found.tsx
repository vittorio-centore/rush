import Link from "next/link";

export default function ClubNotFound() {
  return (
    <div className="min-h-screen bg-surface-warm">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-24 text-center sm:px-10">
        <div className="rounded-container border border-border-warm bg-white p-12 shadow-card">
          <p className="text-5xl">🔍</p>
          <h1
            className="mt-6 text-3xl font-semibold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Club not found
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-ink-muted">
            This club page doesn&apos;t exist or may have moved. Browse the
            directory to find what you&apos;re looking for.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/clubs"
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
            >
              Browse clubs
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-warm"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
