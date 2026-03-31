from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
import joblib

from ml_service.config import Settings


@dataclass
class ActiveArtifacts:
    model_version: str
    embedding_model: str
    ranker: Any | None
    manifest: dict[str, Any]


def _is_s3_path(value: str) -> bool:
    return value.startswith("s3://")


def _download_s3_object(settings: Settings, path: str, destination: Path) -> Path:
    assert path.startswith("s3://")
    _, _, bucket_and_key = path.partition("s3://")
    bucket, _, key = bucket_and_key.partition("/")
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, str(destination))
    return destination


def _load_manifest(settings: Settings) -> dict[str, Any]:
    local_manifest = settings.local_artifact_dir / "active-manifest.json"
    if local_manifest.exists():
        return json.loads(local_manifest.read_text())

    if settings.s3_bucket:
        client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        body = client.get_object(
            Bucket=settings.s3_bucket,
            Key=settings.active_model_manifest_key,
        )["Body"].read()
        return json.loads(body)

    return {
        "model_version": "fallback-popular-v1",
        "embedding_model": settings.default_embedding_model,
        "ranker_path": None,
    }


def load_active_artifacts(settings: Settings) -> ActiveArtifacts:
    manifest = _load_manifest(settings)
    ranker = None
    ranker_path = manifest.get("ranker_path")

    if isinstance(ranker_path, str) and ranker_path:
        if _is_s3_path(ranker_path):
            temp_dir = Path(tempfile.mkdtemp(prefix="rush-ranker-"))
            local_path = _download_s3_object(settings, ranker_path, temp_dir / "ranker.joblib")
            ranker = joblib.load(local_path)
        else:
            ranker = joblib.load(Path(ranker_path))

    return ActiveArtifacts(
        model_version=str(manifest.get("model_version") or "fallback-popular-v1"),
        embedding_model=str(manifest.get("embedding_model") or settings.default_embedding_model),
        ranker=ranker,
        manifest=manifest,
    )
