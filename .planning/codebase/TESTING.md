# Testing
_Last updated: 2026-04-07_

## Summary
Rush uses the Node.js built-in test runner (`node:test`) with `node:assert/strict` for assertions. Only 5 test files exist covering pure utility functions — no component, API, integration, or E2E tests exist. Coverage tooling is not configured.

## Test Framework

- **Runner:** Node.js built-in `node:test` (no Jest, Vitest, or Mocha)
- **Assertions:** `node:assert/strict` only — no matchers, no `.toEqual()`, no snapshot assertions
- **Command:** `npm test` → `node --test src/**/*.test.ts` (via tsx)

## Test File Locations

All test files are co-located with their source modules under `src/lib/`:

```
src/lib/
  application-forms.test.ts
  csv.test.ts
  events.test.ts
  recruiter-decisions.test.ts
  recommendations/
    rollout.test.ts
```

## Test Structure

No `describe` blocks — tests are flat, top-level `test()` calls:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { isQuestionVisible, type FormQuestion } from "@/lib/application-forms";

const baseQuestion: FormQuestion = { /* shared fixture */ };

test("isQuestionVisible returns true when no condition is set", () => {
  const question = { ...baseQuestion, condition_question_id: null };
  assert.equal(isQuestionVisible(question, {}), true);
});
```

**Test names:** Sentence-style descriptions that state the behavior being verified.

## Assertions

Only `node:assert/strict` methods used:

| Method | Usage |
|--------|-------|
| `assert.equal(actual, expected)` | Primitive equality (===) |
| `assert.deepEqual(actual, expected)` | Deep structural equality |
| `assert.ok(value)` | Truthiness check |

## Fixtures and Test Data

**Pattern:** Module-level `const` objects shared across tests via spread:

```typescript
const baseQuestion: FormQuestion = {
  id: "q2",
  type: "short_text",
  // ... all required fields
};

// Per-test variation via spread
const includesQuestion: FormQuestion = {
  ...baseQuestion,
  condition_operator: "includes",
};
```

No external fixture files. No factory functions.

## Mocking

No mocking framework. No mocking at all — all tested modules are pure functions with no I/O or side effects.

## Coverage

**No coverage tooling configured.** No `c8`, `nyc`, or built-in coverage flag in `package.json`.

## What Is Tested

| Module | Test File | What's Covered |
|--------|-----------|----------------|
| `src/lib/application-forms.ts` | `application-forms.test.ts` | `isQuestionVisible` — conditional logic for form field visibility |
| `src/lib/csv.ts` | `csv.test.ts` | `parseCsv` — quoted values, multiline, header normalization |
| `src/lib/events.ts` | `events.test.ts` | `createEventInsert`, `normalizeEventMetadata` — event payload building |
| `src/lib/recruiter-decisions.ts` | `recruiter-decisions.test.ts` | `computeWeightedScore`, `DECISION_TEMPLATES` shape validation |
| `src/lib/recommendations/rollout.ts` | `rollout.test.ts` | `stableUserBucket` determinism, `isUserInRollout` bounds |

## What Is NOT Tested

- **React components** (`src/components/`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`) — zero component tests
- **API routes** (`src/app/api/`) — no integration or route handler tests
- **Server Actions** (`src/app/auth/actions.ts` and all others) — no tests
- **Supabase client wrappers** (`src/lib/supabase/`) — no tests
- **Email module** (`src/lib/email.ts`) — no tests
- **Portal authorization** (`src/lib/portal.ts`) — no tests
- **Recommendation service** (`src/lib/recommendations/service.ts`, `server.ts`, `types.ts`, `reasons.ts`) — no tests
- **E2E / browser flows** — no Playwright or Cypress setup
