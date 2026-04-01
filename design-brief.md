# Rush — Design Brief
## For the Design System Agent

**Date:** March 2026  
**Project:** Rush — campus club recruiting platform, University of Michigan  
**Stack:** Next.js 16.2 / React 19 / Tailwind 4 / Supabase

---

## 1. Current State Audit

The existing UI is functional but has a split personality. `globals.css` defines a warm parchment background (`#f8f4eb`, radial gradient with maize and sky hints) that suggests character, but almost every component overrides it with `bg-slate-50` or `bg-white`, flattening the warmth into a generic SaaS grey. The result: a design system at war with itself.

**Specific observations:**

- **Color:** Tailwind's `blue-600` (`#2563EB`) is used as the single primary action color across all surfaces — landing, auth, directory, portal, dashboard. It is effective but characterless. The warm background gradient in `globals.css` is never capitalized on.
- **Typography:** `"Avenir Next", "Helvetica Neue"` in CSS, but zero heading-level type variation. Every heading is `font-bold tracking-tight text-slate-900` at varying `text-*` sizes. No display font, no personality above the fold.
- **Spacing/Shape:** `rounded-xl`, `rounded-2xl`, `rounded-[28px]` coexist without a clear system. Cards use shadows inconsistently (`shadow-sm` everywhere, no hierarchy).
- **Navigation:** The portal has a good pill-nav pattern (`rounded-full` with active = `bg-slate-900 text-white`). The student dashboard has no persistent navigation of its own — it relies on the page structure. The landing page nav is bare (logo + 2 links).
- **Two-surface problem:** Student-facing pages (dashboard, directory) and recruiter-facing pages (portal) use identical visual language. There is nothing to signal "you are in a different mode."
- **The recommendation rail** is the only place a second hue appears (cyan `#06B6D4`) — this is a good instinct, but it feels bolted on.
- **Empty states** are functional text (`"No clubs match your filters."`) with no illustration, icon, or warmth.
- **Auth page** is split-panel but the left panel is nearly blank — a missed first-impression moment.

---

## 2. Audience

### Primary: Students (18–22, U of M)
- Discovering orgs during the first weeks of a semester — high anxiety, high FOMO, low patience
- Mobile-first browsers; likely arriving from group chat links
- Motivated by: belonging, identity, fear of missing the deadline, social proof ("how many applied")
- Mental model: Instagram/Notion hybrid — visual scanning + structured tracking

### Secondary: Club officers / recruiters (20–24, student org leaders)
- Power users who return weekly during recruiting season
- Using the portal like a lightweight ATS — they care about density, not beauty
- Motivated by: efficiency, authority, clarity on where applicants stand
- Mental model: Airtable/Linear — table views, bulk actions, filter combos

### Design implication
Students need delight and discovery. Recruiters need density and control. The design system must serve both without looking like two different apps bolted together — achieved through shared tokens with different _applications_ per surface.

---

## 3. Color Palette

### Rationale for departing from blue-only
Blue is correct for trust (auth, confirmations, links). But it reads as a bank, a SaaS onboarding flow, a form. For a campus product about identity and belonging, the primary brand color should evoke energy and social warmth — the feeling of a student org fair, not a dashboard tutorial.

### Recommended Palette

| Role | Name | Hex | Psychological rationale |
|---|---|---|---|
| Brand primary | **Maize amber** | `#F0A500` | Draws from U of M's maize without being literal. Amber reads as warm, energetic, optimistic — social science research consistently links amber/golden tones to approachability and enthusiasm. It signals "community" rather than "software." |
| Brand secondary | **Deep teal** | `#0F766E` | Teal-green is the complement that makes amber pop without going full Michigan blue. It reads as trusted, calm, and slightly academic — perfect for status badges, verified marks, and "open recruiting" signals. It also differentiates Rush from every other blue SaaS product. |
| Action (CTA) | **Warm navy** | `#1E3A5F` | Replaces Tailwind's generic `blue-600`. Dark navy has institutional weight that blue-600 lacks — it feels earned, like a university press. Use for primary buttons and key links. |
| Surface warm | **Parchment** | `#FAF6EE` | Already in `globals.css` but underused. Lean into it as the default background. It's the feeling of a bulletin board — physical, campus-y, not sterile. |
| Neutral dark | **Ink** | `#17202B` | Already defined as `--foreground`. Keep it. Deep enough for body text, not pure black — prevents the harshness of `#000`. |

### Extended semantic palette (for status / badges)

