import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import ActiveNav from "@/components/ActiveNav";
import { createClient } from "@/lib/supabase/server";

const NAV_LINKS = [
  { href: "/dashboard/applications", label: "Tracker" },
  { href: "/dashboard/follows", label: "Saved clubs" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, major, year, headline, headshot_url")
    .eq("id", data.user.id)
    .limit(1)
    .single();

  const displayName = profile?.full_name ?? data.user.email ?? "Student";
  const identityLine = [profile?.headline, profile?.major, profile?.year].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="hidden w-[290px] shrink-0 border-r border-border-warm bg-[#f7f5f2] lg:flex lg:flex-col">
          <div className="border-b border-border-warm px-7 py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
              Student workspace
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex text-4xl leading-none tracking-[-0.05em] text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Rush
            </Link>
            <div className="mt-5">
              {profile?.headshot_url ? (
                <div className="mb-4 h-16 w-16 overflow-hidden rounded-full border border-border-warm bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.headshot_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="text-sm font-medium text-ink">{displayName}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-muted">
                {identityLine || "Campus recruiting dashboard"}
              </p>
            </div>
          </div>

          <div className="flex-1 px-4 py-5">
            <ActiveNav
              links={NAV_LINKS}
              containerClassName="space-y-1.5"
              baseItemClassName="flex items-center justify-between rounded-[1rem] px-4 py-3 text-sm font-medium transition-[var(--transition-interact)]"
              activeItemClassName="border border-brand-oxblood/12 bg-brand-oxblood-soft text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              inactiveItemClassName="text-ink-muted hover:bg-white/70 hover:text-ink"
            />

            <div className="mt-8 rounded-[1.5rem] border border-brand-oxblood/10 bg-white px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                Workspace flow
              </p>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                Follow clubs, watch deadlines, and move applications forward without jumping between tools.
              </p>
            </div>
          </div>

          <div className="border-t border-border-warm p-4">
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2.5 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-brand-oxblood"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border-warm bg-[#f7f5f2]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
              <div className="min-w-0">
                <Link
                  href="/"
                  className="text-2xl leading-none tracking-[-0.04em] text-ink lg:hidden"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Rush
                </Link>
                <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood lg:block">
                  Student dashboard
                </p>
                <p className="mt-1 truncate text-sm text-ink-muted">{displayName}</p>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                <Link
                  href="/clubs"
                  className="inline-flex items-center justify-center rounded-control border border-border-warm bg-white px-4 py-2 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-brand-oxblood"
                >
                  Browse clubs
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>

            <div className="border-t border-border-warm/80 px-3 pb-3 pt-2 lg:hidden">
              <ActiveNav
                links={NAV_LINKS}
                containerClassName="flex items-center gap-2 overflow-x-auto"
                baseItemClassName="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-[var(--transition-interact)]"
                activeItemClassName="bg-brand-oxblood-soft text-brand-oxblood"
                inactiveItemClassName="text-ink-muted hover:bg-white hover:text-ink"
              />
            </div>
          </header>

          <main className="flex-1 bg-[#f7f5f2]">
            <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
