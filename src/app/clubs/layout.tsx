import SiteHeader from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";

export default async function ClubsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-surface-warm">
      <SiteHeader isAuthenticated={!!data.user} />
      {children}
    </div>
  );
}
