"""
Instructor-defined expected DTPs and recommendations with metadata.

These represent the 'answer key' that student submissions are matched against.
"""

INSTRUCTOR_DTPS = [
    {
        "dtp_id": "dtp-001",
        "title": "Beta-blocker/Asthma Contraindication",
        "expected_dtp_text": "Patient is taking atenolol (beta-blocker) which is contraindicated in asthma. Beta-blockers can cause bronchospasm and worsen respiratory symptoms in asthmatic patients.",
        "clinical_intent": "Identify beta-blocker/asthma drug-disease contraindication",
        "evaluation_criteria": "Student identifies the specific drug-disease interaction between atenolol and asthma",
    },
    {
        "dtp_id": "dtp-002",
        "title": "Hyperkalemia Risk",
        "expected_dtp_text": "Patient is on lisinopril (ACE inhibitor) with potassium supplementation and has reduced renal function (eGFR 45). This combination creates significant hyperkalemia risk.",
        "clinical_intent": "Identify hyperkalemia risk from ACE inhibitor + potassium + renal impairment",
        "evaluation_criteria": "Student identifies the drug-drug-disease interaction leading to hyperkalemia risk",
    },
    {
        "dtp_id": "dtp-003",
        "title": "NSAID-Anticoagulant Interaction",
        "expected_dtp_text": "Patient is taking ibuprofen (NSAID) concurrently with warfarin (anticoagulant). NSAIDs increase bleeding risk through antiplatelet effects and GI mucosal damage.",
        "clinical_intent": "Identify NSAID-warfarin drug-drug interaction increasing bleeding risk",
        "evaluation_criteria": "Student identifies the increased bleeding risk from concurrent NSAID and anticoagulant use",
    },
]

INSTRUCTOR_RECOMMENDATIONS = [
    {
        "recommendation_id": "rec-001",
        "title": "Switch Beta-blocker to CCB",
        "recommendation_text": "Discontinue atenolol and initiate amlodipine 5mg daily for blood pressure management. Calcium channel blockers are safe in asthma and provide effective antihypertensive therapy.",
        "evaluation_criteria": "Student recommends discontinuing the beta-blocker and switching to an appropriate alternative antihypertensive",
        "rationale": "Beta-blockers are contraindicated in asthma; CCBs provide equivalent BP control without respiratory risk",
    },
    {
        "recommendation_id": "rec-002",
        "title": "Discontinue Potassium Supplement",
        "recommendation_text": "Discontinue potassium chloride supplement and monitor serum potassium within 1 week. ACE inhibitors already promote potassium retention, making supplementation dangerous in renal impairment.",
        "evaluation_criteria": "Student recommends stopping potassium supplementation and monitoring levels",
        "rationale": "ACE inhibitors cause potassium retention; supplementation with reduced renal clearance creates hyperkalemia risk",
    },
    {
        "recommendation_id": "rec-003",
        "title": "Switch NSAID to Acetaminophen",
        "recommendation_text": "Discontinue ibuprofen and switch to acetaminophen 650mg every 6 hours as needed for joint pain. Schedule INR monitoring within 3-5 days to ensure warfarin stability.",
        "evaluation_criteria": "Student recommends a safer analgesic alternative and appropriate monitoring",
        "rationale": "Acetaminophen provides analgesia without antiplatelet effects or GI mucosal damage that increase bleeding risk with warfarin",
    },
]
