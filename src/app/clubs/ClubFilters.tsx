"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

type Props = {
  categories: string[];
  tags: string[];
  current: {
    q?: string;
    category?: string;
    status?: string;
    tag?: string;
  };
};

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "rolling", label: "Rolling" },
  { value: "closed", label: "Closed" },
];

export default function ClubFilters({ categories, tags, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const visibleTags = current.tag
    ? Array.from(new Set([current.tag, ...tags])).slice(0, 24)
    : tags.slice(0, 24);

  function buildHref(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...current, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function toggle(key: string, value: string) {
    const next = current[key as keyof typeof current] === value ? undefined : value;
    router.push(buildHref({ [key]: next }));
  }

  function isActive(key: string, value: string) {
    return current[key as keyof typeof current] === value;
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
          router.push(buildHref({ q: q || undefined }));
        }}
        className="flex gap-3"
      >
        <input
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="Search clubs…"
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
        {current.q && (
          <button
            type="button"
            onClick={() => router.push(buildHref({ q: undefined }))}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => toggle("status", value)}
            className={
              isActive("status", value)
                ? "rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors"
                : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle("category", cat)}
              className={
                isActive("category", cat)
                  ? "rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors"
                  : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tag filters */}
      {visibleTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Popular tags
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggle("tag", tag)}
                className={
                  isActive("tag", tag)
                    ? "rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors"
                    : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                }
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filters summary */}
      {(current.category || current.status || current.tag || current.q) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Filtered by:</span>
          {current.q && (
            <span className="rounded bg-slate-100 px-2 py-0.5">
              &quot;{current.q}&quot;
            </span>
          )}
          {current.status && <span className="rounded bg-slate-100 px-2 py-0.5">{current.status}</span>}
          {current.category && <span className="rounded bg-slate-100 px-2 py-0.5">{current.category}</span>}
          {current.tag && <span className="rounded bg-slate-100 px-2 py-0.5">#{current.tag}</span>}
          <Link href="/clubs" className="ml-1 text-blue-600 text-xs">
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}
