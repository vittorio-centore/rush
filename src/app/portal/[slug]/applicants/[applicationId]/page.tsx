import Link from "next/link";
import { notFound } from "next/navigation";

import { getPortalCapabilities } from "@/lib/portal-features";
import { getPortalContext } from "@/lib/portal";
import {
  colorTokenClasses,
  computeWeightedScore,
  normalizeDecisionWeights,
} from "@/lib/recruiter-decisions";
import {
  isMissingAnySchemaColumn,
  isMissingSchemaTable,
  normalizeApplicationSource,
  type SchemaErrorLike,
} from "@/lib/supabase/compat";

import {
  assignReviewer,
  saveApplicantMemberNote,
  unassignReviewer,
  updateApplicantStatus,
} from "./actions";
import ScorecardForm from "./ScorecardForm";

type Application = {
  id: string;
  user_id: string | null;
  status: "interested" | "applied" | "interview" | "decision";
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted" | null;
  stage_id: string | null;
  decision_label_id: string | null;
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
  application_source: "tracked" | "native" | "external_csv";
  external_full_name: string | null;
  external_email: string | null;
  external_year: string | null;
  external_major: string | null;
  profiles:
    | ProfileRow
    | ProfileRow[]
    | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  year: string | null;
  major: string | null;
  bio: string | null;
  interests: string[] | null;
  skills: string[] | null;
  campus_involvement: string | null;
  experience_summary: string | null;
  phone: string | null;
  phone_number: string | null;
  headshot_url: string | null;
  resume_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
};

type Assignment = {
  id: string;
  reviewer_user_id: string;
  reviewer_profile: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type Review = {
  reviewer_user_id: string;
  problem_solving: number;
  coding_ability: number;
  technical_knowledge: number;
  communication: number;
  notes: string | null;
};

type MemberNote = {
  author_user_id: string;
  flag_status: "neutral" | "green" | "red";
  note_text: string | null;
  is_anonymous: boolean;
  updated_at: string;
};

type Stage = {
  id: string;
  label: string;
  status_bucket: "interested" | "applied" | "interview" | "decision";
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
};

type DecisionLabel = {
  id: string;
  label: string;
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted";
  color_token: "slate" | "blue" | "amber" | "green" | "rose" | "violet";
};

type StageTransition = {
  id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_at: string;
  notes: string | null;
  changed_by_user_id: string;
};

type SubmissionAnswer = {
  answer_text: string | null;
  answer_values: string[] | null;
  club_application_form_questions:
    | {
        label: string;
        type: string;
      }
    | {
        label: string;
        type: string;
      }[]
    | null;
};

const SOURCE_LABELS = {
  tracked: "Tracker only",
  native: "Rush native",
  external_csv: "CSV import",
} as const;
const LEGACY_APPLICATION_SELECT =
  "id, user_id, status, decision_status, notes, applied_at, created_at, updated_at";

function getProfile(application: Application) {
  if (!application.profiles) {
    return null;
  }

  return Array.isArray(application.profiles)
    ? application.profiles[0] ?? null
    : application.profiles;
}

function getApplicantField(
  application: Application,
  key: "full_name" | "email" | "year" | "major",
) {
  const profile = getProfile(application);

  if (profile?.[key]) {
    return profile[key];
  }

  const externalKey =
    key === "full_name"
      ? "external_full_name"
      : key === "email"
        ? "external_email"
        : key === "year"
          ? "external_year"
          : "external_major";

  return application[externalKey];
}

function getQuestionLabel(answer: SubmissionAnswer) {
  if (!answer.club_application_form_questions) {
    return "Question";
  }

  const question = Array.isArray(answer.club_application_form_questions)
    ? answer.club_application_form_questions[0]
    : answer.club_application_form_questions;

  return question?.label ?? "Question";
}

function getAnswerDisplay(answer: SubmissionAnswer) {
  if (Array.isArray(answer.answer_values) && answer.answer_values.length > 0) {
    return answer.answer_values.join(", ");
  }

  return answer.answer_text || "—";
}

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function enrichApplicantProfile(
  profile: Pick<ProfileRow, "id" | "full_name" | "email" | "year" | "major"> & Partial<ProfileRow>,
): ProfileRow {
  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    email: profile.email ?? null,
    year: profile.year ?? null,
    major: profile.major ?? null,
    bio: profile.bio ?? null,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    campus_involvement: profile.campus_involvement ?? null,
    experience_summary: profile.experience_summary ?? null,
    phone: profile.phone ?? null,
    phone_number: profile.phone_number ?? null,
    headshot_url: profile.headshot_url ?? null,
    resume_url: profile.resume_url ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    portfolio_url: profile.portfolio_url ?? null,
  };
}

