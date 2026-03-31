from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RecommendationStrategy = Literal["ml_ranked", "fallback_popular", "rollout_off"]


class RecommendationRequest(BaseModel):
    user_id: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1, le=20)
    surface: str = Field(default="dashboard_recommendations", min_length=1)


class RecommendationItem(BaseModel):
    club_id: str
    score: float
    rank: int
    reason_code: str
    reason_text: str
    model_version: str
    strategy: RecommendationStrategy


class RecommendationResponse(BaseModel):
    items: list[RecommendationItem]
    model_version: str
    strategy: RecommendationStrategy


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_version: str
    cache_enabled: bool


class VersionResponse(BaseModel):
    model_version: str
    embedding_model: str
