from __future__ import annotations

import math
from datetime import datetime, timezone
from functools import lru_cache
from typing import Iterable

import numpy as np


EVENT_WEIGHTS = {
    "view": 0.1,
    "click": 1.0,
    "follow": 2.0,
    "apply": 3.0,
    "native_apply": 4.0,
    "unfollow": -2.0,
}


def compose_club_text(club: dict[str, object]) -> str:
    name = str(club.get("name") or "").strip()
    category = str(club.get("category") or "").strip()
    tags = ", ".join(str(tag).strip() for tag in club.get("tags") or [])
    description = str(club.get("description") or "").strip()
    application_mode = str(club.get("application_mode") or "none").strip()
    recruiting_status = str(club.get("recruiting_status") or "unknown").strip()
    return (
        f"Club: {name}. "
        f"Category: {category}. "
        f"Tags: {tags}. "
        f"Description: {description}. "
        f"Application mode: {application_mode}. "
        f"Recruiting status: {recruiting_status}."
    ).strip()


def compose_profile_text(profile: dict[str, object] | None) -> str:
    if not profile:
        return ""
    year = str(profile.get("year") or "").strip()
    major = str(profile.get("major") or "").strip()
    interests = ", ".join(str(interest).strip() for interest in profile.get("interests") or [])
    return f"Year: {year}. Major: {major}. Interests: {interests}.".strip()


@lru_cache(maxsize=2)
def load_encoder(model_name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def encode_text(model_name: str, text: str) -> np.ndarray | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    return np.asarray(load_encoder(model_name).encode(cleaned), dtype=float)


def event_weight(event_type: str) -> float:
    return EVENT_WEIGHTS.get(event_type, 0.0)


def decay_weight(created_at: str, *, half_life_days: float = 30.0) -> float:
    return decay_weight_at(created_at, reference_time=datetime.now(timezone.utc), half_life_days=half_life_days)


def decay_weight_at(
    created_at: str,
    *,
    reference_time: datetime,
    half_life_days: float = 30.0,
) -> float:
    event_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    age_days = max(
        0.0,
        (reference_time - event_time).total_seconds() / 86400.0,
    )
    return math.exp(-math.log(2) * age_days / half_life_days)


def vector_to_list(vector: np.ndarray | None) -> list[float] | None:
    if vector is None:
        return None
    return [float(value) for value in vector.tolist()]


def list_to_vector(values: list[float] | None) -> np.ndarray | None:
    if not values:
        return None
    return np.asarray(values, dtype=float)


def blend_embeddings(
    profile_embedding: np.ndarray | None,
    behavior_embedding: np.ndarray | None,
    interaction_weight_total: float,
) -> tuple[np.ndarray | None, str]:
    if profile_embedding is None and behavior_embedding is None:
        return None, "fallback_popular"
    if behavior_embedding is None:
        return profile_embedding, "profile_only"
    if profile_embedding is None:
        return behavior_embedding, "behavior_only"

    if interaction_weight_total < 3:
        return profile_embedding * 0.75 + behavior_embedding * 0.25, "hybrid_low"
    if interaction_weight_total < 10:
        return profile_embedding * 0.4 + behavior_embedding * 0.6, "hybrid"
    return profile_embedding * 0.15 + behavior_embedding * 0.85, "behavior_heavy"


def build_behavior_embedding(
    events: Iterable[dict[str, object]],
    club_embeddings: dict[str, np.ndarray],
    *,
    reference_time: datetime | None = None,
) -> tuple[np.ndarray | None, float]:
    scored_vectors: list[np.ndarray] = []
    weights: list[float] = []
    effective_reference_time = reference_time or datetime.now(timezone.utc)

    per_club_scores: dict[str, float] = {}
    for event in events:
        club_id = str(event.get("club_id") or "")
        created_at = str(event.get("created_at") or "")
        event_type = str(event.get("event_type") or "")
        if not club_id or club_id not in club_embeddings or not created_at:
            continue

        weighted = event_weight(event_type) * decay_weight_at(
            created_at,
            reference_time=effective_reference_time,
        )
        per_club_scores[club_id] = per_club_scores.get(club_id, 0.0) + weighted

    interaction_weight_total = sum(max(score, 0.0) for score in per_club_scores.values())

    for club_id, score in per_club_scores.items():
        if score <= 0:
            continue
        capped = min(score, 6.0)
        scored_vectors.append(club_embeddings[club_id])
        weights.append(capped)

    if not scored_vectors or not weights:
        return None, interaction_weight_total

    stacked = np.vstack(scored_vectors)
    return np.average(stacked, axis=0, weights=np.asarray(weights)), interaction_weight_total
