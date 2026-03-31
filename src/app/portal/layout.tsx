import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="h-16 border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-bold uppercase tracking-[0.2em] text-slate-900">
              Rush
            </Link>
            <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Recruiter portal
            </span>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
        {children}
      </div>
    </div>
  );
}
