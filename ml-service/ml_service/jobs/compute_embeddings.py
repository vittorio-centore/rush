from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from ml_service.config import load_settings
from ml_service.embeddings import (
    blend_embeddings,
    build_behavior_embedding,
    compose_club_text,
    compose_profile_text,
    encode_text,
    vector_to_list,
)
from ml_service.supabase import SupabaseRestClient


def run() -> None:
    settings = load_settings()
    supabase = SupabaseRestClient(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )

    clubs = supabase.fetch_all_rows(
        "clubs",
        columns=(
            "id, name, category, tags, description, application_mode, "
            "recruiting_status"
        ),
        order="name.asc",
    )

    club_rows: list[dict[str, object]] = []
    club_embeddings: dict[str, object] = {}
    for club in clubs:
        vector = encode_text(settings.default_embedding_model, compose_club_text(club))
        club_rows.append(
            {
                "id": club["id"],
                "embedding": vector_to_list(vector),
            }
        )
        if vector is not None:
            club_embeddings[str(club["id"])] = vector

    supabase.upsert_rows("clubs", club_rows, on_conflict="id")

    profiles = supabase.fetch_all_rows(
        "profiles",
        columns="id, year, major, interests, full_name",
        order="id.asc",
    )
    events = supabase.fetch_all_rows(
        "events",
        columns="user_id, club_id, event_type, created_at",
        filters=[
            (
                "created_at",
                "gte",
                (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
            )
        ],
        order="created_at.desc",
    )

    events_by_user: dict[str, list[dict[str, object]]] = defaultdict(list)
    for event in events:
        user_id = str(event.get("user_id") or "")
        if user_id:
            events_by_user[user_id].append(event)

    user_rows: list[dict[str, object]] = []
    for profile in profiles:
        user_id = str(profile["id"])
        profile_embedding = encode_text(
            settings.default_embedding_model,
            compose_profile_text(profile),
        )
        behavior_embedding, interaction_weight_total = build_behavior_embedding(
            events_by_user.get(user_id, []),
            club_embeddings,
        )
        blended_embedding, strategy = blend_embeddings(
            profile_embedding,
            behavior_embedding,
            interaction_weight_total,
        )

        last_event_at = None
        if events_by_user.get(user_id):
            last_event_at = str(events_by_user[user_id][0].get("created_at") or "")

        user_rows.append(
            {
                "user_id": user_id,
                "embedding": vector_to_list(blended_embedding),
                "profile_embedding": vector_to_list(profile_embedding),
                "behavior_embedding": vector_to_list(behavior_embedding),
                "interaction_weight_total": interaction_weight_total,
                "strategy": strategy,
                "computed_at": datetime.now(timezone.utc).isoformat(),
                "last_event_at": last_event_at,
            }
        )

    supabase.upsert_rows(
        "user_recommendation_profiles",
        user_rows,
        on_conflict="user_id",
    )


if __name__ == "__main__":
    run()
