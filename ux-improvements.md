# Rush — UX Improvements Audit
**Date:** March 2026  
**Auditor:** Senior UX Research Pass  
**Scope:** Landing, Directory, Club Detail, Auth, Dashboard, Portal

---

## Current State Diagnosis

### Landing (`src/app/page.tsx`)

**Working well — keep it:**
- Hero heading at `text-5xl/6xl/7xl` in Fraunces with the dot-grid texture creates genuine editorial presence.
- The `ClubMosaic` decorative component earns its place — differentiates the page from SaaS templates.
- Split CTA section (students / recruiters) correctly separates audiences.
- Category strip with amber pill chips is the strongest brand-color moment on the public surface.

**Incomplete or confusing:**
- `ValueCard` components use `bg-white` instead of `bg-surface-warm`. They sit inside a `bg-surface-warm` section but pop as bright white cards — breaks the warm surface story.
- The social proof bar (`1,800+ organizations · University of Michigan · Free for students`) is styled as a single centered text line and carries no visual weight. It disappears as a footer ribbon between two major sections.
- The "Add your club" CTA in the header is targeted at recruiters but lives next to "Browse clubs" which is a student action. No visual differentiation between the two audiences in the nav.
- The hero section has `lg:items-start` on the grid but the `ClubMosaic` is vertically misaligned — it starts at the top while the copy section extends much further, leaving whitespace below the mosaic.
- The footer is `text-xs text-ink-muted` with no links — it's empty scaffolding.

**Missing micro-interactions / feedback states:**
- Category pill links in the category strip have no hover state beyond `hover:bg-brand-primary/20` — no translate, no focus ring visible.
- `ValueCard` has no hover interaction at all despite looking like a hoverable card.

**Mobile gaps:**
- The category strip uses `overflow-x-auto` with `width: max-content` but there is no scroll indicator (fade shadow at edges) to signal scrollability on mobile.
- The two CTAs in the hero stack vertically (`sm:flex-row`) but at exactly 375px they are full-width buttons that compete equally — no visual primary/secondary hierarchy.

---

### Directory (`src/app/clubs/page.tsx` + `ClubFilters.tsx`)

**Working well — keep it:**
- The `CATEGORY_ACCENT` map with `border-t-4` colored top stripe on `ClubCard` is the strongest instance of category-coded visual scanning in the product.
- The filter sidebar + results grid layout is correct for desktop; sticky sidebar at `lg:top-20` is well-considered.
- The empty state has an emoji, a human copy line, and a CTA — meets the minimum bar.
- `FilterPill` active-filter display with individual remove ✕ buttons is clean.

**Incomplete or confusing:**
- The page header (`Explore clubs` h1 + club count) sits inside `border-b border-border-warm bg-surface-warm` but there is no global navigation above it. An unauthenticated user who arrives at `/clubs` from a direct link has no "Sign in" button, no back to home, no identity signal. The page starts with the h1 and nothing above it.
- The `ClubCard` "Recruiting now" badge (`bg-amber-50 text-status-urgent`) and the footer-row status badge are two separate status signals on the same card. When `isRecruiting === true`, the card shows "Recruiting now" in the name row AND the open/rolling badge in the footer. This is redundant — one signal should do the work.
- `ClubCard` uses `bg-white` — again breaks the warm surface continuity. On `bg-surface-warm` pages, cards should use `bg-surface-warm` with `border-border-warm`, not `bg-white`.
- The `FilterGroup` label pattern (`text-xs font-semibold uppercase tracking-wider text-ink-muted`) is used for both the sidebar section labels and for in-card metadata labels. The anti-pattern from the design brief (over-use of `text-xs uppercase tracking`) is visible here.
- No result count update is visible on mobile — the count is only in the page header which scrolls off screen; after filtering, the user doesn't know how many results exist without scrolling back up.

**Missing micro-interactions:**
- `ClubCard` has `hover:shadow-card-hover hover:-translate-y-0.5` which is correct, but there is no hover state on the "View club →" text link — it should underline on card hover, not just on direct hover (the `group-hover:underline` is present but visually faint).
- No skeleton loading state — on slow connections the grid simply does not exist yet, leaving the layout visually broken.

**Mobile gaps:**
- The sidebar filters are `mb-8 lg:mb-0` and render above the grid on mobile — a long list of category buttons, tag buttons, and status filters pushes the results below the fold. On mobile, the filters should be collapsed behind a "Filters" button/drawer.

---

### Club Detail (`src/app/clubs/[slug]/page.tsx`)

**Working well — keep it:**
- The deadline urgency treatment (`border-l-4 border-l-brand-primary bg-amber-50`) is the best execution of the amber urgency pattern in the codebase — exactly as the design brief described it.
- The sidebar "Your workflow" card adapts correctly across three states: unauthenticated, tracked, untracked.
- The inline feedback banners (message/error from `searchParams`) are well-positioned above the grid.
- Tags as filter links (`/clubs?tag=`) is a discoverable navigation pattern.

