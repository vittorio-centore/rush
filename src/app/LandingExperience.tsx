"use client";

import Link from "next/link";
import { motion } from "motion/react";
import Balancer from "react-wrap-balancer";

const REVEAL = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

export default function LandingExperience({
  categories,
  isAuthenticated,
}: {
  categories: readonly string[];
  isAuthenticated: boolean;
}) {
  return (
    <>
      <main className="flex flex-1 flex-col bg-white">
        <section className="relative isolate overflow-hidden border-b border-border-warm bg-[linear-gradient(180deg,#fcfcfb_0%,#f7f5f3_100%)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(17,24,39,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />

          <div className="relative mx-auto grid min-h-[calc(100svh-7.5rem)] max-w-6xl items-start gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:px-12 lg:py-14">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="max-w-3xl pt-4"
            >
              <p
                className="text-[clamp(3.25rem,8vw,6.75rem)] leading-[0.9] tracking-[-0.07em] text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Rush
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-brand-oxblood">
                University of Michigan club recruiting
              </p>
              <h1
                className="mt-4 max-w-3xl text-[clamp(2.8rem,6vw,5.4rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Find clubs, track applications, and manage recruiting in one place.
              </h1>
              <div className="mt-5 max-w-lg text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
                <Balancer>
                  Browse club pages, stay on top of deadlines, and keep your recruiting process organized from start to finish.
                </Balancer>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/clubs"
                  className="inline-flex items-center justify-center rounded-control border border-brand-action/20 bg-[linear-gradient(180deg,#172033_0%,#111827_100%)] px-6 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(17,24,39,0.14),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/35 hover:shadow-[0_14px_30px_rgba(17,24,39,0.16),0_0_0_1px_rgba(110,59,63,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  Browse clubs
                </Link>
                <Link
                  href={isAuthenticated ? "/dashboard" : "/auth"}
                  className="inline-flex items-center justify-center rounded-control border border-brand-oxblood/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,248,248,0.96)_100%)] px-6 py-3 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/28 hover:bg-brand-oxblood-soft/45"
                >
                  {isAuthenticated ? "Open dashboard" : "Sign in to track"}
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-border-warm bg-white p-6 shadow-[0_18px_44px_rgba(17,24,39,0.06)] sm:p-7">
                <div className="flex items-start justify-between gap-4 border-b border-border-warm pb-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                      Rush board
                    </p>
                    <p
                      className="mt-3 text-4xl leading-none tracking-[-0.05em] text-ink sm:text-5xl"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      1,800+
                    </p>
                    <p className="mt-2 max-w-[16rem] text-sm leading-6 text-ink-muted">
                      Clubs, deadlines, and next steps in one organized workspace.
                    </p>
                  </div>
                  <div className="rounded-full border border-border-warm bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-oxblood">
                    Neutral overview
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-oxblood">
                    What students can do here
                  </p>
                  <p className="mt-3 text-2xl leading-tight text-ink">
                    Start with a complete directory and build your own shortlist.
                  </p>
                  <div className="mt-5 grid gap-3">
                    {[
                      ["Browse clubs", "Review every listed organization in one directory."],
                      ["Check recruiting status", "See which clubs are open, rolling, or closed."],
                      ["Track applications", "Keep notes, deadlines, and status updates together."],
                    ].map(([title, summary], index) => (
                      <motion.div
                        key={title}
                        initial={{ opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.18 + index * 0.08, ease: "easeOut" }}
                        className="border-b border-border-warm pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-oxblood/12 bg-brand-oxblood-soft text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-oxblood">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-base font-medium text-ink">{title}</p>
                            <p className="mt-1 text-sm text-ink-muted">{summary}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <motion.section {...REVEAL} className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                Choose your entry
              </p>
              <h2 className="mt-4 text-4xl leading-tight tracking-[-0.04em] text-ink">
                Clear paths for students and club teams.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-ink-muted">
                Students should be able to browse quickly. Club officers should be able to publish information and review applicants without extra overhead.
              </p>
            </div>

            <div className="grid gap-8 border-t border-border-warm pt-8 lg:grid-cols-2 lg:border-t-0 lg:pt-0">
              <PathColumn
                eyebrow="For students"
                title="Find the right club without losing track of the process."
                body="Browse the directory, compare opportunities, and keep your application plan organized."
                href="/clubs"
                cta="Browse the directory"
                points={["Browse categories", "Check recruiting status", "Track your applications"]}
                  accent="light"
              />
              <PathColumn
                eyebrow="For club officers"
                title="Run recruiting in one shared workspace."
                body="Claim your page, publish updates, and review applicants from one admin surface."
                href="/auth?tab=recruiter"
                cta="Open club setup"
                points={["Claim your club page", "Publish deadlines", "Review applicants"]}
                accent="dark"
              />
            </div>
          </div>
        </motion.section>

        <motion.section {...REVEAL} className="border-t border-border-warm bg-surface-cool">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-12">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                  Browse faster
                </p>
                <h2 className="mt-3 text-4xl leading-tight tracking-[-0.04em] text-ink">
                  Start with the categories students use most.
                </h2>
              </div>
              <Link href="/clubs" className="text-sm font-medium text-brand-oxblood transition-colors hover:text-ink">
                Open full directory →
              </Link>
            </div>

            <div className="mt-8 border-t border-border-warm pt-6">
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((category, index) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.3, delay: index * 0.025 }}
                    className="min-w-[18rem] flex-[0_0_18rem] snap-start sm:min-w-[21rem] sm:flex-[0_0_21rem] lg:min-w-[23rem] lg:flex-[0_0_23rem]"
                  >
                    <Link
                      href={`/clubs?category=${encodeURIComponent(category)}`}
                      className="group flex h-full w-full flex-col justify-between rounded-[1.5rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#faf8f7_100%)] px-5 py-5 text-left transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/22 hover:bg-brand-oxblood-soft/35 hover:shadow-card"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex rounded-full border border-border-warm bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                            {getCategoryAbbrev(category)}
                          </span>
                          <span className="h-px flex-1 bg-border-warm" />
                        </div>
                        <h3 className="mt-5 text-[1.9rem] leading-[0.95] tracking-[-0.04em] text-ink">
                          {category}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-ink-muted">
                          Browse clubs grouped by this area of campus life.
                        </p>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-border-warm pt-4">
                        <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                          Category shelf
                        </span>
                        <span className="text-sm font-medium text-brand-oxblood transition-colors group-hover:translate-x-0.5 group-hover:text-ink">
                          Explore →
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...REVEAL} className="border-t border-border-warm bg-white">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-12">
            <div className="flex flex-col gap-6 rounded-[2rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f6_100%)] px-6 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                  Ready to start
                </p>
                <h2 className="mt-3 text-4xl leading-tight tracking-[-0.04em] text-ink">
                  Keep recruiting clear from day one.
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Start with the directory, then sign in when you want tracking or club-side tools.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/clubs"
                  className="inline-flex items-center justify-center rounded-control bg-brand-action px-6 py-3 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
                >
                  Browse clubs
                </Link>
                <Link
                  href={isAuthenticated ? "/dashboard" : "/auth"}
                  className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-6 py-3 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/18 hover:text-brand-oxblood"
                >
                  {isAuthenticated ? "Go to dashboard" : "Create account"}
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="border-t border-border-warm bg-white px-6 py-5 sm:px-10 lg:px-12">
        <p className="text-xs text-ink-muted">Rush · University of Michigan</p>
      </footer>
    </>
  );
}

function getCategoryAbbrev(category: string) {
  const compact: Record<string, string> = {
    Business: "BU",
    Engineering: "EN",
    "Pre-Law": "PL",
    "Pre-Med": "PM",
    "Arts & Culture": "AC",
    "Community Service": "CS",
    Athletics: "AT",
    "Greek Life": "GL",
    Research: "RE",
    Politics: "PO",
    Media: "ME",
    Entrepreneurship: "ET",
    STEM: "ST",
    "Social Justice": "SJ",
  };

  return compact[category] ?? category.slice(0, 2).toUpperCase();
}

function PathColumn({
  eyebrow,
  title,
  body,
  href,
  cta,
  points,
  accent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  points: string[];
  accent: "light" | "dark";
}) {
  const dark = accent === "dark";

  return (
    <div
      className={`rounded-[1.75rem] px-6 py-6 sm:px-7 ${
        dark
          ? "bg-[linear-gradient(180deg,#1f2623_0%,#161b18_100%)] text-white"
          : "border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#fbf9f9_100%)] text-ink"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
          dark ? "text-white/55" : "text-brand-oxblood"
        }`}
      >
        {eyebrow}
      </p>
      <h3
        className={`mt-3 text-3xl leading-tight tracking-[-0.04em] ${dark ? "text-white" : "text-ink"}`}
        style={dark ? { color: "#ffffff" } : undefined}
      >
        {title}
      </h3>
      <p className={`mt-3 text-sm leading-7 ${dark ? "text-white/70" : "text-ink-muted"}`}>{body}</p>
      <div className={`mt-5 h-px ${dark ? "bg-white/12" : "bg-brand-oxblood/10"}`} />
      <div className="mt-5 space-y-3">
        {points.map((point, index) => (
          <div key={point} className="flex items-center gap-3">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                dark
                  ? "bg-white/10 text-white"
                  : "bg-brand-oxblood-soft text-brand-oxblood"
              }`}
            >
              {index + 1}
            </span>
            <p className={`text-sm ${dark ? "text-white/86" : "text-ink"}`}>{point}</p>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className={`mt-6 inline-flex items-center justify-center rounded-control px-5 py-2.5 text-sm font-medium transition-[var(--transition-interact)] hover:-translate-y-0.5 ${
          dark
            ? "border border-white/18 bg-white/[0.06] text-white hover:bg-white/[0.1]"
            : "border border-border-warm bg-white text-ink hover:border-brand-oxblood/20 hover:text-brand-oxblood"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
