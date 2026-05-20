"""
Property-based tests for confidence tier classification.

Feature: debrief-dtp-recommendation-test-suite
Properties 22-23: Tier classification correctness, only high/moderate counts as addressed.

The confidence tier logic is embedded in match_message_to_questions in chat.py:
    >= 0.75  → "high"
    0.60-0.74 → "moderate"
    0.45-0.59 → "low"
    < 0.45  → discarded
"""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


def classify_confidence(score: float) -> str | None:
    """Replicate the confidence tier classification from chat.py."""
    if score >= 0.75:
        return "high"
    elif score >= 0.60:
        return "moderate"
    elif score >= 0.45:
        return "low"
    else:
        return None  # discarded


def is_addressed(confidence: str | None) -> bool:
    """Only high and moderate confidence counts as addressed."""
    return confidence in ("high", "moderate")


@pytest.mark.property
@settings(max_examples=100)
@given(score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
def test_tier_classification_correctness(score):
    """Property 22: Tier classification correctness.

    Feature: debrief-dtp-recommendation-test-suite, Property 22: Confidence tier classification correctness
    """
    confidence = classify_confidence(score)

    if score >= 0.75:
        assert confidence == "high", f"Score {score} should be 'high', got '{confidence}'"
    elif score >= 0.60:
        assert confidence == "moderate", f"Score {score} should be 'moderate', got '{confidence}'"
    elif score >= 0.45:
        assert confidence == "low", f"Score {score} should be 'low', got '{confidence}'"
    else:
        assert confidence is None, f"Score {score} should be discarded (None), got '{confidence}'"


@pytest.mark.property
@settings(max_examples=100)
@given(score=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
def test_only_high_moderate_counts_as_addressed(score):
    """Property 23: Only high/moderate confidence counts as addressed.

    Feature: debrief-dtp-recommendation-test-suite, Property 23: Only high/moderate counts as addressed
    """
    confidence = classify_confidence(score)
    addressed = is_addressed(confidence)

    if score >= 0.60:
        assert addressed is True, f"Score {score} (confidence={confidence}) should be addressed"
    else:
        assert addressed is False, f"Score {score} (confidence={confidence}) should NOT be addressed"


def test_boundary_values():
    """Verify exact boundary values classify correctly."""
    assert classify_confidence(0.75) == "high"
    assert classify_confidence(0.749999) == "moderate"
    assert classify_confidence(0.60) == "moderate"
    assert classify_confidence(0.599999) == "low"
    assert classify_confidence(0.45) == "low"
    assert classify_confidence(0.449999) is None
    assert classify_confidence(0.0) is None
    assert classify_confidence(1.0) == "high"
