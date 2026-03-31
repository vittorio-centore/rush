import numpy as np

from ml_service.embeddings import blend_embeddings


def test_blend_embeddings_prefers_profile_for_low_signal():
    profile = np.array([1.0, 0.0])
    behavior = np.array([0.0, 1.0])
    blended, strategy = blend_embeddings(profile, behavior, 1.0)

    assert strategy == "hybrid_low"
    assert np.allclose(blended, np.array([0.75, 0.25]))


def test_blend_embeddings_prefers_behavior_for_high_signal():
    profile = np.array([1.0, 0.0])
    behavior = np.array([0.0, 1.0])
    blended, strategy = blend_embeddings(profile, behavior, 12.0)

    assert strategy == "behavior_heavy"
    assert np.allclose(blended, np.array([0.15, 0.85]))