These slot into the existing semantic system but should be calibrated to the primary palette:

| Semantic | Hex | Use |
|---|---|---|
| Open / success | `#0F766E` (teal) | Replaces green-700 for recruiting status |
| Urgent / deadline | `#B45309` (amber-700) | Replaces red for "7 days left" warnings — still reads urgency without fire-alarm stress |
| Closed | `#6B7280` (slate-500) | Neutral, not alarming |
| Interview stage | `#D97706` (amber-600) | Warm active state |
| Decision / accepted | `#0F766E` (teal) | Consistent with "open" — both are positive outcomes |
| Rejected | `#DC2626` (red-600) | Reserve red for this specific signal only |

### Portal-specific surface
The recruiter portal should use a slightly cooler, more neutral surface: `#F8FAFC` (Tailwind's `slate-50`) rather than warm parchment. This creates a subconscious mode-switch: students are on warm parchment, recruiters are in a cooler workspace. Same tokens, different surface application.

---

## 4. Typography

### Recommended Pairing 1 (preferred)

**Headings: [Fraunces](https://fonts.google.com/specimen/Fraunces)** — variable optical size serif  
**Body: [Inter](https://fonts.google.com/specimen/Inter)** — system-adjacent sans-serif

Rationale: Fraunces is an "optical size" serif designed specifically for display use — it reads as editorial, warm, and slightly quirky without being precious. At 36px+ it has the personality of a well-designed student newspaper masthead. At smaller sizes, switch to Inter, which the user's system may already have cached. This pairing says "we care about craft" without looking like a startup landing page template. It also ages well — not a trend typeface.

Usage guidance:
- `h1` and dashboard hero copy: Fraunces, weight 600–700, optical size `display`
- Section labels (`text-xs uppercase tracking-wide`): Inter, weight 600, keep existing convention
- Body and form labels: Inter, weight 400–500
- Data tables (portal): Inter only — no serif in the recruiter ATS surface

### Recommended Pairing 2 (backup, no CDN dependency)

**Headings: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)**  
**Body: System UI stack** (`ui-sans-serif, system-ui, -apple-system`)

Rationale: If loading a display serif is unacceptable for performance, Plus Jakarta Sans has more warmth and geometric personality than Inter at large sizes, while still reading clean at small sizes. It splits the difference between playful and professional.

---

## 5. Navigation Patterns

### Mental model differences

| Student | Recruiter |
|---|---|
| "Where are the clubs?" (exploratory) | "I need to get back to my pipeline" (task-driven) |
| Low return frequency during off-season | High daily return frequency during rush season |
| Mobile-first scanning behavior | Desktop-first power user |
| Primary nav = bottom bar on mobile | Primary nav = top or sidebar on desktop |

### Student navigation hierarchy

**Public surface (unauthenticated):**  
Logo + "Browse clubs" + "Sign in" — current pattern is correct, but the logo needs more visual weight (use Fraunces or a wordmark treatment).

**Student dashboard (authenticated):**  
Add a persistent sidebar/bottom nav with 4 items maximum: Discover / Applications / Deadlines / Profile. The current dashboard links these as cards mid-page — that works for a first visit but fails for return users who know what they want. On mobile: sticky bottom navigation bar (4 icons + labels, 48px touch targets).

**Club detail page:**  
Contextual — no persistent nav needed. Show a clear back-to-directory breadcrumb and a single primary action (Follow / Apply).

### Recruiter/portal navigation hierarchy

The current pill-nav inside the portal card is good but needs a visual distinction from student nav. Recommendations:
- Keep pill tabs for sub-navigation within the portal (`Applicants / Decisions / Settings / Deadlines / Forms / Imports`)
- Reorder: most-used tabs first — `Applicants` then `Decisions` then `Forms` then `Deadlines` then `Imports` then `Settings`
- Add a persistent portal header with the club name, logo slot, and member role badge — currently this is only in the layout card and disappears on scroll
- On the portal, the tab navigation should be sticky below the header

### Public directory nav
The directory (`/clubs`) should inherit the global student nav. Currently it renders as a standalone `<main>` with no persistent nav above it — unclear if the user is logged in.

---

## 6. Design Personality

### Personality Adjectives

1. **Warmly institutional** — feels like it belongs at Michigan, not like a VC-backed startup
2. **Editorially precise** — clean spacing, legible hierarchy, nothing decorative that doesn't earn its place
3. **Socially alive** — communicates that real people and real orgs are on the other side
4. **Confidently simple** — no tooltips explaining what a button does; copy and visual hierarchy do the work
5. **Seasonally urgent** — the product is most important in September and January; the design should convey that deadlines matter

### Reference Sites

**1. Lenny's Newsletter (lennysnewsletter.com)**  
What makes it work: Confident serif headings against clean white, generous whitespace, warm amber/orange used sparingly as accent. The typography does all the work — no gradients, no blobs, no illustrations needed. It reads as "an expert's personal recommendation" rather than "a product."  
What to steal: The editorial hierarchy model — big serif header, tight small-caps category labels, body text that breathes.

**2. Are.na (are.na)**  
What makes it work: Extremely minimal chrome, dense content, a grid-of-cards that respects the content rather than over-designing it. Navigation is near-invisible because the content is the experience. User actions (save, connect) are quiet until you need them.  
What to steal: Cards with no drop shadows on the student directory — use subtle border + background instead of elevation. The content (club name, description, tags) should be the first thing the eye lands on, not the card chrome.

**3. Notion's marketing site circa 2020–2021**  
What makes it work: That specific era balanced personality (distinctive bold headings, tight letter-spacing) with clarity. The product felt like it was made by people who cared about typography, not by a growth team. The public pages and the product shared enough DNA that switching felt continuous.  
What to steal: The two-panel landing page pattern (feature description left / feature card right) — Rush already uses this but the typography is too timid. Give the heading more scale and the card more visual personality.

---

## 7. Key Design Moments

These are the five highest-leverage places where distinctive design changes how the product feels.

### Moment 1: The Empty Dashboard (first login)
**Current state:** A dashed-border box with `"Get started in three steps"` and three `bg-slate-50` numbered boxes.  
**Opportunity:** This is the most emotional moment in the product — a new student, first week of semester, figuring out campus. It deserves something more alive: a warm illustrated or typographic empty state that communicates the promise of the product. Concretely: a three-step onboarding tile with visual progress (not a numbered list), a prominent "Browse clubs →" CTA, and a stat like "1,800+ orgs on campus" to provide social proof before the user has done anything.

### Moment 2: The Club Card in the Directory
**Current state:** White card, border, club name, category, description (line-clamped), tags.  
**Opportunity:** Club cards are the product's primary discovery surface and they're completely flat. Add a category-derived accent stripe or icon at the top-left of each card. Use the recruiting status badge as the dominant visual signal (open/rolling/closed should visually differentiate the card, not just the badge chip). Add a subtle hover state that reveals an "Follow" quick-action without navigating away.

### Moment 3: Auth / Sign-in Page Left Panel
**Current state:** Logo wordmark + tagline + "Trusted by students at University of Michigan." on `bg-slate-50`. This is essentially blank.  
**Opportunity:** The left panel of the split auth screen is a brand moment. Use it: large Fraunces heading with a season-aware message ("Rush season starts now."), a cluster of 3–4 anonymous club name/category tiles as social proof, and the warm parchment background. This converts a form page into a moment of aspiration.

### Moment 4: Deadline Urgency in the Dashboard
**Current state:** Deadlines use red `ring-red-500` for items within 7 days, grey otherwise. The visual urgency is communicated only by the badge chip.  
**Opportunity:** Urgent deadlines (≤7 days) should visually dominate the list. Use the amber `#F0A500` accent as a left-border rule on urgent rows (a `border-l-4` treatment). The item should feel important without being alarming. This is a case where the brand's amber earns its place — urgency expressed in the brand's voice, not generic red.

### Moment 5: The Recruiter Decision View (Portal Applicant Page)
**Current state:** Functional table row with status badge and score fraction.  
**Opportunity:** When a recruiter opens an individual applicant page, they are making a consequential decision. The layout should feel like a focused workspace: applicant name at large scale (Fraunces display), a clear scorecard section with visual bar indicators for each dimension (problem-solving, coding, communication), and the decision action as a prominent, irreversible-feeling button. The "why this showed up" pattern from the recommendation rail is a good precedent — apply equivalent transparency to the scoring breakdown.

---

## 8. Motion and Interaction Principles

### Principle 1: Translate, don't scale
Use `translateY` for hover states, never `scale`. The current `-translate-y-0.5` on dashboard cards is correct — keep it at 2px max. Scaling cards feels aggressive and creates layout jitter. Translation feels like the card is meeting you.

**Implementation:** `transition-transform duration-150 ease-out hover:-translate-y-0.5`

### Principle 2: Status changes are instant, navigation transitions are short
When a user toggles a filter or submits a form, the feedback should be immediate (no transition delay). When navigating between routes, use a 150ms fade — enough to register that something changed, not enough to feel slow.

**Implementation:** Route transitions via `opacity-0 to opacity-100 duration-150`. Filter chip state changes: no animation, instant class swap.

### Principle 3: Urgency escalates without animating
The temptation with deadline urgency is to pulse or flash. Resist it. Animation for urgent states increases anxiety and feels like a notification. Instead, escalate urgency through static visual weight: thicker border, higher contrast text, accent color. Motion is reserved for user actions (hover, click), not for content states.

---

## 9. Anti-Patterns to Avoid

1. **No hero sections with laptop mockups or phone screenshots.** This is not a product marketing site. The people landing on Rush already need it — show them the product, not a picture of the product.

2. **No gradient blobs or decorative SVG backgrounds.** The warm parchment gradient in `globals.css` is the upper limit of background decoration. No `radial-gradient` multi-color halos, no floating shapes.

3. **No generic blue as the brand primary.** Tailwind's `blue-600` (`#2563EB`) can remain for semantic uses (links, form focus rings, informational badges). It must not be the CTA button color or the brand identity color.

4. **No empty states that are just a grey text string.** Every zero-state surface (no clubs followed, no applications tracked, no applicants in portal) needs a short, warm, human copy line and a single CTA. Not a 3-paragraph explanation.

5. **No uppercase tracking labels as the dominant text on a page.** The `text-xs font-semibold uppercase tracking-[0.2em] text-slate-400` pattern is currently overused — it appears on nearly every section header. Reserve it for genuine metadata labels (timestamps, categories, source indicators). Headings should be headings.

6. **No mixed border-radius systems without rationale.** Consolidate: `rounded-lg` (8px) for interactive controls (inputs, buttons, small chips), `rounded-2xl` (16px) for cards, `rounded-[28px]` for hero/feature containers. Not all three on the same page without a system.

7. **No identical visual language for students and recruiters.** The portal must _feel_ like a different mode. Not a different product — a different gear. Surface color, type density, and action color are the levers.

8. **No toast notifications that auto-dismiss before a user can read them.** The current pattern uses URL `?message=` and `?error=` query params rendered as green/red banners. This is fine for server-action feedback. Do not layer client-side toasts that disappear after 2 seconds for consequential events (application submitted, decision saved).

---

## 10. Token Foundations for Design System Agent

The following are the precise design tokens this brief recommends. The Design System agent should implement these as CSS custom properties in `globals.css` and as Tailwind theme extensions.

```
--color-brand-primary:    #F0A500   /* amber — brand identity */
--color-brand-secondary:  #0F766E   /* teal — trust, success */
--color-brand-action:     #1E3A5F   /* warm navy — CTA buttons */
--color-surface-warm:     #FAF6EE   /* parchment — student surfaces */
--color-surface-cool:     #F8FAFC   /* slate-50 — portal/recruiter surfaces */
--color-ink:              #17202B   /* foreground text */
--color-ink-muted:        #64748B   /* slate-500 — secondary text */
--color-border:           #E2E8F0   /* slate-200 — default borders */
--color-border-warm:      #E8DFC8   /* warm border for parchment surfaces */

--radius-control:         8px       /* inputs, buttons, chips */
--radius-card:            16px      /* content cards */
--radius-container:       28px      /* hero, feature, modal containers */

--shadow-card:            0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-card-hover:      0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)

--font-display:           'Fraunces', Georgia, serif
--font-body:              'Inter', ui-sans-serif, system-ui, sans-serif
--font-mono:              ui-monospace, 'Cascadia Code', monospace

--transition-interact:    150ms ease-out
--transition-route:       150ms ease-in-out
```

---

## Summary for the Design System Agent

Rush is a two-sided campus product where the student experience must feel warm, social, and slightly editorial, and the recruiter experience must feel dense, controlled, and professional. The redesign achieves this split through:

- **Amber (`#F0A500`)** as the brand identity color, replacing generic blue-600 in brand contexts
- **Fraunces** serif at display sizes for student-facing surfaces, Inter for body and all recruiter surfaces
- **Parchment vs. slate** surface distinction between student and portal modes
- **Five high-leverage design moments** (empty dashboard, club card, auth panel, deadline urgency, decision view) that each have specific, actionable treatments defined above
- A **consolidated border-radius system** (8/16/28px) that ends the current three-way inconsistency
- **Zero decorative motion** — transitions only on user-initiated interactions, never on content states
