import assert from "node:assert/strict";
import test from "node:test";

import { computeWeightedScore, DECISION_TEMPLATES } from "@/lib/recruiter-decisions";

test("computeWeightedScore applies configured rubric weights", () => {
  const score = computeWeightedScore(
    [
      {
        problem_solving: 9,
        coding_ability: 8,
        technical_knowledge: 7,
        communication: 6,
      },
      {
        problem_solving: 7,
        coding_ability: 8,
        technical_knowledge: 9,
        communication: 8,
      },
    ],
    {
      problem_solving: 3,
      coding_ability: 3,
      technical_knowledge: 2,
      communication: 1,
    },
  );

  assert.equal(score, 7.9);
});

test("decision templates ship with stages and decision labels", () => {
  assert.ok(DECISION_TEMPLATES.length >= 3);
  assert.ok(DECISION_TEMPLATES.every((template) => template.stages.length >= 3));
  assert.ok(DECISION_TEMPLATES.every((template) => template.decision_labels.length >= 3));
});
