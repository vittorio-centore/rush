"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePortalAdmin } from "@/lib/portal";
import { parseCsv } from "@/lib/csv";

type ImportRow = {
  full_name: string;
  email: string;
  year?: string;
  major?: string;
  status?: string;
  decision_status?: string;
  notes?: string;
  applied_at?: string;
};

const VALID_STATUSES = ["interested", "applied", "interview", "decision"];
const VALID_DECISIONS = ["pending", "accepted", "rejected", "waitlisted"];

function normalizeRow(row: Record<string, string>): ImportRow {
  return {
    full_name: row.full_name?.trim() ?? "",
    email: row.email?.trim().toLowerCase() ?? "",
    year: row.year?.trim() || undefined,
    major: row.major?.trim() || undefined,
    status: row.status?.trim().toLowerCase() || undefined,
    decision_status: row.decision_status?.trim().toLowerCase() || undefined,
    notes: row.notes?.trim() || undefined,
    applied_at: row.applied_at?.trim() || undefined,
  };
}

export async function importApplicants(slug: string, formData: FormData) {
  const { supabase, club, user } = await requirePortalAdmin(slug);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/portal/${slug}/imports?error=Please+upload+a+CSV+file.`);
  }

  const { data: batch, error: batchError } = await supabase
    .from("club_application_import_batches")
    .insert({
      club_id: club.id,
      uploaded_by: user.id,
      file_name: file.name,
      status: "processing",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    redirect(`/portal/${slug}/imports?error=${encodeURIComponent(batchError?.message ?? "Unable to create import batch.")}`);
  }

  const text = await file.text();
  const parsed = parseCsv(text);

  if (parsed.length === 0) {
    await supabase
      .from("club_application_import_batches")
      .update({
        status: "failed",
        error_message: "CSV file contained no rows.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);
    redirect(`/portal/${slug}/imports?error=CSV+file+contained+no+rows.`);
  }

  let importedRows = 0;
  let errorRows = 0;

  for (const rawRow of parsed) {
    const row = normalizeRow(rawRow);

    if (!row.full_name || !row.email) {
      errorRows += 1;
      continue;
    }

    const status = VALID_STATUSES.includes(row.status ?? "")
      ? row.status
      : "applied";
    const decisionStatus = VALID_DECISIONS.includes(row.decision_status ?? "")
      ? row.decision_status
      : "pending";
    const appliedAt = row.applied_at || new Date().toISOString();

    const { data: existing } = await supabase
      .from("user_applications")
      .select("id")
      .eq("club_id", club.id)
      .eq("external_email", row.email)
      .is("user_id", null)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("user_applications")
        .update({
          status,
          decision_status: decisionStatus,
          application_source: "external_csv",
          external_full_name: row.full_name,
          external_email: row.email,
          external_year: row.year ?? null,
          external_major: row.major ?? null,
          notes: row.notes ?? "",
          applied_at: appliedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        errorRows += 1;
      } else {
        importedRows += 1;
      }

      continue;
    }

    const { error } = await supabase.from("user_applications").insert({
      club_id: club.id,
      user_id: null,
      status,
      decision_status: decisionStatus,
      application_source: "external_csv",
      external_full_name: row.full_name,
      external_email: row.email,
      external_year: row.year ?? null,
      external_major: row.major ?? null,
      notes: row.notes ?? "",
      applied_at: appliedAt,
    });

    if (error) {
      errorRows += 1;
    } else {
      importedRows += 1;
    }
  }

  await supabase
    .from("club_application_import_batches")
    .update({
      status: errorRows > 0 && importedRows === 0 ? "failed" : "completed",
      total_rows: parsed.length,
      imported_rows: importedRows,
      error_rows: errorRows,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/portal/${slug}/imports`);
  redirect(
    `/portal/${slug}/imports?message=${encodeURIComponent(
      `Imported ${importedRows} row${importedRows === 1 ? "" : "s"} with ${errorRows} error${errorRows === 1 ? "" : "s"}.`,
    )}`,
  );
}
