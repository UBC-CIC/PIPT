"""
Property-based tests for compute_section_scores and compute_overall_score.

Feature: debrief-dtp-recommendation-test-suite
Properties 13-17: Percentage range, interview practice mode, all-addressed boundary,
none-addressed boundary, DTP consistency.
"""
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from test_support import (
    key_question_lists,
    dtp_comparison_dicts,
    rec_comparison_dicts,
    compute_section_scores,
    compute_overall_score,
)


@pytest.mark.property
@settings(max_examples=100)
@given(
    key_questions=key_question_lists(min_size=1, max_size=8),
    dtp_comp=dtp_comparison_dicts(),
    rec_comp=rec_comparison_dicts(),
    num_addressed=st.integers(min_value=0, max_value=8),
)
def test_percentage_range(key_questions, dtp_comp, rec_comp, num_addressed):
    """Property 13: Percentage range — all non-None percentages in [0, 100].

    Feature: debrief-dtp-recommendation-test-suite, Property 13: Section scores percentage range
    """
    # Build addressed set from available questions
    all_ids = [q["question_id"] for q in key_questions]
    addressed = set(all_ids[:min(num_addressed, len(all_ids))])

    result = compute_section_scores(
        key_questions=key_questions,
        addressed_question_ids=addressed,
        dtp_comparison=dtp_comp,
        rec_comparison=rec_comp,
        patient_mode="standard",
    )

    for section_key in ["key_questions", "dtps", "recommendations"]:
        section = result[section_key]
        if section is not None:
            assert 0 <= section["percentage"] <= 100, (
                f"{section_key} percentage {section['percentage']} out of range"
            )


@pytest.mark.property
@settings(max_examples=100)
@given(
    key_questions=key_question_lists(min_size=1, max_size=8),
    dtp_comp=dtp_comparison_dicts(),
    rec_comp=rec_comparison_dicts(),
)
def test_interview_practice_mode(key_questions, dtp_comp, rec_comp):
    """Property 14: Interview practice mode — dtps and recommendations are None.

    Feature: debrief-dtp-recommendation-test-suite, Property 14: Section scores interview_practice mode
    """
    all_ids = [q["question_id"] for q in key_questions]
    addressed = set(all_ids[:1])  # at least one addressed

    result = compute_section_scores(
        key_questions=key_questions,
        addressed_question_ids=addressed,
        dtp_comparison=dtp_comp,
        rec_comparison=rec_comp,
        patient_mode="interview_practice",
    )

    assert result["dtps"] is None
    assert result["recommendations"] is None


@pytest.mark.property
@settings(max_examples=100)
@given(key_questions=key_question_lists(min_size=1, max_size=8))
def test_all_addressed_boundary(key_questions):
    """Property 15: All-addressed boundary — key_questions percentage == 100 when all addressed.

    Feature: debrief-dtp-recommendation-test-suite, Property 15: Section scores all-addressed boundary
    """
    # Ensure no mandatory questions are missed (all addressed)
    all_ids = set(q["question_id"] for q in key_questions)

    result = compute_section_scores(
        key_questions=key_questions,
        addressed_question_ids=all_ids,
        dtp_comparison=None,
        rec_comparison=None,
        patient_mode="standard",
    )

    assert result["key_questions"] is not None
    assert result["key_questions"]["percentage"] == 100


@pytest.mark.property
@settings(max_examples=100)
@given(key_questions=key_question_lists(min_size=1, max_size=8))
def test_none_addressed_boundary(key_questions):
    """Property 16: None-addressed boundary — key_questions percentage == 0 when none addressed.

    Feature: debrief-dtp-recommendation-test-suite, Property 16: Section scores none-addressed boundary
    """
    result = compute_section_scores(
        key_questions=key_questions,
        addressed_question_ids=set(),
        dtp_comparison=None,
        rec_comparison=None,
        patient_mode="standard",
    )

    assert result["key_questions"] is not None
    assert result["key_questions"]["percentage"] == 0


@pytest.mark.property
@settings(max_examples=100)
@given(dtp_comp=dtp_comparison_dicts())
def test_dtp_consistency(dtp_comp):
    """Property 17: DTP consistency — dtps.total == dtps.matched + count of missed items.

    Feature: debrief-dtp-recommendation-test-suite, Property 17: Section scores DTP consistency
    """
    # Only test when there are matched or missed items (otherwise dtps is None)
    num_matched = len(dtp_comp["matched"])
    num_missed = len(dtp_comp["missed"])
    assume(num_matched + num_missed > 0)

    result = compute_section_scores(
        key_questions=[],
        addressed_question_ids=set(),
        dtp_comparison=dtp_comp,
        rec_comparison=None,
        patient_mode="standard",
    )

    assert result["dtps"] is not None
    assert result["dtps"]["total"] == result["dtps"]["matched"] + num_missed
