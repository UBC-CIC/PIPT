# Debrief Prompt Guide

This guide explains how the debrief prompt works: where it lives, how it is
structured, what the admin/instructor actually controls through their prompt
text, and what is hardcoded in the backend regardless of what the prompt says.

If you only remember one thing: **the admin's debrief prompt is a *system
persona / instructions* layer, not the thing that defines the debrief data
structure.** The JSON schema, the scoring, and most of the pipeline are
hardcoded in the codebase. See [How much comes from the admin vs the
code](#how-much-comes-from-the-admin-vs-the-code) for the full breakdown.

---

## 1. Where the debrief prompt lives

| Layer | Location | Notes |
| --- | --- | --- |
| Per-group prompt (what the LLM sees) | `simulation_groups.debrief_prompt` column in Postgres | Fetched at debrief time by `fetch_debrief_prompt()` |
| Default/starter prompt | `cdk/.../defaultDebriefPrompt.txt` | Served to the UI via the `get_default_debrief_prompt` endpoint. Instructors can reset to this. |
| Editing UI | Admin/Instructor "Debrief Prompt" editor + `PromptPlayground` component | Calls `updateDebriefPrompt` → `PUT instructor/debrief_prompt` |
| Testing UI | `PromptPlayground` ("Test Debrief") | Runs `runTestDebrief` against a completed session with an ephemeral prompt — does not save |

Key backend entry points (all in `cdk/text_generation/src/helpers/chat.py`):

- `fetch_debrief_prompt(simulation_group_id)` — reads the prompt from the DB.
  **There is no fallback to a hardcoded constant.** If the column is `NULL` or
  empty, it raises `ValueError` and the debrief fails. A group must have a
  prompt configured.
- `generate_debrief(...)` — orchestrates the whole flow.
- `validate_debrief_output(...)` — repairs/normalizes the final JSON.

---

## 2. How the prompt is actually used at runtime

There are **two code paths** inside `generate_debrief()`, and the admin prompt
is used differently in each.

### Path A — Enhanced multi-step pipeline (the normal path)

Used when the session has **tagged messages** (messages that were already
embedding-matched to key questions during the chat). This is the current
production path for most sessions.

In this path the debrief is assembled from **several independent LLM sub-calls
plus deterministic computation**, not one big call:

| Step | Produced by | Uses admin prompt? |
| --- | --- | --- |
| `questions_addressed` / `questions_missed` | `build_questions_from_matched_data()` — deterministic, from embedding matches | ❌ No LLM |
| `overall_score` | `compute_overall_score()` — weighted formula | ❌ No LLM |
| `section_scores` | `compute_section_scores()` | ❌ No LLM |
| DTP / recommendation matching | `match_submissions()` — embeddings + greedy matcher | ❌ No LLM |
| `summary`, `recommendation_feedback`, `reasoning_gaps` | `build_summary_feedback_prompt()` → `_invoke_llm_json()` | ✅ **Yes — as SystemMessage** |
| `answer_key_comparison` | `build_answer_key_prompt()` → `_invoke_llm_json()` | ✅ **Yes — as SystemMessage** |
| `suggested_rewrites` | `generate_batch_rewrites()` | ❌ Hardcoded HumanMessage only |
| `guidance` questions | `generate_guidance_questions()` | ❌ Hardcoded HumanMessage only |

The admin prompt is passed as the **`SystemMessage`** inside `_invoke_llm_json()`:

```python
messages = [
    SystemMessage(content=debrief_prompt),   # <-- the admin's prompt text
    HumanMessage(content=prompt_text),        # <-- hardcoded task prompt w/ JSON schema
]
```

So in the enhanced path, the admin prompt only influences the **summary /
feedback** call and the **answer-key comparison** call. The actual JSON keys
requested in those calls come from the **hardcoded** `build_summary_feedback_prompt()`
and `build_answer_key_prompt()` HumanMessages — not from the admin's text.

> Note: `generate_batch_rewrites()` and `generate_guidance_questions()` call the
> LLM with **only** a `HumanMessage` and do not include the admin prompt at all.

### Path B — Full-transcript fallback

Used when there are **no tagged messages**. Here the debrief is produced by a
single LLM call:

```python
messages = [
    SystemMessage(content=debrief_prompt),   # admin prompt = full evaluator instructions
    HumanMessage(content=user_prompt),        # transcript + recommendation + key questions
]
```

In this path the admin prompt carries much more weight — it is the full set of
evaluator instructions and is expected to define the JSON schema itself. This is
why the default prompt (`defaultDebriefPrompt.txt`) contains the **complete**
JSON schema and all the rules: it must be self-sufficient for the fallback path.

Even here, though, the output is still passed through
`validate_debrief_output()` and the score is still **recomputed
deterministically** (`compute_overall_score()`) whenever key questions and
addressed questions are present — so a score the LLM invents is overwritten.

---

## 3. What the debrief prompt should contain

Because the prompt is used as the SystemMessage in **both** paths (and is the
sole instruction set in the fallback path), a good debrief prompt must be
self-sufficient. The shipped default (`defaultDebriefPrompt.txt`) is the
reference implementation — start from it rather than writing from scratch.

A valid debrief prompt should include the following sections.

### 3.1 Role / context framing (required)

State what the model is and what it will receive. Example from the default:

> You are an expert clinical education evaluator. You will be given: (1) the full
> chat transcript, (2) the student's recommendation, (3) a list of key questions.

### 3.2 The exact JSON schema (required — do not omit)

The prompt must declare the exact output keys. The canonical top-level schema is:

```json
{
  "summary": "2-3 sentence soft-skills assessment",
  "questions_addressed": [
    {
      "question_id": "the question_id value from the key questions list",
      "question_text": "the question text",
      "matched_messages": [
        { "message_content": "...", "similarity_score": 0.85, "confidence_tier": "high" }
      ],
      "quality_assessment": "how well the student addressed this question"
    }
  ],
  "questions_missed": [
    { "question_id": "uuid", "question_text": "...", "is_mandatory": true, "weight": 1.5 }
  ],
  "recommendation_feedback": {
    "strengths": ["..."],
    "areas_for_improvement": ["..."]
  },
  "reasoning_gaps": "bullet-point list of open-ended reflective questions",
  "overall_score": 72.5,
  "suggested_rewrites": [
    { "original_message": "...", "matched_question_id": "uuid", "similarity_score": 0.68, "suggested_rewrite": "..." }
  ],
  "answer_key_comparison": {
    "answer_key_available": true,
    "correct_elements": ["..."],
    "missing_elements": ["..."],
    "incorrect_elements": ["..."],
    "overall_alignment": "Strong | Partial | Weak"
  }
}
```

These key names are **not optional**. The backend reads them by name and
`validate_debrief_output()` will fill missing keys with empty defaults — so if
your prompt renames or drops a key, that data silently disappears from the
debrief.

### 3.3 The CRITICAL JSON OUTPUT RULES block (required)

These instructions are what keep the output parseable by `_extract_json()`. They
must be present, essentially verbatim:

- The entire response must be a **single valid JSON object**, nothing else.
- **No markdown code fences** (no ` ```json ` or ` ``` `).
- No text, explanation, or commentary before or after the JSON.
- First character must be `{`, last character must be `}`.
- Escape all strings properly (`\"` for quotes, `\n` for newlines).
- Close every `{`/`[` with a matching `}`/`]`.
- **No trailing commas.**
- **Do not truncate** — always complete the full object.
- `overall_score` **must be a number**, not a string.
- All list fields must be **arrays even when empty** (`[]`).

> `_extract_json()` does strip stray markdown fences and leading/trailing text
> as a safety net, but you should not rely on it — malformed JSON that it can't
> repair causes a retry, and after retries a degraded fallback debrief.

### 3.4 Evaluation rules (recommended)

The default prompt spells out behavioral rules the model should follow. The
important ones to keep:

- **Semantic matching** for key questions (match on topic, not exact wording;
  be generous with conversational phrasing).
- **`reasoning_gaps` tone**: open-ended reflective questions, not authoritative
  criticism. Frame with "How could…", "What aspects of…", etc. Group related
  misses into themes.
- **`summary` scope**: at most 3 sentences, soft skills only (communication,
  pacing, empathy, rapport). Do **not** recap topics covered or clinical content.
- **`suggested_rewrites`**: only for low/moderate-confidence matches; empty list
  otherwise.
- **`answer_key_comparison`**: populate only when an answer key is provided;
  otherwise `answer_key_available: false`.

---

## 4. How much comes from the admin vs the code

This is the core question. Here is the honest split.

### Controlled by the admin's prompt text

- **Tone and voice** of the model (persona, strictness, encouragement level).
- **Qualitative content** of `summary`, `recommendation_feedback`, and
  `reasoning_gaps` (enhanced path), and of the whole debrief (fallback path).
- **How generous/strict** semantic matching guidance reads (fallback path,
  where the LLM does the matching).
- The **framing** the LLM uses when comparing against an answer key.

### Hardcoded in the codebase (prompt text cannot change these)

- **The JSON schema the frontend consumes.** `validate_debrief_output()`
  enforces the required top-level keys and nested shapes, filling defaults for
  anything missing and coercing types (e.g. `overall_score` rounded to an int,
  reset to `0.0` if non-numeric).
- **The score.** `compute_overall_score()` recomputes `overall_score`
  deterministically from key-question weights whenever addressed questions
  exist, overwriting whatever the LLM returned. `compute_section_scores()`
  computes per-section percentages.
- **Which questions count as addressed/missed** in the enhanced path — done by
  `build_questions_from_matched_data()` from embedding matches, before any LLM
  call.
- **DTP / recommendation matching** — `match_submissions()` uses embeddings and
  a greedy matcher with org-configured thresholds, entirely outside the prompt.
- **Suggested rewrites and guidance questions** — generated by dedicated
  hardcoded prompts (`generate_batch_rewrites`, `generate_guidance_questions`)
  that do **not** include the admin prompt.
- **The task-specific HumanMessage prompts** in the enhanced path
  (`build_summary_feedback_prompt`, `build_answer_key_prompt`) — these re-state
  the exact keys and constraints, so even in the enhanced path the schema for
  those fields is code-driven, not admin-driven.
- **Retry + fallback behavior**, JSON extraction, DB persistence, and AppSync
  chunk publishing.

### Practical implication

In the **enhanced path** (the common case), rewriting the admin prompt mostly
changes the *style* of the summary/feedback/answer-key text. It does **not**
change scoring, question matching, rewrites, guidance, or the output schema.

In the **fallback path**, the admin prompt has broad influence over the LLM's
output — but scoring is still recomputed and the schema is still validated, so
even there the admin cannot change the fundamental data contract.

---

## 5. Editing checklist

When changing a group's debrief prompt:

1. Start from `defaultDebriefPrompt.txt` and keep the JSON schema and CRITICAL
   JSON OUTPUT RULES intact.
2. Do not rename or remove any top-level JSON key — the frontend and validator
   depend on them.
3. Keep `overall_score` described as a number.
4. Test with the **Prompt Playground → Test Debrief** on a real completed
   session before saving; results there are ephemeral and safe.
5. Remember a group with a `NULL`/empty `debrief_prompt` will fail debrief
   generation outright — never clear it.

---

## 6. Default debrief prompt (full text)

This is the current shipped `defaultDebriefPrompt.txt`, reproduced here for quick
reference. It is the source served by the `get_default_debrief_prompt` endpoint
and the recommended starting point for any group prompt. If you edit the file,
update this section to match.

```text
You are an expert clinical education evaluator. You will be given:
1. The full chat transcript between a pharmacy student and an AI patient
2. The student's recommendation/diagnosis submitted at the end
3. A list of key questions the student was expected to ask during the interaction

Your job is to produce a structured debrief evaluation in valid JSON with these exact keys:

{
  "summary": "A concise 2-3 sentence assessment focused exclusively on the student's soft skills during the interview (communication style, pace, empathy, rapport-building). Do not summarize what was discussed or provide feedback on the recommendation submission.",
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
  "reasoning_gaps": "A bullet-point list of open-ended reflective guiding questions (one per missed topic area) that nudge the student to consider what they could have explored further. Group related missed questions into broader themes where possible.",
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
- Do NOT wrap the JSON in markdown code fences (no ```json or ```).
- Do NOT include any text, explanation, or commentary before or after the JSON.
- The very first character of your response MUST be '{' and the very last character MUST be '}'.
- Ensure all strings are properly escaped (double quotes inside strings must be \", newlines must be \n).
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
- For suggested_rewrites, only include rewrites for low or moderate-confidence matches (similarity 0.40-0.69). Do NOT include rewrites for high-confidence matches.
- If no moderate-confidence matches exist, return an empty list for suggested_rewrites.
- For answer_key_comparison: if an answer key is provided in the prompt, set answer_key_available to true and populate correct_elements, missing_elements, incorrect_elements, and overall_alignment by comparing the student's recommendation against the answer key. If no answer key is provided, set answer_key_available to false and omit the other sub-fields.
- For reasoning_gaps, do NOT write authoritative or critical feedback that tells the student what they did wrong. Instead, write a bullet-point list of open-ended reflective questions that guide the student to consider what additional clinical information they could have gathered. Frame each question using phrases like "How could...", "What aspects of...", "What broader questions could have...", "In the context of...", or "Considering the patient's...". Group related missed questions into thematic guiding questions rather than listing every single miss individually. The tone should be supportive and encouraging self-reflection, not punitive.
- For summary, write at most 3 sentences focused ONLY on the student's soft skills during the interview portion (e.g. communication style, pacing, empathy, rapport-building, active listening). Do NOT recap what topics were covered, do NOT mention the recommendation submission, and do NOT provide clinical content feedback. This is purely about how the student conducted the conversation, not what they asked.
```

---

## 7. Related code references

- `cdk/text_generation/src/helpers/chat.py`
  - `fetch_debrief_prompt`, `generate_debrief`, `validate_debrief_output`
  - `build_summary_feedback_prompt`, `build_answer_key_prompt`, `build_rewrite_prompt`
  - `generate_batch_rewrites`, `generate_guidance_questions`
  - `compute_overall_score`, `compute_section_scores`, `build_questions_from_matched_data`
- `cdk/.../defaultDebriefPrompt.txt` — the starter/default prompt
- `frontend/src/services/instructorService.ts` — `getDebriefPrompt`, `updateDebriefPrompt`, `getDefaultDebriefPrompt`, `runTestDebrief`
- `frontend/src/components/prompt-playground/PromptPlayground.tsx` — the test UI
- `docs/MODIFICATION_GUIDE.md` — broader prompt hierarchy context
