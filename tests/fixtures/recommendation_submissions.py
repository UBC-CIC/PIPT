"""
Student recommendation submissions at varying quality levels.

Includes strong recommendations with rationale, weak recommendations
without rationale, and incorrect recommendations.
"""

RECOMMENDATION_SUBMISSIONS = {
    "strong": [
        {
            "text": "I recommend discontinuing atenolol and switching to a calcium channel blocker such as amlodipine 5mg daily for blood pressure management, as beta-blockers are contraindicated in asthma. This avoids bronchospasm while maintaining adequate BP control.",
            "quality": "strong",
        },
        {
            "text": "I recommend discontinuing the potassium supplement and monitoring serum potassium levels within 1 week. The combination of lisinopril with potassium supplementation in a patient with eGFR 45 creates unacceptable hyperkalemia risk.",
            "quality": "strong",
        },
        {
            "text": "I recommend switching from ibuprofen to acetaminophen 650mg every 6 hours for joint pain management. The concurrent use of NSAIDs with warfarin significantly increases GI bleeding risk. The patient should also have an INR check within 3 days.",
            "quality": "strong",
        },
    ],
    "weak": [
        {
            "text": "Maybe switch the beta-blocker to something else.",
            "quality": "weak",
        },
        {
            "text": "Stop the potassium supplement.",
            "quality": "weak",
        },
        {
            "text": "Change the pain medication to something safer.",
            "quality": "weak",
        },
    ],
    "incorrect": [
        {
            "text": "I recommend increasing the atenolol dose to 100mg for better blood pressure control.",
            "quality": "incorrect",
        },
        {
            "text": "I recommend adding another NSAID like naproxen for better pain relief.",
            "quality": "incorrect",
        },
        {
            "text": "The patient should take their warfarin with ibuprofen to reduce inflammation.",
            "quality": "incorrect",
        },
    ],
}
