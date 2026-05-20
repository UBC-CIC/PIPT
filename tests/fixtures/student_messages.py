"""
Realistic student messages categorized by interaction phase.

These messages simulate what pharmacy students would say during a clinical
patient consultation, covering all major interaction phases.
"""

STUDENT_MESSAGES = {
    "Introduction": [
        "Hi, my name is Sarah and I'm a pharmacy student. I'll be helping you today with your medications.",
        "Good morning! I'm a fourth-year pharmacy student. How are you doing today?",
        "Hello, I'm here to talk with you about your health and medications. Is that okay?",
    ],
    "Other_ID": [
        "Can you confirm your date of birth for me?",
        "What is your full name and date of birth?",
        "Could you verify your identity — name and date of birth please?",
    ],
    "CC": [
        "What brings you in today?",
        "What's the main reason for your visit?",
        "How can I help you today? What concerns do you have?",
        "Tell me about what's been bothering you.",
    ],
    "HPI": [
        "When did your symptoms first start?",
        "How long have you been experiencing this?",
        "Has this gotten worse over time or stayed about the same?",
        "Can you walk me through what happened leading up to this?",
    ],
    "MACS": [
        "Do you have any allergies to medications?",
        "Are you allergic to anything — medications, foods, or environmental allergens?",
        "Have you ever had a bad reaction to any medication in the past?",
    ],
    "SCHOLAR": [
        "Can you describe the severity of your pain on a scale of 1 to 10?",
        "Where exactly is the pain located?",
        "Does anything make it better or worse?",
        "How often does this happen — is it constant or does it come and go?",
    ],
    "Drug_Counselling": [
        "Are you currently taking any medications, including over-the-counter ones?",
        "What medications are you on right now?",
        "Do you take any supplements or herbal products?",
        "How are you taking your metformin — with food or on an empty stomach?",
    ],
    "Non_pharm": [
        "Have you tried any lifestyle changes to help manage your condition?",
        "Are you getting regular exercise?",
        "What does your diet look like? Are you watching your salt intake?",
    ],
    "Adherence": [
        "Are you taking your medications as prescribed?",
        "Do you ever miss doses or forget to take your medication?",
        "How often would you say you miss a dose in a typical week?",
    ],
    "Monitoring": [
        "When was your last blood pressure reading?",
        "Are you monitoring your blood sugar at home?",
        "Have you had any recent lab work done?",
    ],
    "Follow_up": [
        "When is your next appointment with your doctor?",
        "Do you have any other questions for me before we wrap up?",
        "Is there anything else I can help you with today?",
    ],
}
