# Technology Stack: Visual Portal Editor

**Project:** Rush — Visual Portal Editor milestone
**Researched:** 2026-04-08
**Scope:** Net-new capabilities on top of Next.js 16.2.1 + React 19.2.4 + Supabase + Tailwind CSS v4

---

## Recommendation Summary

**Do not use a third-party drag-and-drop editor library (Puck, Craft.js, GrapeJS).** Build a custom theme editor using CSS custom properties stored as JSONB in Supabase. The "Squarespace-style" requirement for Rush is branding customization (colors, hero image, layout section toggles) — not freeform content editing. A bespoke theme editor is 1/10th the complexity, avoids every React 19 / App Router compat landmine, and produces a better user experience for the actual use case.

---

## The React 19 Problem with Editor Libraries

React 19 shipped in December 2024 with breaking changes: removed legacy context API, deprecated `ReactDOM.render`, changed how refs work with `forwardRef`. As of mid-2025:

- **Craft.js**: Last release v0.2.7 (2022). Uses legacy React context API internally. React 19 compatibility: broken without patches. Maintenance status: effectively abandoned (no commits in 18+ months as of August 2025). **[MEDIUM confidence — GitHub activity pattern from training data]**
- **GrapeJS**: jQuery-era DOM manipulation architecture. Works as a standalone editor but integrating with Next.js App Router requires mounting it inside a `"use client"` boundary with dynamic imports and `ssr: false`. React 19 is not a first-class target. Heavyweight: 500KB+ bundle, designed for email/HTML templates, not React component trees. **[MEDIUM confidence]**
- **Puck**: Actively maintained, React-first, explicit Next.js integration docs. However, Puck is designed for full page assembly (drag components into a canvas), which is more than the Rush use case needs. Puck v0.16.x targets React 18; React 19 compatibility in progress as of August 2025. Uses `forwardRef` patterns that conflict with React 19's ref handling changes. Adding Puck means adding a 200KB+ editor bundle plus a content rendering engine. **[MEDIUM confidence — Puck version and React 19 status from training data, verify before implementing]**

**Bottom line:** Every third-party visual editor adds a heavy dependency with uncertain React 19 compatibility. For Rush's actual scope — clubs pick a brand color, upload a hero image, and toggle a few sections — none of these libraries is appropriate.

---

## What "Squarespace-Style" Actually Means for Rush

The PROJECT.md states: "clubs customize colors, layout, hero image, and branding on their public-facing page."

This maps to three specific capabilities:

| Capability | Mechanism |
|------------|-----------|
| Brand color / accent | CSS custom property (`--club-accent`) stored in DB |
| Hero image | File upload to Supabase Storage, URL stored in DB |
| Layout section toggles | Boolean flags stored in DB (`show_gallery`, `show_officers`, etc.) |

This is a **theme picker + section toggle**, not a drag-and-drop canvas. Squarespace's simplest plans work exactly this way — you don't drag components, you pick a palette and toggle sections on/off.

---

## Recommended Stack

### Visual Editor UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React `useState` + Server Actions | (built-in) | Editor state management and persistence | No new dependencies. Editor state is simple: a handful of scalar values and one image URL. Server Actions handle save. Matches existing codebase pattern exactly. |
| `@radix-ui/react-slider` | ^1.2.x | Hue/saturation picker (if color wheel needed) | Headless, accessible, Tailwind-compatible. Much lighter than a full color library. |
| `react-colorful` | ^5.6.1 | Inline hex/HSL color picker | 2.8KB gzipped. Zero dependencies. Works with React 19 (pure hook-based, no legacy context). Best-in-class for minimal color pickers. |

**Confidence:** HIGH for react-colorful (well-established, maintained, no framework coupling). MEDIUM for Radix slider (widely used but verify React 19 compat before use).

### Image Upload

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Storage (already in stack) | — | Hero image hosting | Already authenticated via the same Supabase client. Public bucket with club-scoped path. No new service needed. |
| `@supabase/supabase-js` upload API | ^2.100.1 | Client-side upload from editor | Direct browser-to-storage upload. Server Action updates the DB record with the returned public URL. |

**Confidence:** HIGH — Supabase Storage is the correct and obvious choice; it eliminates a new CDN integration.

### Layout Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Postgres `jsonb` column (`clubs.portal_theme`) | — | Store theme config per club | Already pattern-established in the codebase (`events.metadata jsonb`). JSONB supports partial updates, indexing, and schema evolution. Single column addition to `clubs` table. |

**Storage schema:**
```typescript
interface PortalTheme {
  accent_color: string;        // hex, e.g. "#2563EB"
  hero_image_url: string | null;
  hero_headline: string | null; // override for club name
  show_officers_section: boolean;
  show_gallery_section: boolean;
  layout_variant: "default" | "minimal"; // future expansion
}
```

**Confidence:** HIGH — JSONB column on `clubs` is the simplest, most maintainable approach. Avoids a separate `club_themes` table for what is logically a 1:1 extension of the clubs record.

