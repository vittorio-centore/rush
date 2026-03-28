import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn, signUp } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type AuthPageProps = {
  searchParams?: Promise<SearchParams>;
};

type SearchParams = {
  error?: string;
  message?: string;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  if (data.user) {
    redirect("/dashboard");
  }

  const error = resolvedSearchParams.error;
  const message = resolvedSearchParams.message;

  return (
    <main className="flex min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 sm:px-10 lg:flex-row lg:items-start lg:justify-between lg:px-12">
        <div className="max-w-2xl space-y-6">
          <Link
            href="/"
            className="text-sm font-medium uppercase tracking-[0.24em] text-amber-300"
          >
            Rush
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Sign in to track applications and follow club recruiting deadlines.
          </h1>
          <p className="max-w-xl text-base leading-8 text-stone-300 sm:text-lg">
            Start with email and password auth. Once that works cleanly, the
            student dashboard, follows, and club workflows can build on top of
            the same session model.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-200">
                Student flow
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-400">
                Save clubs, monitor deadlines, and keep your recruiting process
                organized in one account.
              </p>
            </article>
            <article className="rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-200">
                Club flow
              </h2>
              <p className="mt-3 text-sm leading-7 text-stone-400">
                Claim your org page later and manage applicants with the same
                underlying auth and permissions system.
              </p>
            </article>
          </div>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-900/80 p-7 shadow-2xl shadow-black/30">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Account access</h2>
            <p className="text-sm leading-7 text-stone-400">
              Use the same form to sign in or create an account.
            </p>
          </div>

          {message ? (
            <p className="mt-6 rounded-2xl border border-emerald-700/40 bg-emerald-950/50 px-4 py-3 text-sm leading-6 text-emerald-200">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="mt-6 rounded-2xl border border-rose-700/40 bg-rose-950/50 px-4 py-3 text-sm leading-6 text-rose-200">
              {error}
            </p>
          ) : null}

          <form className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="full_name" className="text-sm font-medium text-stone-200">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Alex Morgan"
                className="w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-400"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-stone-200">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@umich.edu"
                className="w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-400"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-stone-200">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full rounded-2xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                formAction={signIn}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200"
              >
                Sign in
              </button>
              <button
                formAction={signUp}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-stone-700 bg-transparent px-5 py-3 text-sm font-semibold text-stone-100 transition hover:border-stone-500 hover:bg-stone-800/60"
              >
                Create account
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
