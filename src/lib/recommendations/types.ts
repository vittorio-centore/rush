export type RecommendationStrategy =
  | "ml_ranked"
  | "fallback_popular"
  | "rollout_off";

export type RecommendationResponseItem = {
  club_id: string;
  score: number;
  rank: number;
  reason_code: string;
  reason_text: string;
  model_version: string;
  strategy: RecommendationStrategy;
};

export type RecommendedClub = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  recruiting_status: "unknown" | "open" | "closed" | "rolling";
  verified: boolean;
  target_years: string[] | null;
  recommendation: RecommendationResponseItem;
};

export type DashboardRecommendations = {
  strategy: RecommendationStrategy;
  modelVersion: string;
  items: RecommendedClub[];
};