### Rendering (Public Club Page)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS custom properties (inline `style` prop) | (native) | Apply club brand colors at render time | Server Component reads `portal_theme` from DB, injects `--club-accent: #hex` into a wrapper `<div style={...}>`. Zero client JS. Tailwind v4 CSS variables integrate naturally. |
| Next.js `<Image>` | (built-in) | Hero image rendering | Already in Next.js. Handles optimization, lazy loading. |

**Example render pattern:**
```tsx
// Server Component — no client JS needed for rendering
<div
  style={{ "--club-accent": theme.accent_color } as React.CSSProperties}
  className="club-portal-root"
>
  {/* children use `text-[var(--club-accent)]` Tailwind arbitrary value */}
</div>
```

**Confidence:** HIGH — CSS custom properties with inline `style` injection from Server Components is the standard SSR-friendly approach for per-tenant theming. No hydration required.

---

## What NOT to Use

### Puck (measuredco/puck)

**Why not:** Puck is a full page-assembly editor — clubs drag React components onto a canvas, define props via a schema, and the output is a JSON tree that maps to components. This is 10x more than Rush needs. Implementation costs:

- Requires wrapping the entire club page in Puck's rendering engine (`<Render>`) — this restructures the existing club page significantly
- Editor UI (`<Puck>`) must run as a full client component tree, fighting against the App Router Server Component model
- React 19 compatibility uncertain as of August 2025 — Puck uses patterns that changed in React 19
- Adds ~200KB to the editor bundle
- Clubs would need to learn Puck's component drag metaphor, which is overkill for "pick a color and upload a photo"

**If Rush were building a full CMS where clubs author arbitrary rich content pages**, Puck would be the right answer. It is not that product.

### Craft.js (prevwong/craft.js)

**Why not:** Maintenance is dead. Last meaningful release was 2022. No React 19 support. Uses internal React APIs that are removed in React 19 (`unstable_batchedUpdates`, legacy context). Using this would require forking and patching.

### GrapeJS

**Why not:** DOM-manipulation architecture incompatible with React's virtual DOM model. Designed for building HTML email templates and landing pages, not React component trees. Requires `dynamic(() => import('grapesjs'), { ssr: false })` and mounting into a raw DOM element — at which point you've left the React component model entirely. Bundle is 500KB+. Not appropriate for a React 19 / App Router codebase.

### TipTap / Plate.js (rich text editors)

**Why not:** These are rich text / block-document editors (like Notion), not visual page editors. Useful for a club description rich text field, but that is a separate, smaller feature — not the portal editor.

### Builder.io Visual SDK

**Why not:** Paid SaaS dependency with a generous free tier that locks you in. For a campus product, vendor lock-in and pricing uncertainty are unacceptable.

---

## Supporting Libraries (Supporting Features in Milestone)

These are for the other milestone capabilities, not the editor, but documented here for completeness.

### Email (Decision Notifications)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `resend` | ^6.9.4 (already in stack) | Accept/reject/waitlist emails | Already integrated. Add new email templates in `src/lib/email.ts`. |
| `react-email` | ^3.x | Email template authoring | Optional — Resend supports plain HTML strings too. Use only if email design complexity warrants it. |

**Confidence:** HIGH for continuing with Resend. LOW for react-email — only add if plain HTML string templates become unmaintainable.

### Form Validation (Application Pipeline / Profile Autofill)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | ^3.23.x | Schema validation for Server Actions | Not currently in the codebase but recommended by the TypeScript rules. Add for validating portal theme saves and pipeline stage transitions. |

**Confidence:** HIGH — Zod is the de facto standard for TypeScript schema validation, integrates with `useActionState` patterns, and is listed in project TypeScript rules.

---

## Database Schema Additions Required

```sql
-- Add portal_theme to clubs (single JSONB column, backward compatible)
alter table public.clubs
  add column portal_theme jsonb not null default '{}'::jsonb;

-- Hero image storage bucket (Supabase Storage)
-- bucket: club-assets, path pattern: clubs/{club_id}/hero.{ext}
-- RLS: admin can write, public can read
```

No new tables needed for the theme editor. The `portal_theme` JSONB column on `clubs` handles all customization state.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| CSS custom properties for theming | HIGH | Web standard, no version risk |
| Supabase Storage for images | HIGH | Already in stack, documented pattern |
| JSONB column for theme config | HIGH | Already used in codebase (events.metadata) |
| react-colorful for color picker | HIGH | Stable, maintained, zero deps, hook-based |
| Not using Puck / Craft.js | HIGH | React 19 compat risk + scope mismatch documented above |
| Puck React 19 status | MEDIUM | From training data — verify before considering |
| Craft.js maintenance status | MEDIUM | From training data — GitHub activity pattern |

---

## Sources

- Codebase analysis: `/home/kaelwu/Rush/rush/package.json`, `/home/kaelwu/Rush/rush/supabase/migrations/20260327180000_initial_schema.sql`
- Project scope: `/home/kaelwu/Rush/rush/.planning/PROJECT.md`
- Architecture patterns: `/home/kaelwu/Rush/rush/.planning/codebase/ARCHITECTURE.md`
- react-colorful: training data (npm package, actively maintained, React hook-based API, well-known in React ecosystem)
- Puck, Craft.js, GrapeJS: training data through August 2025 — MEDIUM confidence, verify React 19 compat status before any implementation
