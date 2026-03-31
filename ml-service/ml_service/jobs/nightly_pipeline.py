from __future__ import annotations

from ml_service.config import load_settings
from ml_service.jobs.build_training_dataset import run as build_training_dataset
from ml_service.jobs.compute_embeddings import run as compute_embeddings
from ml_service.jobs.publish_model import run as publish_model
from ml_service.jobs.train_ranker import run as train_ranker
from ml_service.supabase import SupabaseRestClient


def run() -> None:
    settings = load_settings()
    supabase = SupabaseRestClient(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )

    supabase.rpc("refresh_club_recommendation_stats", {})
    compute_embeddings()
    dataset_path = build_training_dataset()
    build_dir = train_ranker(str(dataset_path))
    publish_model(str(build_dir))


if __name__ == "__main__":
    run()
