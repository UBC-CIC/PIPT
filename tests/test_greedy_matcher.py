"""
Property-based tests for greedy_match_assignment.

Feature: debrief-dtp-recommendation-test-suite
Properties 5-9: Student completeness, instructor completeness, one-to-one,
threshold constraint, descending order.
"""
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from test_support import similarity_matrices, greedy_match_assignment


@pytest.mark.property
@settings(max_examples=100)
@given(data=similarity_matrices())
def test_student_completeness(data):
    """Property 5: Student completeness — matched student indices + additional == {0..num_students-1}.

    Feature: debrief-dtp-recommendation-test-suite, Property 5: Greedy matcher student completeness
    """
    pairs, num_students, num_instructors = data
    threshold = 0.55

    matched_pairs, missed_instructors, additional_students = greedy_match_assignment(
        pairs, num_students, num_instructors, threshold
    )

    matched_student_indices = {s_idx for s_idx, _, _ in matched_pairs}
    all_students = matched_student_indices | additional_students
    assert all_students == set(range(num_students))


@pytest.mark.property
@settings(max_examples=100)
@given(data=similarity_matrices())
def test_instructor_completeness(data):
    """Property 6: Instructor completeness — matched instructor indices + missed == {0..num_instructors-1}.

    Feature: debrief-dtp-recommendation-test-suite, Property 6: Greedy matcher instructor completeness
    """
    pairs, num_students, num_instructors = data
    threshold = 0.55

    matched_pairs, missed_instructors, additional_students = greedy_match_assignment(
        pairs, num_students, num_instructors, threshold
    )

    matched_instructor_indices = {i_idx for _, i_idx, _ in matched_pairs}
    all_instructors = matched_instructor_indices | missed_instructors
    assert all_instructors == set(range(num_instructors))


@pytest.mark.property
@settings(max_examples=100)
@given(data=similarity_matrices())
def test_one_to_one_assignment(data):
    """Property 7: One-to-one — no student or instructor index appears more than once.

    Feature: debrief-dtp-recommendation-test-suite, Property 7: Greedy matcher one-to-one assignment
    """
    pairs, num_students, num_instructors = data
    threshold = 0.55

    matched_pairs, _, _ = greedy_match_assignment(
        pairs, num_students, num_instructors, threshold
    )

    student_indices = [s_idx for s_idx, _, _ in matched_pairs]
    instructor_indices = [i_idx for _, i_idx, _ in matched_pairs]

    assert len(student_indices) == len(set(student_indices)), "Duplicate student index in matched pairs"
    assert len(instructor_indices) == len(set(instructor_indices)), "Duplicate instructor index in matched pairs"


@pytest.mark.property
@settings(max_examples=100)
@given(data=similarity_matrices())
def test_threshold_constraint(data):
    """Property 8: Threshold constraint — all matched pairs have score >= threshold.

    Feature: debrief-dtp-recommendation-test-suite, Property 8: Greedy matcher threshold constraint
    """
    pairs, num_students, num_instructors = data
    threshold = 0.55

    matched_pairs, _, _ = greedy_match_assignment(
        pairs, num_students, num_instructors, threshold
    )

    for s_idx, i_idx, score in matched_pairs:
        assert score >= threshold, f"Matched pair ({s_idx}, {i_idx}) has score {score} < threshold {threshold}"


@pytest.mark.property
@settings(max_examples=100)
@given(data=similarity_matrices())
def test_descending_order(data):
    """Property 9: Descending order — matched pairs ordered by descending similarity score.

    Feature: debrief-dtp-recommendation-test-suite, Property 9: Greedy matcher descending order
    """
    pairs, num_students, num_instructors = data
    threshold = 0.55

    matched_pairs, _, _ = greedy_match_assignment(
        pairs, num_students, num_instructors, threshold
    )

    scores = [score for _, _, score in matched_pairs]
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1], (
            f"Matched pairs not in descending order: {scores[i]} < {scores[i + 1]}"
        )


def test_threshold_1_no_perfect_scores():
    """Edge case: threshold=1.0 with no perfect scores returns zero matches."""
    pairs = [(0, 0, 0.99), (0, 1, 0.8), (1, 0, 0.7), (1, 1, 0.6)]
    matched, missed, additional = greedy_match_assignment(
        pairs, num_students=2, num_instructors=2, threshold=1.0
    )
    assert len(matched) == 0
    assert missed == {0, 1}
    assert additional == {0, 1}
