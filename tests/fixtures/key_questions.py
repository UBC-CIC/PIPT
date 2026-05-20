"""
Key questions with metadata for testing question matching and scoring.

Each question includes question_id, question_text, evaluation_criteria,
is_mandatory flag, and weight for scoring.
"""

KEY_QUESTIONS = [
    {
        "question_id": "q-001",
        "question_text": "What medications are you currently taking?",
        "evaluation_criteria": "Student asks about current medication list including prescription, OTC, and supplements",
        "is_mandatory": True,
        "weight": 2.0,
    },
    {
        "question_id": "q-002",
        "question_text": "Do you have any allergies to medications?",
        "evaluation_criteria": "Student inquires about drug allergies and adverse reactions",
        "is_mandatory": True,
        "weight": 2.0,
    },
    {
        "question_id": "q-003",
        "question_text": "What brings you in today?",
        "evaluation_criteria": "Student identifies the chief complaint or reason for visit",
        "is_mandatory": True,
        "weight": 1.5,
    },
    {
        "question_id": "q-004",
        "question_text": "When did your symptoms first start?",
        "evaluation_criteria": "Student establishes timeline and onset of symptoms",
        "is_mandatory": False,
        "weight": 1.0,
    },
    {
        "question_id": "q-005",
        "question_text": "Are you taking your medications as prescribed?",
        "evaluation_criteria": "Student assesses medication adherence and identifies barriers",
        "is_mandatory": False,
        "weight": 1.5,
    },
    {
        "question_id": "q-006",
        "question_text": "Have you tried any lifestyle changes to manage your condition?",
        "evaluation_criteria": "Student explores non-pharmacological interventions and lifestyle modifications",
        "is_mandatory": False,
        "weight": 1.0,
    },
    {
        "question_id": "q-007",
        "question_text": "Are you monitoring your blood pressure at home?",
        "evaluation_criteria": "Student asks about self-monitoring practices and recent readings",
        "is_mandatory": False,
        "weight": 1.0,
    },
    {
        "question_id": "q-008",
        "question_text": "When is your next follow-up appointment?",
        "evaluation_criteria": "Student establishes follow-up plan and continuity of care",
        "is_mandatory": False,
        "weight": 0.5,
    },
]