**Incomplete or confusing:**
- The club header card uses `bg-white` instead of `bg-surface-warm`. On a `bg-surface-warm` page, a `bg-white` card creates unnecessary contrast at the top of the most important card on the page.
- The "Links" section header is `text-xs font-semibold uppercase tracking-wider text-ink-muted` — it reads as metadata, not a section heading. Given it precedes actual external links, it should read as a navigational label with more visual weight.
- The sidebar "Deadlines" widget (compact version) duplicates the main-column deadlines block. Two deadline lists on the same page increases cognitive load. The sidebar version adds no additional information.
- The "Is this your club?" claim card uses `text-sm font-semibold text-ink` for the heading and `text-xs text-ink-muted` for the body — an h2 element styled as small text is a semantic/visual mismatch.
- There is no state for "club is not recruiting and has no deadlines and has no description" — the page would render a nearly-empty main column with just the header card. No empty state or call to action in that scenario.
- The `applyHref` for external applications can be any string from the database. If `club.application_url` is null and `isRecruiting` is true for an external club, the CTA card renders with "Applications are open" but no button — a broken affordance with no fallback message.

**Missing micro-interactions:**
- `FollowButton` is imported but its state feedback (optimistic follow/unfollow) is unknown without reading the component — assumed it works, but there is no visual acknowledgment in the page layout when following succeeds.
- The breadcrumb `← Club directory` has `hover:text-ink transition-colors` but no `hover:-translate-x-0.5` micro-motion, which would reinforce the back navigation metaphor.

**Mobile gaps:**
- The 3-column grid (`lg:grid-cols-3`) stacks to single column on mobile, which places the sidebar ("Your workflow", deadlines, claim) below the full main content. On mobile, the primary CTA for following or applying is buried at the bottom of the page after long descriptions, deadlines, and links.
- The status badge + "Recruiting now" badge + app mode badge cluster in the header (`flex-wrap items-center gap-3`) wraps unpredictably on narrow screens, mixing follow button with status badges in a single unordered line.

---

### Auth (`src/app/auth/page.tsx` + `AuthForm.tsx`)

**Working well — keep it:**
- The `BrandPattern` SVG with overlapping amber/teal circles is subtle and on-brand — does not violate the "no gradient blobs" anti-pattern because opacity is below 0.12.
- The social proof tiles (1,800+ orgs, U of M, <5 min to apply) inside the left panel are well-placed.
- `RoleCard` with icon + label + description is the clearest role-selector pattern in the codebase.
- The `Spinner` inside submit buttons provides correct pending feedback.
- `friendlyError()` translating raw Supabase errors into human-readable copy is excellent — keep this pattern everywhere.

**Incomplete or confusing:**
- The left panel heading is `"Find your people."` (h1, 4xl/5xl Fraunces). It is generic. The design brief specifically called for a season-aware message ("Rush season starts now."). The current copy works but misses the urgency moment the brief identified as high-leverage.
- The auth form container uses `rounded-container` (`28px`) border radius while using `border border-border-warm bg-white`. The warm border on a `bg-surface-cool` right panel works, but the `bg-white` card on `bg-surface-cool` creates a third surface color in the same panel (page background is surface-cool, card is white, form inputs are white) — no surface contrast hierarchy.
- The right panel heading `"Welcome to Rush"` (h2 above the form) duplicates the branding already present in the left panel and the mobile logo. On desktop, users see the left panel and then "Welcome to Rush" — it's redundant. The h2 should be context-specific: "Sign in to your account" or "Create your account" that changes based on the active tab.
- `tab === "signin" | "signup"` tab switching updates the form but NOT the h2 heading above the `AuthForm`. The page-level heading stays "Welcome to Rush" regardless of tab state — but the heading is in `auth/page.tsx` (server component), not inside `AuthForm`. This means the heading cannot update with tab state. It's a structural limitation that makes the "Welcome to Rush" heading permanently generic.
- On mobile, the left panel is hidden entirely. There is no brand moment, no social proof, and no warmth. The mobile experience starts immediately with the form card. The mobile logo (`Rush` wordmark + amber R badge) fills this gap only minimally.

**Missing micro-interactions:**
- The tab switcher has no animated sliding indicator — the active state transitions from a text-only state to a `bg-white shadow-card` state. A subtle sliding `div` behind the active tab would signal which tab is selected more clearly.
- Form fields have `focus:border-brand-action focus:ring-2 focus:ring-brand-action/20` but there is no inline validation feedback (e.g., a green checkmark when the email format is valid, or an inline "too short" message as the user types the password). All validation happens after submit.

---

### Dashboard (`src/app/dashboard/page.tsx` + `layout.tsx`)

**Working well — keep it:**
- The sidebar layout (`w-64 shrink-0 border-r`) with `ActiveNav` is correctly structured. The active state (`bg-brand-action text-white`) provides clear location awareness.
- The welcome header with display-name personalization, date, and stats grid is the right composition for a returning-user home screen.
- The deadline urgency treatment (`border-l-4 border-l-brand-primary`) is consistent with the club detail page — good system coherence.
- The quick-navigation tiles (Discover / Track / Stay ahead) with `font-display` headings and colored uppercase labels are the strongest use of the brand's amber accent on this surface.
- The empty state ("Your journey starts here.") uses Fraunces display text and a single CTA — meets the design brief's minimum bar.

