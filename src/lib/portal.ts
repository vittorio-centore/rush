import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import {
  isMissingSchemaColumn,
  normalizeTargetYears,
} from "@/lib/supabase/compat";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

type PortalRole = "admin" | "reviewer" | "member";

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

export const getPortalIdentity = cache(async (slug: string) => {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth");
  }

  const primaryClub = await serviceSupabase
    .from("clubs")
    .select(
      "id, slug, name, description, tags, category, website_url, instagram_url, contact_email, target_years, application_mode, application_url, recruiting_status",
    )
    .eq("slug", slug);

  let club: PortalClub | null = null;

  if (!primaryClub.error) {
    const row = primaryClub.data?.[0];
    if (row) {
      club = {
        ...(row as Omit<PortalClub, "target_years">),
        target_years: normalizeTargetYears((row as { target_years?: unknown }).target_years),
      };
    }
  } else if (isMissingSchemaColumn(primaryClub.error, "target_years")) {
    const fallbackClub = await serviceSupabase
      .from("clubs")
      .select(
        "id, slug, name, description, tags, category, website_url, instagram_url, contact_email, application_mode, application_url, recruiting_status",
      )
      .eq("slug", slug)
      .single();

    if (!fallbackClub.error && fallbackClub.data) {
      club = {
        ...(fallbackClub.data as Omit<PortalClub, "target_years">),
        target_years: null,
      };
    }
  } else {
    console.error("Failed to load portal club context:", primaryClub.error.message);
  }

  if (!club) {
    notFound();
  }

  const { data: membership } = await serviceSupabase
    .from("club_admin_memberships")
    .select("id, role")
    .eq("club_id", club.id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!membership) {
    redirect(
      `/clubs/${slug}/claim?error=${encodeURIComponent("You do not have portal access for this club yet.")}`,
    );
  }

  return {
    user: authData.user,
    club: club as PortalClub,
    membership: membership as PortalMembership,
  };
});

export async function getPortalContext(slug: string) {
  const identity = await getPortalIdentity(slug);
  const supabase = createServiceClient();

  return {
    supabase,
    ...identity,
  };
}

export async function requirePortalAdmin(slug: string) {
  const context = await getPortalContext(slug);

  if (context.membership.role !== "admin") {
    redirect(
      `/portal/${slug}?error=${encodeURIComponent("Admin access is required for that page.")}`,
    );
  }

  return context;
}
