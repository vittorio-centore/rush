"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePortalAdmin } from "@/lib/portal";
import { isMissingSchemaColumn } from "@/lib/supabase/compat";
import { createServiceClient } from "@/lib/supabase/service";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createDeadline(slug: string, formData: FormData) {
  const { club } = await requirePortalAdmin(slug);
  const supabase = createServiceClient();

  const title = getString(formData, "title");
  const deadlineAt = getString(formData, "deadline_at");

  if (!title || !deadlineAt) {
    redirect(`/portal/${slug}/deadlines?error=Title+and+deadline+are+required.`);
  }

  const { error } = await supabase.from("club_deadlines").insert({
    club_id: club.id,
    title,
    deadline_at: deadlineAt,
    is_active: true,
  });

  if (error) {
    redirect(`/portal/${slug}/deadlines?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/deadlines`);
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/clubs/${slug}`);
  redirect(`/portal/${slug}/deadlines?message=Deadline+created.`);
}

export async function updateDeadline(slug: string, deadlineId: string, formData: FormData) {
  const { club } = await requirePortalAdmin(slug);
  const supabase = createServiceClient();

  const title = getString(formData, "title");
  const deadlineAt = getString(formData, "deadline_at");

  if (!title || !deadlineAt) {
    redirect(`/portal/${slug}/deadlines?error=Title+and+deadline+are+required.`);
  }

  let { error } = await supabase
    .from("club_deadlines")
    .update({
      title,
      deadline_at: deadlineAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deadlineId)
    .eq("club_id", club.id);

  if (error && isMissingSchemaColumn(error, "updated_at")) {
    ({ error } = await supabase
      .from("club_deadlines")
      .update({
        title,
        deadline_at: deadlineAt,
      })
      .eq("id", deadlineId)
      .eq("club_id", club.id));
  }

  if (error) {
    redirect(`/portal/${slug}/deadlines?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/deadlines`);
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/clubs/${slug}`);
  redirect(`/portal/${slug}/deadlines?message=Deadline+updated.`);
}

export async function toggleDeadline(slug: string, deadlineId: string, isActive: boolean) {
  const { club } = await requirePortalAdmin(slug);
  const supabase = createServiceClient();

  let { error } = await supabase
    .from("club_deadlines")
    .update({
      is_active: !isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deadlineId)
    .eq("club_id", club.id);

  if (error && isMissingSchemaColumn(error, "updated_at")) {
    ({ error } = await supabase
      .from("club_deadlines")
      .update({
        is_active: !isActive,
      })
      .eq("id", deadlineId)
      .eq("club_id", club.id));
  }

  if (error) {
    redirect(`/portal/${slug}/deadlines?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/portal/${slug}/deadlines`);
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/clubs/${slug}`);
  redirect(`/portal/${slug}/deadlines?message=Deadline+updated.`);
}
