import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 sm:px-10 lg:px-12">
          <span className="text-base font-bold text-slate-900">Rush</span>
          <nav className="flex items-center gap-4">
            <Link href="/clubs" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Browse clubs
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-20 sm:px-10 lg:px-12">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="max-w-2xl space-y-6">
          <p className="text-xs font-medium text-slate-500">
            University of Michigan · 1,800+ student organizations
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Find your club. Run your recruiting.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-600">
            Rush gives students one place to discover organizations, track deadlines,
            and manage applications, while club teams get a recruiter portal for forms,
            applicant review, scorecards, and decisions.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/clubs"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Browse clubs →
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Student side
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Browse and filter the campus directory</li>
                <li>Follow clubs and watch upcoming deadlines</li>
                <li>Track applications from interest to decision</li>
                <li>Submit native Rush applications when clubs enable them</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Club side
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Claim and manage your public club page</li>
                <li>Set deadlines and publish native application forms</li>
                <li>Import external applicants by CSV when needed</li>
                <li>Assign reviewers and collect structured scorecards</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">1,800+</p>
            <p className="mt-1 text-sm text-slate-500">clubs on campus</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">Two-sided</p>
            <p className="mt-1 text-sm text-slate-500">student discovery plus recruiter workflows</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">Pre-ML beta</p>
            <p className="mt-1 text-sm text-slate-500">product-first before recommendations</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 sm:px-10 lg:px-12">
        <p className="text-xs text-slate-400">Rush · University of Michigan</p>
      </footer>
    </div>
  );
}
