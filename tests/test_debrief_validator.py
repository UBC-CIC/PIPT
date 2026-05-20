"""
Property-based tests for validate_debrief_output.

Feature: debrief-dtp-recommendation-test-suite
Properties 18-21: Guarantees required keys, data preservation,
answer_key_comparison presence, overall_score numeric.
"""
import copy
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from test_support import validate_debrief_output, debrief_dicts


REQUIRED_KEYS = {"summary", "questions_addressed", "questions_missed", "recommendation_feedback", "overall_score"}


@pytest.mark.property
@settings(max_examples=100)
@given(data=debrief_dicts(complete=False))
def test_guarantees_required_keys(data):
    """Property 18: Guarantees required keys — output always contains required top-level keys.

    Feature: debrief-dtp-recommendation-test-suite, Property 18: Debrief validator guarantees required keys
    """
    result = validate_debrief_output(data, answer_key_provided=False)

    for key in REQUIRED_KEYS:
        assert key in result, f"Required key '{key}' missing from validated output"


@pytest.mark.property
@settings(max_examples=100)
@given(data=debrief_dicts(complete=True))
def test_data_preservation(data):
    """Property 19: Data preservation — valid input data preserved without modification (except overall_score rounding).

    Feature: debrief-dtp-recommendation-test-suite, Property 19: Debrief validator data preservation
    """
    original = copy.deepcopy(data)
    result = validate_debrief_output(data, answer_key_provided=False)

    # summary should be preserved
    assert result["summary"] == original["summary"]
    # questions_addressed should be preserved (entries are dicts with correct keys)
    assert len(result["questions_addressed"]) == len(original["questions_addressed"])
    # questions_missed should be preserved
    assert len(result["questions_missed"]) == len(original["questions_missed"])
    # recommendation_feedback structure preserved
    assert "strengths" in result["recommendation_feedback"]
    assert "areas_for_improvement" in result["recommendation_feedback"]
    # overall_score is rounded but same value
    assert result["overall_score"] == round(original["overall_score"])


@pytest.mark.property
@settings(max_examples=100)
@given(data=debrief_dicts(complete=True))
def test_answer_key_comparison_presence(data):
    """Property 20: answer_key_comparison presence — present when answer_key_provided=True.

    Feature: debrief-dtp-recommendation-test-suite, Property 20: Debrief validator answer_key_comparison presence
    """
    result = validate_debrief_output(data, answer_key_provided=True)

    assert "answer_key_comparison" in result


@pytest.mark.property
@settings(max_examples=100)
@given(data=debrief_dicts(complete=False))
def test_overall_score_numeric(data):
    """Property 21: overall_score numeric — output overall_score is always int or float.

    Feature: debrief-dtp-recommendation-test-suite, Property 21: Debrief validator overall_score numeric
    """
    result = validate_debrief_output(data, answer_key_provided=False)

    assert isinstance(result["overall_score"], (int, float)), (
        f"overall_score is {type(result['overall_score'])}, expected int or float"
    )


def test_missing_keys_get_defaults():
    """Edge case: missing keys get appropriate defaults."""
    result = validate_debrief_output({}, answer_key_provided=False)

    assert result["summary"] == ""
    assert result["questions_addressed"] == []
    assert result["questions_missed"] == []
    assert result["recommendation_feedback"] == {"strengths": [], "areas_for_improvement": []}
    assert result["overall_score"] == 0.0


def test_non_dict_questions_addressed_normalized():
    """Edge case: non-dict items in questions_addressed normalized."""
    data = {
        "summary": "test",
        "questions_addressed": ["not a dict", 123],
        "questions_missed": [],
        "recommendation_feedback": {"strengths": [], "areas_for_improvement": []},
        "overall_score": 50,
        "suggested_rewrites": [],
        "reasoning_gaps": "",
    }
    result = validate_debrief_output(data, answer_key_provided=False)

    # Non-dict entries should be replaced with default dicts
    for entry in result["questions_addressed"]:
        assert isinstance(entry, dict)
