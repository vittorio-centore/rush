import ActiveNav from "@/components/ActiveNav";
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
      <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
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

        <ActiveNav
          links={NAV_ITEMS.map((item) => ({
            href: `/portal/${slug}${item.href}`,
            label: item.label,
          }))}
          containerClassName="mt-5 flex flex-wrap gap-2"
          baseItemClassName="rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
          activeItemClassName="bg-slate-900 text-white shadow-sm"
          inactiveItemClassName="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        />
      </div>

      {children}
    </div>
  );
}
