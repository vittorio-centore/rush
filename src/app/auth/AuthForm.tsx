"use client";

import { useState, useTransition } from "react";
import { signIn, signInWithGoogle, signUp } from "@/app/auth/actions";

type Tab = "signin" | "signup";
type Role = "student" | "recruiter";

interface AuthFormProps {
  error?: string;
}

const GRAD_YEARS = ["2025", "2026", "2027", "2028", "2029"];

function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "That email and password combination didn't match. Please try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in — check your inbox.";
  }
  if (lower.includes("user already registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (lower.includes("password should be")) {
    return "Your password must be at least 8 characters long.";
  }
  if (lower.includes("email and password are required")) {
    return "Please enter your email and password.";
  }
  return raw;
}

export default function AuthForm({ error: initialError }: AuthFormProps) {
  const [tab, setTab] = useState<Tab>("signin");
  const [role, setRole] = useState<Role>("student");
  const [isPending, startTransition] = useTransition();

  const handleSignIn = (formData: FormData) => {
    startTransition(async () => {
      await signIn(formData);
    });
  };

  const handleSignUp = (formData: FormData) => {
    startTransition(async () => {
      await signUp(formData);
    });
  };

  const inputClass =
    "w-full rounded-control border border-border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition-[var(--transition-interact)] focus:border-brand-action focus:ring-2 focus:ring-brand-action/20";

  const labelClass = "block text-sm font-medium text-ink mb-1";

  return (
    <div className="rounded-[2rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#faf8f7_100%)] p-8 shadow-[0_20px_50px_rgba(17,24,39,0.06)]">
      {/* Tab-aware heading */}
      <div className="mb-6 space-y-1">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {tab === "signin" ? "Sign in" : "Create your account"}
        </h2>
        <p className="text-sm text-ink-muted">
          {tab === "signin" ? "Welcome back to Rush." : "Join campus recruiting in one place."}
        </p>
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-control border border-border-warm bg-white px-4 py-3 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-brand-oxblood"
        >
          <GoogleMark />
          Continue with Google
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-warm" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
          or with email
        </span>
        <div className="h-px flex-1 bg-border-warm" />
      </div>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Sign in or create account"
        className="mb-6 flex rounded-control border border-border-warm bg-[#f6f4f3] p-1"
      >
        <button
          role="tab"
          aria-selected={tab === "signin"}
          aria-controls="panel-signin"
          id="tab-signin"
          type="button"
          onClick={() => setTab("signin")}
          className={`flex-1 rounded-[6px] py-2 text-sm font-medium transition-[var(--transition-interact)] ${
            tab === "signin"
              ? "bg-white text-ink shadow-[var(--shadow-card)]"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={tab === "signup"}
          aria-controls="panel-signup"
          id="tab-signup"
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 rounded-[6px] py-2 text-sm font-medium transition-[var(--transition-interact)] ${
            tab === "signup"
              ? "bg-white text-ink shadow-[var(--shadow-card)]"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Create account
        </button>
      </div>

      {/* Error banner */}
      {initialError ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-control border border-brand-primary/40 bg-amber-50 px-4 py-3 text-sm text-[#92400E]"
        >
          <svg
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          {friendlyError(initialError)}
        </div>
      ) : null}

      {/* Sign in panel */}
      <div
        role="tabpanel"
        id="panel-signin"
        aria-labelledby="tab-signin"
        hidden={tab !== "signin"}
      >
        <form className="space-y-4">
          <div>
            <label htmlFor="signin-email" className={labelClass}>
              Email
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@umich.edu"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="signin-password" className={labelClass}>
              Password
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              placeholder="Your password"
              className={inputClass}
            />
          </div>

          <button
            formAction={handleSignIn}
            disabled={isPending}
            aria-busy={isPending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-control bg-brand-action px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Spinner />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-muted">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => setTab("signup")}
            className="font-medium text-brand-action underline-offset-2 hover:underline"
          >
            Create one
          </button>
        </p>
      </div>

      {/* Sign up panel */}
      <div
        role="tabpanel"
        id="panel-signup"
        aria-labelledby="tab-signup"
        hidden={tab !== "signup"}
      >
        {/* Role selector */}
        <fieldset className="mb-5">
          <legend className="mb-2.5 text-sm font-medium text-ink">I am a…</legend>
          <div className="grid grid-cols-2 gap-3">
            <RoleCard
              id="role-student"
              value="student"
              selected={role === "student"}
              onSelect={() => setRole("student")}
              icon={
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 14l9-5-9-5-9 5 9 5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                  />
                </svg>
              }
              label="Student"
              description="Discover clubs & track applications"
            />
            <RoleCard
              id="role-recruiter"
              value="recruiter"
              selected={role === "recruiter"}
              onSelect={() => setRole("recruiter")}
              icon={
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              }
              label="Club recruiter"
              description="Manage applicants & run your portal"
            />
          </div>
        </fieldset>

        <form className="space-y-4">
          {/* Hidden role field */}
          <input type="hidden" name="role" value={role} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="signup-fullname" className={labelClass}>
                Full name
              </label>
              <input
                id="signup-fullname"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                placeholder="Alex Morgan"
                className={inputClass}
              />
            </div>

            {role === "student" ? (
              <div>
                <label htmlFor="signup-gradyear" className={labelClass}>
                  Grad year
                </label>
                <select
                  id="signup-gradyear"
                  name="grad_year"
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Select…</option>
                  {GRAD_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label htmlFor="signup-clubname" className={labelClass}>
                  Club name
                </label>
                <input
                  id="signup-clubname"
                  name="club_name"
                  type="text"
                  autoComplete="organization"
                  placeholder="e.g. Michigan Data Science Team"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="signup-email" className={labelClass}>
              Email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@umich.edu"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="signup-password" className={labelClass}>
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>

          <button
            formAction={handleSignUp}
            disabled={isPending}
            aria-busy={isPending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-control bg-brand-action px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Spinner />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-muted">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setTab("signin")}
            className="font-medium text-brand-action underline-offset-2 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.805 10.023H12v3.955h5.613c-.242 1.27-.967 2.346-2.062 3.07v2.55h3.338c1.953-1.798 3.08-4.445 2.916-7.575Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.64 0 4.854-.87 6.47-2.352l-3.338-2.55c-.927.622-2.116.989-3.132.989-2.407 0-4.447-1.625-5.176-3.808H3.38v2.63A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.824 14.279A5.996 5.996 0 0 1 6.531 12c0-.792.137-1.561.293-2.279V7.091H3.38A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.38 4.909l3.444-2.63Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.913c1.435 0 2.723.494 3.736 1.463l2.804-2.804C16.85 2.99 14.636 2 12 2a9.996 9.996 0 0 0-8.62 5.091l3.444 2.63C7.553 7.538 9.593 5.913 12 5.913Z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface RoleCardProps {
  id: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function RoleCard({ id, selected, onSelect, icon, label, description }: RoleCardProps) {
  return (
    <button
      type="button"
      id={id}
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-card border p-3.5 text-left transition-[var(--transition-interact)] focus-visible:outline-2 focus-visible:outline-brand-action ${
        selected
          ? "border-brand-action bg-brand-action/5 ring-2 ring-brand-action/20"
          : "border-border-warm bg-surface-warm hover:border-brand-action/40 hover:bg-white"
      }`}
    >
      <span
        className={`${selected ? "text-brand-action" : "text-ink-muted"}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs leading-snug text-ink-muted">{description}</span>
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
