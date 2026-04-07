# Conventions
_Last updated: 2026-04-07_

## Summary

This is a Next.js 16 App Router project written in TypeScript with `strict: true`. All source lives under `src/` with a single path alias (`@/*` → `src/*`). Styling is done exclusively with Tailwind CSS utility classes — there are no CSS modules or separate stylesheet files.

---

## Naming Conventions

### Files

| Kind | Pattern | Examples |
|---|---|---|
| Route pages | `page.tsx` (lowercase) | `src/app/dashboard/page.tsx` |
| Route layouts | `layout.tsx` | `src/app/dashboard/layout.tsx` |
| Loading/not-found | `loading.tsx`, `not-found.tsx` | `src/app/clubs/[slug]/not-found.tsx` |
| Server Actions | `actions.ts` (lowercase) | `src/app/clubs/[slug]/actions.ts` |
| Client components co-located in route | `PascalCase.tsx` | `src/app/clubs/[slug]/FollowButton.tsx` |
| Shared components | `PascalCase.tsx` | `src/components/TrackedLink.tsx` |
| Utility/lib modules | `kebab-case.ts` | `src/lib/application-forms.ts`, `src/lib/recruiter-decisions.ts` |
| Sub-directory lib modules | `kebab-case.ts` | `src/lib/recommendations/rollout.ts` |
| Test files | `<module>.test.ts` co-located with source | `src/lib/events.test.ts` |

### Components

- Exported component functions use **PascalCase**: `FollowButton`, `ApplicationForm`, `TrackedLink`.
- Default export is used for page/layout/route-level components.
- Named exports are used when a file contains multiple related components (e.g., `TrackedLink` and `TrackedAnchor` are both named exports from `src/components/TrackedLink.tsx`).

### Functions (non-component)

- **camelCase** for all regular functions: `followClub`, `unfollowClub`, `daysUntil`, `relativeDate`, `getRecord`, `createEventInsert`.
- Private/internal helpers within a module are not exported and follow the same camelCase rule: `getString`, `getNumber`, `readString`, `revalidateFormPaths`.

### Variables and Constants

- Local variables: **camelCase** — `isFollowing`, `allDeadlines`, `applyHref`.
- Module-level lookup tables / constant maps: **SCREAMING_SNAKE_CASE** — `STATUS_LABELS`, `STATUS_BADGE`, `APP_MODE_LABELS`, `VALID_QUESTION_TYPES`.
- Boolean flags derived from data use `is` / `has` prefix: `isFollowing`, `isNativeApplication`, `isPending`, `isPast`, `profileReady`.

### Types

- `type` aliases for all domain shapes, unions, and utility combos: `EventType`, `RecommendationStrategy`, `AnswerMap`, `Props`.
- Local component prop types are named `Props` (single-file convention).
- Shared domain types in lib modules use descriptive PascalCase names: `FormQuestion`, `FormSection`, `RecommendedClub`, `DashboardRecommendations`.
- No `enum` usage observed — string literal unions are used throughout (`"open" | "closed" | "rolling" | "unknown"`).
- `interface` is not used in the codebase; `type` is the consistent choice.

### Database / API Field Names

Fields from Supabase are **snake_case** (matching the DB schema): `club_id`, `user_id`, `decision_status`, `application_source`, `deadline_at`, `is_active`. These are used as-is without renaming in TypeScript.

---

## TypeScript Config

Config file: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "esModuleInterop": true,
    "allowJs": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

**Key strictness settings:**
- `strict: true` — enables `strictNullChecks`, `strictFunctionTypes`, `noImplicitAny`, and all other strict flags.
- `noEmit: true` — TypeScript is type-check only; Next.js/SWC handles compilation.
- `isolatedModules: true` — each file must be independently compilable (important for `as const` and re-exports).

**No `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or `noImplicitReturns`** — these are not enabled beyond the default `strict` bundle.

---

## Linting & Formatting

### ESLint

Config file: `eslint.config.mjs`

Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` via the flat config API (`defineConfig`). No additional custom rules are defined beyond the Next.js presets. Run with:

```bash
pnpm lint
```

### Prettier

No `.prettierrc` or `prettier.config.*` file is present. Formatting is not enforced via Prettier in this project. Code style is maintained by convention — consistent 2-space indentation and trailing commas are observed throughout the source, consistent with Next.js scaffold defaults.

### Tailwind CSS

Config: `postcss.config.mjs` with `@tailwindcss/postcss`. Tailwind v4 is used; there is no `tailwind.config.*` file (v4 uses CSS-first config). All visual styling is inline Tailwind utility classes — no custom CSS modules or `@apply` patterns observed.

