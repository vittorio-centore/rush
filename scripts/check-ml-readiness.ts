import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { isEventType, normalizeEventMetadata } from "@/lib/events";
import { createServiceClient } from "@/lib/supabase/service";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const POSITIVE_EVENT_TYPES = new Set(["click", "follow", "apply", "native_apply"]);

async function main() {
  const supabase = createServiceClient();

  const [
    clubsResponse,
    profilesResponse,
    eventsResponse,
    positiveEventsResponse,
  ] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, slug, description, tags, category", { count: "exact" }),
    supabase
      .from("profiles")
      .select("id, full_name, year, major, interests", { count: "exact" }),
    supabase
      .from("events")
      .select("id, event_type, metadata", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("events")
      .select("event_type", { count: "exact" })
      .in("event_type", Array.from(POSITIVE_EVENT_TYPES)),
  ]);

  const clubs = clubsResponse.data ?? [];
  const profiles = profilesResponse.data ?? [];
  const events = eventsResponse.data ?? [];
  const positiveCount = positiveEventsResponse.count ?? 0;
  const slugCounts = new Map<string, number>();
  for (const club of clubs) {
    slugCounts.set(club.slug, (slugCounts.get(club.slug) ?? 0) + 1);
  }
  const duplicates = Array.from(slugCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([slug, slugCount]) => ({ slug, slug_count: slugCount }));

  const invalidEventTypes = events.filter((event) => !isEventType(event.event_type));
  const invalidMetadata = events.filter((event) => {
    try {
      if (!isEventType(event.event_type)) {
        throw new Error("Unsupported event type");
      }
      normalizeEventMetadata(event.event_type, event.metadata);
      return false;
    } catch {
      return true;
    }
  });

  const clubsMissingDescriptions = clubs.filter((club) => !club.description?.trim()).length;
  const clubsMissingTags = clubs.filter((club) => !Array.isArray(club.tags) || club.tags.length === 0).length;
  const clubsMissingCategory = clubs.filter((club) => !club.category?.trim()).length;
  const incompleteProfiles = profiles.filter((profile) => {
    return !profile.full_name?.trim() || !profile.year?.trim() || !profile.major?.trim();
  }).length;

  const report = {
    generated_at: new Date().toISOString(),
    thresholds: {
      minimum_positive_events_for_ml: 1000,
      minimum_beta_days_for_ml: 14,
    },
    counts: {
      clubs: clubsResponse.count ?? clubs.length,
      profiles: profilesResponse.count ?? profiles.length,
      sampled_events: events.length,
      positive_signal_events: positiveCount,
    },
    quality: {
      clubs_missing_descriptions: clubsMissingDescriptions,
      clubs_missing_tags: clubsMissingTags,
      clubs_missing_category: clubsMissingCategory,
      duplicate_slugs: duplicates.length,
      invalid_event_types: invalidEventTypes.length,
      invalid_event_metadata: invalidMetadata.length,
      incomplete_profiles: incompleteProfiles,
    },
    samples: {
      duplicate_slugs: duplicates.slice(0, 10),
      invalid_event_metadata: invalidMetadata.slice(0, 10).map((event) => ({
        id: event.id,
        event_type: event.event_type,
      })),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
