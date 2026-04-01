import "server-only";

import {
  isMissingSchemaColumn,
  normalizeTargetYears,
} from "@/lib/supabase/compat";
import { createServiceClient } from "@/lib/supabase/service";

import { recommendationReasonText } from "./reasons";
import { isUserInRollout } from "./rollout";
import type {
  DashboardRecommendations,
  RecommendedClub,
  RecommendationResponseItem,
  RecommendationStrategy,
} from "./types";

function readOptionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function getRolloutPercent() {
  const raw = readOptionalEnv("RECOMMENDER_ROLLOUT_PERCENT");
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

function isRecommendedClub(value: RecommendedClub | null): value is RecommendedClub {
  return value !== null;
}

async function fetchClubRows(clubIds: string[]) {
  if (clubIds.length === 0) {
    return [];
  }

  const supabase = createServiceClient();
  const primary = await supabase
    .from("clubs")
    .select(
      "id, slug, name, description, category, tags, recruiting_status, verified, target_years",
    )
    .in("id", clubIds);

  let data = primary.data;

  if (primary.error) {
    if (!isMissingSchemaColumn(primary.error, "target_years")) {
      throw new Error(primary.error.message);
    }

    const fallback = await supabase
      .from("clubs")
      .select("id, slug, name, description, category, tags, recruiting_status, verified")
      .in("id", clubIds);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    data = (fallback.data ?? []).map((club) => ({
      ...club,
      target_years: null,
    }));
  }

  const order = new Map(clubIds.map((clubId, index) => [clubId, index]));
  return (data ?? [])
    .map((club) => ({
      ...club,
      target_years: normalizeTargetYears(club.target_years),
    }))
    .sort((a, b) => {
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}

async function getFallbackRecommendations(
  userId: string,
  limit: number,
  strategy: RecommendationStrategy = "fallback_popular",
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_popular_recommendation_clubs", {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []) as {
    club_id: string;
    popularity_score: number;
    reason_code: string;
  }[];

  const clubRows = await fetchClubRows(items.map((item) => item.club_id));
  const clubById = new Map(clubRows.map((club) => [club.id, club]));

  return {
    strategy,
    modelVersion: "fallback-popular-v1",
    items: items
      .map((item, index) => {
        const club = clubById.get(item.club_id);
        if (!club) {
          return null;
        }

        const recommendation: RecommendationResponseItem = {
          club_id: item.club_id,
          score: item.popularity_score,
          rank: index + 1,
          reason_code: item.reason_code,
          reason_text: recommendationReasonText(item.reason_code, club.name),
          model_version: "fallback-popular-v1",
          strategy,
        };

        return {
          ...club,
          recommendation,
        };
      })
      .filter(isRecommendedClub),
  } satisfies DashboardRecommendations;
}

async function fetchRemoteRecommendations(userId: string, limit: number) {
  const serviceUrl = readOptionalEnv("RECOMMENDER_SERVICE_URL");
  const serviceToken = readOptionalEnv("RECOMMENDER_SERVICE_TOKEN");

  if (!serviceUrl || !serviceToken) {
    throw new Error("Recommendation service is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(`${serviceUrl}/v1/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({
        user_id: userId,
        limit,
        surface: "dashboard_recommendations",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Recommendation service failed with ${response.status}`);
    }

    const payload = (await response.json()) as {
      items?: RecommendationResponseItem[];
      model_version?: string;
      strategy?: RecommendationStrategy;
    };

    const remoteItems = Array.isArray(payload.items) ? payload.items : [];
    if (remoteItems.length === 0) {
      return {
        strategy: payload.strategy ?? "ml_ranked",
        modelVersion: payload.model_version ?? "unknown",
        items: [],
      } satisfies DashboardRecommendations;
    }

    const clubs = await fetchClubRows(remoteItems.map((item) => item.club_id));
    const clubById = new Map(clubs.map((club) => [club.id, club]));

    return {
      strategy: payload.strategy ?? remoteItems[0]?.strategy ?? "ml_ranked",
      modelVersion:
        payload.model_version ?? remoteItems[0]?.model_version ?? "unknown",
      items: remoteItems
        .map((item) => {
          const club = clubById.get(item.club_id);
          if (!club) {
            return null;
          }

          return {
            ...club,
            recommendation: {
              ...item,
              reason_text:
                item.reason_text || recommendationReasonText(item.reason_code, club.name),
            },
          };
        })
        .filter(isRecommendedClub),
    } satisfies DashboardRecommendations;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDashboardRecommendations(userId: string, limit = 6) {
  const rolloutPercent = getRolloutPercent();
  const remoteEnabled = isUserInRollout(userId, rolloutPercent);

  if (!remoteEnabled) {
    try {
      return await getFallbackRecommendations(userId, limit, "rollout_off");
    } catch (error) {
      console.error("Recommendation fallback fetch failed:", error);
      return {
        strategy: "rollout_off",
        modelVersion: "fallback-popular-v1",
        items: [],
      } satisfies DashboardRecommendations;
    }
  }

  try {
    const remote = await fetchRemoteRecommendations(userId, limit);
    if (remote.items.length > 0) {
      return remote;
    }
  } catch (error) {
    console.error("Recommendation service fetch failed:", error);
  }

  try {
    return await getFallbackRecommendations(userId, limit);
  } catch (error) {
    console.error("Recommendation fallback fetch failed:", error);
    return {
      strategy: "fallback_popular",
      modelVersion: "fallback-popular-v1",
      items: [],
    } satisfies DashboardRecommendations;
  }
}