---

## Import Patterns

### Path Alias

A single alias is configured:

```ts
"@/*" → "./src/*"
```

Use `@/` for all imports from within `src/`. Relative imports (e.g., `./actions`, `./FollowButton`) are used only for same-directory siblings.

### Import Order (observed pattern)

1. **External packages** — `next/*`, `react`, third-party packages
2. **Internal `@/` aliases** — lib utilities, shared components, server clients
3. **Relative sibling imports** — `./actions`, `./FollowButton`

Within each group, `import type` statements come before value imports when both are needed from the same source.

**Example from `src/app/clubs/[slug]/page.tsx`:**
```ts
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addApplication } from "@/app/dashboard/applications/actions";
import { TrackedAnchor, TrackedLink } from "@/components/TrackedLink";
import { insertEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import FollowButton from "./FollowButton";
```

**`import type`** is used for all type-only imports (`import type { Metadata }`, `import type { ReactNode }`).

---

## Component Patterns

### RSC vs Client Components

- **Default is RSC (React Server Component).** All `page.tsx` and `layout.tsx` files are async server components with no directive.
- **Client components** are opted in with `"use client"` at the top of the file. They are co-located in the route directory or placed in `src/components/`.
- Client components are kept narrow in scope — they handle interactivity only (e.g., `FollowButton.tsx` manages `useTransition` + click handler; `ApplicationForm.tsx` manages controlled form state).
- **Server-side data fetching** happens directly in RSC page/layout bodies using `await createClient()` and Supabase queries — no React Query or SWR.

### Server Actions

- Declared in `actions.ts` files co-located with the route that uses them.
- Always begin with `"use server"` directive.
- Named exports only (no default export for actions files).
- Actions call `redirect()` or `revalidatePath()` after mutations.
- Auth guard pattern: call `supabase.auth.getUser()` and `redirect("/auth")` if no user.

**Example pattern from `src/app/clubs/[slug]/actions.ts`:**
```ts
"use server";

export async function followClub(clubId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth");
  // ... mutation ...
  revalidatePath("/clubs/[slug]", "page");
}
```

### Props Typing

- Props are typed with a local `type Props = { ... }` — no `React.FC` wrapper.
- Async page components receive `params: Promise<{ slug: string }>` (Next.js 16 async params pattern).

### Conditional Rendering

Prefer `condition ? <JSX /> : null` over `condition && <JSX />` throughout — this avoids the `0` rendering footgun and is the consistent codebase pattern.

---

## File & Module Conventions

### Co-location Rule

Route-specific logic lives next to the route file:
```
src/app/clubs/[slug]/
  page.tsx          ← RSC page
  actions.ts        ← "use server" mutations
  FollowButton.tsx  ← "use client" interactive component
  not-found.tsx     ← Next.js not found boundary
  apply/
    page.tsx
    actions.ts
    ApplicationForm.tsx
```

### Shared Components

Reusable client components that are used across routes go in `src/components/`:
- `src/components/TrackedLink.tsx` — event-logging link wrappers
- `src/components/ActiveNav.tsx` — navigation with active state

### Library Modules (`src/lib/`)

Pure utility and server-side logic live in `src/lib/`:
- Domain utilities: `src/lib/application-forms.ts`, `src/lib/events.ts`, `src/lib/portal.ts`
- Feature sub-directories for cohesive domains: `src/lib/recommendations/` (contains `types.ts`, `server.ts`, `rollout.ts`, `reasons.ts`)
- Supabase client factory: `src/lib/supabase/` (contains `client.ts`, `server.ts`, `service.ts`, `proxy.ts`, `config.ts`)

### Constants / Lookup Tables

Module-level `const` records (typed as `Record<string, string>` or `as const`) are defined at the top of the file that uses them, not extracted to a separate constants file. Example pattern:

```ts
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Status unknown",
};
```

### `as const` Assertions

Used for tuple/array constants that derive union types:
```ts
export const EVENT_TYPES = ["view", "click", "follow", ...] as const;
export type EventType = (typeof EVENT_TYPES)[number];
```

And for object constants where property types should be narrowed:
```ts
const APPLICATION_STATUS_BADGE = {
  interested: "...",
  applied: "...",
} as const;
```

### Error Handling in Server Actions

Actions use early returns (not thrown exceptions) for non-fatal errors, logging via `console.error`. Fatal/auth errors use `redirect()`. No custom error types or Result wrappers are used.

### Void Fire-and-Forget

Side-effect calls that should not block rendering are prefixed with `void`:
```ts
void insertEvent(supabase, { ... });
```
