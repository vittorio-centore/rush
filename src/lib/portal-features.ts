import { cache } from "react";

import { getPortalIdentity } from "@/lib/portal";
import {
  isMissingAnySchemaColumn,
  isMissingAnySchemaTable,
  type SchemaErrorLike,
} from "@/lib/supabase/compat";
import { createClient } from "@/lib/supabase/server";

export type PortalFeature =
  | "advancedApplications"
  | "decisionWorkspace"
  | "formBuilder"
  | "imports"
  | "reviewerTools";

export type PortalCapabilities = {
  advancedApplications: boolean;
  decisionWorkspace: boolean;
  formBuilder: boolean;
  imports: boolean;
  reviewerTools: boolean;
};

const ADVANCED_APPLICATION_COLUMNS = [
  "application_source",
  "stage_id",
  "decision_label_id",
  "external_full_name",
  "external_email",
  "external_year",
  "external_major",
] as const;

const PORTAL_FEATURE_MESSAGES: Record<PortalFeature, string> = {
  advancedApplications:
    "This database is missing the newer portal application columns, so external applicant fields and custom pipeline metadata are unavailable here.",
  decisionWorkspace:
    "Decision templates, pipeline stages, labels, and saved recruiter views need the newer portal database schema before they can work in this environment.",
  formBuilder:
    "The native Rush application builder needs the newer portal database schema before sections, questions, and publishing can work in this environment.",
  imports:
    "CSV imports need the newer portal database schema before batches and external applicants can be stored in this environment.",
  reviewerTools:
    "Reviewer assignments and scorecards need the newer portal database schema before they can work in this environment.",
};

function isMissingPortalSchema(
  error: SchemaErrorLike | null | undefined,
  {
    columns = [],
    tables = [],
  }: {
    columns?: string[];
    tables?: string[];
  },
) {
  return (
    isMissingAnySchemaColumn(error, columns) ||
    isMissingAnySchemaTable(error, tables)
  );
}

export const getPortalCapabilities = cache(
  async (slug: string): Promise<PortalCapabilities> => {
    const supabase = await createClient();
    const { club } = await getPortalIdentity(slug);

    const [
      advancedApplicationsProbe,
      decisionSettingsProbe,
      pipelineStagesProbe,
      decisionLabelsProbe,
      savedViewsProbe,
      formBuilderProbe,
      importsProbe,
      reviewerAssignmentsProbe,
      reviewerScorecardsProbe,
    ] = await Promise.all([
      supabase
        .from("user_applications")
        .select(
          "application_source, stage_id, decision_label_id, external_full_name, external_email, external_year, external_major",
        )
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_decision_settings")
        .select("club_id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_pipeline_stages")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_decision_labels")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_saved_recruiter_views")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_application_forms")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_application_import_batches")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_reviewer_assignments")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
      supabase
        .from("club_application_reviews")
        .select("id")
        .eq("club_id", club.id)
        .limit(1),
    ]);

    const advancedApplications = !isMissingPortalSchema(
      advancedApplicationsProbe.error,
      {
        columns: [...ADVANCED_APPLICATION_COLUMNS],
      },
    );

    const decisionWorkspace =
      advancedApplications &&
      !isMissingPortalSchema(decisionSettingsProbe.error, {
        tables: ["club_decision_settings"],
      }) &&
      !isMissingPortalSchema(pipelineStagesProbe.error, {
        tables: ["club_pipeline_stages"],
      }) &&
      !isMissingPortalSchema(decisionLabelsProbe.error, {
        tables: ["club_decision_labels"],
      }) &&
      !isMissingPortalSchema(savedViewsProbe.error, {
        tables: ["club_saved_recruiter_views"],
      });

    const formBuilder = !isMissingPortalSchema(formBuilderProbe.error, {
      tables: ["club_application_forms"],
    });

    const imports =
      advancedApplications &&
      !isMissingPortalSchema(importsProbe.error, {
        tables: ["club_application_import_batches"],
      });

    const reviewerTools =
      !isMissingPortalSchema(reviewerAssignmentsProbe.error, {
        tables: ["club_reviewer_assignments"],
      }) &&
      !isMissingPortalSchema(reviewerScorecardsProbe.error, {
        tables: ["club_application_reviews"],
      });

    return {
      advancedApplications,
      decisionWorkspace,
      formBuilder,
      imports,
      reviewerTools,
    };
  },
);

export function getPortalFeatureUnavailableMessage(feature: PortalFeature) {
  return PORTAL_FEATURE_MESSAGES[feature];
}
