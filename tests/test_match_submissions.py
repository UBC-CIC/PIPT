"""
Property-based and example-based tests for match_submissions.

Feature: debrief-dtp-recommendation-test-suite
Properties 10-12, 24: Student completeness, instructor completeness,
threshold constraint, result structure.
"""
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from test_support import (
    match_submissions,
    SUBMISSION_MATCH_THRESHOLD,
    MockEmbeddingsModel,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_instructor_items(texts: list[str], model: MockEmbeddingsModel) -> list[dict]:
    """Build instructor items with pre-cached embeddings."""
    embeddings = model.embed_documents(texts)
    return [
        {
            "dtp_id": f"dtp-{i:03d}",
            "expected_dtp_text": text,
            "embedding": emb,
        }
        for i, (text, emb) in enumerate(zip(texts, embeddings))
    ]


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------

@pytest.mark.property
@settings(max_examples=100)
@given(
    num_students=st.integers(min_value=1, max_value=6),
    num_instructors=st.integers(min_value=1, max_value=6),
)
def test_student_completeness(num_students, num_instructors):
    """Property 10: Student completeness — matched + additional == len(student_texts).

    Feature: debrief-dtp-recommendation-test-suite, Property 10: Match submissions student completeness
    """
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [f"student submission {i}" for i in range(num_students)]
    instructor_texts = [f"instructor item {i}" for i in range(num_instructors)]
    instructor_items = _make_instructor_items(instructor_texts, model)

    result = match_submissions(student_texts, instructor_items, model)

    assert len(result["matched"]) + len(result["additional"]) == num_students


@pytest.mark.property
@settings(max_examples=100)
@given(
    num_students=st.integers(min_value=1, max_value=6),
    num_instructors=st.integers(min_value=1, max_value=6),
)
def test_instructor_completeness(num_students, num_instructors):
    """Property 11: Instructor completeness — matched + missed == len(instructor_items).

    Feature: debrief-dtp-recommendation-test-suite, Property 11: Match submissions instructor completeness
    """
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [f"student submission {i}" for i in range(num_students)]
    instructor_texts = [f"instructor item {i}" for i in range(num_instructors)]
    instructor_items = _make_instructor_items(instructor_texts, model)

    result = match_submissions(student_texts, instructor_items, model)

    assert len(result["matched"]) + len(result["missed"]) == num_instructors


@pytest.mark.property
@settings(max_examples=100)
@given(
    num_students=st.integers(min_value=1, max_value=6),
    num_instructors=st.integers(min_value=1, max_value=6),
)
def test_threshold_constraint(num_students, num_instructors):
    """Property 12: Threshold constraint — all matched scores >= 0.55.

    Feature: debrief-dtp-recommendation-test-suite, Property 12: Match submissions threshold constraint
    """
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [f"student submission {i}" for i in range(num_students)]
    instructor_texts = [f"instructor item {i}" for i in range(num_instructors)]
    instructor_items = _make_instructor_items(instructor_texts, model)

    result = match_submissions(student_texts, instructor_items, model)

    for item in result["matched"]:
        assert item["score"] >= SUBMISSION_MATCH_THRESHOLD, (
            f"Matched item has score {item['score']} < threshold {SUBMISSION_MATCH_THRESHOLD}"
        )


@pytest.mark.property
@settings(max_examples=100)
@given(
    num_students=st.integers(min_value=1, max_value=6),
    num_instructors=st.integers(min_value=1, max_value=6),
)
def test_result_structure(num_students, num_instructors):
    """Property 24: Result structure — matched/missed/additional have correct fields.

    Feature: debrief-dtp-recommendation-test-suite, Property 24: Match submissions result structure
    """
    model = MockEmbeddingsModel(dimension=64)
    student_texts = [f"student submission {i}" for i in range(num_students)]
    instructor_texts = [f"instructor item {i}" for i in range(num_instructors)]
    instructor_items = _make_instructor_items(instructor_texts, model)

    result = match_submissions(student_texts, instructor_items, model)

    for item in result["matched"]:
        assert "student_text" in item
        assert "instructor_text" in item
        assert "instructor_id" in item
        assert "score" in item

    for item in result["missed"]:
        assert "instructor_text" in item
        assert "instructor_id" in item

    for item in result["additional"]:
        assert "student_text" in item


# ---------------------------------------------------------------------------
# Example-based tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_empty_student_texts():
    """Empty student_texts returns all instructors as missed."""
    model = MockEmbeddingsModel(dimension=64)
    instructor_items = _make_instructor_items(["expected dtp 1", "expected dtp 2"], model)

    result = match_submissions([], instructor_items, model)

    assert result["matched"] == []
    assert len(result["missed"]) == 2
    assert result["additional"] == []


@pytest.mark.integration
def test_empty_instructor_items():
    """Empty instructor_items returns all students as additional."""
    model = MockEmbeddingsModel(dimension=64)

    result = match_submissions(["student text 1", "student text 2"], [], model)

    assert result["matched"] == []
    assert result["missed"] == []
    assert len(result["additional"]) == 2


@pytest.mark.integration
def test_both_empty():
    """Both empty returns all empty lists."""
    model = MockEmbeddingsModel(dimension=64)

    result = match_submissions([], [], model)

    assert result == {"matched": [], "missed": [], "additional": []}


@pytest.mark.integration
def test_identical_texts_produce_score_1():
    """Identical mock vectors produce score=1.0."""
    text = "exact same text for matching"
    model = MockEmbeddingsModel(dimension=64)
    instructor_items = _make_instructor_items([text], model)

    result = match_submissions([text], instructor_items, model)

    assert len(result["matched"]) == 1
    assert result["matched"][0]["score"] == 1.0
    assert result["missed"] == []
    assert result["additional"] == []
