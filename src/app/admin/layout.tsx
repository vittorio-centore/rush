import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { getPlatformAdminAccess } from "@/lib/platform-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPlatformAdmin } = await getPlatformAdminAccess();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_45%,#eef2f7_100%)]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-black uppercase tracking-[0.3em] text-slate-950"
            >
              Rush
            </Link>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Platform admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isPlatformAdmin ? (
              <Link
                href="/admin/claims"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Claims inbox
              </Link>
            ) : (
              <Link
                href="/admin/access"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Access
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
