import Link from "next/link";
import { Suspense } from "react";

import ActiveNav from "@/components/ActiveNav";
import { getPortalIdentity } from "@/lib/portal";

function getNavItems(role: "admin" | "reviewer" | "member") {
  if (role === "member") {
    return [
      { href: "", label: "Applicants" },
      { href: "/members", label: "Members" },
    ];
  }

  if (role === "reviewer") {
    return [
      { href: "", label: "Applicants" },
      { href: "/members", label: "Members" },
    ];
  }

  return [
    { href: "", label: "Applicants" },
    { href: "/members", label: "Members" },
    { href: "/decisions", label: "Decisions" },
    { href: "/forms", label: "Forms" },
    { href: "/deadlines", label: "Deadlines" },
    { href: "/imports", label: "Imports" },
    { href: "/settings", label: "Settings" },
  ];
}

export default function ClubPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return (
    <div className="mx-auto max-w-[1520px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="relative isolate overflow-hidden rounded-[30px] border border-slate-800/80 bg-[linear-gradient(135deg,#0f172a_0%,#111827_55%,#131b2e_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_26%)]" />
        <div className="relative mx-auto max-w-[1520px] px-5 sm:px-7 lg:px-8">
          <Suspense fallback={<PortalHeaderFallback />}>
            <PortalHeader params={params} />
          </Suspense>

          <div className="border-t border-white/10 py-3">
            <Suspense fallback={<PortalNavFallback />}>
              <PortalNav params={params} />
            </Suspense>
          </div>
        </div>
      </header>

      <div className="pt-6">
        {children}
      </div>
    </div>
  );
}

async function PortalHeader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { club, membership } = await getPortalIdentity(slug);

  return (
    <div className="flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Recruiter workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-none tracking-[-0.03em] sm:text-[2rem]">
          {club.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
          {club.category ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              {club.category}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 capitalize">
            {club.recruiting_status} recruiting
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200">
          <span className="uppercase tracking-[0.18em] text-slate-400">
            Role
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 capitalize text-white">
            {membership.role}
          </span>
        </div>
        <Link
          href={`/clubs/${slug}`}
          className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-slate-200 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          Public page →
        </Link>
      </div>
    </div>
  );
}

async function PortalNav({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership } = await getPortalIdentity(slug);
  const navItems = getNavItems(membership.role);

  return (
    <ActiveNav
      links={navItems.map((item) => ({
        href: `/portal/${slug}${item.href}`,
        label: item.label,
      }))}
      containerClassName="flex flex-wrap gap-2"
      baseItemClassName="rounded-full px-4 py-2 text-sm font-medium transition-[var(--transition-interact)]"
      activeItemClassName="bg-white text-slate-950 shadow-[0_8px_24px_rgba(255,255,255,0.16)]"
      inactiveItemClassName="text-slate-300 hover:-translate-y-0.5 hover:bg-white/8 hover:text-white"
    />
  );
}

function PortalHeaderFallback() {
  return (
    <div className="flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Recruiter workspace
        </p>
        <div className="mt-2 h-8 w-72 animate-pulse rounded bg-white/10" />
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-28 animate-pulse rounded-full bg-white/8" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-white/8" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/8" />
      </div>
    </div>
  );
}

function PortalNavFallback() {
  return (
    <div className="flex flex-wrap gap-2">
      {["Applicants", "Members", "Decisions", "Forms"].map((item) => (
        <div
          key={item}
          className="h-10 w-24 animate-pulse rounded-full bg-white/8"
        />
      ))}
    </div>
  );
}