async function loadApplicantProfile(
  supabase: Awaited<ReturnType<typeof getPortalContext>>["supabase"],
  userId: string,
) {
  const selectAttempts = [
    {
      select:
        "id, full_name, email, year, major, bio, interests, skills, campus_involvement, experience_summary, phone, phone_number, headshot_url, resume_url, linkedin_url, portfolio_url",
      missingColumns: [
        "bio",
        "interests",
        "skills",
        "campus_involvement",
        "experience_summary",
        "phone",
        "phone_number",
        "headshot_url",
        "resume_url",
        "linkedin_url",
        "portfolio_url",
      ],
    },
    {
      select: "id, full_name, email, year, major, headshot_url, resume_url",
      missingColumns: ["headshot_url", "resume_url"],
    },
    {
      select: "id, full_name, email, year, major",
      missingColumns: [],
    },
  ] as const;

  let lastError: SchemaErrorLike | null = null;

  for (const attempt of selectAttempts) {
    const response = await supabase.from("profiles").select(attempt.select).eq("id", userId).maybeSingle();

    if (!response.error) {
      const row = response.data as
        | (Pick<ProfileRow, "id" | "full_name" | "email" | "year" | "major"> & Partial<ProfileRow>)
        | null;

      return {
        profile: row ? enrichApplicantProfile(row) : null,
        error: null,
      };
    }

    lastError = response.error;

    if (
      attempt.missingColumns.length === 0 ||
      !isMissingAnySchemaColumn(response.error, [...attempt.missingColumns])
    ) {
      break;
    }
  }

  return {
    profile: null as ProfileRow | null,
    error: lastError,
  };
}

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200">
      <div className="h-full rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
    </div>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
    >
      {label}
    </a>
  );
}

