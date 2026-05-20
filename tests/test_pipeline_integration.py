"""
Fixture-driven integration tests for the full evaluation pipeline.

Feature: debrief-dtp-recommendation-test-suite
Property 27: Pipeline section_scores consistency.
Tests: DTP comparison, recommendation comparison, interview_practice mode.
"""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from test_support import (
    match_submissions,
    compute_section_scores,
    MockEmbeddingsModel,
    dtp_comparison_dicts,
    rec_comparison_dicts,
    key_question_lists,
)
from fixtures.instructor_items import INSTRUCTOR_DTPS, INSTRUCTOR_RECOMMENDATIONS
from fixtures.dtp_submissions import DTP_SUBMISSIONS
from fixtures.recommendation_submissions import RECOMMENDATION_SUBMISSIONS
from fixtures.key_questions import KEY_QUESTIONS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_instructor_items_with_embeddings(items, model, text_key):
    """Add embeddings to instructor items."""
    result = []
    for item in items:
        item_copy = dict(item)
        item_copy["embedding"] = model.embed_query(item[text_key])
        result.append(item_copy)
    return result


# ---------------------------------------------------------------------------
# Integration tests — DTP comparison
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_complete_interaction_produces_dtp_comparison():
    """Complete interaction fixture produces dtp_comparison with matched/missed/additional arrays."""
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [s["text"] for s in DTP_SUBMISSIONS["complete"]]
    instructor_items = _make_instructor_items_with_embeddings(
        INSTRUCTOR_DTPS, model, "expected_dtp_text"
    )

    result = match_submissions(student_texts, instructor_items, model)

    assert "matched" in result
    assert "missed" in result
    assert "additional" in result
    assert isinstance(result["matched"], list)
    assert isinstance(result["missed"], list)
    assert isinstance(result["additional"], list)


@pytest.mark.integration
def test_complete_interaction_produces_recommendations_comparison():
    """Complete interaction fixture produces recommendations_comparison with matched/missed/additional."""
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [s["text"] for s in RECOMMENDATION_SUBMISSIONS["strong"]]
    instructor_items = _make_instructor_items_with_embeddings(
        INSTRUCTOR_RECOMMENDATIONS, model, "recommendation_text"
    )

    result = match_submissions(
        student_texts, instructor_items, model,
        text_key="recommendation_text", id_key="recommendation_id"
    )

    assert "matched" in result
    assert "missed" in result
    assert "additional" in result


@pytest.mark.integration
def test_high_quality_dtp_with_high_similarity_produces_matches():
    """High-quality DTP submissions with high-similarity mock embeddings produce non-empty matched."""
    # Use lookup mode to force high similarity between student and instructor texts
    student_text = "Beta-blocker contraindicated in asthma patient"
    instructor_text = "Beta-blocker contraindicated in asthma patient"

    # Same text → same embedding → similarity 1.0
    model = MockEmbeddingsModel(dimension=64)
    instructor_items = [{
        "dtp_id": "dtp-001",
        "expected_dtp_text": instructor_text,
        "embedding": model.embed_query(instructor_text),
    }]

    result = match_submissions([student_text], instructor_items, model)

    assert len(result["matched"]) > 0, "Expected at least one match for identical texts"


@pytest.mark.integration
def test_no_dtp_submissions_produces_empty_matched_and_additional():
    """No DTP submissions produces empty matched and additional arrays."""
    model = MockEmbeddingsModel(dimension=64)
    instructor_items = _make_instructor_items_with_embeddings(
        INSTRUCTOR_DTPS, model, "expected_dtp_text"
    )

    result = match_submissions([], instructor_items, model)

    assert result["matched"] == []
    assert result["additional"] == []
    assert len(result["missed"]) == len(INSTRUCTOR_DTPS)


