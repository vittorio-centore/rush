import test from "node:test";
import assert from "node:assert/strict";

import { isUserInRollout, stableUserBucket } from "@/lib/recommendations/rollout";

test("stableUserBucket is deterministic", () => {
  const first = stableUserBucket("user-123");
  const second = stableUserBucket("user-123");

  assert.equal(first, second);
});

test("isUserInRollout respects rollout bounds", () => {
  assert.equal(isUserInRollout("user-123", 0), false);
  assert.equal(isUserInRollout("user-123", 100), true);
});