**Incomplete or confusing:**
- The three quick-stat cards (`Following`, `Applications`, `This week`) in the welcome section use `text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted` labels — the anti-pattern from the brief. These are genuine metadata labels, so it's borderline acceptable, but at 3 in a row it accumulates.
- The stats grid layout (`grid-cols-3 gap-3 xl:grid-cols-1`) means on breakpoints between `sm` and `xl`, the three stat cards are side by side. At medium widths (`md`, `lg`) this results in very narrow cards with the 3xl number and label squeezed together. The cards need a `min-w-[80px]` guard.
- The "Followed clubs" list renders as a plain `<ul>` inside a card with `border-b` dividers. Each row is `flex items-center` with club name, category, status badge, and "View →". On mobile, at 375px width, the row content (`name + category + badge + link`) overflows — the category and badge will compete for space. The category text (`mr-4 text-xs text-ink-muted`) has no truncation.
- The "Upcoming deadlines" section has no "See all →" link, unlike the "Recent applications" and "Followed clubs" sections. If there are 5+ deadlines, the user cannot access older ones from this surface.
- The profile completion nudge (`border-amber-200 bg-amber-50`) uses raw Tailwind amber colors (`amber-900`, `amber-800`) instead of the design tokens (`text-status-urgent` for amber-700, or `text-brand-action` for brand-action). This is a token inconsistency.
- The mobile top bar shows only the Rush logo and a "Sign out" button. There is no user identity indicator (no name, no avatar initial). The `displayName` is available in the layout but not shown on mobile.

**Missing micro-interactions / feedback:**
- After following a club (via `FollowButton` on the club page), returning to the dashboard should show the new follow immediately. There is no optimistic update — the server-rendered list requires a full reload.
- The recommendation rail (`RecommendationRail`) is positioned between the welcome header and the empty state check. On a first-time user with no follows and no applications, the recommendations appear before the empty state CTA. The visual flow is: welcome → recommendations → empty state CTA. The empty state CTA should come before recommendations for new users.

**Empty states:**
- The "Followed clubs" empty state uses `"You haven't followed any clubs yet."` in `text-sm text-ink-muted` — plain text, no icon, minimal copy. The design brief explicitly called for "a short, warm, human copy line and a single CTA." The link exists (`Browse clubs →`) but the copy is generic.
- The "Upcoming deadlines" empty state (`"Follow clubs to see their deadlines here."`) is a one-line instruction with no CTA. It should link to `/clubs`.

**Mobile gaps:**
- The mobile top bar (`fixed top-0 z-10`) uses `pt-24` on the main content to clear it. The pill-nav row adds roughly 44px below the logo row, which totals ~88px of chrome. `pt-24` (96px) is tight — on very tall nav configurations this could clip the first content section.
- No bottom navigation bar on mobile. The brief explicitly calls for "sticky bottom navigation bar (4 icons + labels, 48px touch targets)" for mobile. The current implementation uses a horizontal pill-nav in the top bar, which is harder to reach on large phones and offers no icons.

---

### Portal (`src/app/portal/[slug]/layout.tsx` + `page.tsx`)

**Working well — keep it:**
- The portal layout card (`rounded-[28px] border bg-surface-cool`) correctly applies the cooler surface to signal mode-switch from student surfaces.
- `.portal-surface` class on the layout wrapper correctly overrides heading fonts to Inter only — the data-density mode works as intended.
- The `ActiveNav` pill tabs with `bg-brand-action text-white` active state are visually clean and scannable.
- The role badge (`bg-brand-action/10 text-brand-action capitalize`) correctly signals membership level without shouting.
- The stats grid (Interested / Applied / Interview / Decision counts) gives the recruiter an instant pipeline snapshot.

**Incomplete or confusing:**
- The portal layout card does NOT become sticky on scroll. The brief called for "the tab navigation should be sticky below the header." Currently, when reviewing a long applicant table, the recruiter scrolls past the nav card entirely and cannot switch tabs without scrolling back up.
- The bulk-action toolbar (stage/status/decision/label selects + "Bulk update selected" button) has no indicator of how many items are selected. A recruiter selecting 15 checkboxes and hitting "Bulk update" has no count confirmation — this is a high-risk operation with no feedback. At minimum, a "X selected" text alongside the button should appear.
- The table's "Score" column shows `3/10` or `—` — the fraction format is ambiguous. Is it `3 out of 10`? `3` scores averaged? The `(count)` parenthetical helps but the primary value format needs a unit label. Should read `3.0 avg` or `3/10 (2 reviews)`.
- The filters form requires a submit button click (`Apply filters`) — none of the filter selects trigger live filtering. For a power user doing repeated filter refinements, this adds unnecessary clicks. The search input especially should debounce and filter on-type.
- The pagination control (`Page X of Y`) has no total count — "Page 1 of 4" is less useful than "Page 1 of 4 (187 applicants)".
- The empty table state is a plain `text-center text-sm text-ink-muted` with copy "No applicants match the current filters." — uses the exact anti-pattern the design brief prohibits (plain grey text as the empty state). No icon, no warmth, no "clear filters" CTA.

**Missing micro-interactions:**
- Checkbox selection has no visual highlight on the selected row — the recruiter cannot visually confirm which rows will be affected by the bulk update. Selected rows should get `bg-brand-action/5` or a `border-l-2 border-l-brand-action` treatment.
- The "Open →" link in the review column gives no preview on hover. Even a subtle tooltip with the applicant name would prevent accidental wrong-row opens.

**Mobile gaps:**
- The portal is explicitly described in the brief as "Desktop-first power user." The table is wrapped in `overflow-x-auto` which is correct. However, the layout card (header + tabs) renders at full width and the tab pills may wrap below 640px, causing the recruiter to see broken pill layout on tablet.

