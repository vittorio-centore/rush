import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import ActiveNav from "@/components/ActiveNav";
import { createClient } from "@/lib/supabase/server";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/applications", label: "Applications" },
  { href: "/dashboard/follows", label: "Followed Clubs" },
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
    .select("full_name")
    .eq("id", data.user.id)
    .limit(1)
    .single();

  const displayName = profile?.full_name ?? data.user.email ?? "Student";

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/70 bg-white/80 backdrop-blur lg:flex">
        {/* Logo */}
        <div className="border-b border-slate-200/80 px-5 py-5">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.22em] text-slate-900">
            Rush
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Student workspace
          </p>
          <p className="mt-1 text-sm text-slate-600">{displayName}</p>
        </div>

        {/* Nav links */}
        <ActiveNav
          links={NAV_LINKS}
          containerClassName="flex-1 space-y-1 p-3 pt-4"
          baseItemClassName="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          activeItemClassName="bg-slate-900 text-white shadow-sm"
          inactiveItemClassName="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        />

        {/* Sign out at bottom */}
        <div className="border-t border-slate-200/80 p-4">
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-10 border-b border-white/70 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.2em] text-slate-900">
            Rush
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
        <ActiveNav
          links={NAV_LINKS}
          containerClassName="flex items-center gap-1 overflow-x-auto px-3 pb-3"
          baseItemClassName="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeItemClassName="bg-slate-900 text-white"
          inactiveItemClassName="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-24">
        <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
