from __future__ import annotations

import json
from pathlib import Path

import boto3

from ml_service.config import load_settings
from ml_service.supabase import SupabaseRestClient


def run(build_dir: str) -> None:
    settings = load_settings()
    path = Path(build_dir)
    manifest_path = path / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError(f"Manifest file not found at {manifest_path}")

    manifest = json.loads(manifest_path.read_text())
    if not settings.s3_bucket:
        target = settings.local_artifact_dir / "active-manifest.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(manifest, indent=2))
    else:
        client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        ranker_key = f"models/{manifest['model_version']}/ranker.joblib"
        manifest_key = f"models/{manifest['model_version']}/manifest.json"
        client.upload_file(str(path / "ranker.joblib"), settings.s3_bucket, ranker_key)
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=manifest_key,
            Body=json.dumps({**manifest, "ranker_path": f"s3://{settings.s3_bucket}/{ranker_key}"}),
            ContentType="application/json",
        )
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=settings.active_model_manifest_key,
            Body=json.dumps({**manifest, "ranker_path": f"s3://{settings.s3_bucket}/{ranker_key}"}),
            ContentType="application/json",
        )

    supabase = SupabaseRestClient(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    active_model = supabase.fetch_active_model()
    if active_model and active_model["version"] != manifest["model_version"]:
        supabase.patch_rows(
            "ml_model_versions",
            {
                "status": "archived",
            },
            filters=[("version", "eq", active_model["version"])],
        )

    supabase.upsert_rows(
        "ml_model_versions",
        [
            {
                "version": manifest["model_version"],
                "embedding_model": manifest["embedding_model"],
                "ranker_version": manifest["model_version"],
                "training_window_start": manifest["training_window_start"],
                "training_window_end": manifest["training_window_end"],
                "status": "active",
                "artifact_manifest_url": (
                    f"s3://{settings.s3_bucket}/models/{manifest['model_version']}/manifest.json"
                    if settings.s3_bucket
                    else str(settings.local_artifact_dir / "active-manifest.json")
                ),
                "activated_at": manifest["training_window_end"],
            }
        ],
        on_conflict="version",
    )


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m ml_service.jobs.publish_model <build-dir>")
    run(sys.argv[1])
