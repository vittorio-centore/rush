from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _read_required(name: str) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.strip()


def _read_optional(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    trimmed = value.strip()
    return trimmed or default


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    recommender_service_token: str
    redis_url: str | None
    s3_bucket: str | None
    aws_access_key_id: str | None
    aws_secret_access_key: str | None
    aws_region: str
    active_model_manifest_key: str
    local_artifact_dir: Path
    default_embedding_model: str


def load_settings() -> Settings:
    return Settings(
        supabase_url=_read_required("SUPABASE_URL"),
        supabase_service_role_key=_read_required("SUPABASE_SERVICE_ROLE_KEY"),
        recommender_service_token=_read_required("RECOMMENDER_SERVICE_TOKEN"),
        redis_url=_read_optional("REDIS_URL"),
        s3_bucket=_read_optional("S3_BUCKET"),
        aws_access_key_id=_read_optional("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=_read_optional("AWS_SECRET_ACCESS_KEY"),
        aws_region=_read_optional("AWS_REGION", "us-east-1") or "us-east-1",
        active_model_manifest_key=_read_optional(
            "ACTIVE_MODEL_MANIFEST_KEY",
            "models/active-manifest.json",
        )
        or "models/active-manifest.json",
        local_artifact_dir=Path(
            _read_optional("LOCAL_ARTIFACT_DIR", "./artifacts") or "./artifacts"
        ),
        default_embedding_model=_read_optional(
            "DEFAULT_EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        )
        or "sentence-transformers/all-MiniLM-L6-v2",
    )
