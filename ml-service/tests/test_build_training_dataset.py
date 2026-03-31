from pathlib import Path

import pandas as pd

from ml_service.config import Settings
from ml_service.jobs import build_training_dataset


class FakeSupabaseClient:
    def __init__(self, *_args, **_kwargs):
        self.rpc_calls = []

    def fetch_all_rows(self, table, *, columns, filters=None, order=None, page_size=1000):
        if table == "profiles":
            return [
                {
                    "id": "user-1",
                    "year": "junior",
                    "major": "Computer Science",
                    "interests": ["tech", "consulting"],
                    "full_name": "Test User",
                }
            ]
        if table == "events":
            return [
                {
                    "user_id": "user-1",
                    "club_id": "club-a",
                    "event_type": "follow",
                    "created_at": "2026-02-01T12:00:00+00:00",
                },
                {
                    "user_id": "user-1",
                    "club_id": "club-b",
                    "event_type": "click",
                    "created_at": "2026-02-03T12:00:00+00:00",
                },
            ]
        if table == "club_recommendation_stats":
            return [
                {
                    "club_id": "club-a",
                    "views_30d": 20,
                    "clicks_30d": 8,
                    "follows_30d": 3,
                    "applications_30d": 1,
                    "native_applications_30d": 0,
                    "next_deadline_at": "2099-03-01T00:00:00+00:00",
                    "active_deadline_count": 1,
                },
                {
                    "club_id": "club-b",
                    "views_30d": 25,
                    "clicks_30d": 9,
                    "follows_30d": 5,
                    "applications_30d": 2,
                    "native_applications_30d": 1,
                    "next_deadline_at": "2099-03-02T00:00:00+00:00",
                    "active_deadline_count": 1,
                },
            ]
        if table == "clubs":
            return [
                {
                    "id": "club-a",
                    "embedding": [1.0, 0.0, 0.0],
                    "category": "Tech",
                    "tags": ["tech"],
                    "recruiting_status": "open",
                    "application_mode": "native",
                    "verified": True,
                    "target_years": ["junior"],
                },
                {
                    "id": "club-b",
                    "embedding": [0.0, 1.0, 0.0],
                    "category": "Consulting",
                    "tags": ["consulting"],
                    "recruiting_status": "open",
                    "application_mode": "external",
                    "verified": False,
                    "target_years": ["junior"],
                },
            ]
        raise AssertionError(f"Unexpected table: {table}")

    def rpc(self, function_name, payload):
        self.rpc_calls.append((function_name, payload))
        assert function_name == "match_clubs_by_embedding"
        assert payload["match_count"] == 50
        return [
            {"club_id": "club-a", "similarity": 0.91},
            {"club_id": "club-b", "similarity": 0.72},
        ]


def test_build_training_dataset_uses_retrieval_candidates_and_zero_labels(
    monkeypatch,
    tmp_path: Path,
):
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

    monkeypatch.setattr(build_training_dataset, "load_settings", lambda: settings)
    monkeypatch.setattr(
        build_training_dataset,
        "SupabaseRestClient",
        lambda *_args, **_kwargs: fake_supabase,
    )
    monkeypatch.setattr(
        build_training_dataset,
        "encode_text",
        lambda _model, _text: build_training_dataset.np.asarray([0.2, 0.8, 0.0]),
    )

    output_path = tmp_path / "training.parquet"
    dataset_path = build_training_dataset.run(str(output_path))
    dataset = pd.read_parquet(dataset_path)

    assert dataset_path == output_path
    assert len(fake_supabase.rpc_calls) == 2

    snapshot_rows = dataset.loc[dataset["snapshot_date"] == "2026-02-03"]
    assert set(snapshot_rows["club_id"]) == {"club-a", "club-b"}

    by_club = {
        row["club_id"]: row
        for row in snapshot_rows.to_dict(orient="records")
    }
    assert by_club["club-a"]["label"] == 0
    assert by_club["club-b"]["label"] == 2
    assert by_club["club-a"]["feature_0"] == 0.91
    assert by_club["club-b"]["feature_0"] == 0.72
    assert by_club["club-a"]["feature_19"] == 1.0
    assert by_club["club-a"]["feature_20"] == 0.0
