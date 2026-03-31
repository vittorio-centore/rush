"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePortalAdmin } from "@/lib/portal";

const VALID_RECRUITING_STATUSES = ["unknown", "open", "rolling", "closed"] as const;
const VALID_APPLICATION_MODES = ["none", "external", "native"] as const;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateClubSettings(slug: string, formData: FormData) {
  const { supabase, club } = await requirePortalAdmin(slug);

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
