import Link from "next/link";

import ActiveNav from "@/components/ActiveNav";
import { getPortalContext } from "@/lib/portal";

const NAV_ITEMS = [
  { href: "", label: "Applicants" },
  { href: "/decisions", label: "Decisions" },
  { href: "/forms", label: "Forms" },
  { href: "/deadlines", label: "Deadlines" },
  { href: "/imports", label: "Imports" },
  { href: "/settings", label: "Settings" },
];

export default async function ClubPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { club, membership } = await getPortalContext(slug);

  return (
    <div className="portal-surface min-h-screen bg-[linear-gradient(180deg,#fcfbfa_0%,#f3f0ef_100%)]">
      <div className="mx-auto max-w-[1520px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-border-warm bg-[linear-gradient(180deg,#ffffff_0%,#f7f4f3_100%)] p-5 shadow-card sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-oxblood">
                Recruiter workspace
              </p>
              <h1 className="mt-4 text-4xl leading-none tracking-[-0.04em] text-ink">
                {club.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
                Review applicants, tune decisions, and keep the club-side recruiting flow legible for your team.
              </p>
            </div>

            <div className="grid gap-4 border-t border-border-warm pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <PortalMeta
                label="Role"
                value={membership.role}
                note="Portal permissions for this account"
              />
              <div className="border-b border-border-warm pb-4 last:border-b-0 last:pb-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                  Public page
                </p>
                <Link
                  href={`/clubs/${slug}`}
                  className="mt-2 inline-flex items-center text-sm font-medium text-ink transition-colors hover:text-brand-oxblood"
                >
                  Open club listing
                </Link>
                <p className="mt-2 text-sm text-ink-muted">
                  {club.category ?? "Campus organization"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border-warm pt-4">
            <ActiveNav
              links={NAV_ITEMS.map((item) => ({
                href: `/portal/${slug}${item.href}`,
                label: item.label,
              }))}
              containerClassName="flex flex-wrap gap-2"
              baseItemClassName="rounded-full px-3.5 py-2 text-sm font-medium transition-[var(--transition-interact)]"
              activeItemClassName="border border-brand-oxblood/12 bg-brand-oxblood-soft text-brand-oxblood shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              inactiveItemClassName="border border-border-warm bg-white text-ink-muted hover:-translate-y-0.5 hover:border-brand-oxblood/20 hover:text-ink"
            />
          </div>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function PortalMeta({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border-b border-border-warm pb-4 last:border-b-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {label}
      </p>
      <p className="mt-2 text-3xl capitalize leading-none tracking-[-0.05em] text-ink">
        {value}
      </p>
      <p className="mt-2 text-sm text-ink-muted">{note}</p>
    </div>
  );
}