---

## Information Architecture Gaps

### 1. No global nav on `/clubs` (directory)
The directory page (`src/app/clubs/page.tsx`) renders a standalone `<main>` with no persistent navigation above it. The landing page has a header (`sticky top-0 z-10`) with logo + "Browse clubs" + "Sign in", but the directory page does not inherit this header — it is a separate route with no nav at all. An unauthenticated visitor arriving at `/clubs` has no path back to the landing page, no sign-in button, and no identity signal.

**What needs to happen:** Add a shared `<Header>` component used on both `/` and `/clubs` (and `/clubs/[slug]`). The dashboard has its own layout, so authenticated users are covered. The gap is the public surface.

### 2. Mobile CTA placement on Club Detail is inverted
On mobile, the 3-column grid collapses to single-column, placing the sidebar (which contains "Your workflow" — the primary action card for following or applying) below the main column. A student on mobile sees: breadcrumb → feedback banners → header card (name, description, tags, target years) → apply CTA card → deadlines block → links block → then finally the sidebar. The primary action is at position 7 in the visual flow.

### 3. Dashboard deadlines section has no "See all" escape
"Upcoming deadlines" shows up to 5 deadlines but has no link to a full deadlines view. The "Followed clubs" section has "See all →" to `/dashboard/follows`. Applications has "Open full tracker →". Deadlines is a dead end — if there are 6+ deadlines, the overflow is invisible.

### 4. Portal nav tabs order doesn't match brief recommendation
Current tab order: Applicants / Decisions / Forms / Deadlines / Imports / Settings.  
Brief recommendation: Applicants / Decisions / Forms / Deadlines / Imports / Settings.  
These match on first glance but the brief specifies "most-used tabs first." For a typical recruiter, the usage frequency is Applicants >> Decisions > Forms > Settings > Deadlines > Imports. The "Settings" tab at the end is correct, but "Deadlines" and "Imports" are both less frequently used than "Settings" during active reviewing — Settings is used during setup, then rarely. The current order is acceptable but not optimal.

### 5. The `ValueCard` in landing is not linked
The three `ValueCard` components (Discover / Apply / Track) are static cards with no navigation affordance. A student who reads "Filter all 1,800+ orgs" cannot click the card to go to `/clubs`. This is a missed conversion moment.

---

## Personality & Delight Opportunities

### Moment A — Empty Dashboard (first login)
**Current state:** "Your journey starts here." heading with a description and "Discover clubs →" button. `bg-white rounded-container p-8 text-center`.  
**Opportunity:** The copy is good but the container is generic. Add an amber `border-t-4 border-t-brand-primary` to the empty state container (consistent with the urgent-deadline pattern), a subtle category-chip cluster (`Business`, `Engineering`, `Arts` as decorative pills inside the card), and change the CTA to include the stat: "Discover clubs → 1,800+ orgs on campus" as subtext below the button. This converts the empty state from an instruction into an invitation.

### Moment B — Follow success feedback
**Current state:** No visible state change at the page level after following a club from the detail page — relies on `FollowButton` internal state.  
**Opportunity:** After a successful follow, the "Your workflow" sidebar card should briefly show a teal-tinted success line: `"Added to your watchlist."` in `text-status-open text-xs` that appears for ~2 seconds via CSS `opacity-0 animate-pulse` or simply persists as a static line below the follow button. This does not require a toast — it stays in context.

### Moment C — Category strip scroll indicator
**Current state:** Horizontal scroll strip with no fade shadows at edges.  
**Opportunity:** Add `after:absolute after:right-0 after:top-0 after:h-full after:w-12 after:bg-gradient-to-l after:from-surface-warm` on the scroll container wrapper. This signals that more categories exist off-screen without any JavaScript.

### Moment D — Deadline countdown "Today" treatment
**Current state:** When `days === 0`, the text shows `"Today"` in `text-status-urgent` in the sidebar widget and main deadlines block.  
**Opportunity:** The "Today" state is the highest urgency possible but looks identical to a "3d left" item except for the word. Add `font-semibold text-sm` (instead of the current `text-xs`) to "Today" labels and pair with the amber `border-l-4` treatment even in the sidebar compact list. Make the word feel heavier — it is the most important signal on the page.

### Moment E — Portal empty-applicant state
**Current state:** Plain text `"No applicants match the current filters."` centered in the table.  
**Opportunity:** Replace with a three-element empty state: a `text-2xl` icon (e.g., `📭` or an SVG clipboard), a heading (`"No applicants yet"` or `"No results for these filters"`), and a CTA link (`"Clear all filters"` → `/portal/${slug}` with no query params). Style in `text-center p-12` with the same warmth used in the student-facing empty states, but keep the container `bg-surface-cool` to maintain portal mode.

---

## Typography & Spacing Refinements

### T1 — Directory page header is undersized
**File:** `src/app/clubs/page.tsx`, line 103  
**Current:** `text-3xl font-semibold sm:text-4xl` for the "Explore clubs" h1.  
**Issue:** At `text-3xl` the heading competes visually with individual `ClubCard` headings which are `text-base font-semibold`. The page-level heading should be clearly dominant. On the directory — a high-information-density page — the h1 is the user's orientation anchor.  
**Fix:** Increase to `text-4xl sm:text-5xl` and add `leading-[1.1] tracking-tight` to match the hero heading scale pattern.

