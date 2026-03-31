import assert from "node:assert/strict";
import test from "node:test";

import { isQuestionVisible, type FormQuestion } from "@/lib/application-forms";

const baseQuestion: FormQuestion = {
  id: "q2",
  type: "short_text",
  label: "Tell us more",
  help_text: null,
  placeholder: null,
  is_required: false,
  position: 1,
  condition_question_id: "q1",
  condition_operator: "equals",
  condition_value: "yes",
};

test("isQuestionVisible returns true when no condition is set", () => {
  const question: FormQuestion = {
    ...baseQuestion,
    condition_question_id: null,
    condition_operator: null,
    condition_value: null,
  };

  assert.equal(isQuestionVisible(question, {}), true);
});

test("isQuestionVisible supports equals and includes conditions", () => {
  assert.equal(isQuestionVisible(baseQuestion, { q1: "yes" }), true);
  assert.equal(isQuestionVisible(baseQuestion, { q1: "no" }), false);

  const includesQuestion: FormQuestion = {
    ...baseQuestion,
    condition_operator: "includes",
    condition_value: "backend",
  };

  assert.equal(isQuestionVisible(includesQuestion, { q1: ["frontend", "backend"] }), true);
  assert.equal(isQuestionVisible(includesQuestion, { q1: ["frontend"] }), false);
});
