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
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      {/* Left panel */}
      <div className="flex flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16 lg:py-20">
        <div className="mx-auto w-full max-w-sm space-y-6 lg:mx-0">
          <Link href="/" className="text-sm font-semibold text-slate-900 hover:text-slate-700 transition-colors">
            Rush
          </Link>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-slate-900">Sign in to Rush</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Track your club applications and never miss a deadline.
            </p>
          </div>
          <div className="border-t border-slate-200" />
          <p className="text-sm text-slate-400">
            Trusted by students at University of Michigan.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16 lg:py-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Account access</h2>
              <p className="text-sm text-slate-500">Sign in or create a new account below.</p>
            </div>

            {message ? (
              <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <form className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Alex Morgan"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@umich.edu"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  formAction={signIn}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Sign in
                </button>
                <button
                  formAction={signUp}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
