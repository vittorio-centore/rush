import Link from "next/link";

import { getPlatformAdminAccess } from "@/lib/platform-admin";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminAccessPage({ searchParams }: Props) {
  const { email, isPlatformAdmin } = await getPlatformAdminAccess();
  const { error } = await searchParams;

  if (isPlatformAdmin) {
    return (
      <section className="rounded-[28px] border border-slate-200/90 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Platform admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
          Your account can already review claims.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Open the claims inbox to approve first-club admins, then let club admins manage their own
          officers from the portal settings page.
        </p>
        <div className="mt-6">
          <Link
            href="/admin/claims"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Open claims inbox
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200/90 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Platform admin access
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
        Allow your account to review club claims.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        This admin surface is intentionally small: once your email is allowlisted, you can approve
        first admins for clubs, and those club admins can handle the rest themselves.
      </p>

      {error ? (
        <div className="mt-6 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-medium text-slate-900">Signed-in account</p>
        <p className="mt-2 text-sm text-slate-600">{email || "No email found on this account."}</p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-medium text-slate-900">One-time setup</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add this email to <code>PLATFORM_ADMIN_EMAILS</code> in <code>.env.local</code>, then
          restart the app server. Example:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-100">
          <code>{`PLATFORM_ADMIN_EMAILS=${email || "you@example.com"}`}</code>
        </pre>
      </div>
    </section>
  );
}
