export default function ClubsLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 lg:px-12">
      <div className="mb-8 h-8 w-48 animate-pulse rounded-xl bg-slate-100" />
      <div className="mb-6 h-12 w-full animate-pulse rounded-xl bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl bg-white border border-slate-200 shadow-sm"
          />
        ))}
      </div>
    </main>
  );
}
