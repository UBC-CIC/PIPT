"""
Shared test helpers — re-exports from conftest for use in test modules.

Since conftest.py cannot be imported directly as a module in pytest,
this module provides access to the target functions and custom strategies.
"""
import sys
import os

# Ensure path is set up
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_HELPERS_PATH = os.path.join(_REPO_ROOT, "cdk", "text_generation", "src", "helpers")
_SRC_PATH = os.path.join(_REPO_ROOT, "cdk", "text_generation", "src")

if _HELPERS_PATH not in sys.path:
    sys.path.insert(0, _HELPERS_PATH)
if _SRC_PATH not in sys.path:
    sys.path.insert(0, _SRC_PATH)

# Import target functions
try:
    # Mock unavailable dependencies before importing chat.py
    import types
    _mock_modules = [
        "psycopg", "boto3", "langchain_aws", "langchain_core",
        "langchain_core.prompts", "langchain_core.runnables",
        "langchain_core.runnables.history", "langchain_core.messages",
        "langchain_classic", "langchain_classic.chains",
        "langchain_classic.chains.combine_documents",
        "langchain_community", "langchain_community.chat_message_histories",
        "pydantic",
    ]
    for mod_name in _mock_modules:
        if mod_name not in sys.modules:
            mock_mod = types.ModuleType(mod_name)
            # Add common attributes that chat.py expects
            mock_mod.BaseModel = type("BaseModel", (), {})
            mock_mod.Field = lambda **kwargs: None
            mock_mod.ChatBedrock = type("ChatBedrock", (), {})
            mock_mod.ChatPromptTemplate = type("ChatPromptTemplate", (), {})
            mock_mod.MessagesPlaceholder = type("MessagesPlaceholder", (), {})
            mock_mod.create_stuff_documents_chain = lambda *a, **kw: None
            mock_mod.create_retrieval_chain = lambda *a, **kw: None
            mock_mod.RunnableWithMessageHistory = type("RunnableWithMessageHistory", (), {})
            mock_mod.DynamoDBChatMessageHistory = type("DynamoDBChatMessageHistory", (), {})
            sys.modules[mod_name] = mock_mod

    from chat import (
        compute_cosine_similarity,
        greedy_match_assignment,
        match_submissions,
        are_clinically_contradictory,
        compute_section_scores,
        compute_overall_score,
        validate_debrief_output,
        SUBMISSION_MATCH_THRESHOLD,
    )
    CHAT_AVAILABLE = True
except ImportError as e:
    CHAT_AVAILABLE = False
    compute_cosine_similarity = None
    greedy_match_assignment = None
    match_submissions = None
    are_clinically_contradictory = None
    compute_section_scores = None
    compute_overall_score = None
    validate_debrief_output = None
    SUBMISSION_MATCH_THRESHOLD = 0.55

# Import MockEmbeddingsModel and strategies
import math
import hashlib
import struct
from hypothesis import strategies as st


