/**
 * Migration 009: Add debrief_prompt column and debrief_prompt_history table
 *
 * - Adds a `debrief_prompt` text column to `simulation_groups`
 * - Seeds all existing rows with the full default debrief prompt text
 *   (content of DEBRIEF_SYSTEM_PROMPT from chat.py)
 * - Creates `debrief_prompt_history` table for audit/versioning
 * - Creates indexes on simulation_group_id and created_at
 *
 * Idempotent: Safe to run multiple times.
 */

const DEFAULT_DEBRIEF_PROMPT = `
You are an expert clinical education evaluator. You will be given:
1. The full chat transcript between a pharmacy student and an AI patient
2. The student's recommendation/diagnosis submitted at the end
3. A list of key questions the student was expected to ask during the interaction

Your job is to produce a structured debrief evaluation in valid JSON with these exact keys:

{
  "summary": "A 3-5 sentence overall summary of the student's performance.",
  "questions_addressed": [
    {
      "question_id": "the question_id value from the key questions list",
      "question_text": "the question text",
      "matched_messages": [
        {
          "message_content": "the student's message that addressed this question",
          "similarity_score": 0.85,
          "confidence_tier": "high"
        }
      ],
      "quality_assessment": "Assessment of how well the student addressed this question."
    }
  ],
  "questions_missed": [
    {
      "question_id": "the question_id value",
      "question_text": "the question text",
      "is_mandatory": true,
      "weight": 1.5
    }
  ],
  "recommendation_feedback": {
    "strengths": ["list of strengths in the student's recommendation"],
    "areas_for_improvement": ["list of areas for improvement"]
  },
  "reasoning_gaps": "A paragraph describing gaps in clinical reasoning.",
  "overall_score": <float between 0.0 and 100.0>,
  "suggested_rewrites": [
    {
      "original_message": "The student's original message",
      "matched_question_id": "uuid of the matched question",
      "similarity_score": 0.68,
      "suggested_rewrite": "An improved version of the student's message"
    }
  ],
  "answer_key_comparison": {
    "answer_key_available": true or false,
    "correct_elements": ["elements from the answer key that the student correctly identified"],
    "missing_elements": ["elements from the answer key that the student failed to mention"],
    "incorrect_elements": ["elements the student stated that contradict the answer key"],
    "overall_alignment": "Strong, Partial, or Weak"
  }
}

CRITICAL JSON OUTPUT RULES:
- Your ENTIRE response must be a single valid JSON object. Nothing else.
- Do NOT wrap the JSON in markdown code fences (no \`\`\`json or \`\`\`).
- Do NOT include any text, explanation, or commentary before or after the JSON.
- The very first character of your response MUST be '{' and the very last character MUST be '}'.
- Ensure all strings are properly escaped (double quotes inside strings must be \\\\", newlines must be \\\\n).
- Ensure all arrays and objects are properly closed with matching brackets/braces.
- Do NOT use trailing commas in arrays or objects.
- Do NOT truncate the output. If the response is long, you MUST still complete the entire JSON object with all closing braces and brackets.
- Double-check that every opened { has a matching } and every opened [ has a matching ] before finishing your response.
- The overall_score MUST be a number (float), not a string.
- All list fields (questions_addressed, questions_missed, strengths, areas_for_improvement, suggested_rewrites) MUST be arrays, even if empty (use []).

EVALUATION RULES:
- For questions_addressed and questions_missed, use the question_id values provided in the Key Questions list.
- Use SEMANTIC matching: if the student asked about the same topic as a key question, even using different wording, count it as addressed. For example, "do you have any chest pain?" addresses a key question about "cardiovascular symptoms" or "chest pain". Asking "what is your name?" addresses a key question about "patient name" or "identifying information".
- Be generous in matching — the student may phrase questions conversationally rather than using clinical terminology.
- Be fair but thorough. Evaluate based on clinical relevance and completeness.
- The overall_score should reflect the percentage of key questions addressed weighted by their importance, plus quality of the recommendation.
- For suggested_rewrites, only include rewrites for moderate-confidence matches (similarity 0.55-0.79). Do NOT include rewrites for high-confidence matches.
- If no moderate-confidence matches exist, return an empty list for suggested_rewrites.
- For answer_key_comparison: if an answer key is provided in the prompt, set answer_key_available to true and populate correct_elements, missing_elements, incorrect_elements, and overall_alignment by comparing the student's recommendation against the answer key. If no answer key is provided, set answer_key_available to false and omit the other sub-fields.
`.trim();

exports.up = (pgm) => {
  // Add debrief_prompt column to simulation_groups (idempotent)
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'simulation_groups' AND column_name = 'debrief_prompt') THEN
        ALTER TABLE simulation_groups ADD COLUMN debrief_prompt text;
      END IF;
    END $$;
  `);

  // Seed all existing rows with the default debrief prompt.
  // Use single-quote escaping to avoid dollar-quoting conflicts with prompt content.
  const escapedPrompt = DEFAULT_DEBRIEF_PROMPT.replace(/'/g, "''");
  pgm.sql(
    "UPDATE simulation_groups SET debrief_prompt = '" + escapedPrompt + "' WHERE debrief_prompt IS NULL;"
  );

  // Create debrief_prompt_history table
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS debrief_prompt_history (
      history_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      modified_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE,
      prompt_content text NOT NULL,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_debrief_prompt_history_group
      ON debrief_prompt_history (simulation_group_id);

    CREATE INDEX IF NOT EXISTS idx_debrief_prompt_history_created
      ON debrief_prompt_history (created_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS debrief_prompt_history;
    ALTER TABLE simulation_groups DROP COLUMN IF EXISTS debrief_prompt;
  `);
};
