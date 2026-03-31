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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white h-14">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 h-full sm:px-10">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-bold text-slate-900">
              Rush
            </Link>
            <span className="text-xs text-slate-400 ml-2">Portal</span>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
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
