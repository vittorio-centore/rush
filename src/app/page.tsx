export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-stone-950 text-stone-100">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-6 py-24 sm:px-10 lg:px-12">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-300">
            Rush
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
            Club discovery and recruiting infrastructure for campus teams.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-300">
            The first build focuses on searchable club pages, application
            tracking, and recruiter workflows. Recommendations come later, once
            the product has real usage data.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
            <h2 className="text-lg font-semibold text-stone-100">Students</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Discover clubs, follow deadlines, and manage application progress
              in one place.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
            <h2 className="text-lg font-semibold text-stone-100">Clubs</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Claim your page, review applicants, and move candidates through a
              shared pipeline.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-6">
            <h2 className="text-lg font-semibold text-stone-100">Platform</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Built with Next.js and Supabase first, with ML layered in only
              after the product proves demand.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
