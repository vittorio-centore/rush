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
const REQUIRED_HEADERS = ["full_name", "email"] as const;
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

type ExistingApplication = {
  id: string;
  user_id: string | null;
  application_source: "tracked" | "native" | "external_csv";
  external_email: string | null;
  profiles:
    | {
        email: string | null;
      }
    | {
        email: string | null;
      }[]
    | null;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

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

function getProfileEmail(application: ExistingApplication) {
  if (!application.profiles) {
    return null;
  }

  const profile = Array.isArray(application.profiles)
    ? application.profiles[0] ?? null
    : application.profiles;

  return profile?.email?.trim().toLowerCase() || null;
}

function getApplicationEmail(application: ExistingApplication) {
  return application.external_email?.trim().toLowerCase() || getProfileEmail(application);
}

function importPriority(application: ExistingApplication) {
  if (application.application_source === "external_csv") {
    return 3;
  }

  if (application.application_source === "tracked") {
    return 2;
  }

  return 1;
}

export async function importApplicants(slug: string, formData: FormData) {
  const { supabase, club, user } = await requirePortalAdmin(slug);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/portal/${slug}/imports?error=Please+upload+a+CSV+file.`);
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    redirect(`/portal/${slug}/imports?error=CSV+file+must+be+5MB+or+smaller.`);
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

  let headers: string[] = [];
  let parsed: Record<string, string>[] = [];
  try {
    const parsedCsv = parseCsv(text);
    headers = parsedCsv.headers;
    parsed = parsedCsv.rows;
  } catch {
    await supabase
      .from("club_application_import_batches")
      .update({
        status: "failed",
        error_message: "Unable to parse CSV. Check quotes, commas, and column structure.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);
    redirect(`/portal/${slug}/imports?error=Unable+to+parse+CSV+file.`);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    await supabase
      .from("club_application_import_batches")
      .update({
        status: "failed",
        error_message: `Missing required column(s): ${missingHeaders.join(", ")}`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);
    redirect(
      `/portal/${slug}/imports?error=${encodeURIComponent(`Missing required columns: ${missingHeaders.join(", ")}`)}`,
    );
  }

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

  const { data: existingApplicationsData } = await supabase
    .from("user_applications")
    .select("id, user_id, application_source, external_email, profiles(email)")
    .eq("club_id", club.id);

  const existingApplications = (existingApplicationsData ?? []) as ExistingApplication[];
  const existingByEmail = new Map<string, ExistingApplication>();
  for (const application of existingApplications) {
    const email = getApplicationEmail(application);
    if (!email) {
      continue;
    }

    const current = existingByEmail.get(email);
    if (!current || importPriority(application) > importPriority(current)) {
      existingByEmail.set(email, application);
    }
  }

  for (const rawRow of parsed) {
    const row = normalizeRow(rawRow);

    if (!row.full_name || !row.email) {
      errorRows += 1;
      continue;
    }

    if (!isValidEmail(row.email)) {
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

    if (!isValidIsoDate(appliedAt)) {
      errorRows += 1;
      continue;
    }

    const existing = existingByEmail.get(row.email) ?? null;

    if (existing) {
      if (existing.application_source === "native") {
        errorRows += 1;
        continue;
      }

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
        existingByEmail.set(row.email, {
          ...existing,
          application_source: "external_csv",
          external_email: row.email,
        });
      }

      continue;
    }

    const { data: inserted, error } = await supabase
      .from("user_applications")
      .insert({
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
      })
      .select("id, user_id, application_source, external_email, profiles(email)")
      .single();

    if (error) {
      errorRows += 1;
    } else {
      importedRows += 1;
      if (inserted) {
        existingByEmail.set(row.email, inserted as ExistingApplication);
      }
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
