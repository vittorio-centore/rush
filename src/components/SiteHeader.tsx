import Link from "next/link";

interface SiteHeaderProps {
  isAuthenticated?: boolean;
}

export default function SiteHeader({ isAuthenticated = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border-warm bg-white/92 backdrop-blur-md">
      <div className="border-b border-border-warm bg-surface-cool">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-2 text-[11px] uppercase tracking-[0.16em] text-ink-muted sm:px-10 lg:px-12">
          <span>University of Michigan club recruiting</span>
          <span>Directory · deadlines · applications</span>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center text-xl font-semibold text-ink transition-colors hover:text-brand-oxblood"
          >
            <div className="flex flex-col">
              <span style={{ fontFamily: "var(--font-display)" }}>Rush</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Student recruiting tool
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/clubs"
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Browse clubs
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Home
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/clubs"
            className="hidden text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Directory
          </Link>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-control border border-brand-action/15 bg-brand-action px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-[#1F2937]"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-control border border-brand-action/15 bg-brand-action px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-[#1F2937]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