### T2 — "Links" section label on Club Detail is too small
**File:** `src/app/clubs/[slug]/page.tsx`, line 395  
**Current:** `text-xs font-semibold uppercase tracking-wider text-ink-muted` — this is the anti-pattern label applied to the section heading for external links.  
**Fix:** Change to `text-sm font-semibold text-ink mb-3` — treat it as an actual section heading, not a metadata label. Same fix applies to the sidebar "Deadlines" header at line 577.

### T3 — Portal stats cards lack heading scale
**File:** `src/app/portal/[slug]/page.tsx`, line 316  
**Current:** `text-xs font-medium uppercase tracking-[0.14em] text-ink-muted` label + `text-3xl font-semibold text-ink` number. The gap between `text-xs` label and `text-3xl` number is extreme.  
**Fix:** Change the label to `text-sm font-medium text-ink-muted` (remove uppercase + tracking). The number is fine at `text-3xl`. This reduces the label-to-number size ratio from ~4:1 to ~2.5:1, which reads more naturally.

### T4 — Dashboard welcome description is too wide
**File:** `src/app/dashboard/page.tsx`, line 173  
**Current:** `max-w-xl text-base leading-7 text-ink-muted`. At `max-w-xl` (36rem) this is a long 3-line paragraph in the welcome area. The brief recommends generous whitespace and content that breathes.  
**Fix:** Tighten to `max-w-sm text-base leading-7 text-ink-muted` — shorter measure, fewer words per line, easier to skim for a returning user who knows the product.

### T5 — Auth form right panel heading is static and generic
**File:** `src/app/auth/page.tsx`, line 107  
**Current:** `<h2 className="font-display text-2xl font-semibold text-ink">Welcome to Rush</h2>`  
**Fix:** Move this heading inside `AuthForm` where it can respond to the active tab state. Inside `AuthForm`, render `{tab === "signin" ? "Sign in" : "Create your account"}` at `text-2xl font-semibold text-ink`. Remove the static server-rendered heading from `auth/page.tsx`.

### T6 — `ValueCard` heading is undersized for its role
**File:** `src/app/page.tsx`, line 243  
**Current:** `text-lg font-semibold text-ink` for Discover/Apply/Track headings.  
**Fix:** Increase to `text-xl font-semibold text-ink` and add `leading-snug`. These headings anchor each value proposition; at `text-lg` they are the same visual weight as body text on adjacent sections.

---

## Color & Visual Weight

### C1 — `ClubCard` and club header card use `bg-white` on `bg-surface-warm` background
**Files:** `src/app/clubs/page.tsx` line 185; `src/app/clubs/[slug]/page.tsx` line 197  
**Issue:** `bg-white` creates a stark `#FFFFFF` on `#FAF6EE` (parchment) contrast that reads as "floating" rather than "belonging." The design system defines `bg-surface-warm` + `border-border-warm` as the card pattern for student surfaces.  
**Fix:** Replace `bg-white` with `bg-surface-warm` (or `bg-white/90` as a middle ground that preserves slight separation). Apply `border-border-warm` consistently. This applies to `ValueCard` in landing, `ClubCard` in directory, and the main club header card on the detail page.

### C2 — Portal layout card border is set via inline style instead of token class
**File:** `src/app/portal/[slug]/layout.tsx`, line 26  
**Current:** `style={{ borderColor: "var(--color-border)" }}` alongside Tailwind classes.  
**Issue:** Token is available as `border-border` in Tailwind; the inline style is unnecessary and breaks the utility-class pattern.  
**Fix:** Replace `style={{ borderColor: "var(--color-border)" }}` with `border-border` as a Tailwind class. Remove the inline style attribute entirely.

### C3 — Landing `ValueCard` uses `bg-white` instead of `bg-surface-warm`
**File:** `src/app/page.tsx`, line 236  
**Fix:** Change `bg-white` to `bg-surface-warm` and `border-border-warm` (already present) — creates cohesion with the section background. This is the same issue as C1 but on the landing page.

### C4 — Dashboard profile completion nudge uses raw Tailwind amber instead of tokens
**File:** `src/app/dashboard/page.tsx`, lines 179–190  
**Current:** `border-amber-200 bg-amber-50`, text `text-amber-900`, `text-amber-800`, `text-amber-950`.  
**Fix:** Replace with token-consistent classes: `border-brand-primary/30 bg-brand-primary/8 text-ink` for the container; `text-ink font-semibold` for the heading; `text-ink-muted` for the body; `text-brand-action hover:text-[#162d4a]` for the CTA link. This brings the nudge card into the token system and makes it consistent with the amber accent language used elsewhere.

### C5 — Portal filter submit button is `bg-brand-action` — primary color collision
**File:** `src/app/portal/[slug]/page.tsx`, line 380  
**Issue:** The "Apply filters" button uses `bg-brand-action` (warm navy), which is the primary CTA color. On the same page, "Bulk update selected" also uses `bg-brand-action`. Having two identical primary buttons at the same visual weight makes it ambiguous which is the more consequential action.  
**Fix:** Downgrade "Apply filters" to a secondary button: `border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink hover:bg-border rounded-control transition-colors`. Reserve `bg-brand-action` for "Bulk update selected" only — it's the more consequential, potentially irreversible action.

