"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPortalCapabilities } from "@/lib/portal-features";
import { requirePortalAdmin } from "@/lib/portal";

const VALID_RECRUITING_STATUSES = ["unknown", "open", "rolling", "closed"] as const;
const VALID_APPLICATION_MODES = ["none", "external", "native"] as const;
const VALID_PORTAL_ROLES = ["admin", "reviewer", "member"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getMembershipSnapshot(slug: string) {
  const { supabase, club, user } = await requirePortalAdmin(slug);

  const { data: memberships, error } = await supabase
    .from("club_admin_memberships")
    .select("user_id, role")
    .eq("club_id", club.id);

  if (error) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(error.message)}`);
  }

  const adminCount = (memberships ?? []).filter((membership) => membership.role === "admin").length;

  return {
    supabase,
    club,
    user,
    memberships: memberships ?? [],
    adminCount,
  };
}

export async function updateClubSettings(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);
  const capabilities = await getPortalCapabilities(slug);

  const name = getString(formData, "name");
  const description = getString(formData, "description");
  const category = getString(formData, "category");
  const tags = getString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const targetYears = formData
    .getAll("target_years")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const websiteUrl = getString(formData, "website_url");
  const instagramUrl = getString(formData, "instagram_url");
  const contactEmail = getString(formData, "contact_email");
  const recruitingStatus = getString(formData, "recruiting_status");
  const applicationMode = getString(formData, "application_mode");
  const applicationUrl = getString(formData, "application_url");

  if (!name) {
    redirect(`/portal/${slug}/settings?error=Club+name+is+required.`);
  }

  if (
    !VALID_RECRUITING_STATUSES.includes(
      recruitingStatus as (typeof VALID_RECRUITING_STATUSES)[number],
    )
  ) {
    redirect(`/portal/${slug}/settings?error=Choose+a+valid+recruiting+status.`);
  }

  if (
    !VALID_APPLICATION_MODES.includes(
      applicationMode as (typeof VALID_APPLICATION_MODES)[number],
    )
  ) {
    redirect(`/portal/${slug}/settings?error=Choose+a+valid+application+mode.`);
  }

  if (applicationMode === "external" && !applicationUrl) {
    redirect(`/portal/${slug}/settings?error=External+applications+require+an+application+URL.`);
  }

  if (
    applicationMode === "native" &&
    club.application_mode !== "native" &&
    !capabilities.formBuilder
  ) {
    redirect(
      `/portal/${slug}/settings?error=Native+Rush+applications+are+not+available+on+this+database+yet.`,
    );
  }

  const normalizedTargetYears = Array.from(new Set(targetYears));
  const normalizedApplicationUrl = applicationMode === "external" ? applicationUrl : null;

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      description: description || null,
      category: category || null,
      tags,
      target_years: normalizedTargetYears,
      website_url: websiteUrl || null,
      instagram_url: instagramUrl || null,
      contact_email: contactEmail.toLowerCase() || null,
      recruiting_status: recruitingStatus,
      application_mode: applicationMode,
      application_url: normalizedApplicationUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", club.id);

  if (error) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/settings`);
  revalidatePath(`/clubs/${slug}`);
  revalidatePath("/clubs");
  redirect(`/portal/${slug}/settings?message=Club+settings+updated.`);
}

export async function addOfficer(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);
  const email = getString(formData, "email").toLowerCase();
  const role = getString(formData, "role");

  if (!email) {
    redirect(`/portal/${slug}/settings?error=Officer+email+is+required.`);
  }

  if (!VALID_PORTAL_ROLES.includes(role as (typeof VALID_PORTAL_ROLES)[number])) {
    redirect(`/portal/${slug}/settings?error=Choose+a+valid+portal+role.`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(profileError.message)}`);
  }

  if (!profile) {
    redirect(
      `/portal/${slug}/settings?error=No+Rush+account+exists+for+${encodeURIComponent(email)}.`,
    );
  }

  const { error } = await supabase.from("club_admin_memberships").upsert(
    {
      club_id: club.id,
      user_id: profile.id,
      role,
    },
    { onConflict: "club_id,user_id" },
  );

  if (error) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/settings`);
  revalidatePath(`/portal/${slug}`);
  redirect(`/portal/${slug}/settings?message=${encodeURIComponent(`Access updated for ${email}.`)}`);
}

export async function updateOfficerRole(slug: string, userId: string, nextRole: string) {
  const { supabase, club, memberships, adminCount } = await getMembershipSnapshot(slug);

  if (!VALID_PORTAL_ROLES.includes(nextRole as (typeof VALID_PORTAL_ROLES)[number])) {
    redirect(`/portal/${slug}/settings?error=Choose+a+valid+portal+role.`);
  }

  const currentMembership = memberships.find((membership) => membership.user_id === userId);

  if (!currentMembership) {
    redirect(`/portal/${slug}/settings?error=Officer+record+not+found.`);
  }

  if (currentMembership.role === "admin" && nextRole !== "admin" && adminCount <= 1) {
    redirect(`/portal/${slug}/settings?error=Keep+at+least+one+club+admin.`);
  }

  const { error } = await supabase
    .from("club_admin_memberships")
    .update({ role: nextRole })
    .eq("club_id", club.id)
    .eq("user_id", userId);

  if (error) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/settings`);
  revalidatePath(`/portal/${slug}`);
  redirect(`/portal/${slug}/settings?message=Officer+role+updated.`);
}

export async function removeOfficer(slug: string, userId: string) {
  const { supabase, club, user, memberships, adminCount } = await getMembershipSnapshot(slug);
  const currentMembership = memberships.find((membership) => membership.user_id === userId);

  if (!currentMembership) {
    redirect(`/portal/${slug}/settings?error=Officer+record+not+found.`);
  }

  if (currentMembership.role === "admin" && adminCount <= 1) {
    redirect(`/portal/${slug}/settings?error=Keep+at+least+one+club+admin.`);
  }

  if (userId === user.id && currentMembership.role === "admin" && adminCount <= 1) {
    redirect(`/portal/${slug}/settings?error=You+cannot+remove+the+last+club+admin.`);
  }

  const { error } = await supabase
    .from("club_admin_memberships")
    .delete()
    .eq("club_id", club.id)
    .eq("user_id", userId);

  if (error) {
    redirect(`/portal/${slug}/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/settings`);
  revalidatePath(`/portal/${slug}`);
  redirect(`/portal/${slug}/settings?message=Officer+removed.`);
}
