import Link from "next/link";

import { getPortalContext } from "@/lib/portal";

const NAV_ITEMS = [
  { href: "", label: "Applicants" },
  { href: "/settings", label: "Settings" },
  { href: "/deadlines", label: "Deadlines" },
  { href: "/forms", label: "Forms" },
  { href: "/imports", label: "Imports" },
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
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Recruiter portal
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{club.name}</h1>
            {club.category && (
              <p className="mt-1 text-sm text-slate-500">{club.category}</p>
            )}
          </div>
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700">
            {membership.role}
          </span>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const href = `/portal/${slug}${item.href}`;
            return (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
