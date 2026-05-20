"""
Property-based tests for JSON extraction round-trip.

Feature: debrief-dtp-recommendation-test-suite
Properties 25-26: Round-trip, leading text robustness.

Note: _extract_json is a nested function in generate_debrief/generate_test_debrief.
We replicate its exact logic here for testing since it cannot be imported directly.
"""
import json
import re
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from test_support import json_serializable_dicts


def _extract_json(raw: str) -> dict:
    """Replicate the _extract_json logic from chat.py for testing."""
    cleaned = raw.strip()
    cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
    cleaned = re.sub(r'\n?\s*```\s*$', '', cleaned)
    cleaned = cleaned.strip()
    if not cleaned.startswith('{'):
        first_brace = cleaned.find('{')
        if first_brace != -1:
            cleaned = cleaned[first_brace:]
    if not cleaned.endswith('}'):
        last_brace = cleaned.rfind('}')
        if last_brace != -1:
            cleaned = cleaned[:last_brace + 1]
    return json.loads(cleaned)


@pytest.mark.property
@settings(max_examples=100)
@given(data=json_serializable_dicts())
def test_round_trip_markdown_fences(data):
    """Property 25: Round-trip — JSON in markdown fences extracts correctly.

    Feature: debrief-dtp-recommendation-test-suite, Property 25: JSON extraction round-trip
    """
    # Wrap in markdown code fences
    raw = f"```json\n{json.dumps(data)}\n```"
    result = _extract_json(raw)
    assert result == data


@pytest.mark.property
@settings(max_examples=100)
@given(data=json_serializable_dicts())
def test_round_trip_raw_json(data):
    """Property 25: Round-trip — raw JSON extracts correctly.

    Feature: debrief-dtp-recommendation-test-suite, Property 25: JSON extraction round-trip
    """
    raw = json.dumps(data)
    result = _extract_json(raw)
    assert result == data


@pytest.mark.property
@settings(max_examples=100)
@given(data=json_serializable_dicts())
def test_round_trip_whitespace_padded(data):
    """Property 25: Round-trip — whitespace-padded JSON extracts correctly.

    Feature: debrief-dtp-recommendation-test-suite, Property 25: JSON extraction round-trip
    """
    raw = f"   \n  {json.dumps(data)}  \n   "
    result = _extract_json(raw)
    assert result == data


@pytest.mark.property
@settings(max_examples=100)
@given(
    data=json_serializable_dicts(),
    leading_text=st.text(
        alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "Z"),
            blacklist_characters="{}"
        ),
        min_size=1,
        max_size=50,
    ),
)
def test_leading_text_robustness(data, leading_text):
    """Property 26: Leading text robustness — non-JSON text before { does not prevent extraction.

    Feature: debrief-dtp-recommendation-test-suite, Property 26: JSON extraction leading text robustness
    """
    # Ensure leading text doesn't contain braces
    assume("{" not in leading_text and "}" not in leading_text)
    raw = f"{leading_text}{json.dumps(data)}"
    result = _extract_json(raw)
    assert result == data


def test_non_json_input_raises_error():
    """Edge case: non-JSON input raises appropriate error."""
    with pytest.raises(json.JSONDecodeError):
        _extract_json("this is not json at all")
