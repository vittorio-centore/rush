export type FormQuestion = {
  id: string;
  type: "short_text" | "long_text" | "single_select" | "multi_select";
  label: string;
  help_text: string | null;
  placeholder: string | null;
  is_required: boolean;
  position: number;
  condition_question_id: string | null;
  condition_operator: string | null;
  condition_value: string | null;
};

export type AnswerMap = Record<string, string | string[]>;

export function isQuestionVisible(question: FormQuestion, answers: AnswerMap) {
  if (!question.condition_question_id || !question.condition_operator) {
    return true;
  }

  const dependentValue = answers[question.condition_question_id];
  const conditionValue = question.condition_value ?? "";

  if (Array.isArray(dependentValue)) {
    const includes = dependentValue.includes(conditionValue);
    return question.condition_operator === "includes"
      ? includes
      : question.condition_operator === "not_includes"
        ? !includes
        : question.condition_operator === "equals"
          ? dependentValue.join(",") === conditionValue
          : dependentValue.join(",") !== conditionValue;
  }

  const normalizedValue = dependentValue ?? "";
  switch (question.condition_operator) {
    case "equals":
      return normalizedValue === conditionValue;
    case "not_equals":
      return normalizedValue !== conditionValue;
    case "includes":
      return normalizedValue.includes(conditionValue);
    case "not_includes":
      return !normalizedValue.includes(conditionValue);
    default:
      return true;
  }
}

export function getTextAnswer(formData: FormData, questionId: string) {
  const value = formData.get(`question_${questionId}`);
  return typeof value === "string" ? value.trim() : "";
}

export function getArrayAnswer(formData: FormData, questionId: string) {
  return formData
    .getAll(`question_${questionId}`)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}
