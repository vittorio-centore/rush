export type DecisionWeights = {
  problem_solving: number;
  coding_ability: number;
  technical_knowledge: number;
  communication: number;
};

export type StageTemplate = {
  key: string;
  label: string;
  status_bucket: "interested" | "applied" | "interview" | "decision";
  color_token: ColorToken;
  position: number;
};

export type DecisionLabelTemplate = {
  key: string;
  label: string;
  decision_status: "pending" | "accepted" | "rejected" | "waitlisted";
  color_token: ColorToken;
  position: number;
};

export type DecisionTemplate = {
  key: string;
  name: string;
  description: string;
  target_acceptances: number;
  waitlist_target: number;
  weights: DecisionWeights;
  stages: StageTemplate[];
  decision_labels: DecisionLabelTemplate[];
};

export type ReviewScore = {
  problem_solving: number;
  coding_ability: number;
  technical_knowledge: number;
  communication: number;
};

export type ColorToken = "slate" | "blue" | "amber" | "green" | "rose" | "violet";

export const DEFAULT_DECISION_WEIGHTS: DecisionWeights = {
  problem_solving: 1,
  coding_ability: 1,
  technical_knowledge: 1,
  communication: 1,
};

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    key: "technical_rush",
    name: "Technical Rush",
    description: "Resume screen, technical rounds, and a final committee pass.",
    target_acceptances: 18,
    waitlist_target: 8,
    weights: {
      problem_solving: 3,
      coding_ability: 3,
      technical_knowledge: 2,
      communication: 1,
    },
    stages: [
      {
        key: "resume_screen",
        label: "Resume Screen",
        status_bucket: "applied",
        color_token: "blue",
        position: 0,
      },
      {
        key: "technical_round",
        label: "Technical Round",
        status_bucket: "interview",
        color_token: "violet",
        position: 1,
      },
      {
        key: "final_committee",
        label: "Final Committee",
        status_bucket: "decision",
        color_token: "amber",
        position: 2,
      },
    ],
    decision_labels: [
      {
        key: "offer",
        label: "Offer",
        decision_status: "accepted",
        color_token: "green",
        position: 0,
      },
      {
        key: "priority_waitlist",
        label: "Priority Waitlist",
        decision_status: "waitlisted",
        color_token: "amber",
        position: 1,
      },
      {
        key: "reject",
        label: "Reject",
        decision_status: "rejected",
        color_token: "rose",
        position: 2,
      },
    ],
  },
  {
    key: "community_fit",
    name: "Community Fit",
    description: "Coffee chats, team-fit conversations, and membership vote.",
    target_acceptances: 24,
    waitlist_target: 10,
    weights: {
      problem_solving: 1,
      coding_ability: 1,
      technical_knowledge: 1,
      communication: 3,
    },
    stages: [
      {
        key: "application_review",
        label: "Application Review",
        status_bucket: "applied",
        color_token: "blue",
        position: 0,
      },
      {
        key: "coffee_chat",
        label: "Coffee Chat",
        status_bucket: "interview",
        color_token: "amber",
        position: 1,
      },
      {
        key: "member_vote",
        label: "Member Vote",
        status_bucket: "decision",
        color_token: "violet",
        position: 2,
      },
    ],
    decision_labels: [
      {
        key: "accepted",
        label: "Accepted",
        decision_status: "accepted",
        color_token: "green",
        position: 0,
      },
      {
        key: "hold",
        label: "Hold",
        decision_status: "waitlisted",
        color_token: "amber",
        position: 1,
      },
      {
        key: "declined",
        label: "Declined",
        decision_status: "rejected",
        color_token: "rose",
        position: 2,
      },
    ],
  },
  {
    key: "consulting_sprint",
    name: "Consulting Sprint",
    description: "Case-heavy funnel with a shortlist and final board review.",
    target_acceptances: 16,
    waitlist_target: 6,
    weights: {
      problem_solving: 3,
      coding_ability: 1,
      technical_knowledge: 2,
      communication: 2,
    },
    stages: [
      {
        key: "resume_review",
        label: "Resume Review",
        status_bucket: "applied",
        color_token: "blue",
        position: 0,
      },
      {
        key: "case_round",
        label: "Case Round",
        status_bucket: "interview",
        color_token: "amber",
        position: 1,
      },
      {
        key: "board_review",
        label: "Board Review",
        status_bucket: "decision",
        color_token: "violet",
        position: 2,
      },
    ],
    decision_labels: [
      {
        key: "invite",
        label: "Invite",
        decision_status: "accepted",
        color_token: "green",
        position: 0,
      },
      {
        key: "waitlist",
        label: "Waitlist",
        decision_status: "waitlisted",
        color_token: "amber",
        position: 1,
      },
      {
        key: "pass",
        label: "Pass",
        decision_status: "rejected",
        color_token: "rose",
        position: 2,
      },
    ],
  },
];

export function normalizeDecisionWeights(
  input: Partial<DecisionWeights> | null | undefined,
): DecisionWeights {
  return {
    problem_solving: Number(input?.problem_solving) > 0 ? Number(input?.problem_solving) : 1,
    coding_ability: Number(input?.coding_ability) > 0 ? Number(input?.coding_ability) : 1,
    technical_knowledge:
      Number(input?.technical_knowledge) > 0 ? Number(input?.technical_knowledge) : 1,
    communication: Number(input?.communication) > 0 ? Number(input?.communication) : 1,
  };
}

export function computeWeightedScore(
  reviews: ReviewScore[],
  rawWeights: Partial<DecisionWeights> | null | undefined,
) {
  if (reviews.length === 0) {
    return null;
  }

  const weights = normalizeDecisionWeights(rawWeights);
  const reviewCount = reviews.length;
  const dimensionAverage = {
    problem_solving:
      reviews.reduce((sum, review) => sum + review.problem_solving, 0) / reviewCount,
    coding_ability:
      reviews.reduce((sum, review) => sum + review.coding_ability, 0) / reviewCount,
    technical_knowledge:
      reviews.reduce((sum, review) => sum + review.technical_knowledge, 0) / reviewCount,
    communication:
      reviews.reduce((sum, review) => sum + review.communication, 0) / reviewCount,
  };

  const weightTotal =
    weights.problem_solving +
    weights.coding_ability +
    weights.technical_knowledge +
    weights.communication;

  const weighted =
    dimensionAverage.problem_solving * weights.problem_solving +
    dimensionAverage.coding_ability * weights.coding_ability +
    dimensionAverage.technical_knowledge * weights.technical_knowledge +
    dimensionAverage.communication * weights.communication;

  return Math.round((weighted / weightTotal) * 10) / 10;
}

export function colorTokenClasses(color: ColorToken) {
  switch (color) {
    case "blue":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "amber":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "green":
      return "bg-green-50 text-green-700 ring-green-600/20";
    case "rose":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    case "violet":
      return "bg-violet-50 text-violet-700 ring-violet-600/20";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-400/20";
  }
}
