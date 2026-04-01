import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { TrackedLink } from "@/components/TrackedLink";
import SiteHeader from "@/components/SiteHeader";
import ClubFilters from "./ClubFilters";
import DirectoryEventReporter from "./DirectoryEventReporter";

export const metadata: Metadata = {
  title: "Club Directory | Rush",
  description: "Browse and search clubs on Rush.",
};

type SearchParams = {
  q?: string;
  category?: string;
  status?: string;
  tag?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Status unknown",
};

const STATUS_BADGE: Record<string, string> = {
  open: "inline-flex items-center rounded-control bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-status-open ring-1 ring-inset ring-status-open/20",
  closed:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed ring-1 ring-inset ring-status-closed/20",
  rolling:
    "inline-flex items-center rounded-control bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-status-interview ring-1 ring-inset ring-status-interview/20",
  unknown:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-muted ring-1 ring-inset ring-border/60",
};

/** A thin top border accent per category — cycles through brand hues */
const CATEGORY_ACCENT: Record<string, string> = {
  Business: "border-t-brand-primary",
  Engineering: "border-t-brand-secondary",
  "Pre-Med": "border-t-brand-secondary",
  "Pre-Law": "border-t-brand-action",
  "Arts & Culture": "border-t-brand-primary",
  "Community Service": "border-t-brand-secondary",
  Athletics: "border-t-brand-primary",
  Research: "border-t-brand-action",
  Politics: "border-t-brand-action",
  Media: "border-t-brand-primary",
  Entrepreneurship: "border-t-brand-primary",
};

function categoryAccent(category: string | null): string {
  if (!category) return "border-t-border-warm";
  return CATEGORY_ACCENT[category] ?? "border-t-brand-primary";
}

export default async function ClubsPage({ searchParams }: PageProps) {
  const resolved: SearchParams = (await searchParams) ?? {};
  const { q, category, status, tag } = resolved;

  const supabase = await createClient();

  let query = supabase
    .from("clubs")
    .select("id, slug, name, description, tags, category, recruiting_status, verified")
    .order("name");

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("recruiting_status", status);
  if (tag) query = query.contains("tags", [tag]);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

  const { data: clubs } = await query;

  // Collect unique categories from all clubs (unfiltered) for filter UI
  const { data: allClubs } = await supabase
    .from("clubs")
    .select("category, tags")
    .not("category", "is", null);

  const categories = Array.from(
    new Set((allClubs ?? []).map((c) => c.category).filter(Boolean))
  ).sort() as string[];

  const allTags = Array.from(
    new Set((allClubs ?? []).flatMap((c) => c.tags ?? []))
  ).sort() as string[];

  const results = clubs ?? [];
  const { data: authData } = await supabase.auth.getUser();
  const isAuthenticated = !!authData.user;

  return (
    <div className="min-h-screen bg-surface-warm">
      <SiteHeader isAuthenticated={isAuthenticated} />

      {/* Page header — full-bleed tinted band */}
      <div className="border-b border-border-warm bg-surface-cool">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-10 lg:px-12">
          <div className="px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-action">
              Club directory
            </p>
            <h1
              className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Browse Michigan organizations in one searchable directory.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
              Compare recruiting status, open real club pages, and narrow the list by category,
              tags, and search terms.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink-muted">
              {results.length} {results.length === 1 ? "club" : "clubs"} found
              {q ? ` for "${q}"` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10 lg:px-12">
        {/* Desktop: sidebar + grid layout */}
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          {/* Filter sidebar */}
          <aside className="mb-8 lg:mb-0">
            <div className="rounded-container border border-border-warm bg-white p-5 shadow-card lg:sticky lg:top-24">
              <ClubFilters
                categories={categories}
                tags={allTags}
                current={{ q, category, status, tag }}
              />
            </div>
          </aside>

          {/* Results grid */}
          <section>
            <DirectoryEventReporter q={q} resultCount={results.length} />

            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-card border border-border-warm bg-surface-warm p-14 text-center shadow-card">
                <span className="text-4xl" role="img" aria-label="No results">
                  🔍
                </span>
                <p className="font-medium text-ink">No clubs match your filters.</p>
                <p className="text-sm text-ink-muted">
                  Try adjusting your search or removing a filter.
                </p>
                <Link
                  href="/clubs"
                  className="mt-1 inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white hover:bg-[#1F2937] transition-colors"
                >
                  Clear filters
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((club) => (
                  <li key={club.id}>
                    <ClubCard club={club} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

type ClubRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  recruiting_status: string;
  verified: boolean | null;
};

function ClubCard({ club }: { club: ClubRow }) {
  return (
    <TrackedLink
      href={`/clubs/${club.slug ?? club.id}`}
      clubId={club.id}
      metadata={{ surface: "club_directory", target: "club_page" }}
      className={`group flex h-full flex-col rounded-card border border-border-warm bg-white shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-[box-shadow,transform] duration-150 ease-out border-t-4 ${categoryAccent(club.category)}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-base font-semibold text-ink leading-snug"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {club.name}
            {club.verified && (
              <span
                className="ml-1.5 inline-flex items-center text-xs text-brand-secondary"
                title="Verified"
                aria-label="Verified club"
              >
                ✓
              </span>
            )}
          </h2>

        </div>

        {/* Category */}
        {club.category && (
          <p className="text-xs font-medium text-ink-muted">{club.category}</p>
        )}

        {/* Description */}
        {club.description && (
          <p className="flex-1 text-sm leading-relaxed text-ink-muted line-clamp-2">
            {club.description}
          </p>
        )}

        {Array.isArray(club.tags) && club.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {club.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-control border border-border-warm bg-surface-cool px-2 py-0.5 text-[11px] text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3 border-t border-border-warm px-5 py-3">
        <span
          className={`shrink-0 ${STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown}`}
        >
          {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
        </span>
        <span className="text-xs font-medium text-brand-action group-hover:underline">
          Open club page →
        </span>
      </div>
    </TrackedLink>
  );
}
