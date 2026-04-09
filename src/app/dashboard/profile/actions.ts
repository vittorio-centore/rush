"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const fullName = getString(formData, "full_name");
  const year = getString(formData, "year");
  const major = getString(formData, "major");
  const interests = getString(formData, "interests")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const bio = getString(formData, "bio");
  const phone = getString(formData, "phone");
  const linkedinUrl = getString(formData, "linkedin_url");

  if (!fullName) {
    redirect("/dashboard/profile?error=Full+name+is+required.");
  }

  if (linkedinUrl && !linkedinUrl.startsWith("https://")) {
    redirect("/dashboard/profile?error=LinkedIn+URL+must+start+with+https://");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      year: year || null,
      major: major || null,
      interests,
      bio: bio || null,
      phone: phone || null,
      linkedin_url: linkedinUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (error) {
    redirect(
      `/dashboard/profile?error=${encodeURIComponent("Failed to update profile. Please try again.")}`,
    );
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  redirect("/dashboard/profile?message=Profile+updated.");
}

export async function saveResumeUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const expectedPrefix = `${data.user.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    redirect("/dashboard/profile?error=Invalid+resume+path.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      resume_url: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (error) {
    redirect(
      `/dashboard/profile?error=${encodeURIComponent("Failed to save resume. Please try again.")}`,
    );
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}
