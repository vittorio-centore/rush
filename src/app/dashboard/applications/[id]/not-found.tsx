import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center">
      <section className="w-full border-y border-border-warm py-12">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
              Missing record
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl leading-[0.98] tracking-[-0.05em] text-ink">
              This application is not available anymore.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted">
              It may have been removed from your tracker, or you may not have permission to open it from this account.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/applications"
                className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-3 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
              >
                Back to tracker
              </Link>
              <Link
                href="/clubs"
                className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-5 py-3 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-brand-oxblood"
              >
                Browse clubs
              </Link>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border-warm pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <MetaBlock
              label="What to do"
              title="Open the full tracker"
              body="If you were trying to edit an existing application, return to the applications page and reopen it from there."
            />
            <MetaBlock
              label="Need a replacement?"
              title="Start a new tracked club"
              body="You can add a different organization to the tracker from the main applications page."
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function MetaBlock({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="border-b border-border-warm pb-4 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {label}
      </p>
      <p className="mt-2 text-2xl leading-tight tracking-[-0.04em] text-ink">{title}</p>
      <p className="mt-2 text-sm leading-7 text-ink-muted">{body}</p>
    </div>
  );
}
