import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="border-b border-slate-200 px-4 py-4">
          <Link href="/" className="text-sm font-bold text-slate-900">
            Rush
          </Link>
          <p className="text-xs text-slate-400 mt-0.5">{displayName}</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Sign out at bottom */}
        <div className="border-t border-slate-200 p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors w-full"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 border-b border-slate-200 bg-white z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-bold text-slate-900">
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
        <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-24">
        <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
