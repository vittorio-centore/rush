from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from ml_service.config import load_settings
from ml_service.embeddings import (
    blend_embeddings,
    build_behavior_embedding,
    compose_profile_text,
    encode_text,
    list_to_vector,
)
from ml_service.features import build_feature_row, event_history_flags
from ml_service.supabase import SupabaseRestClient


LABEL_MAP = {
    "view": 1,
    "click": 2,
    "follow": 3,
    "apply": 4,
    "native_apply": 5,
}

def run(output_path: str | None = None) -> Path:
    settings = load_settings()
    supabase = SupabaseRestClient(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )

    training_window_start = datetime.now(timezone.utc) - timedelta(days=90)
    validation_window_start = datetime.now(timezone.utc) - timedelta(days=14)

    profiles = {
        row["id"]: row
        for row in supabase.fetch_all_rows(
            "profiles",
            columns="id, year, major, interests, full_name",
        )
    }
    events = supabase.fetch_all_rows(
        "events",
        columns="user_id, club_id, event_type, created_at",
        filters=[("created_at", "gte", training_window_start.isoformat())],
        order="created_at.asc",
    )
    stats = {
        row["club_id"]: row
        for row in supabase.fetch_all_rows(
            "club_recommendation_stats",
            columns=(
                "club_id, views_30d, clicks_30d, follows_30d, applications_30d, "
                "native_applications_30d, next_deadline_at, active_deadline_count"
            ),
        )
    }
    clubs = {
        row["id"]: row
        for row in supabase.fetch_all_rows(
            "clubs",
            columns=(
                "id, embedding, category, tags, recruiting_status, application_mode, "
                "verified, target_years"
            ),
        )
    }
    club_embeddings = {
        club_id: list_to_vector(club.get("embedding"))
        for club_id, club in clubs.items()
        if list_to_vector(club.get("embedding")) is not None
    }
    profile_embeddings = {
        user_id: encode_text(settings.default_embedding_model, compose_profile_text(profile))
        for user_id, profile in profiles.items()
    }

    events_by_user_day: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
    events_by_user: dict[str, list[dict[str, object]]] = defaultdict(list)
    for event in events:
        created_at = str(event.get("created_at") or "")
        event_date = created_at[:10]
        user_id = str(event.get("user_id") or "")
        if not user_id or not event_date:
            continue
        events_by_user_day[(user_id, event_date)].append(event)
        events_by_user[user_id].append(event)

    rows: list[dict[str, object]] = []
    for user_id, snapshot_date in sorted(events_by_user_day.keys()):
        profile = profiles.get(user_id)
        snapshot_dt = datetime.fromisoformat(f"{snapshot_date}T00:00:00+00:00")
        label_end = snapshot_dt + timedelta(days=14)
        history_events = [
            event
            for event in events_by_user[user_id]
            if datetime.fromisoformat(str(event.get("created_at") or "").replace("Z", "+00:00")) < snapshot_dt
        ]
        profile_embedding = profile_embeddings.get(user_id)
        behavior_embedding, interaction_weight_total = build_behavior_embedding(
            history_events,
            club_embeddings,
            reference_time=snapshot_dt,
        )
        user_embedding, _ = blend_embeddings(
            profile_embedding,
            behavior_embedding,
            interaction_weight_total,
        )
        if user_embedding is None:
            continue

        positives_by_club: dict[str, int] = {}
        for event in events_by_user[user_id]:
            created_at = datetime.fromisoformat(
                str(event.get("created_at") or "").replace("Z", "+00:00")
            )
            if created_at < snapshot_dt or created_at >= label_end:
                continue
            club_id = str(event.get("club_id") or "")
            label = LABEL_MAP.get(str(event.get("event_type") or ""), 0)
            positives_by_club[club_id] = max(positives_by_club.get(club_id, 0), label)

        if not positives_by_club:
            continue

        history_by_club: dict[str, list[dict[str, object]]] = defaultdict(list)
        for event in history_events:
            club_id = str(event.get("club_id") or "")
            if club_id:
                history_by_club[club_id].append(event)

        excluded_club_ids = [
            club_id
            for club_id, club_events in history_by_club.items()
            if any(event.get("event_type") in {"apply", "native_apply"} for event in club_events)
        ]
        retrieval_rows = supabase.rpc(
            "match_clubs_by_embedding",
            {
                "query_embedding_text": str(np.asarray(user_embedding).tolist()),
                "match_count": 50,
                "excluded_club_ids": excluded_club_ids,
            },
        ) or []

        candidate_scores = {
            str(row["club_id"]): float(row.get("similarity") or 0.0)
            for row in retrieval_rows
        }
        candidate_ids = list(candidate_scores.keys())
        if not candidate_ids:
            continue

        for club_id in candidate_ids:
            club = clubs.get(club_id)
            if not club:
                continue
            club_history = history_by_club.get(club_id, [])
            has_viewed_before, has_followed_before, has_unfollowed_before = event_history_flags(club_history)
            prior_application_state = 1.0 if any(
                event.get("event_type") in {"apply", "native_apply"} for event in club_history
            ) else 0.0

            feature_row = build_feature_row(
                similarity=candidate_scores[club_id],
                club=club,
                stats=stats.get(club_id),
                profile=profile,
                has_viewed_before=has_viewed_before,
                has_followed_before=has_followed_before,
                has_unfollowed_before=has_unfollowed_before,
                prior_application_state=prior_application_state,
            )
            rows.append(
                {
                    "user_id": user_id,
                    "snapshot_date": snapshot_date,
                    "club_id": club_id,
                    "label": positives_by_club.get(club_id, 0),
                    "interaction_weight_total": interaction_weight_total,
                    "is_validation": snapshot_dt >= validation_window_start,
                    **{
                        f"feature_{index}": value
                        for index, value in enumerate(feature_row)
                    },
                }
            )

    dataset = pd.DataFrame(rows)
    settings.local_artifact_dir.mkdir(parents=True, exist_ok=True)
    path = Path(output_path) if output_path else settings.local_artifact_dir / "training-dataset.parquet"
    dataset.to_parquet(path, index=False)
    return path


if __name__ == "__main__":
    run()