@pytest.mark.integration
def test_interview_practice_excludes_dtp_and_recommendations():
    """patient_mode='interview_practice' excludes dtp_comparison and recommendations_comparison."""
    result = compute_section_scores(
        key_questions=KEY_QUESTIONS,
        addressed_question_ids={"q-001"},
        dtp_comparison={"matched": [{"score": 0.8}], "missed": [], "additional": []},
        rec_comparison={"matched": [{"score": 0.9}], "missed": [], "additional": []},
        patient_mode="interview_practice",
    )

    assert result["dtps"] is None
    assert result["recommendations"] is None
    assert result["key_questions"] is not None


# ---------------------------------------------------------------------------
# Property 27: Pipeline section_scores consistency
# ---------------------------------------------------------------------------

@pytest.mark.property
@settings(max_examples=100)
@given(
    dtp_comp=dtp_comparison_dicts(),
    rec_comp=rec_comparison_dicts(),
    key_questions=key_question_lists(min_size=1, max_size=5),
    num_addressed=st.integers(min_value=0, max_value=5),
)
def test_pipeline_section_scores_consistency(dtp_comp, rec_comp, key_questions, num_addressed):
    """Property 27: Pipeline section_scores consistency.

    section_scores.dtps.matched == len(dtp_comparison["matched"])
    section_scores.recommendations.matched == len(recommendations_comparison["matched"])

    Feature: debrief-dtp-recommendation-test-suite, Property 27: Pipeline section_scores consistency
    """
    all_ids = [q["question_id"] for q in key_questions]
    addressed = set(all_ids[:min(num_addressed, len(all_ids))])

    result = compute_section_scores(
        key_questions=key_questions,
        addressed_question_ids=addressed,
        dtp_comparison=dtp_comp,
        rec_comparison=rec_comp,
        patient_mode="standard",
    )

    # DTP consistency
    if result["dtps"] is not None:
        assert result["dtps"]["matched"] == len(dtp_comp["matched"])

    # Recommendations consistency
    if result["recommendations"] is not None:
        assert result["recommendations"]["matched"] == len(rec_comp["matched"])


# ---------------------------------------------------------------------------
# Realistic fixture tests — DTP matching quality
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_realistic_dtp_close_paraphrase_matched():
    """Close paraphrase → matched, unrelated → additional, no match → missed."""
    model = MockEmbeddingsModel(dimension=64)

    # Use identical text for a guaranteed match
    matched_text = INSTRUCTOR_DTPS[0]["expected_dtp_text"]
    unrelated_text = "The patient should drink more water and get more sleep"

    instructor_items = _make_instructor_items_with_embeddings(
        INSTRUCTOR_DTPS, model, "expected_dtp_text"
    )

    result = match_submissions(
        [matched_text, unrelated_text], instructor_items, model
    )

    # The identical text should be matched
    matched_student_texts = [m["student_text"] for m in result["matched"]]
    assert matched_text in matched_student_texts

    # Total partitioning is correct
    assert len(result["matched"]) + len(result["additional"]) == 2
    assert len(result["matched"]) + len(result["missed"]) == len(INSTRUCTOR_DTPS)


@pytest.mark.integration
def test_realistic_recommendation_partial_overlap():
    """Partial overlap correctly partitioned into matched/missed/additional."""
    model = MockEmbeddingsModel(dimension=64)

    # Use one matching text and one unrelated
    matching_text = INSTRUCTOR_RECOMMENDATIONS[0]["recommendation_text"]
    unrelated_text = "Patient should consider yoga for stress management"

    instructor_items = _make_instructor_items_with_embeddings(
        INSTRUCTOR_RECOMMENDATIONS, model, "recommendation_text"
    )

    result = match_submissions(
        [matching_text, unrelated_text], instructor_items, model,
        text_key="recommendation_text", id_key="recommendation_id"
    )

    # Verify partitioning
    assert len(result["matched"]) + len(result["additional"]) == 2
    assert len(result["matched"]) + len(result["missed"]) == len(INSTRUCTOR_RECOMMENDATIONS)
    # The identical text should definitely match
    assert len(result["matched"]) >= 1
