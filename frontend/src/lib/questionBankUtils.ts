/**
 * Question-bank-specific utilities for the instructor question bank page.
 *
 * The bank-agnostic helpers now live in `@/lib/instructorBankUtils` and are
 * re-exported here unchanged, so existing importers (`InstructorQuestionBankPage`,
 * `useInstructorQuestionBank`) keep resolving against this module. Only the
 * question-shaped pieces — the content field types and `validateContentFields` —
 * are defined here, and `validateContentFields` is a thin call into the generic
 * validator with behaviour identical to its previous implementation.
 *
 * Everything is pure: no React, no hooks, no service calls, no side effects.
 * Search and pagination are deliberately NOT reimplemented — `filterByTitle` and
 * `paginate` in `@/lib/bankUtils` are reused as-is.
 */

import {
  validateRequiredTextFields,
  type BankTab,
} from '@/lib/instructorBankUtils';

// ─── Re-exports of the bank-agnostic layer ───────────────────────────────────

export {
  PATIENT_SPECIFIC_TAG,
  resolveOrganizationIds,
  resolveActiveOrganization,
  partitionByPatientSpecific,
  parseTagsInput,
  normalizeInstructorTags,
  validateRequiredTextFields,
  replaceItem,
  type BankTab,
  type RequiredTextFieldsValidation,
} from '@/lib/instructorBankUtils';

// ─── Question bank types ─────────────────────────────────────────────────────

/** The two tabs of the question bank view. */
export type QuestionBankTab = BankTab;

/** Content fields an instructor can author for a question bank item. */
export interface InstructorContentFields {
  title: string;
  question_text: string;
  clinical_intent: string;
  evaluation_criteria: string;
  is_mandatory: boolean;
  tags: string[];
}

/**
 * Which write path the fields are being validated for.
 * `evaluation_criteria` is required on create but not on edit, because the
 * instructor `PUT` does not require it.
 */
export type ContentFieldsMode = 'create' | 'edit';

/** Content field keys `validateContentFields` can reject. */
type ContentFieldKey = 'title' | 'question_text' | 'evaluation_criteria';

/** Result of validating instructor content fields. */
export interface ContentFieldsValidation {
  valid: boolean;
  /** Field names that failed the non-blank check, in field order. */
  errors: ContentFieldKey[];
}

// ─── Content field validation ────────────────────────────────────────────────

/** Required keys on the edit path, in the order errors are reported. */
const EDIT_REQUIRED_KEYS: readonly ContentFieldKey[] = ['title', 'question_text'];

/** Required keys on the create path, in the order errors are reported. */
const CREATE_REQUIRED_KEYS: readonly ContentFieldKey[] = [
  'title',
  'question_text',
  'evaluation_criteria',
];

/**
 * Validate instructor content fields before issuing a write.
 * `title` and `question_text` must be non-blank on both paths;
 * `evaluation_criteria` must additionally be non-blank on the create path.
 */
export function validateContentFields(
  fields: Pick<InstructorContentFields, ContentFieldKey>,
  mode: ContentFieldsMode
): ContentFieldsValidation {
  return validateRequiredTextFields<ContentFieldKey>(
    fields,
    mode === 'create' ? CREATE_REQUIRED_KEYS : EDIT_REQUIRED_KEYS
  );
}
