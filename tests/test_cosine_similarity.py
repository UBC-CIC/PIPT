"""
Property-based tests for compute_cosine_similarity.

Feature: debrief-dtp-recommendation-test-suite
Properties 1-4: Cosine similarity bounded range, self-similarity, symmetry, negation.
"""
import pytest
from hypothesis import given, settings
from test_support import non_zero_vectors, compute_cosine_similarity

TOLERANCE = 1e-9


@pytest.mark.property
@settings(max_examples=100)
@given(vec=non_zero_vectors(dim=50))
def test_bounded_range(vec):
    """Property 1: Bounded range — result in [-1.0, 1.0] for all non-zero vector pairs.

    Feature: debrief-dtp-recommendation-test-suite, Property 1: Cosine similarity bounded range
    """
    # Use the vector against a shifted version to get a general pair
    other = [v + 0.1 for v in vec]
    result = compute_cosine_similarity(vec, other)
    assert -1.0 - TOLERANCE <= result <= 1.0 + TOLERANCE


@pytest.mark.property
@settings(max_examples=100)
@given(vec=non_zero_vectors(dim=50))
def test_self_similarity(vec):
    """Property 2: Self-similarity — compute_cosine_similarity(v, v) == 1.0.

    Feature: debrief-dtp-recommendation-test-suite, Property 2: Cosine similarity self-similarity
    """
    result = compute_cosine_similarity(vec, vec)
    assert abs(result - 1.0) < TOLERANCE


@pytest.mark.property
@settings(max_examples=100)
@given(a=non_zero_vectors(dim=50), b=non_zero_vectors(dim=50))
def test_symmetry(a, b):
    """Property 3: Symmetry — similarity(a, b) == similarity(b, a).

    Feature: debrief-dtp-recommendation-test-suite, Property 3: Cosine similarity symmetry
    """
    result_ab = compute_cosine_similarity(a, b)
    result_ba = compute_cosine_similarity(b, a)
    assert abs(result_ab - result_ba) < TOLERANCE


@pytest.mark.property
@settings(max_examples=100)
@given(vec=non_zero_vectors(dim=50))
def test_negation(vec):
    """Property 4: Negation — compute_cosine_similarity(v, -v) == -1.0.

    Feature: debrief-dtp-recommendation-test-suite, Property 4: Cosine similarity negation
    """
    neg_vec = [-v for v in vec]
    result = compute_cosine_similarity(vec, neg_vec)
    assert abs(result - (-1.0)) < TOLERANCE


def test_zero_vector_returns_zero():
    """Edge case: zero vector returns 0.0."""
    zero = [0.0] * 50
    non_zero = [1.0] * 50
    assert compute_cosine_similarity(zero, non_zero) == 0.0
    assert compute_cosine_similarity(non_zero, zero) == 0.0
    assert compute_cosine_similarity(zero, zero) == 0.0
