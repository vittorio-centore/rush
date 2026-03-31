from ml_service.rerank import apply_rerank_rules


def test_rerank_excludes_applied_and_prefers_deadlines():
    results = apply_rerank_rules(
        [
            {
                "club_id": "a",
                "score": 1.0,
                "category": "Consulting",
                "recruiting_status": "open",
                "next_deadline_at": None,
                "verified": False,
            },
            {
                "club_id": "b",
                "score": 0.8,
                "category": "Consulting",
                "recruiting_status": "open",
                "next_deadline_at": "2099-01-03T00:00:00+00:00",
                "verified": True,
            },
        ],
        applied_club_ids={"a"},
        recently_unfollowed_club_ids=set(),
        limit=5,
    )

    assert [item["club_id"] for item in results] == ["b"]


def test_rerank_caps_category_diversity_in_top_ten():
    candidates = [
        {
            "club_id": str(index),
            "score": 100 - index,
            "category": "Tech" if index < 4 else "Consulting",
            "recruiting_status": "open",
            "next_deadline_at": None,
            "verified": False,
        }
        for index in range(12)
    ]

    results = apply_rerank_rules(
        candidates,
        applied_club_ids=set(),
        recently_unfollowed_club_ids=set(),
        limit=10,
    )

    top_ten = results[:10]
    assert sum(1 for item in top_ten if item["category"] == "Tech") <= 2