class MockEmbeddingsModel:
    """Deterministic mock for CohereBedrockEmbeddings.

    Supports two modes:
    1. Hash-based: Generates deterministic vectors from text content via hashing.
    2. Lookup-based: Returns pre-configured vectors for specific texts.
    """

    def __init__(self, dimension: int = 1024, lookup: dict | None = None):
        self.dimension = dimension
        self.lookup = lookup or {}

    def _hash_to_vector(self, text: str) -> list[float]:
        """Generate a deterministic unit vector from text via SHA-256 hashing."""
        raw_bytes = b""
        seed = text.encode("utf-8")
        while len(raw_bytes) < self.dimension * 4:
            seed = hashlib.sha256(seed).digest()
            raw_bytes += seed

        vec = []
        for i in range(self.dimension):
            val = struct.unpack_from(">i", raw_bytes, i * 4)[0]
            vec.append(val / (2**31))

        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Batch embed — matches CohereBedrockEmbeddings interface."""
        return [self._embed_single(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        """Single embed — matches CohereBedrockEmbeddings interface."""
        return self._embed_single(text)

    def _embed_single(self, text: str) -> list[float]:
        """Embed a single text, using lookup if available, else hash-based."""
        if text in self.lookup:
            return self.lookup[text]
        return self._hash_to_vector(text)


# ---------------------------------------------------------------------------
# Hypothesis custom strategies
# ---------------------------------------------------------------------------

@st.composite
def non_zero_vectors(draw, dim=50):
    """Generate float vectors with at least one non-zero element."""
    d = dim
    vec = draw(
        st.lists(
            st.floats(min_value=-1e3, max_value=1e3, allow_nan=False, allow_infinity=False),
            min_size=d,
            max_size=d,
        )
    )
    # Ensure the vector has meaningful magnitude (not effectively zero)
    norm_sq = sum(v * v for v in vec)
    if norm_sq < 1e-10:
        idx = draw(st.integers(min_value=0, max_value=d - 1))
        vec[idx] = draw(
            st.floats(min_value=1.0, max_value=1e3, allow_nan=False, allow_infinity=False)
        )
    return vec


@st.composite
def similarity_matrices(draw, num_students=None, num_instructors=None):
    """Generate valid similarity pair lists for greedy_match_assignment."""
    ns = num_students or draw(st.integers(min_value=1, max_value=8))
    ni = num_instructors or draw(st.integers(min_value=1, max_value=8))
    pairs = []
    for s_idx in range(ns):
        for i_idx in range(ni):
            score = draw(st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
            pairs.append((s_idx, i_idx, score))
    return pairs, ns, ni


@st.composite
def key_question_lists(draw, min_size=1, max_size=10):
    """Generate lists of key question dicts with valid metadata."""
    size = draw(st.integers(min_value=min_size, max_value=max_size))
    questions = []
    for i in range(size):
        questions.append({
            "question_id": f"q-{i:03d}",
            "question_text": draw(st.text(min_size=5, max_size=100)),
            "evaluation_criteria": draw(st.text(min_size=5, max_size=100)),
            "is_mandatory": draw(st.booleans()),
            "weight": draw(st.floats(min_value=0.5, max_value=5.0, allow_nan=False, allow_infinity=False)),
        })
    return questions


@st.composite
def dtp_comparison_dicts(draw):
    """Generate valid dtp_comparison structures."""
    num_matched = draw(st.integers(min_value=0, max_value=5))
    num_missed = draw(st.integers(min_value=0, max_value=5))
    num_additional = draw(st.integers(min_value=0, max_value=5))

    matched = [
        {
            "student_text": f"student dtp {i}",
            "instructor_text": f"instructor dtp {i}",
            "instructor_id": f"dtp-{i:03d}",
            "score": draw(st.floats(min_value=0.55, max_value=1.0, allow_nan=False)),
        }
        for i in range(num_matched)
    ]
    missed = [
        {"instructor_text": f"missed dtp {i}", "instructor_id": f"dtp-missed-{i:03d}"}
        for i in range(num_missed)
    ]
    additional = [
        {"student_text": f"additional dtp {i}"}
        for i in range(num_additional)
    ]
    return {"matched": matched, "missed": missed, "additional": additional}


@st.composite
def rec_comparison_dicts(draw):
    """Generate valid rec_comparison structures."""
    num_matched = draw(st.integers(min_value=0, max_value=5))
    num_missed = draw(st.integers(min_value=0, max_value=5))
    num_additional = draw(st.integers(min_value=0, max_value=5))

    matched = [
        {
            "student_text": f"student rec {i}",
            "instructor_text": f"instructor rec {i}",
            "instructor_id": f"rec-{i:03d}",
            "score": draw(st.floats(min_value=0.55, max_value=1.0, allow_nan=False)),
        }
        for i in range(num_matched)
    ]
    missed = [
        {"instructor_text": f"missed rec {i}", "instructor_id": f"rec-missed-{i:03d}"}
        for i in range(num_missed)
    ]
    additional = [
        {"student_text": f"additional rec {i}"}
        for i in range(num_additional)
    ]
    return {"matched": matched, "missed": missed, "additional": additional}


@st.composite
def debrief_dicts(draw, complete=True):
    """Generate debrief output dicts (optionally with missing keys)."""
    base = {
        "summary": draw(st.text(min_size=0, max_size=200)),
        "questions_addressed": [
            {
                "question_id": f"q-{i:03d}",
                "question_text": f"Question {i}",
                "matched_messages": [f"message {i}"],
                "quality_assessment": "Good",
            }
            for i in range(draw(st.integers(min_value=0, max_value=3)))
        ],
        "questions_missed": [
            {
                "question_id": f"q-missed-{i:03d}",
                "question_text": f"Missed question {i}",
                "is_mandatory": draw(st.booleans()),
                "weight": 1.0,
            }
            for i in range(draw(st.integers(min_value=0, max_value=3)))
        ],
        "recommendation_feedback": {
            "strengths": [draw(st.text(min_size=1, max_size=50))],
            "areas_for_improvement": [draw(st.text(min_size=1, max_size=50))],
        },
        "reasoning_gaps": draw(st.text(min_size=0, max_size=100)),
        "overall_score": draw(st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)),
        "suggested_rewrites": [],
    }

    if not complete:
        keys_to_maybe_remove = ["summary", "reasoning_gaps", "suggested_rewrites", "overall_score"]
        for key in keys_to_maybe_remove:
            if draw(st.booleans()):
                del base[key]

    return base


@st.composite
def json_serializable_dicts(draw):
    """Generate arbitrary JSON-serializable dictionaries."""
    return draw(
        st.dictionaries(
            keys=st.text(
                alphabet=st.characters(whitelist_categories=("L", "N", "P")),
                min_size=1,
                max_size=20,
            ),
            values=st.one_of(
                st.text(max_size=50),
                st.integers(min_value=-1000, max_value=1000),
                st.floats(min_value=-1000, max_value=1000, allow_nan=False, allow_infinity=False),
                st.booleans(),
                st.none(),
                st.lists(st.integers(min_value=-100, max_value=100), max_size=5),
            ),
            min_size=1,
            max_size=8,
        )
    )
