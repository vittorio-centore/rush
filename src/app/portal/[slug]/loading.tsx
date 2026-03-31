export default function Loading() {
  return (
    <main>
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 w-24 animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-200" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 last:border-0 px-4 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-16 animate-pulse rounded-md bg-slate-100" />
            <div className="ml-auto h-4 w-14 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
