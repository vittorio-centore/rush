"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadProfileAsset(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  file: File,
  kind: "headshot" | "resume",
) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null;
  const safeExtension =
    extension && /^[a-z0-9]+$/.test(extension) ? extension : kind === "resume" ? "pdf" : "bin";
  const path = `${userId}/${kind}-${Date.now()}.${safeExtension}`;

  const { error } = await supabase.storage.from("profile-assets").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-assets").getPublicUrl(path);

  return publicUrl;
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
  const skills = getString(formData, "skills")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const campusInvolvement = getString(formData, "campus_involvement");
  const linkedinUrl = getString(formData, "linkedin_url");
  const portfolioUrl = getString(formData, "portfolio_url");
  const headshotFile = getFile(formData, "headshot_file");
  const resumeFile = getFile(formData, "resume_file");

  if (!fullName) {
    redirect("/dashboard/profile?error=Full+name+is+required.");
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("headshot_url, resume_url")
    .eq("id", data.user.id)
    .single();

  if (currentProfileError) {
    redirect(
      `/dashboard/profile?error=${encodeURIComponent("Failed to load your current profile.")}`,
    );
  }

  let headshotUrl = currentProfile?.headshot_url ?? null;
  let resumeUrl = currentProfile?.resume_url ?? null;

  try {
    const serviceSupabase = createServiceClient();

    if (headshotFile) {
      headshotUrl = await uploadProfileAsset(serviceSupabase, data.user.id, headshotFile, "headshot");
    }

    if (resumeFile) {
      resumeUrl = await uploadProfileAsset(serviceSupabase, data.user.id, resumeFile, "resume");
    }
  } catch (uploadError) {
    const message =
      uploadError instanceof Error ? uploadError.message : "Failed to upload profile assets.";
    redirect(`/dashboard/profile?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      year: year || null,
      major: major || null,
      interests,
      skills,
      campus_involvement: campusInvolvement || null,
      headshot_url: headshotUrl,
      resume_url: resumeUrl,
      linkedin_url: linkedinUrl || null,
      portfolio_url: portfolioUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (error) {
    redirect(
      `/dashboard/profile?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  redirect("/dashboard/profile?message=Profile+updated.");
}
