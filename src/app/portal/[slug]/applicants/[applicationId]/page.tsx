import Link from "next/link";
import { notFound } from "next/navigation";

import { getPortalContext } from "@/lib/portal";
import {
  colorTokenClasses,
  computeWeightedScore,
  normalizeDecisionWeights,
} from "@/lib/recruiter-decisions";

import {
  assignReviewer,
  saveReviewerScorecard,
  unassignReviewer,
  updateApplicantStatus,
} from "./actions";

type Application = {
  id: string;
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
    | {
        full_name: string | null;
        email: string | null;
        year: string | null;
        major: string | null;
      }
    | {
        full_name: string | null;
        email: string | null;
        year: string | null;
        major: string | null;
      }[]
    | null;
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

  const [settingsResponse, stagesResponse, decisionLabelsResponse] = await Promise.all([
    supabase
      .from("club_decision_settings")
      .select(
        "weight_problem_solving, weight_coding_ability, weight_technical_knowledge, weight_communication",
      )
      .eq("club_id", club.id)
      .maybeSingle(),
    supabase
      .from("club_pipeline_stages")
      .select("id, label, status_bucket, color_token")
      .eq("club_id", club.id)
      .order("position"),
    supabase
      .from("club_decision_labels")
      .select("id, label, decision_status, color_token")
      .eq("club_id", club.id)
      .order("position"),
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

  const { data: applicationData } = await supabase
    .from("user_applications")
    .select(
      "id, status, decision_status, stage_id, decision_label_id, notes, applied_at, created_at, updated_at, application_source, external_full_name, external_email, external_year, external_major, profiles(full_name, email, year, major)",
    )
    .eq("id", applicationId)
    .eq("club_id", club.id)
    .single();

  if (!applicationData) {
    notFound();
  }

  const application = applicationData as Application;

  const { data: assignmentsData } = await supabase
    .from("club_reviewer_assignments")
    .select("id, reviewer_user_id")
    .eq("application_id", applicationId)
    .order("created_at");

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

  const { data: reviewsData } = await supabase
    .from("club_application_reviews")
    .select(
      "reviewer_user_id, problem_solving, coding_ability, technical_knowledge, communication, notes",
    )
    .eq("application_id", applicationId);

  const reviews = (reviewsData ?? []) as Review[];
  const currentReview = reviews.find((review) => review.reviewer_user_id === user.id) ?? null;
  const isAssignedReviewer =
    membership.role === "admin" ||
    assignments.some((assignment) => assignment.reviewer_user_id === user.id);

  const { data: submissionData } = await supabase
    .from("club_application_submissions")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();

  const { data: answersData } = submissionData
    ? await supabase
        .from("club_application_submission_answers")
        .select("answer_text, answer_values, club_application_form_questions(label, type)")
        .eq("submission_id", submissionData.id)
    : { data: [] };

  const answers = (answersData ?? []) as SubmissionAnswer[];

  const { data: reviewerOptionsData } =
    membership.role === "admin"
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

  const submittedAt = application.applied_at ?? application.created_at;

  return (
    <main className="flex flex-col gap-6">
      <Link
        href={`/portal/${slug}`}
        className="text-sm text-ink-muted transition-colors hover:text-ink"
      >
        ← Back to applicants
      </Link>

      {message ? (
        <div className="rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      {/* Applicant header */}
      <div className="rounded-card border border-border bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink">{applicantName}</h2>
            {applicantEmail ? (
              <p className="mt-1 text-sm text-ink-muted">{applicantEmail}</p>
            ) : null}
            <p className="mt-2 text-xs text-ink-muted">
              Source: {SOURCE_LABELS[application.application_source]} ·{" "}
              {new Date(submittedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          {overallAverage ? (
            <div className="rounded-card border border-border bg-surface-cool px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
                Weighted score
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">{overallAverage}/10</p>
            </div>
          ) : null}
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-control border border-border bg-surface-cool p-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Year
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink">{applicantYear ?? "—"}</dd>
          </div>
          <div className="rounded-control border border-border bg-surface-cool p-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Major
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink">{applicantMajor ?? "—"}</dd>
          </div>
          <div className="rounded-control border border-border bg-surface-cool p-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Status
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {currentStage ? currentStage.label : application.status}
            </dd>
          </div>
          <div className="rounded-control border border-border bg-surface-cool p-3">
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
              Decision
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {currentDecisionLabel
                ? currentDecisionLabel.label
                : application.decision_status ?? "pending"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-6">
          {/* Application answers */}
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-ink">Application answers</h3>
            {answers.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">
                No native Rush form answers for this applicant.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {answers.map((answer, index) => (
                  <div
                    key={`${getQuestionLabel(answer)}-${index}`}
                    className="rounded-control border border-border bg-surface-cool p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                      {getQuestionLabel(answer)}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-ink">{getAnswerDisplay(answer)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="rounded-card border border-border bg-white p-6 shadow-card">
            <h3 className="text-base font-semibold text-ink">Reviews</h3>
            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No scorecards submitted yet.</p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {reviews.map((review) => {
                  const reviewer = reviewerProfiles.get(review.reviewer_user_id);
                  return (
                    <div
                      key={review.reviewer_user_id}
                      className="rounded-control border border-border bg-surface-cool p-4"
                    >
                      <p className="text-sm font-semibold text-ink">
                        {reviewer?.full_name || reviewer?.email || review.reviewer_user_id}
                      </p>
                      <dl className="mt-3 flex flex-col gap-2 text-sm">
                        {(
                          [
                            ["Problem solving", review.problem_solving],
                            ["Coding ability", review.coding_ability],
                            ["Technical knowledge", review.technical_knowledge],
                            ["Communication", review.communication],
                          ] as [string, number][]
                        ).map(([label, score]) => (
                          <div key={label} className="flex items-center justify-between gap-3">
                            <dt className="text-ink-muted">{label}</dt>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                                <div
                                  className="h-full rounded-full bg-brand-action"
                                  style={{ width: `${(score / 10) * 100}%` }}
                                />
                              </div>
                              <dd className="w-8 text-right text-xs font-medium text-ink">
                                {score}/10
                              </dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                      {review.notes ? (
                        <p className="mt-3 text-sm leading-6 text-ink-muted">{review.notes}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {membership.role === "admin" ? (
            <>
              {/* Pipeline control */}
              <div className="rounded-card border border-border bg-white p-6 shadow-card">
                <h3 className="text-base font-semibold text-ink">Pipeline control</h3>
                <form className="mt-4 flex flex-col gap-4">
                  {stages.length > 0 ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-ink-muted">
                        Stage
                      </label>
                      <select
                        name="stage_id"
                        defaultValue={application.stage_id ?? ""}
                        className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
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
                      <label className="mb-1 block text-sm font-medium text-ink-muted">
                        Status
                      </label>
                      <select
                        name="status"
                        defaultValue={application.status}
                        className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
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
                      <label className="mb-1 block text-sm font-medium text-ink-muted">
                        Decision label
                      </label>
                      <select
                        name="decision_label_id"
                        defaultValue={application.decision_label_id ?? ""}
                        className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
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
                      <label className="mb-1 block text-sm font-medium text-ink-muted">
                        Decision
                      </label>
                      <select
                        name="decision_status"
                        defaultValue={application.decision_status ?? "pending"}
                        className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="waitlisted">Waitlisted</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-muted">
                      Internal notes
                    </label>
                    <textarea
                      name="notes"
                      rows={4}
                      defaultValue={application.notes ?? ""}
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  </div>
                  <button
                    formAction={updateApplicantStatus.bind(null, slug, applicationId)}
                    className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1F2937]"
                  >
                    Save applicant
                  </button>
                </form>
              </div>

              {/* Reviewer assignments */}
              <div className="rounded-card border border-border bg-white p-6 shadow-card">
                <h3 className="text-base font-semibold text-ink">Reviewer assignments</h3>
                <form className="mt-4 flex flex-col gap-4 sm:flex-row">
                  <select
                    name="reviewer_user_id"
                    defaultValue=""
                    className="min-w-0 flex-1 rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
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
                    className="inline-flex items-center justify-center rounded-control border border-border bg-surface-cool px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-border"
                  >
                    Assign
                  </button>
                </form>

                <div className="mt-4 flex flex-col gap-3">
                  {assignments.length === 0 ? (
                    <p className="text-sm text-ink-muted">No reviewers assigned yet.</p>
                  ) : (
                    assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between rounded-control border border-border bg-surface-cool px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {assignment.reviewer_profile?.full_name ||
                              assignment.reviewer_profile?.email ||
                              assignment.reviewer_user_id}
                          </p>
                          {assignment.reviewer_profile?.email ? (
                            <p className="text-xs text-ink-muted">
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
                            className="text-xs font-medium text-status-rejected transition-colors hover:text-red-700"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}

          {/* Reviewer scorecard */}
          {isAssignedReviewer ? (
            <div className="rounded-card border border-border bg-white p-6 shadow-card">
              <h3 className="text-base font-semibold text-ink">Your review</h3>
              <form className="mt-4 flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-muted">
                      Problem solving
                    </label>
                    <input
                      name="problem_solving"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={currentReview?.problem_solving ?? 7}
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-muted">
                      Coding ability
                    </label>
                    <input
                      name="coding_ability"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={currentReview?.coding_ability ?? 7}
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-muted">
                      Technical knowledge
                    </label>
                    <input
                      name="technical_knowledge"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={currentReview?.technical_knowledge ?? 7}
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-muted">
                      Communication
                    </label>
                    <input
                      name="communication"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={currentReview?.communication ?? 7}
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-muted">
                    Review notes
                  </label>
                  <textarea
                    name="review_notes"
                    rows={5}
                    defaultValue={currentReview?.notes ?? ""}
                    className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action"
                  />
                </div>
                <button
                  formAction={saveReviewerScorecard.bind(null, slug, applicationId)}
                  className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1F2937]"
                >
                  Save review
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
