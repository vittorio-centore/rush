from __future__ import annotations

from datetime import datetime, timezone


def jaccard_overlap(left: list[str] | None, right: list[str] | None) -> float:
    left_set = {item.strip().lower() for item in left or [] if item and item.strip()}
    right_set = {item.strip().lower() for item in right or [] if item and item.strip()}
    if not left_set or not right_set:
        return 0.0
    intersection = len(left_set & right_set)
    union = len(left_set | right_set)
    return intersection / union if union else 0.0


def profile_overlap_count(left: list[str] | None, right: list[str] | None) -> int:
    left_set = {item.strip().lower() for item in left or [] if item and item.strip()}
    right_set = {item.strip().lower() for item in right or [] if item and item.strip()}
    return len(left_set & right_set)


def target_year_match(profile_year: str | None, target_years: list[str] | None) -> float:
    if not profile_year or not target_years:
        return 0.0
    normalized_year = profile_year.strip().lower()
    normalized_targets = {year.strip().lower() for year in target_years if year and year.strip()}
    return 1.0 if normalized_year in normalized_targets else 0.0


def days_until(deadline_iso: str | None) -> float:
    if not deadline_iso:
        return 30.0
    deadline = datetime.fromisoformat(deadline_iso.replace("Z", "+00:00"))
    delta = (deadline - datetime.now(timezone.utc)).total_seconds() / 86400.0
    return max(0.0, min(30.0, delta))


def build_feature_row(
    *,
    similarity: float,
    club: dict[str, object],
    stats: dict[str, object] | None,
    profile: dict[str, object] | None,
    has_viewed_before: bool,
    has_followed_before: bool,
    has_unfollowed_before: bool,
    prior_application_state: float,
) -> list[float]:
    profile_interests = list(profile.get("interests") or []) if profile else []
    club_tags = list(club.get("tags") or [])
    target_years = list(club.get("target_years") or [])
    days_to_deadline = days_until(str(stats.get("next_deadline_at")) if stats else None)
    recruiting_status = str(club.get("recruiting_status") or "unknown")
    application_mode = str(club.get("application_mode") or "none")
    category = str(club.get("category") or "").strip().lower()
    interest_set = {item.strip().lower() for item in profile_interests if item and item.strip()}

    return [
        float(similarity),
        1.0 if category and category in interest_set else 0.0,
        jaccard_overlap(profile_interests, club_tags),
        float(profile_overlap_count(profile_interests, club_tags)),
        target_year_match(str(profile.get("year") or "") if profile else None, target_years),
        1.0 if recruiting_status == "open" else 0.0,
        1.0 if recruiting_status == "rolling" else 0.0,
        1.0 if recruiting_status == "unknown" else 0.0,
        1.0 if application_mode == "native" else 0.0,
        1.0 if application_mode == "external" else 0.0,
        1.0 if bool(club.get("verified")) else 0.0,
        float(stats.get("views_30d") or 0),
        float(stats.get("clicks_30d") or 0),
        float(stats.get("follows_30d") or 0),
        float(stats.get("applications_30d") or 0),
        float(stats.get("native_applications_30d") or 0),
        days_to_deadline,
        1.0 if days_to_deadline <= 7 else 0.0,
        1.0 if has_viewed_before else 0.0,
        1.0 if has_followed_before else 0.0,
        1.0 if has_unfollowed_before else 0.0,
        prior_application_state,
    ]


def event_history_flags(events: list[dict[str, object]]) -> tuple[bool, bool, bool]:
    return (
        any(event.get("event_type") == "view" for event in events),
        any(event.get("event_type") == "follow" for event in events),
        any(event.get("event_type") == "unfollow" for event in events),
    )