### C6 — Landing split CTA section background imbalance
**File:** `src/app/page.tsx`, lines 167, 191  
**Current:** Student panel uses `bg-brand-primary/8` (amber tint). Recruiter panel uses `bg-brand-action/5` (navy tint). The two panels read as two independent marketing blocks with different palette identities.  
**Fix:** Give the student panel `bg-brand-primary/10` and the recruiter panel `bg-brand-action/8` — both raised to the same opacity level, creating a more balanced visual weight between the two sides. Also add `border-brand-primary/20` to the student panel border (currently `border-border-warm`) to make the amber differentiation explicit.

---

## Prioritized Actionable Improvements

### HIGH Priority

---

**H1 — Add global nav to the directory and club detail pages**  
**File:** `src/app/clubs/page.tsx`, `src/app/clubs/[slug]/page.tsx`  
**Change:** Extract the landing page `<header>` into `src/components/SiteHeader.tsx`. Import and render it at the top of the `ClubsPage` and `ClubPage` components. The header already has the right classes (`sticky top-0 z-10 border-b border-border-warm bg-surface-warm/80 backdrop-blur-sm`) — it just needs to be a shared component. Pass an optional `isAuthenticated` prop (derived from Supabase session) to conditionally show "Sign in" vs. "Dashboard" in the nav.  
**Why:** Unauthenticated users on `/clubs` have no path to sign in, no branding, and no navigation. This is the highest-friction conversion gap in the student flow.

---

**H2 — Elevate mobile CTA on Club Detail**  
**File:** `src/app/clubs/[slug]/page.tsx`, line 193  
**Change:** On mobile (below `lg:`), the sidebar renders below the main column. Move the "Your workflow" sidebar card to appear between the club header card and the rest of the main content on mobile using responsive ordering. Wrap the main-column content and sidebar in a structure where:  
- `lg:col-span-2` main content keeps its order on desktop  
- On mobile, insert the sidebar's "Your workflow" card (inline, not the full sidebar) immediately after the header card using a CSS order trick:  
  Add `order-first lg:order-none` to the sidebar `<div>` wrapper.  
**Why:** On mobile the primary CTA (Follow / Add to tracker / Apply) is the most important action. Requiring users to scroll past descriptions, deadlines, and links before they can act violates the mobile-first principle stated in the design brief.

---

**H3 — Collapse filters behind a toggle on mobile in the directory**  
**File:** `src/app/clubs/ClubFilters.tsx`  
**Change:** Wrap the filter groups (Recruiting status, Category, Tags) in a `<details>` element or add a `showFilters` boolean state. On mobile (below `lg:`), render a `<button>` that reads "Filters · {count} active" (where count = number of active filters from `current`). Clicking toggles `showFilters`. The filter groups render inside a `<div className={showFilters ? 'block' : 'hidden lg:block'}>` wrapper. The search input stays always visible.  
**Why:** On mobile, 20+ category buttons and 24 tag buttons above the results push all club cards out of view. The filter UI is currently more prominent than the content it filters.

---

**H4 — Replace `bg-white` with `bg-surface-warm` on student-surface cards**  
**Files:** `src/app/page.tsx` line 236 (ValueCard); `src/app/clubs/page.tsx` line 185 (ClubCard); `src/app/clubs/[slug]/page.tsx` line 197 (club header card), line 296 (apply CTA card), line 339 (deadlines card), line 394 (links card), line 432 (workflow card), line 576 (sidebar deadlines), line 627 (claim card)  
**Change:** Replace `bg-white` → `bg-surface-warm` on all student-surface cards. The `border-border-warm` is already correct on most of these. This aligns with the design system spec: "Student surface: `bg-surface-warm border border-border-warm rounded-card shadow-card`."  
**Why:** The current `bg-white` on `bg-surface-warm` creates an unintended contrast that makes the page feel like a white SaaS product with a beige page background, rather than a warm unified surface. This is the single most pervasive token violation in the codebase.

---

**H5 — Add "See all deadlines" link to the dashboard**  
**File:** `src/app/dashboard/page.tsx`, line 404  
**Change:** In the "Upcoming deadlines" section, add a `<div className="mb-4 flex items-end justify-between gap-4">` wrapper around the heading (matching the pattern used in "Recent applications" on line 302). Add:  
```jsx
<Link href="/dashboard/follows" className="text-xs font-medium text-ink-muted transition-colors hover:text-ink">
  See all →
</Link>
```
**Why:** Deadlines are the highest-urgency information type in the product. Showing only 5 with no escape hatch means a student tracking 8+ clubs can miss deadlines that don't fit in the preview. The "See all" pattern is already used on two adjacent sections — the omission here is inconsistent.

---

**H6 — Show selected-row count in portal bulk action toolbar**  
**File:** `src/app/portal/[slug]/page.tsx`, line 390  
**Change:** Convert the bulk action toolbar from a simple `<form>` to a client component (extract as `BulkActionBar.tsx`). Track checkbox state with `useState<Set<string>>` and display `{selectedIds.size} selected` next to the "Bulk update selected" button when count > 0. Disable the button when no checkboxes are checked (add `disabled={selectedIds.size === 0} aria-disabled={selectedIds.size === 0}`).  
**Why:** A recruiter with 50 applicants can accidentally trigger bulk status changes on unexpected rows. The absence of a selection count and the always-enabled submit button is a high-risk UX failure for a consequential action.

