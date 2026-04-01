import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/app/auth/AuthForm";
import CheckEmailView from "@/app/auth/CheckEmailView";

type AuthPageProps = {
  searchParams?: Promise<SearchParams>;
};

type SearchParams = {
  error?: string;
  message?: string;
  email?: string;
};

const CHECK_EMAIL_TRIGGER = "check your email";

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  if (data.user) {
    redirect("/dashboard");
  }

  const error = resolvedSearchParams.error;
  const message = resolvedSearchParams.message;
  const email = resolvedSearchParams.email;

  // Show a dedicated "check your email" view after sign-up
  const isCheckEmail = message?.toLowerCase().includes(CHECK_EMAIL_TRIGGER);

  if (isCheckEmail) {
    return <CheckEmailView email={email} />;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#fcfcfb_0%,#f7f5f4_100%)] px-8 py-10 lg:w-[54%] lg:px-16 lg:py-16">
        <BrandPattern />

        <Link
          href="/"
          aria-label="Rush home"
          className="relative z-10 inline-flex items-center gap-3 text-lg font-semibold text-ink transition-[var(--transition-interact)] hover:text-brand-oxblood"
        >
          <span style={{ fontFamily: "var(--font-display)" }} className="text-3xl leading-none">
            Rush
          </span>
        </Link>

        <div className="relative z-10 my-auto max-w-2xl py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-oxblood">
            Sign in to Rush
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-ink lg:text-6xl">
            Find your people and keep recruiting in view.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-ink-muted lg:text-lg">
            Browse campus organizations, track applications, and move between student and club workflows without losing context.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {SOCIAL_PROOF.map((item) => (
              <div
                key={item.stat}
                className="rounded-[1.25rem] border border-border-warm bg-white/75 px-4 py-4 backdrop-blur-sm"
              >
                <p className="font-display text-2xl font-semibold text-ink">{item.stat}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-ink-muted/70">
          © {new Date().getFullYear()} Rush · University of Michigan
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              aria-label="Rush home"
              className="text-3xl leading-none text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Rush
            </Link>
          </div>

          <AuthForm error={error} />

          <p className="mt-6 text-center text-xs text-ink-muted/60">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink-muted">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-ink-muted">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Brand pattern ────────────────────────────────────────────────────────────

const SOCIAL_PROOF = [
  { stat: "1,800+", label: "student orgs" },
  { stat: "U of M", label: "Michigan campus" },
  { stat: "One", label: "shared tracker" },
];

function BrandPattern() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="auth-fade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6E3B3F" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#111827" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect x="8%" y="10%" width="84%" height="1" fill="#6E3B3F" fillOpacity="0.08" />
      <rect x="8%" y="24%" width="54%" height="1" fill="#111827" fillOpacity="0.08" />
      <rect x="30%" y="78%" width="58%" height="1" fill="#6E3B3F" fillOpacity="0.08" />
      <rect x="74%" y="18%" width="1" height="54%" fill="#111827" fillOpacity="0.05" />
      <rect x="18%" y="38%" width="1" height="36%" fill="#6E3B3F" fillOpacity="0.05" />
      <path d="M0 72 C 18 68, 32 80, 49 76 S 82 63, 100 70" stroke="url(#auth-fade)" strokeWidth="1.5" fill="none" />
      <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="#17202B" fillOpacity="0.04" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#dots)" />
    </svg>
  );
}
