from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np

from ml_service.artifacts import ActiveArtifacts
from ml_service.embeddings import compose_profile_text, encode_text, list_to_vector
from ml_service.features import build_feature_row, profile_overlap_count, target_year_match
from ml_service.reasons import reason_code_for_candidate, reason_text
from ml_service.rerank import apply_rerank_rules
from ml_service.schemas import RecommendationItem, RecommendationResponse, RecommendationStrategy
from ml_service.supabase import SupabaseRestClient


def _as_float(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


class RecommendationEngine:
    def __init__(self, supabase: SupabaseRestClient, artifacts: ActiveArtifacts):
        self.supabase = supabase
        self.artifacts = artifacts

    def _fallback_response(
        self,
        user_id: str,
        limit: int,
        strategy: RecommendationStrategy = "fallback_popular",
    ) -> RecommendationResponse:
        rows = self.supabase.rpc(
            "get_popular_recommendation_clubs",
            {
                "p_user_id": user_id,
                "p_limit": limit,
            },
        ) or []

        items = [
            RecommendationItem(
                club_id=str(row["club_id"]),
                score=float(row.get("popularity_score") or 0.0),
                rank=index + 1,
                reason_code=str(row.get("reason_code") or "popular_on_rush"),
                reason_text=reason_text(str(row.get("reason_code") or "popular_on_rush")),
                model_version=self.artifacts.model_version,
                strategy=strategy,
            )
            for index, row in enumerate(rows)
        ]
        return RecommendationResponse(
            items=items,
            model_version=self.artifacts.model_version,
            strategy=strategy,
        )

    def recommend(self, *, user_id: str, limit: int) -> RecommendationResponse:
        profile = self.supabase.fetch_profile(user_id)
        recommendation_profile = self.supabase.fetch_user_recommendation_profile(user_id)
        applications = self.supabase.fetch_user_applications(user_id)

        applied_club_ids = {
            str(application["club_id"])
            for application in applications
            if str(application.get("status") or "") in {"applied", "interview", "decision"}
        }

        cached_embedding = list_to_vector(recommendation_profile.get("embedding") if recommendation_profile else None)
        interaction_weight_total = _as_float(
            recommendation_profile.get("interaction_weight_total") if recommendation_profile else 0.0
        )

        user_embedding = cached_embedding
        if user_embedding is None:
            profile_embedding = encode_text(
                self.artifacts.embedding_model,
                compose_profile_text(profile),
            )
            if profile_embedding is None:
                return self._fallback_response(user_id, limit)
            user_embedding = profile_embedding

        retrieval_rows = self.supabase.rpc(
            "match_clubs_by_embedding",
            {
                "query_embedding_text": str(np.asarray(user_embedding).tolist()),
                "match_count": 50,
                "excluded_club_ids": list(applied_club_ids),
            },
        ) or []

        if not retrieval_rows:
            return self._fallback_response(user_id, limit)

        candidate_ids = [str(row["club_id"]) for row in retrieval_rows]
        clubs = {club["id"]: club for club in self.supabase.fetch_candidate_clubs(candidate_ids)}
        stats = {row["club_id"]: row for row in self.supabase.fetch_candidate_stats(candidate_ids)}
        recent_events = self.supabase.fetch_user_events(
            user_id,
            club_ids=candidate_ids,
            since_iso=(datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
        )

        events_by_club: dict[str, list[dict[str, object]]] = defaultdict(list)
        for event in recent_events:
            club_id = str(event.get("club_id") or "")
            if club_id:
                events_by_club[club_id].append(event)

        ranked_candidates: list[dict[str, object]] = []
        for index, row in enumerate(retrieval_rows):
            club_id = str(row["club_id"])
            club = clubs.get(club_id)
            if not club:
                continue

            similarity = float(row.get("similarity") or 0.0)
            club_stats = stats.get(club_id)
            club_events = events_by_club.get(club_id, [])
            has_viewed_before = any(event.get("event_type") == "view" for event in club_events)
            has_followed_before = any(event.get("event_type") == "follow" for event in club_events)
            has_unfollowed_before = any(event.get("event_type") == "unfollow" for event in club_events)
            prior_application_state = 1.0 if club_id in applied_club_ids else 0.0

            feature_row = build_feature_row(
                similarity=similarity,
                club=club,
                stats=club_stats,
                profile=profile,
                has_viewed_before=has_viewed_before,
                has_followed_before=has_followed_before,
                has_unfollowed_before=has_unfollowed_before,
                prior_application_state=prior_application_state,
            )

            model_score = similarity
            if self.artifacts.ranker is not None:
                ranker_score = float(self.artifacts.ranker.predict([feature_row])[0])
                if interaction_weight_total < 3:
                    model_score = 0.8 * similarity + 0.2 * ranker_score
                elif interaction_weight_total < 10:
                    model_score = 0.4 * similarity + 0.6 * ranker_score
                else:
                    model_score = 0.15 * similarity + 0.85 * ranker_score

            overlap_count = profile_overlap_count(
                list(profile.get("interests") or []) if profile else [],
                list(club.get("tags") or []),
            )
            year_match = bool(
                target_year_match(
                    str(profile.get("year") or "") if profile else None,
                    list(club.get("target_years") or []),
                )
            )
            deadline_iso = str(club_stats.get("next_deadline_at") or "") if club_stats else ""
            has_deadline_soon = False
            if deadline_iso:
                deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
                has_deadline_soon = (
                    deadline - datetime.now(timezone.utc)
                ).total_seconds() <= 7 * 86400
            reason_code = reason_code_for_candidate(
                similarity=similarity,
                has_deadline_soon=has_deadline_soon,
                overlap_count=overlap_count,
                target_year_match=year_match,
            )

            ranked_candidates.append(
                {
                    "club_id": club_id,
                    "score": model_score,
                    "rank_seed": index + 1,
                    "reason_code": reason_code,
                    "reason_text": reason_text(reason_code),
                    "verified": bool(club.get("verified")),
                    "category": club.get("category"),
                    "recruiting_status": club.get("recruiting_status"),
                    "next_deadline_at": deadline_iso or None,
                }
            )

        reranked = apply_rerank_rules(
            ranked_candidates,
            applied_club_ids=applied_club_ids,
            recently_unfollowed_club_ids={
                club_id
                for club_id, club_events in events_by_club.items()
                if any(event.get("event_type") == "unfollow" for event in club_events)
            },
            limit=limit,
        )

        return RecommendationResponse(
            items=[
                RecommendationItem(
                    club_id=str(candidate["club_id"]),
                    score=float(candidate["score"]),
                    rank=index + 1,
                    reason_code=str(candidate["reason_code"]),
                    reason_text=str(candidate["reason_text"]),
                    model_version=self.artifacts.model_version,
                    strategy="ml_ranked",
                )
                for index, candidate in enumerate(reranked)
            ],
            model_version=self.artifacts.model_version,
            strategy="ml_ranked",
        )
