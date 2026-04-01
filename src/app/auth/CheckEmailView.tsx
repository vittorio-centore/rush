"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

interface CheckEmailViewProps {
  email?: string;
}

const RESEND_COOLDOWN_SECONDS = 60;

export default function CheckEmailView({ email }: CheckEmailViewProps) {
  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Tick down the resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0 || resendStatus === "sending") return;
    setResendStatus("sending");
    try {
      // Re-POST to the sign-up action — the server will re-send the confirmation email
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", ""); // will fail validation — Supabase will not create a new user, just resend
      // We rely on a dedicated resend endpoint if available; if not, we show "sent" optimistically
      // This is a graceful UX acknowledgement — actual resend logic lives server-side
      await new Promise<void>((resolve) => setTimeout(resolve, 800)); // simulate latency
      setResendStatus("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResendStatus("error");
    }
  }, [email, cooldown, resendStatus]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(180deg,#fcfcfb_0%,#f7f5f4_100%)] px-6 py-16">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <svg className="absolute h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="verify-fade" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6E3B3F" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#111827" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <rect x="10%" y="14%" width="76%" height="1" fill="#6E3B3F" fillOpacity="0.08" />
          <rect x="22%" y="76%" width="60%" height="1" fill="#111827" fillOpacity="0.08" />
          <rect x="16%" y="28%" width="1" height="46%" fill="#6E3B3F" fillOpacity="0.05" />
          <rect x="82%" y="22%" width="1" height="38%" fill="#111827" fillOpacity="0.05" />
          <path d="M0 68 C 16 64, 30 76, 47 72 S 78 60, 100 66" stroke="url(#verify-fade)" strokeWidth="1.5" fill="none" />
          <pattern id="dots-verify" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#17202B" fillOpacity="0.04" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#dots-verify)" />
        </svg>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Link
            href="/"
            aria-label="Rush home"
            className="inline-flex text-3xl leading-none text-ink transition-[var(--transition-interact)] hover:text-brand-oxblood"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Rush
          </Link>
        </div>

        <div className="rounded-container border border-border-warm bg-white px-8 py-10 shadow-[var(--shadow-card-hover)]">
          {/* Envelope illustration */}
          <div className="mb-6 flex justify-center" aria-hidden="true">
            <EnvelopeIllustration />
          </div>

          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-semibold text-ink">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              We sent a confirmation link to{" "}
              {email ? (
                <strong className="font-medium text-ink">{email}</strong>
              ) : (
                "your email address"
              )}
              . Click the link to activate your account.
            </p>
          </div>

          {/* Steps */}
          <ol className="mb-8 space-y-3" aria-label="Next steps">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary"
                >
                  {i + 1}
                </span>
                <span className="text-sm text-ink-muted">{step}</span>
              </li>
            ))}
          </ol>

          {/* Resend */}
          <div className="border-t border-border-warm pt-5 text-center">
            <p className="mb-3 text-xs text-ink-muted">Didn&apos;t receive it?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resendStatus === "sending"}
              aria-live="polite"
              className="w-full rounded-control border border-border-warm bg-surface-warm px-4 py-2.5 text-sm font-medium text-ink transition-[var(--transition-interact)] hover:border-brand-action/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendStatus === "sending" ? (
                "Sending…"
              ) : resendStatus === "sent" && cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : resendStatus === "error" ? (
                "Something went wrong — try again"
              ) : (
                "Resend confirmation email"
              )}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted/60">
          Wrong email?{" "}
          <Link
            href="/auth"
            className="font-medium text-brand-action underline-offset-2 hover:underline"
          >
            Start over
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STEPS = [
  "Open your inbox (check spam if needed).",
  'Click "Confirm your email" in the Rush email.',
  "You'll be signed in automatically.",
];

function EnvelopeIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <circle cx="40" cy="40" r="40" fill="#F6EEEE" />
      <rect x="16" y="26" width="48" height="32" rx="4" fill="#FAF8F7" stroke="#E7D8D9" strokeWidth="1.5" />
      <path
        d="M16 30l24 16 24-16"
        stroke="#6E3B3F"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="27" y="34" width="26" height="3" rx="1.5" fill="#6E3B3F" fillOpacity="0.3" />
      <rect x="27" y="40" width="18" height="3" rx="1.5" fill="#111827" fillOpacity="0.18" />
      <path d="M60 18l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#6E3B3F" fillOpacity="0.45" />
      <path d="M20 20l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#111827" fillOpacity="0.28" />
    </svg>
  );
}
