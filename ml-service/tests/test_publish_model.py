import json
import sys
import types
from pathlib import Path

from ml_service.config import Settings


class FakeSupabaseClient:
    def __init__(self, *_args, **_kwargs):
        self.patches = []
        self.upserts = []

    def fetch_active_model(self):
        return {
            "version": "ranker-v0",
            "status": "active",
        }

    def patch_rows(self, table, updates, *, filters):
        self.patches.append(
            {
                "table": table,
                "updates": updates,
                "filters": filters,
            }
        )

    def upsert_rows(self, table, rows, *, on_conflict=None):
        self.upserts.append(
            {
                "table": table,
                "rows": rows,
                "on_conflict": on_conflict,
            }
        )


def test_publish_model_archives_previous_active_version(monkeypatch, tmp_path: Path):
    sys.modules.setdefault("boto3", types.SimpleNamespace(client=lambda *_args, **_kwargs: None))
    from ml_service.jobs import publish_model

    build_dir = tmp_path / "build"
    build_dir.mkdir()
    manifest = {
        "model_version": "ranker-v1",
        "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        "training_window_start": "2026-01-01T00:00:00+00:00",
        "training_window_end": "2026-01-31T00:00:00+00:00",
    }
    (build_dir / "manifest.json").write_text(json.dumps(manifest))

    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role",
        recommender_service_token="token",
        redis_url=None,
        s3_bucket=None,
        aws_access_key_id=None,
        aws_secret_access_key=None,
        aws_region="us-east-1",
        active_model_manifest_key="models/active-manifest.json",
        local_artifact_dir=tmp_path / "artifacts",
        default_embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    )

    fake_supabase = FakeSupabaseClient()

    monkeypatch.setattr(publish_model, "load_settings", lambda: settings)
    monkeypatch.setattr(
        publish_model,
        "SupabaseRestClient",
        lambda *_args, **_kwargs: fake_supabase,
    )

    publish_model.run(str(build_dir))

    assert fake_supabase.patches == [
        {
            "table": "ml_model_versions",
            "updates": {"status": "archived"},
            "filters": [("version", "eq", "ranker-v0")],
        }
    ]
    assert fake_supabase.upserts == [
        {
            "table": "ml_model_versions",
            "rows": [
                {
                    "version": "ranker-v1",
                    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
                    "ranker_version": "ranker-v1",
                    "training_window_start": "2026-01-01T00:00:00+00:00",
                    "training_window_end": "2026-01-31T00:00:00+00:00",
                    "status": "active",
                    "artifact_manifest_url": str(tmp_path / "artifacts" / "active-manifest.json"),
                    "activated_at": "2026-01-31T00:00:00+00:00",
                }
            ],
            "on_conflict": "version",
        }
    ]
