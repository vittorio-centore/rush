import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const fullName =
    typeof data.user.user_metadata.full_name === "string" &&
    data.user.user_metadata.full_name.length > 0
      ? data.user.user_metadata.full_name
      : data.user.email;

  return (
    <main className="flex min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16 sm:px-10 lg:px-12">
        <div className="flex flex-col gap-6 rounded-3xl border border-stone-800 bg-stone-900/75 p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-300">
                Rush dashboard
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance">
                Welcome back, {fullName}.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-stone-300">
                Auth is live. This protected page confirms the Supabase session,
                profile trigger, and cookie refresh flow are all working.
              </p>
            </div>

            <form action={signOut}>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-stone-700 px-5 py-2 text-sm font-semibold text-stone-100 transition hover:border-stone-500 hover:bg-stone-800/60">
                Sign out
              </button>
            </form>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                Email
              </dt>
              <dd className="mt-3 text-sm text-stone-100">{data.user.email}</dd>
            </div>
            <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                User ID
              </dt>
              <dd className="mt-3 break-all text-sm text-stone-100">
                {data.user.id}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h2 className="text-lg font-semibold">Next build slice</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Use this session state to attach follows, applications, and saved
              clubs to the authenticated user.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h2 className="text-lg font-semibold">Schema status</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              The database already has `profiles`, `clubs`, `user_follows`, and
              `user_applications` waiting behind RLS.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h2 className="text-lg font-semibold">Immediate target</h2>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Build the club directory next so the first real product data has a
              place to show up.
            </p>
          </article>
        </div>

        <Link
          href="/"
          className="text-sm font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 transition hover:text-stone-200"
        >
          Back to homepage
        </Link>
      </section>
    </main>
  );
}
