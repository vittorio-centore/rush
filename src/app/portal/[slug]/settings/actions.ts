"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePortalAdmin } from "@/lib/portal";

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
  const websiteUrl = getString(formData, "website_url");
  const instagramUrl = getString(formData, "instagram_url");
  const contactEmail = getString(formData, "contact_email");
  const recruitingStatus = getString(formData, "recruiting_status");
  const applicationMode = getString(formData, "application_mode");
  const applicationUrl = getString(formData, "application_url");

  if (!name) {
    redirect(`/portal/${slug}/settings?error=Club+name+is+required.`);
  }

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      description: description || null,
      category: category || null,
      tags,
      website_url: websiteUrl || null,
      instagram_url: instagramUrl || null,
      contact_email: contactEmail || null,
      recruiting_status: recruitingStatus || "unknown",
      application_mode: applicationMode || "none",
      application_url: applicationUrl || null,
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
