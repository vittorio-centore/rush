import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PortalRole = "admin" | "reviewer";

type PortalClub = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  website_url: string | null;
  instagram_url: string | null;
  contact_email: string | null;
  target_years: string[] | null;
  application_mode: "none" | "external" | "native";
  application_url: string | null;
  recruiting_status: "unknown" | "open" | "closed" | "rolling";
};

type PortalMembership = {
  id: string;
  role: PortalRole;
};

export async function getPortalContext(slug: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "id, slug, name, description, tags, category, website_url, instagram_url, contact_email, target_years, application_mode, application_url, recruiting_status",
    )
    .eq("slug", slug)
    .single();

  if (!club) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("club_admin_memberships")
    .select("id, role")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  return {
    supabase,
    user: authData.user,
    club: club as PortalClub,
    membership: membership as PortalMembership,
  };
}

export async function requirePortalAdmin(slug: string) {
  const context = await getPortalContext(slug);

  if (context.membership.role !== "admin") {
    notFound();
  }

  return context;
}
