from __future__ import annotations

import threading
import time

from fastapi import Depends, FastAPI, Header, HTTPException, status

from ml_service.artifacts import ActiveArtifacts, load_active_artifacts
from ml_service.cache import CacheClient
from ml_service.config import Settings, load_settings
from ml_service.recommender import RecommendationEngine
from ml_service.schemas import HealthResponse, RecommendationRequest, RecommendationResponse, VersionResponse
from ml_service.supabase import SupabaseRestClient

app = FastAPI(title="Rush ML Service", version="0.1.0")

_settings = load_settings()
_cache = CacheClient(_settings.redis_url)
_supabase = SupabaseRestClient(
    _settings.supabase_url,
    _settings.supabase_service_role_key,
)
_artifacts = load_active_artifacts(_settings)
_engine = RecommendationEngine(_supabase, _artifacts)
_artifact_lock = threading.Lock()
_last_artifact_refresh = 0.0


def require_service_token(authorization: str = Header(default="")) -> None:
    expected = f"Bearer {_settings.recommender_service_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token",
        )


def refresh_artifacts_if_stale() -> None:
    global _artifacts, _engine, _last_artifact_refresh

    now = time.time()
    if now - _last_artifact_refresh < 300:
        return

    with _artifact_lock:
        if now - _last_artifact_refresh < 300:
            return

        try:
            fresh_artifacts = load_active_artifacts(_settings)
        except Exception:
            _last_artifact_refresh = now
            return

        _artifacts = fresh_artifacts
        _engine = RecommendationEngine(_supabase, _artifacts)
        _last_artifact_refresh = now


def cache_key(payload: RecommendationRequest, artifacts: ActiveArtifacts) -> str:
    return (
        f"recs:{artifacts.model_version}:{payload.surface}:{payload.user_id}:{payload.limit}"
    )


@app.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    refresh_artifacts_if_stale()
    return HealthResponse(
        status="ok",
        model_version=_artifacts.model_version,
        cache_enabled=_cache.enabled,
    )


@app.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    refresh_artifacts_if_stale()
    return VersionResponse(
        model_version=_artifacts.model_version,
        embedding_model=_artifacts.embedding_model,
    )


@app.post(
    "/v1/recommendations",
    response_model=RecommendationResponse,
    dependencies=[Depends(require_service_token)],
)
def recommendations(payload: RecommendationRequest) -> RecommendationResponse:
    refresh_artifacts_if_stale()
    key = cache_key(payload, _artifacts)
    cached = _cache.get_json(key)
    if cached:
        return RecommendationResponse.model_validate(cached)

    result = _engine.recommend(user_id=payload.user_id, limit=payload.limit)
    _cache.set_json(key, result.model_dump(), ttl_seconds=3600)
    return result
