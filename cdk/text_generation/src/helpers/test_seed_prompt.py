"""Unit tests for seed_prompt utility."""

import pytest
from seed_prompt import seed_prompt


DEFAULT_PROMPT = "This is the default prompt."


class TestSeedPrompt:
    """Tests for seed_prompt function."""

    def test_returns_default_when_value_is_none(self):
        assert seed_prompt(None, DEFAULT_PROMPT) == DEFAULT_PROMPT

    def test_returns_default_when_value_is_empty_string(self):
        assert seed_prompt("", DEFAULT_PROMPT) == DEFAULT_PROMPT

    def test_returns_default_when_value_is_whitespace_only(self):
        assert seed_prompt("   ", DEFAULT_PROMPT) == DEFAULT_PROMPT
        assert seed_prompt("\t\n", DEFAULT_PROMPT) == DEFAULT_PROMPT

    def test_returns_value_when_non_empty(self):
        custom = "You are a helpful patient."
        assert seed_prompt(custom, DEFAULT_PROMPT) == custom

    def test_returns_value_with_leading_trailing_whitespace(self):
        custom = "  Some prompt with spaces  "
        assert seed_prompt(custom, DEFAULT_PROMPT) == custom
