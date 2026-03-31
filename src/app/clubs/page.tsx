import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { TrackedLink } from "@/components/TrackedLink";
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
  open: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  closed: "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  rolling: "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  unknown: "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
};

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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 lg:px-12">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Clubs</h1>
        <p className="text-sm text-slate-500">
          {results.length} {results.length === 1 ? "club" : "clubs"} found
          {q ? ` for "${q}"` : ""}
        </p>
      </div>

      <ClubFilters
        categories={categories}
        tags={allTags}
        current={{ q, category, status, tag }}
      />
      <DirectoryEventReporter q={q} resultCount={results.length} />

      {results.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-slate-400">No clubs match your filters.</p>
          <Link
            href="/clubs"
            className="mt-4 inline-block text-sm font-medium text-blue-600"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((club) => (
            <li key={club.id}>
              <TrackedLink
                href={`/clubs/${club.slug}`}
                clubId={club.id}
                metadata={{
                  surface: "club_directory",
                  target: "club_page",
                }}
                className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    {club.name}
                    {club.verified && (
                      <span className="ml-1.5 inline-flex items-center text-xs text-blue-600" title="Verified">
                        ✓
                      </span>
                    )}
                  </h2>
                  <span
                    className={`shrink-0 ${STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown}`}
                  >
                    {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
                  </span>
                </div>

                {club.category && (
                  <p className="mt-1 text-xs text-slate-500">
                    {club.category}
                  </p>
                )}

                {club.description && (
                  <p className="mt-3 flex-1 text-sm text-slate-600 line-clamp-2">
                    {club.description}
                  </p>
                )}

                {club.tags && club.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(club.tags as string[]).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </TrackedLink>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
