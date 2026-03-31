import Link from "next/link";

export default function ClubsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white h-14">
        <div className="mx-auto flex max-w-6xl h-full items-center justify-between px-6 sm:px-10 lg:px-12">
          <Link
            href="/"
            className="font-bold text-slate-900 text-sm"
          >
            Rush
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/clubs"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Clubs
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
