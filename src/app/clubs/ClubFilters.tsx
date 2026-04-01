"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { postBrowserEvent } from "@/lib/events";

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
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = [current.category, current.status, current.tag].filter(Boolean).length;
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
    const merged = { ...current, [key]: next };
    void postBrowserEvent({
      eventType: "filter",
      metadata: {
        surface: "club_directory",
        category: merged.category ?? null,
        status: merged.status ?? null,
        tag: merged.tag ?? null,
      },
    });
    router.push(buildHref({ [key]: next }));
  }

  function isActive(key: string, value: string) {
    return current[key as keyof typeof current] === value;
  }

  const hasActiveFilters = !!(current.category || current.status || current.tag || current.q);

  return (
    <div className="space-y-5">
      <div className="border-b border-border-warm pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Refine results
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Search by name, then narrow the directory by status, category, or tags.
        </p>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
          router.push(buildHref({ q: q || undefined }));
        }}
        className="flex gap-2"
      >
        <input
          name="q"
          defaultValue={current.q ?? ""}
          placeholder="Search clubs…"
          className="w-full rounded-control border border-border-warm bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action/30 transition-colors"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
        >
          Search
        </button>
        {current.q && (
          <button
            type="button"
            onClick={() => router.push(buildHref({ q: undefined }))}
            className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-warm transition-colors"
          >
            ✕
          </button>
        )}
      </form>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Active:</span>
          {current.q && (
            <FilterPill label={`"${current.q}"`} onRemove={() => router.push(buildHref({ q: undefined }))} />
          )}
          {current.status && (
            <FilterPill label={current.status} onRemove={() => router.push(buildHref({ status: undefined }))} />
          )}
          {current.category && (
            <FilterPill label={current.category} onRemove={() => router.push(buildHref({ category: undefined }))} />
          )}
          {current.tag && (
            <FilterPill label={`#${current.tag}`} onRemove={() => router.push(buildHref({ tag: undefined }))} />
          )}
          <Link href="/clubs" className="ml-1 text-xs font-medium text-brand-action hover:underline">
            Clear all
          </Link>
        </div>
      )}

      {/* Mobile toggle */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-control border border-border-warm bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-white"
        >
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ""}
          <span aria-hidden="true">{showFilters ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Filter groups */}
      <div className={`space-y-5 ${showFilters ? "block" : "hidden lg:block"}`}>
        {/* Recruiting status */}
        <FilterGroup label="Recruiting status">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggle("status", value)}
                className={
                  isActive("status", value)
                    ? "rounded-control border border-brand-action/30 bg-brand-action/10 px-3 py-1.5 text-xs font-medium text-brand-action transition-colors"
                    : "rounded-control border border-border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-border hover:text-ink transition-colors"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </FilterGroup>

        {/* Category */}
        {categories.length > 0 && (
          <FilterGroup label="Category">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggle("category", cat)}
                  className={
                    isActive("category", cat)
                      ? "rounded-control border border-brand-action/30 bg-brand-action/10 px-3 py-1.5 text-xs font-medium text-brand-action transition-colors"
                      : "rounded-control border border-border-warm bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-border hover:text-ink transition-colors"
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </FilterGroup>
        )}

        {/* Tags */}
        {visibleTags.length > 0 && (
          <FilterGroup label="Popular tags">
            <div className="flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggle("tag", tag)}
                  className={
                    isActive("tag", tag)
                      ? "rounded-full border border-brand-action/30 bg-brand-action/10 px-3 py-1 text-xs font-medium text-brand-action transition-colors"
                      : "rounded-full border border-border-warm bg-white px-3 py-1 text-xs font-medium text-ink-muted hover:border-border hover:text-ink transition-colors"
                  }
                >
                  #{tag}
                </button>
              ))}
            </div>
          </FilterGroup>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-brand-action/20 bg-brand-action/8 px-2.5 py-1 text-xs font-medium text-brand-action">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="ml-0.5 rounded-full hover:bg-brand-action/15 transition-colors p-0.5"
      >
        ✕
      </button>
    </span>
  );
}
