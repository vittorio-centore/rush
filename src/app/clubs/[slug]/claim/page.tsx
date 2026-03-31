import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { submitClaim } from "./actions";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
};

export default async function ClaimPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { message, error } = resolvedSearchParams;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth?message=Sign+in+to+claim+a+club.");
  }

  const userId = authData.user.id;

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!club) {
    notFound();
  }

  const { data: existingClaim } = await supabase
    .from("club_claims")
    .select("id, status")
    .eq("club_id", club.id)
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="bg-slate-50 min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-lg">
        <Link
          href={`/clubs/${slug}`}
          className="mb-6 inline-flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to {club.name}
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Claim{" "}
            <span className="text-blue-600">{club.name}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tell us about your role so we can verify your connection to this club.
          </p>

          {message && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {existingClaim?.status === "pending" ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Your claim is pending review. We&apos;ll notify you once it&apos;s processed.
            </div>
          ) : existingClaim?.status === "approved" ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              You already manage this club.
            </div>
          ) : existingClaim?.status === "rejected" ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your previous claim was rejected. You can submit a new claim with more detail below.
            </div>
          ) : (
            <form className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Describe your role in this club
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  minLength={20}
                  rows={5}
                  placeholder="e.g. I am the current president of this club and have been a member for two years…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">Minimum 20 characters.</p>
              </div>
              <button
                formAction={submitClaim.bind(null, slug)}
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Submit claim
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
