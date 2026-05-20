"""
Test fixtures module — realistic student interaction data for pipeline testing.
"""
from .student_messages import STUDENT_MESSAGES
from .dtp_submissions import DTP_SUBMISSIONS
from .recommendation_submissions import RECOMMENDATION_SUBMISSIONS
from .instructor_items import INSTRUCTOR_DTPS, INSTRUCTOR_RECOMMENDATIONS
from .key_questions import KEY_QUESTIONS

__all__ = [
    "STUDENT_MESSAGES",
    "DTP_SUBMISSIONS",
    "RECOMMENDATION_SUBMISSIONS",
    "INSTRUCTOR_DTPS",
    "INSTRUCTOR_RECOMMENDATIONS",
    "KEY_QUESTIONS",
]
