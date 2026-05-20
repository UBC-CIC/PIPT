"""
Student DTP (Drug Therapy Problem) submissions at varying quality levels.

Each submission has a 'text' field (what the student wrote) and a 'quality'
field indicating the level of clinical reasoning demonstrated.
"""

DTP_SUBMISSIONS = {
    "complete": [
        {
            "text": "The patient is currently taking atenolol (a beta-blocker) which is contraindicated in patients with asthma. This represents a drug-disease interaction that could worsen the patient's respiratory symptoms.",
            "quality": "complete",
        },
        {
            "text": "Patient is on both lisinopril and potassium supplements without regular monitoring. This creates a risk of hyperkalemia, especially given the patient's reduced renal function (eGFR 45).",
            "quality": "complete",
        },
        {
            "text": "The patient reports taking ibuprofen daily for joint pain while also on warfarin. This NSAID-anticoagulant combination significantly increases bleeding risk and represents a drug-drug interaction.",
            "quality": "complete",
        },
    ],
    "partial": [
        {
            "text": "I think there might be a drug interaction with the beta-blocker.",
            "quality": "partial",
        },
        {
            "text": "The potassium levels could be a problem with the current medications.",
            "quality": "partial",
        },
        {
            "text": "There's a possible issue with the pain medication and blood thinner.",
            "quality": "partial",
        },
    ],
    "incorrect": [
        {
            "text": "The patient needs more vitamin C supplementation to improve their immune system.",
            "quality": "incorrect",
        },
        {
            "text": "I think the patient should switch to a higher dose of their current medication for better results.",
            "quality": "incorrect",
        },
        {
            "text": "The patient's headache is probably from not drinking enough water.",
            "quality": "incorrect",
        },
    ],
}