---

### MEDIUM Priority

---

**M1 — Fix the portal layout card border inline style**  
**File:** `src/app/portal/[slug]/layout.tsx`, line 26  
**Change:** Remove `style={{ borderColor: "var(--color-border)" }}`. Add `border-border` as a Tailwind class to the `div` that currently has `className="rounded-[28px] border bg-surface-cool p-5 shadow-card"`.  
**Change result:** `className="rounded-[28px] border border-border bg-surface-cool p-5 shadow-card"`  
**Why:** Token consistency. Inline styles break the utility-class-only convention and are harder to override with responsive modifiers.

---

**M2 — Remove redundant "Recruiting now" badge from ClubCard**  
**File:** `src/app/clubs/page.tsx`, line 206  
**Change:** Delete the `{isRecruiting && (...)}` "Recruiting now" badge block in the name row (lines 206–210). The footer row already shows the full `STATUS_BADGE` ("Open" in teal, "Rolling" in amber) which communicates the same information more precisely.  
**Why:** Two status signals on the same card (one in the header, one in the footer) is redundant noise. The footer badge is already well-styled and specific — "Open" vs "Rolling" is more useful than "Recruiting now" which conflates both states into one label.

---

**M3 — Make auth page heading tab-aware**  
**File:** `src/app/auth/page.tsx`, line 106; `src/app/auth/AuthForm.tsx`  
**Change:** Remove the `<div className="mb-6 space-y-1">` block at line 106–110 from `auth/page.tsx`. Inside `AuthForm.tsx`, add at the top of the returned JSX (before the tab switcher div):  
```jsx
<div className="mb-6 space-y-1">
  <h2 className="font-display text-2xl font-semibold text-ink">
    {tab === "signin" ? "Sign in" : "Create your account"}
  </h2>
  <p className="text-sm text-ink-muted">
    {tab === "signin"
      ? "Welcome back."
      : "Join 1,800+ clubs on campus."}
  </p>
</div>
```
**Why:** The static "Welcome to Rush" heading does not update when the user switches to the Create Account tab. A context-sensitive heading reduces cognitive load and makes the two-panel form feel more interactive.

---

**M4 — Downgrade portal "Apply filters" button to secondary style**  
**File:** `src/app/portal/[slug]/page.tsx`, line 379  
**Change:** Replace button class `"inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#162d4a]"` with `"inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"`.  
**Why:** Two `bg-brand-action` buttons on the same page (Apply filters + Bulk update) create ambiguous CTA hierarchy. Filters is a non-destructive exploratory action; Bulk update is consequential. Visual hierarchy should reflect this difference.

---

**M5 — Fix dashboard profile nudge to use design tokens**  
**File:** `src/app/dashboard/page.tsx`, lines 179–190  
**Change:**  
- Container: `border-amber-200 bg-amber-50` → `border-brand-primary/30 bg-brand-primary/8`  
- Heading: `text-amber-900` → `text-ink`  
- Body: `text-amber-800` → `text-ink-muted`  
- Link: `text-amber-900 hover:text-amber-950` → `text-brand-action hover:text-[#162d4a]`  
**Why:** Token consistency. Using raw `amber-*` Tailwind colors bypasses the design token system and creates drift between this component and every other amber-accented element in the codebase.

---

**M6 — Add category scroll fade on landing page**  
**File:** `src/app/page.tsx`, lines 148–160  
**Change:** Wrap the `overflow-x-auto` div in a relative container and add a right-edge fade:  
```jsx
<div className="relative">
  <div className="overflow-x-auto px-6 sm:px-10 lg:px-12">
    <div className="flex gap-2.5 pb-2" style={{ width: "max-content" }}>
      {/* existing category links */}
    </div>
  </div>
  <div
    aria-hidden="true"
    className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-surface-warm to-transparent"
  />
</div>
```
**Why:** The horizontal scroll strip is the primary secondary navigation moment on the landing page. Without a scroll indicator, most mobile users will not discover the additional categories. The fade is a standard affordance for horizontal scroll overflow.

---

**M7 — Elevate portal stat card label typography**  
**File:** `src/app/portal/[slug]/page.tsx`, line 316  
**Change:** Replace `text-xs font-medium uppercase tracking-[0.14em] text-ink-muted` with `text-sm font-medium text-ink-muted` on the four stats-card labels (Interested, Applied, Interview, Decision).  
**Why:** Removes the over-use of the `text-xs uppercase tracking` anti-pattern. In a data-dense portal context, the stat cards' labels should read as actual labels, not metadata tags. At `text-sm` they are more legible at a glance.

---

**M8 — Link `ValueCard` tiles on the landing page**  
**File:** `src/app/page.tsx`, `ValueCard` component (line 226)  
**Change:** Add an optional `href?: string` prop to `ValueCard`. Wrap the card content in `<Link href={href}>` when `href` is provided. Pass: Discover card → `href="/clubs"`, Apply card → `href="/clubs"`, Track card → `href="/auth"`. Add `hover:-translate-y-0.5 transition-transform hover:shadow-card-hover` to the card container class.  
**Why:** Static informational cards with no action are missed conversion opportunities. The student who reads about "filtering 1,800+ orgs" should be able to click the card to start doing it.

---