function flagStyles(flagStatus: "neutral" | "green" | "red") {
  if (flagStatus === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (flagStatus === "red") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getRoundFocus(stage: Stage | null, status: Application["status"]) {
  const round = stage?.status_bucket ?? status;

  if (round === "interview") {
    return {
      eyebrow: "Current focus",
      title: "Interview round",
      description:
        "Keep the discussion on live evaluation: scorecards, member flags, and interviewer judgment should drive the page first.",
      checklist: [
        "Check scorecards before reopening the original application.",
        "Use club notes for green flags, risks, and who strongly advocated.",
        "Only drop into form answers when something needs verification.",
      ],
    };
  }

  if (round === "decision") {
    return {
      eyebrow: "Current focus",
      title: "Final decision round",
      description:
        "This is a final-class page now. Optimize for recommendation quality, risks, and confidence instead of rereading every answer.",
      checklist: [
        "Use the score summary and notes to decide if this applicant belongs in the class.",
        "Compare final signals, not just early application writing.",
        "Treat application answers as supporting detail below, not the main workspace.",
      ],
    };
  }

  if (round === "applied") {
    return {
      eyebrow: "Current focus",
      title: "Application review",
      description:
        "This is the right stage to read the original submission closely and decide who should move forward.",
      checklist: [
        "Read the profile card, then skim the original answers.",
        "Leave a quick flag or note if something stands out.",
        "Move strong candidates into the next round with a clean stage update.",
      ],
    };
  }

  return {
    eyebrow: "Current focus",
    title: "Early pipeline review",
    description:
      "Use this page to decide whether the applicant deserves a full review pass or should stay in the tracker for now.",
    checklist: [
      "Check profile basics and source first.",
      "Leave a note if this person should be revisited later.",
      "Promote only when there is enough signal to justify the next step.",
    ],
  };
}

function mapApplication(value: unknown, includeAdvancedFields: boolean): Application {
  const row = value as Partial<Application>;

  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    status: row.status as Application["status"],
    decision_status: (row.decision_status as Application["decision_status"]) ?? null,
    stage_id: includeAdvancedFields ? row.stage_id ?? null : null,
    decision_label_id: includeAdvancedFields ? row.decision_label_id ?? null : null,
    notes: row.notes ?? null,
    applied_at: row.applied_at ?? null,
    created_at: row.created_at ?? new Date(0).toISOString(),
    updated_at: row.updated_at ?? new Date(0).toISOString(),
    application_source: normalizeApplicationSource(row.application_source),
    external_full_name: includeAdvancedFields ? row.external_full_name ?? null : null,
    external_email: includeAdvancedFields ? row.external_email ?? null : null,
    external_year: includeAdvancedFields ? row.external_year ?? null : null,
    external_major: includeAdvancedFields ? row.external_major ?? null : null,
    profiles: null,
  };
}

export default async function ApplicantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; applicationId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug, applicationId } = await params;
  const { message, error } = await searchParams;
  const { supabase, club, membership, user } = await getPortalContext(slug);
  const capabilities = await getPortalCapabilities(slug);

  const [settingsResponse, stagesResponse, decisionLabelsResponse] = await Promise.all([
    capabilities.decisionWorkspace
      ? supabase
          .from("club_decision_settings")
          .select(
            "weight_problem_solving, weight_coding_ability, weight_technical_knowledge, weight_communication",
          )
          .eq("club_id", club.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    capabilities.decisionWorkspace
      ? supabase
          .from("club_pipeline_stages")
          .select("id, label, status_bucket, color_token")
          .eq("club_id", club.id)
          .order("position")
      : Promise.resolve({ data: [] }),
    capabilities.decisionWorkspace
      ? supabase
          .from("club_decision_labels")
          .select("id, label, decision_status, color_token")
          .eq("club_id", club.id)
          .order("position")
      : Promise.resolve({ data: [] }),
  ]);

  const stages = (stagesResponse.data ?? []) as Stage[];
  const decisionLabels = (decisionLabelsResponse.data ?? []) as DecisionLabel[];
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const decisionLabelById = new Map(decisionLabels.map((label) => [label.id, label]));
  const weights = normalizeDecisionWeights(
    settingsResponse.data
      ? {
          problem_solving: settingsResponse.data.weight_problem_solving,
          coding_ability: settingsResponse.data.weight_coding_ability,
          technical_knowledge: settingsResponse.data.weight_technical_knowledge,
          communication: settingsResponse.data.weight_communication,
        }
      : null,
  );

  const applicationSelect = capabilities.advancedApplications
    ? "id, user_id, status, decision_status, stage_id, decision_label_id, notes, applied_at, created_at, updated_at, application_source, external_full_name, external_email, external_year, external_major"
    : LEGACY_APPLICATION_SELECT;
  const { data: applicationData } = await supabase
    .from("user_applications")
    .select(applicationSelect)
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .single();

  if (!applicationData) {
    notFound();
  }

  const application = mapApplication(applicationData, capabilities.advancedApplications);
  const { profile: applicantProfileData, error: applicantProfileError } = application.user_id
    ? await loadApplicantProfile(supabase, application.user_id)
    : { profile: null, error: null };

  if (applicantProfileError) {
    throw new Error(applicantProfileError.message ?? "Failed to load applicant profile.");
  }

  application.profiles = applicantProfileData;

  const { data: assignmentsData } = capabilities.reviewerTools
    ? await supabase
        .from("club_reviewer_assignments")
        .select("id, reviewer_user_id")
        .eq("application_id", applicationId)
        .order("created_at")
    : { data: [] };

  const assignmentsBase = assignmentsData ?? [];
  const reviewerIds = assignmentsBase.map((assignment) => assignment.reviewer_user_id);
  const { data: reviewerProfilesData } = reviewerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", reviewerIds)
    : { data: [] };

  const reviewerProfiles = new Map(
    (reviewerProfilesData ?? []).map((profile) => [profile.id, profile]),
  );

  const assignments = assignmentsBase.map((assignment) => ({
    ...assignment,
    reviewer_profile: reviewerProfiles.get(assignment.reviewer_user_id) ?? null,
  })) as Assignment[];

  const { data: reviewsData } = capabilities.reviewerTools
    ? await supabase
        .from("club_application_reviews")
        .select(
          "reviewer_user_id, problem_solving, coding_ability, technical_knowledge, communication, notes",
        )
        .eq("application_id", applicationId)
    : { data: [] };

  const reviews = (reviewsData ?? []) as Review[];
  const currentReview = reviews.find((review) => review.reviewer_user_id === user.id) ?? null;
  const isAssignedReviewer =
    capabilities.reviewerTools &&
    (membership.role === "admin" ||
      assignments.some((assignment) => assignment.reviewer_user_id === user.id));

  const { data: submissionData } = capabilities.formBuilder
    ? await supabase
        .from("club_application_submissions")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle()
    : { data: null };

  const { data: answersData } = submissionData
    ? await supabase
        .from("club_application_submission_answers")
        .select("answer_text, answer_values, club_application_form_questions(label, type)")
        .eq("submission_id", submissionData.id)
    : { data: [] };

  const answers = (answersData ?? []) as SubmissionAnswer[];

  const { data: reviewerOptionsData } =
    membership.role === "admin" && capabilities.reviewerTools
      ? await supabase
          .from("club_admin_memberships")
          .select("user_id, role")
          .eq("club_id", club.id)
          .in("role", ["admin", "reviewer"])
      : { data: [] };

  const reviewerOptionIds = (reviewerOptionsData ?? []).map((member) => member.user_id);
  const { data: reviewerOptionProfilesData } =
    reviewerOptionIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", reviewerOptionIds)
      : { data: [] };

  const reviewerOptionProfiles = new Map(
    (reviewerOptionProfilesData ?? []).map((profile) => [profile.id, profile]),
  );

  const availableReviewers = (reviewerOptionsData ?? []).map((member) => ({
    user_id: member.user_id,
    role: member.role,
    profile: reviewerOptionProfiles.get(member.user_id) ?? null,
  }));

  const applicantName = getApplicantField(application, "full_name") ?? "Unknown applicant";
  const applicantEmail = getApplicantField(application, "email");
  const applicantYear = getApplicantField(application, "year");
  const applicantMajor = getApplicantField(application, "major");

  const overallAverage = computeWeightedScore(reviews, weights);
  const currentStage = application.stage_id ? stageById.get(application.stage_id) ?? null : null;
  const currentDecisionLabel = application.decision_label_id
    ? decisionLabelById.get(application.decision_label_id) ?? null
    : null;
  const { data: memberNotesData, error: memberNotesError } = await supabase
    .from("club_application_member_notes")
    .select("author_user_id, flag_status, note_text, is_anonymous, updated_at")
    .eq("application_id", applicationId)
    .order("updated_at", { ascending: false });
  const memberNotes = isMissingSchemaTable(memberNotesError, "club_application_member_notes")
    ? []
    : ((memberNotesData ?? []) as MemberNote[]);
  const memberNoteAuthorIds = Array.from(new Set(memberNotes.map((note) => note.author_user_id)));
  const { data: memberNoteProfilesData } = memberNoteAuthorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", memberNoteAuthorIds)
    : { data: [] };
  const memberNoteProfiles = new Map(
    (memberNoteProfilesData ?? []).map((profile) => [profile.id, profile]),
  );
  const currentMemberNote = memberNotes.find((note) => note.author_user_id === user.id) ?? null;
  const { data: transitionsData, error: transitionsError } = capabilities.decisionWorkspace
    ? await supabase
        .from("club_application_stage_transitions")
        .select("id, from_stage_id, to_stage_id, changed_at, notes, changed_by_user_id")
        .eq("application_id", applicationId)
        .order("changed_at", { ascending: false })
    : { data: [], error: null };
  const transitions = isMissingSchemaTable(
    transitionsError,
    "club_application_stage_transitions",
  )
    ? []
    : ((transitionsData ?? []) as StageTransition[]);
  const transitionActorIds = Array.from(
    new Set(transitions.map((transition) => transition.changed_by_user_id)),
  );
  const { data: transitionActorProfilesData } = transitionActorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", transitionActorIds)
    : { data: [] };
  const transitionActors = new Map(
    (transitionActorProfilesData ?? []).map((profile) => [profile.id, profile]),
  );

  const decisionStatus = application.decision_status ?? "pending";
  const roundFocus = getRoundFocus(currentStage, application.status);
  const compatibilityMode =
    !capabilities.advancedApplications ||
    !capabilities.decisionWorkspace ||
    !capabilities.reviewerTools ||
    !capabilities.formBuilder;

  return (
    <main className="flex flex-col gap-5">
      <Link
        href={`/portal/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        ← Back to applicants
      </Link>

      {message ? (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {compatibilityMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This applicant is loading in portal compatibility mode. Legacy status updates still work,
          but scorecards, reviewer assignments, and native form data are unavailable until the
          newer recruiter portal schema is applied.
        </div>
      ) : null}

      {/* ── Applicant identity ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600">
            {getInitials(applicantName)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">{applicantName}</h2>
            {applicantEmail ? (
              <p className="mt-0.5 text-sm text-gray-500">{applicantEmail}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {applicantYear ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {applicantYear}
                </span>
              ) : null}
              {applicantMajor ? (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {applicantMajor}
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                {SOURCE_LABELS[application.application_source]}
              </span>
              {currentStage ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(currentStage.color_token)}`}
                >
                  {currentStage.label}
                </span>
              ) : null}
            </div>
          </div>

          {/* Overall score — top right */}
          {overallAverage !== null ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Score
              </p>
              <p className="mt-0.5 text-4xl font-black tabular-nums text-gray-900">
                {overallAverage.toFixed(1)}
              </p>
              <p className="text-xs text-gray-400">/ 10 &middot; {reviews.length}r</p>
              <div className="mt-2 w-20">
                <ScoreBar value={overallAverage} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:w-[320px] lg:shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Applicant profile
            </p>
            <div className="mt-4 rounded-[1.5rem] border border-gray-200 bg-gray-50 p-5">
              {application.profiles?.headshot_url ? (
                <div className="h-20 w-20 overflow-hidden rounded-[1.1rem] border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={application.profiles.headshot_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.1rem] border border-gray-200 bg-white text-[2rem] font-semibold text-gray-700">
                  {getInitials(applicantName)}
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-[1.65rem] leading-none tracking-[-0.04em] text-gray-950">
                  {applicantName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {application.profiles?.campus_involvement ??
                    "No quick campus summary added yet."}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-500">
                  {[applicantMajor, applicantYear].filter(Boolean).join(" · ") || "Major · Year"}
                </p>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Contact
                </p>
                <p className="mt-3 text-sm text-gray-900">{applicantEmail ?? "No email added"}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {application.profiles?.phone_number ??
                    application.profiles?.phone ??
                    "No phone number added"}
                </p>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Links
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {application.profiles?.resume_url ? (
                    <LinkChip href={application.profiles.resume_url} label="Resume" />
                  ) : null}
                  {application.profiles?.linkedin_url ? (
                    <LinkChip href={application.profiles.linkedin_url} label="LinkedIn" />
                  ) : null}
                  {application.profiles?.portfolio_url ? (
                    <LinkChip href={application.profiles.portfolio_url} label="Portfolio" />
                  ) : null}
                  {!application.profiles?.resume_url &&
                  !application.profiles?.linkedin_url &&
                  !application.profiles?.portfolio_url ? (
                    <span className="text-sm text-gray-500">No profile links added.</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Bio
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-700">
                  {application.profiles?.bio ?? "No bio added yet."}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Recent experience
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-700">
                  {application.profiles?.experience_summary ??
                    "No experience summary added yet."}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Application context
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
                    {SOURCE_LABELS[application.application_source]}
                  </span>
                  {applicantYear ? (
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
                      {applicantYear}
                    </span>
                  ) : null}
                  {applicantMajor ? (
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
                      {applicantMajor}
                    </span>
                  ) : null}
                  {currentStage ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(currentStage.color_token)}`}
                    >
                      {currentStage.label}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Skills and interests
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(application.profiles?.skills ?? []).slice(0, 8).map((skill) => (
                    <span
                      key={`skill-${skill}`}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {skill}
                    </span>
                  ))}
                  {(application.profiles?.interests ?? []).slice(0, 8).map((interest) => (
                    <span
                      key={`interest-${interest}`}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700"
                    >
                      {interest}
                    </span>
                  ))}
                  {(application.profiles?.skills ?? []).length === 0 &&
                  (application.profiles?.interests ?? []).length === 0 ? (
                    <span className="text-sm text-gray-500">
                      No skills or interests added yet.
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {!application.user_id ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This application came in through an external source, so only the imported fields
                are available here. A full Rush profile card only exists for users with a linked
                student account.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {roundFocus.eyebrow}
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.03em]">{roundFocus.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {roundFocus.description}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              What to do on this page
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
              {roundFocus.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Club notes and flags
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Leave a green flag, red flag, or quick note for the team. If you post anonymously,
          other non-admin members will see it as anonymous.
        </p>

        <form className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Flag
              </label>
              <select
                name="flag_status"
                defaultValue={currentMemberNote?.flag_status ?? "neutral"}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="neutral">No flag</option>
                <option value="green">Green flag</option>
                <option value="red">Red flag</option>
              </select>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  name="is_anonymous"
                  defaultChecked={currentMemberNote?.is_anonymous ?? false}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Post anonymously
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                Note
              </label>
              <textarea
                name="note_text"
                rows={4}
                defaultValue={currentMemberNote?.note_text ?? ""}
                placeholder="Strong communicator, seems very organized, likely to contribute on project teams..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              formAction={saveApplicantMemberNote.bind(null, slug, applicationId)}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Save club note
            </button>
            <p className="text-xs text-gray-500">
              Save with `No flag` and an empty note to clear your entry.
            </p>
          </div>
        </form>

        <div className="mt-5 flex flex-col gap-3">
          {memberNotes.length === 0 ? (
            <p className="text-sm text-gray-400">No club notes yet.</p>
          ) : (
            memberNotes.map((note) => {
              const author = memberNoteProfiles.get(note.author_user_id);
              const showAnonymous =
                note.is_anonymous && membership.role !== "admin" && note.author_user_id !== user.id;

              return (
                <div
                  key={`${note.author_user_id}-${note.updated_at}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {showAnonymous
                          ? "Anonymous member"
                          : author?.full_name ?? author?.email ?? note.author_user_id}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(note.updated_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${flagStyles(note.flag_status)}`}
                    >
                      {note.flag_status === "neutral"
                        ? "No flag"
                        : note.flag_status === "green"
                          ? "Green flag"
                          : "Red flag"}
                    </span>
                  </div>
                  {note.note_text ? (
                    <p className="mt-3 text-sm leading-6 text-gray-700">{note.note_text}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Make a Decision (most prominent, full width) ── */}
      {membership.role === "admin" ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Make a decision
          </p>
          <p className="mt-0.5 text-base font-bold text-white">
            Current:{" "}
            <span className="capitalize text-gray-300">
              {currentDecisionLabel ? currentDecisionLabel.label : decisionStatus}
            </span>
          </p>

          {decisionLabels.length === 0 ? (
            /* Standard 3-button row for simple accept/waitlist/reject */
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {/* Accept */}
              <form className="flex-1">
                {application.stage_id ? (
                  <input type="hidden" name="stage_id" value={application.stage_id} />
                ) : (
                  <input type="hidden" name="status" value={application.status} />
                )}
                <input type="hidden" name="decision_status" value="accepted" />
                <input type="hidden" name="notes" value={application.notes ?? ""} />
                <button
                  formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                  className={`w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-all ${
                    decisionStatus === "accepted"
                      ? "bg-white text-gray-900 ring-2 ring-white ring-offset-2 ring-offset-gray-900"
                      : "bg-gray-800 text-gray-200 hover:bg-white hover:text-gray-900"
                  }`}
                >
                  {decisionStatus === "accepted" ? "✓ Accepted" : "Accept"}
                </button>
              </form>

              {/* Waitlist */}
              <form className="flex-1">
                {application.stage_id ? (
                  <input type="hidden" name="stage_id" value={application.stage_id} />
                ) : (
                  <input type="hidden" name="status" value={application.status} />
                )}
                <input type="hidden" name="decision_status" value="waitlisted" />
                <input type="hidden" name="notes" value={application.notes ?? ""} />
                <button
                  formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                  className={`w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-all ${
                    decisionStatus === "waitlisted"
                      ? "bg-gray-400 text-gray-900 ring-2 ring-gray-400 ring-offset-2 ring-offset-gray-900"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-600 hover:text-white"
                  }`}
                >
                  {decisionStatus === "waitlisted" ? "✓ Waitlisted" : "Waitlist"}
                </button>
              </form>

              {/* Reject */}
              <form className="flex-1">
                {application.stage_id ? (
                  <input type="hidden" name="stage_id" value={application.stage_id} />
                ) : (
                  <input type="hidden" name="status" value={application.status} />
                )}
                <input type="hidden" name="decision_status" value="rejected" />
                <input type="hidden" name="notes" value={application.notes ?? ""} />
                <button
                  formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                  className={`w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-all ${
                    decisionStatus === "rejected"
                      ? "bg-gray-600 text-white ring-2 ring-gray-500 ring-offset-2 ring-offset-gray-900"
                      : "bg-gray-800 text-gray-500 hover:bg-gray-600 hover:text-white"
                  }`}
                >
                  {decisionStatus === "rejected" ? "✓ Rejected" : "Reject"}
                </button>
              </form>
            </div>
          ) : (
            /* Decision labels variant — show label buttons */
            <form className="mt-5 flex flex-col gap-2">
              {application.stage_id ? (
                <input type="hidden" name="stage_id" value={application.stage_id} />
              ) : (
                <input type="hidden" name="status" value={application.status} />
              )}
              <input type="hidden" name="notes" value={application.notes ?? ""} />
              {decisionLabels.map((label) => (
                <button
                  key={label.id}
                  formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                  name="decision_label_id"
                  value={label.id}
                  className={`w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-all ring-1 ring-inset ${colorTokenClasses(label.color_token)} hover:opacity-90`}
                >
                  {label.label}
                </button>
              ))}
            </form>
          )}
        </div>
      ) : null}

      {/* ── Application answers ── */}
      <details className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Application answers
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Keep this as supporting detail. Open it when you need to verify the original submission.
            </p>
          </div>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Expand
          </span>
        </summary>
        {!capabilities.formBuilder ? (
          <p className="mt-4 text-sm text-gray-400">
            Native Rush form submissions are unavailable on this database.
          </p>
        ) : answers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No native Rush form answers for this applicant.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {answers.map((answer, index) => (
              <div
                key={`${getQuestionLabel(answer)}-${index}`}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  {getQuestionLabel(answer)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-900">
                  {getAnswerDisplay(answer)}
                </p>
              </div>
            ))}
          </div>
        )}
      </details>

      {/* ── Submitted reviews / scorecards ── */}
      {capabilities.reviewerTools ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Scorecards
            </h3>
            {reviews.length > 0 ? (
              <span className="text-xs font-medium text-gray-400">
                {reviews.length} submitted
              </span>
            ) : null}
          </div>

          {reviews.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No scorecards submitted yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {reviews.map((review) => {
                const reviewer = reviewerProfiles.get(review.reviewer_user_id);
                const reviewerAvg = computeWeightedScore([review], weights);
                return (
                  <div
                    key={review.reviewer_user_id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {reviewer?.full_name || reviewer?.email || review.reviewer_user_id}
                      </p>
                      {reviewerAvg !== null ? (
                        <span className="shrink-0 text-xl font-bold tabular-nums text-gray-900">
                          {reviewerAvg.toFixed(1)}
                          <span className="text-xs font-normal text-gray-400"> /10</span>
                        </span>
                      ) : null}
                    </div>

                    <dl className="mt-3 flex flex-col gap-2.5">
                      {(
                        [
                          ["Problem solving", review.problem_solving],
                          ["Coding ability", review.coding_ability],
                          ["Technical knowledge", review.technical_knowledge],
                          ["Communication", review.communication],
                        ] as [string, number][]
                      ).map(([label, score]) => (
                        <div key={label}>
                          <div className="flex items-center justify-between text-xs">
                            <dt className="text-gray-500">{label}</dt>
                            <dd className="font-bold tabular-nums text-gray-900">{score}/10</dd>
                          </div>
                          <div className="mt-1">
                            <ScoreBar value={score} />
                          </div>
                        </div>
                      ))}
                    </dl>

                    {review.notes ? (
                      <p className="mt-3 text-xs leading-5 text-gray-500">{review.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Your review (scorecard input) ── */}
      {isAssignedReviewer ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
            Your review
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {currentReview
              ? "Update your scorecard below."
              : "Submit a scorecard for this applicant."}
          </p>
          <ScorecardForm
            slug={slug}
            applicationId={applicationId}
            currentReview={currentReview}
          />
        </div>
      ) : null}

      {/* ── Admin tools: pipeline + reviewer assignments ── */}
      {membership.role === "admin" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Pipeline control */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Pipeline
            </h3>
            <form className="mt-4 flex flex-col gap-3">
              {stages.length > 0 ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Stage</label>
                  <select
                    name="stage_id"
                    defaultValue={application.stage_id ?? ""}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="">Use legacy status</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                  {currentStage ? (
                    <span
                      className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(currentStage.color_token)}`}
                    >
                      {currentStage.label}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">Status</label>
                  <select
                    name="status"
                    defaultValue={application.status}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="interested">Interested</option>
                    <option value="applied">Applied</option>
                    <option value="interview">Interview</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
              )}
              {decisionLabels.length > 0 ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Decision label
                  </label>
                  <select
                    name="decision_label_id"
                    defaultValue={application.decision_label_id ?? ""}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="">Use legacy decision</option>
                    {decisionLabels.map((decisionLabel) => (
                      <option key={decisionLabel.id} value={decisionLabel.id}>
                        {decisionLabel.label}
                      </option>
                    ))}
                  </select>
                  {currentDecisionLabel ? (
                    <span
                      className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(currentDecisionLabel.color_token)}`}
                    >
                      {currentDecisionLabel.label}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    Decision
                  </label>
                  <select
                    name="decision_status"
                    defaultValue={application.decision_status ?? "pending"}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="waitlisted">Waitlisted</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Internal notes
                </label>
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={application.notes ?? ""}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <button
                formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
              >
                Save applicant
              </button>
            </form>
          </div>

          {/* Reviewer assignments */}
          {capabilities.reviewerTools ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                Reviewer assignments
              </h3>
              <form className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select
                  name="reviewer_user_id"
                  defaultValue=""
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                >
                  <option value="">Choose reviewer</option>
                  {availableReviewers.map((reviewer) => (
                    <option key={reviewer.user_id} value={reviewer.user_id}>
                      {reviewer.profile?.full_name ||
                        reviewer.profile?.email ||
                        reviewer.user_id}{" "}
                      ({reviewer.role})
                    </option>
                  ))}
                </select>
                <button
                  formAction={assignReviewer.bind(null, slug, applicationId)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  Assign
                </button>
              </form>

              <div className="mt-3 flex flex-col gap-2">
                {assignments.length === 0 ? (
                  <p className="text-sm text-gray-400">No reviewers assigned yet.</p>
                ) : (
                  assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {assignment.reviewer_profile?.full_name ||
                            assignment.reviewer_profile?.email ||
                            assignment.reviewer_user_id}
                        </p>
                        {assignment.reviewer_profile?.email ? (
                          <p className="text-xs text-gray-400">
                            {assignment.reviewer_profile.email}
                          </p>
                        ) : null}
                      </div>
                      <form>
                        <button
                          formAction={unassignReviewer.bind(
                            null,
                            slug,
                            applicationId,
                            assignment.id,
                          )}
                          className="text-xs font-semibold text-red-500 transition-colors hover:text-red-700"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              Reviewer assignments are unavailable on this database until the recruiter portal
              schema is upgraded.
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
              Stage history
            </h3>
            {transitions.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">No stage transitions recorded yet.</p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {transitions.map((transition) => {
                  const fromStage = transition.from_stage_id
                    ? stageById.get(transition.from_stage_id) ?? null
                    : null;
                  const toStage = transition.to_stage_id
                    ? stageById.get(transition.to_stage_id) ?? null
                    : null;
                  const actor = transitionActors.get(transition.changed_by_user_id);

                  return (
                    <div
                      key={transition.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {fromStage ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(fromStage.color_token)}`}
                          >
                            {fromStage.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No stage</span>
                        )}
                        <span className="text-gray-400">→</span>
                        {toStage ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colorTokenClasses(toStage.color_token)}`}
                          >
                            {toStage.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No stage</span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        {actor?.full_name || actor?.email || "Unknown"} ·{" "}
                        {new Date(transition.changed_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {transition.notes ? (
                        <p className="mt-2 text-sm leading-6 text-gray-600">
                          {transition.notes}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
