from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import pandas as pd

from ml_service.config import load_settings


def run(dataset_path: str | None = None) -> Path:
    settings = load_settings()
    path = Path(dataset_path) if dataset_path else settings.local_artifact_dir / "training-dataset.parquet"
    if not path.exists():
        raise RuntimeError(f"Training dataset not found at {path}")

    frame = pd.read_parquet(path)
    if frame.empty:
        raise RuntimeError("Training dataset is empty")

    feature_columns = sorted(column for column in frame.columns if column.startswith("feature_"))
    train_frame = frame[~frame["is_validation"]]
    validation_frame = frame[frame["is_validation"]]

    if train_frame.empty or validation_frame.empty:
        raise RuntimeError("Training and validation splits must both be non-empty")

    train_groups = train_frame.groupby(["user_id", "snapshot_date"]).size().tolist()
    validation_groups = validation_frame.groupby(["user_id", "snapshot_date"]).size().tolist()

    model = lgb.LGBMRanker(
        objective="lambdarank",
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=31,
        min_data_in_leaf=20,
    )
    model.fit(
        train_frame[feature_columns],
        train_frame["label"],
        group=train_groups,
        eval_set=[(validation_frame[feature_columns], validation_frame["label"])],
        eval_group=[validation_groups],
        eval_at=[10],
    )

    version = datetime.now(timezone.utc).strftime("ranker-%Y%m%d%H%M%S")
    output_dir = settings.local_artifact_dir / version
    output_dir.mkdir(parents=True, exist_ok=True)

    ranker_path = output_dir / "ranker.joblib"
    joblib.dump(model, ranker_path)

    manifest = {
        "model_version": version,
        "embedding_model": settings.default_embedding_model,
        "ranker_path": str(ranker_path),
        "training_window_start": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
        "training_window_end": datetime.now(timezone.utc).isoformat(),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return output_dir


if __name__ == "__main__":
    run()
