from __future__ import annotations

from datetime import datetime, timezone


def apply_rerank_rules(
    candidates: list[dict[str, object]],
    *,
    applied_club_ids: set[str],
    recently_unfollowed_club_ids: set[str],
    max_per_category_top_ten: int = 2,
    limit: int = 20,
) -> list[dict[str, object]]:
    rescored: list[dict[str, object]] = []

    for candidate in candidates:
        club_id = str(candidate["club_id"])
        if club_id in applied_club_ids:
            continue
        if str(candidate.get("recruiting_status") or "unknown") == "closed":
            continue

        score = float(candidate["score"])
        next_deadline_at = candidate.get("next_deadline_at")
        if club_id in recently_unfollowed_club_ids:
            score *= 0.15

        if isinstance(next_deadline_at, str) and next_deadline_at:
            deadline = datetime.fromisoformat(next_deadline_at.replace("Z", "+00:00"))
            delta_days = (deadline - datetime.now(timezone.utc)).total_seconds() / 86400.0
            if 0 <= delta_days <= 3:
                score *= 1.3
            elif 0 <= delta_days <= 7:
                score *= 1.15

        if candidate.get("verified"):
            score *= 1.05

        rescored.append({**candidate, "score": score})

    rescored.sort(key=lambda item: float(item["score"]), reverse=True)

    final: list[dict[str, object]] = []
    top_ten_category_counts: dict[str, int] = {}
    overflow: list[dict[str, object]] = []
    strict_cap_window = min(10, limit)

    for candidate in rescored:
        category = str(candidate.get("category") or "uncategorized")
        current_count = top_ten_category_counts.get(category, 0)
        if len(final) < strict_cap_window and current_count >= max_per_category_top_ten:
            overflow.append(candidate)
            continue

        final.append(candidate)
        if len(final) <= strict_cap_window:
            top_ten_category_counts[category] = current_count + 1

        if len(final) == limit:
            return final

    if limit <= 10:
        return final[:limit]

    for candidate in overflow:
        if len(final) == limit:
            break
        final.append(candidate)

    return final[:limit]