**M9 — Add "Today" emphasis to deadline labels**  
**Files:** `src/app/clubs/[slug]/page.tsx` line 377; `src/app/dashboard/page.tsx` line 446  
**Change:** When `days === 0`, render the deadline label as:  
```jsx
<span className="shrink-0 text-sm font-semibold text-status-urgent">Today</span>
```
instead of `text-xs font-medium`. On the sidebar compact list in club detail page (line 607), similarly upgrade the "today" text to `text-sm font-semibold text-status-urgent`.  
**Why:** "Today" is maximum urgency. Rendering it at `text-xs` — the same size as "3d left" — undersells the critical signal. Making it heavier and larger creates a visual escalation that communicates urgency without animation (consistent with the design brief's principle 3).

---

### LOW Priority

---

**L1 — Add hover translation to `ValueCard`**  
**File:** `src/app/page.tsx`, line 236 (`ValueCard` `div`)  
**Change:** Add `transition-transform hover:-translate-y-0.5 cursor-pointer` to the `ValueCard` container class.  
**Why:** The card visually looks interactive but has no hover feedback. Even without a link, the hover translation aligns with the motion principle ("cards meet you") and signals that these are scannable clickable blocks.

---

**L2 — Fix landing page `ClubMosaic` vertical alignment**  
**File:** `src/app/page.tsx`, line 63  
**Change:** On the hero grid, change `lg:items-start` to `lg:items-center`. The mosaic is decorative and short compared to the copy block; centering it visually balances the two-column layout.  
**Why:** `items-start` causes the mosaic (6 tiles, ~340px tall) to pin to the top of the grid, leaving visible whitespace below it when the copy column is taller. `items-center` keeps the mosaic optically balanced against the copy.

---

**L3 — Add footer links to the landing page**  
**File:** `src/app/page.tsx`, line 217  
**Change:** Expand the footer from:  
```jsx
<p className="text-xs text-ink-muted">Rush · University of Michigan</p>
```
to:  
```jsx
<div className="flex items-center justify-between gap-4">
  <p className="text-xs text-ink-muted">Rush · University of Michigan</p>
  <nav className="flex gap-4">
    <Link href="/clubs" className="text-xs text-ink-muted hover:text-ink transition-colors">Browse clubs</Link>
    <Link href="/auth" className="text-xs text-ink-muted hover:text-ink transition-colors">Sign in</Link>
  </nav>
</div>
```
**Why:** The current footer is a dead end. Minimal footer navigation is expected by users who scroll to the bottom of a page looking for a way back in.

---

**L4 — Display user name in mobile dashboard top bar**  
**File:** `src/app/dashboard/layout.tsx`, line 77  
**Change:** In the mobile top bar section, replace the simple `<Link>Rush</Link>` with:  
```jsx
<div className="flex flex-col leading-tight">
  <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">Rush</Link>
  <span className="text-xs text-ink-muted">{displayName}</span>
</div>
```
**Why:** On mobile, the sidebar (which shows the user's name) is hidden. The top bar currently has no identity signal. Adding the name in `text-xs text-ink-muted` below the logo costs no space and gives the user confirmation they are in the right account.

---

**L5 — Improve the portal tab order per brief recommendation**  
**File:** `src/app/portal/[slug]/layout.tsx`, line 4  
**Change:** Reorder `NAV_ITEMS` to: Applicants → Decisions → Forms → Settings → Deadlines → Imports.  
**Why:** Settings is used during initial club setup (a one-time-ish action) but Deadlines and Imports are less frequent than Settings during active recruiting review. Moving Settings before the less-common utility tabs mirrors how power users actually sequence their work: review applicants, make decisions, manage forms, configure settings, then handle one-off imports.

---

**L6 — Add pagination total count to portal**  
**File:** `src/app/portal/[slug]/page.tsx`, line 570  
**Change:** Replace `<span>Page {currentPage} of {totalPages}</span>` with:  
```jsx
<span>Page {currentPage} of {totalPages} &middot; {filteredApplications.length} applicants</span>
```
**Why:** "Page 1 of 4" is less useful than "Page 1 of 4 · 187 applicants" when a recruiter is trying to assess the size of their pipeline at a glance.

---

## Summary: Token Violations Inventory

The following is a complete list of places where `bg-white` appears on student-facing (non-portal) pages that should use `bg-surface-warm`:

| File | Line | Element | Fix |
|---|---|---|---|
| `src/app/page.tsx` | 236 | `ValueCard` container | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/page.tsx` | 185 | `ClubCard` `TrackedLink` | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/page.tsx` | 133 | empty state card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 197 | club header card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 296 | apply CTA card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 339 | deadlines block card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 394 | links card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 432 | sidebar workflow card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 576 | sidebar deadlines card | `bg-white` → `bg-surface-warm` |
| `src/app/clubs/[slug]/page.tsx` | 627 | claim card | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 196 | stat card (Following) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 205 | stat card (Applications) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 213 | stat card (This week) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 258 | nav tile (Discover) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 268 | nav tile (Track) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 278 | nav tile (Stay ahead) | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 319 | application preview card | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 363 | followed clubs container | `bg-white` → `bg-surface-warm` |
| `src/app/dashboard/page.tsx` | 408 | deadlines container | `bg-white` → `bg-surface-warm` |

Portal (`bg-surface-cool`) cards are NOT included — those are correct. `bg-white` inside portal is also acceptable for form containers and input backgrounds.

---

*End of audit.*
