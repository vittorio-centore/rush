/**
 * Scrapes all organizations from Maize Pages and upserts them into the Rush
 * clubs table. Safe to run multiple times — uses upsert on slug.
 *
 * Usage:
 *   pnpm seed-clubs
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ─── Config ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAIZE_PAGES_API = "https://maizepages.umich.edu/api/discovery/search/organizations";
const PAGE_SIZE = 100;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Types ──────────────────────────────────────────────────────────────────

type MaizePagesOrg = {
  Id: string;
  Name: string;
  ShortName: string | null;
  WebsiteKey: string;
  Description: string | null;
  Summary: string | null;
  CategoryNames: string[];
  Status: string;
  Visibility: string;
};

type MaizePagesResponse = {
  value: MaizePagesOrg[];
};

type ClubRow = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  category: string | null;
  website_url: string;
  application_mode: "none" | "external" | "native";
  recruiting_status: "unknown" | "open" | "closed" | "rolling";
  verified: boolean;
  source: string;
  last_synced_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function toSlug(websiteKey: string): string {
  // WebsiteKey is already URL-safe but may have uppercase — normalize it
  return websiteKey.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function mapCategory(names: string[]): string | null {
  if (!names || names.length === 0) return null;
  // Use the first category as the primary category
  return names[0];
}

function orgToClub(org: MaizePagesOrg): ClubRow | null {
  if (!org.WebsiteKey || !org.Name) return null;
  if (org.Status !== "Active") return null;
  if (org.Visibility !== "Public") return null;

  const slug = toSlug(org.WebsiteKey);
  if (!slug) return null;

  const description = stripHtml(org.Description) ?? stripHtml(org.Summary);
  const tags = (org.CategoryNames ?? []).filter(Boolean);

  return {
    slug,
    name: org.Name.trim(),
    description,
    tags,
    category: mapCategory(tags),
    website_url: `https://maizepages.umich.edu/organization/${org.WebsiteKey}`,
    application_mode: "external",
    recruiting_status: "unknown",
    verified: false,
    source: "maize_pages",
    last_synced_at: new Date().toISOString(),
  };
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchPage(skip: number): Promise<MaizePagesOrg[]> {
  const url = `${MAIZE_PAGES_API}?top=${PAGE_SIZE}&skip=${skip}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Rush/1.0 (club directory seed script)",
    },
  });

  if (!res.ok) {
    throw new Error(`Maize Pages API error: ${res.status} ${res.statusText} (skip=${skip})`);
  }

  const json: MaizePagesResponse = await res.json();
  return json.value ?? [];
}

async function fetchAllOrgs(): Promise<MaizePagesOrg[]> {
  const all: MaizePagesOrg[] = [];
  let skip = 0;
  let page = 1;

  while (true) {
    process.stdout.write(`  Fetching page ${page} (skip=${skip})…`);
    const orgs = await fetchPage(skip);
    console.log(` ${orgs.length} orgs`);

    if (orgs.length === 0) break;
    all.push(...orgs);
    if (orgs.length < PAGE_SIZE) break;

    skip += PAGE_SIZE;
    page++;

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  return all;
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

async function upsertBatch(clubs: ClubRow[]): Promise<{ inserted: number; errors: number }> {
  const BATCH = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < clubs.length; i += BATCH) {
    const batch = clubs.slice(i, i + BATCH);
    const { error } = await supabase
      .from("clubs")
      .upsert(batch, { onConflict: "slug", ignoreDuplicates: false });

    if (error) {
      console.error(`  Upsert error (batch ${i / BATCH + 1}):`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Upserted ${inserted}/${clubs.length} clubs…`);
    }
  }

  console.log(); // newline after progress
  return { inserted, errors };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Fetching organizations from Maize Pages…\n");

  const orgs = await fetchAllOrgs();
  console.log(`\nFetched ${orgs.length} total organizations.\n`);

  console.log("🔧 Converting to club rows…");
  const clubs: ClubRow[] = [];
  let skipped = 0;

  // Deduplicate by slug (keep first occurrence)
  const seenSlugs = new Set<string>();
  for (const org of orgs) {
    const club = orgToClub(org);
    if (!club) { skipped++; continue; }
    if (seenSlugs.has(club.slug)) { skipped++; continue; }
    seenSlugs.add(club.slug);
    clubs.push(club);
  }

  console.log(`  ${clubs.length} clubs ready, ${skipped} skipped (inactive/private/invalid)\n`);

  console.log("💾 Upserting into Supabase…");
  const { inserted, errors } = await upsertBatch(clubs);

  console.log(`\n✅ Done.`);
  console.log(`   Upserted: ${inserted}`);
  if (errors > 0) console.log(`   Errors:   ${errors}`);

  // Print a sample
  const { data: sample } = await supabase
    .from("clubs")
    .select("name, slug, category, tags")
    .order("name")
    .limit(5);

  if (sample && sample.length > 0) {
    console.log("\nSample clubs in DB:");
    for (const c of sample) {
      console.log(`  • ${c.name} (/${c.slug}) [${c.category ?? "no category"}]`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
