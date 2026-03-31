import test from "node:test";
import assert from "node:assert/strict";

import { createEventInsert, normalizeEventMetadata } from "@/lib/events";

test("normalizeEventMetadata enforces recommendation impression fields", () => {
  const metadata = normalizeEventMetadata("recommendation_impression", {
    surface: "dashboard_recommendations",
    model_version: "ranker-v1",
    strategy: "ml_ranked",
    club_ids: ["club-a", "club-b"],
  });

  assert.deepEqual(metadata, {
    surface: "dashboard_recommendations",
    model_version: "ranker-v1",
    strategy: "ml_ranked",
    club_ids: ["club-a", "club-b"],
  });
});

test("createEventInsert normalizes click metadata", () => {
  const insert = createEventInsert({
    userId: "user-1",
    clubId: "club-1",
    eventType: "click",
    metadata: {
      surface: "club_directory",
      target: "club_page",
      reason_code: "semantic_match",
    },
  });

  assert.deepEqual(insert, {
    user_id: "user-1",
    club_id: "club-1",
    event_type: "click",
    metadata: {
      surface: "club_directory",
      target: "club_page",
      reason_code: "semantic_match",
    },
  });
});

test("createEventInsert supports tracker add events without treating them as applies", () => {
  const insert = createEventInsert({
    userId: "user-1",
    clubId: "club-1",
    eventType: "apply_add",
    metadata: {
      surface: "dashboard_applications",
      source: "tracked",
    },
  });

  assert.deepEqual(insert, {
    user_id: "user-1",
    club_id: "club-1",
    event_type: "apply_add",
    metadata: {
      surface: "dashboard_applications",
      source: "tracked",
    },
  });
});
