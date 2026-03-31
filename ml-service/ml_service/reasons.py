from __future__ import annotations


def reason_code_for_candidate(
    *,
    similarity: float,
    has_deadline_soon: bool,
    overlap_count: int,
    target_year_match: bool,
) -> str:
    if has_deadline_soon:
        return "deadline_urgent"
    if overlap_count > 0 or target_year_match:
        return "interest_match"
    if similarity > 0.65:
        return "semantic_match"
    return "hybrid_match"


def reason_text(reason_code: str) -> str:
    if reason_code == "deadline_urgent":
        return "This club has an active deadline soon."
    if reason_code == "interest_match":
        return "This club overlaps with your stated interests or year fit."
    if reason_code == "semantic_match":
        return "This club is close to your recent behavior in the recommendation space."
    return "This club blends profile and behavioral signals well."
