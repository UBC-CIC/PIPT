/**
 * Pure utilities for the instructor question bank management page.
 *
 * Every export here is a pure function or a plain type: no React, no hooks,
 * no service calls, no side effects. Search and pagination are deliberately
 * NOT reimplemented here — `filterByTitle` and `paginate` in
 * `@/lib/bankUtils` are reused as-is.
 */

// ─── Types & Constants ───────────────────────────────────────────────────────

/** Tag that marks a question bank item as patient-specific. */
export const PATIENT_SPECIFIC_TAG = 'patient_specific';

/** The two tabs of the question bank view. */
export type QuestionBankTab = 'global' | 'patientSpecific';

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

/** Result of validating instructor content fields. */
export interface ContentFieldsValidation {
  valid: boolean;
  /** Field names that failed the non-blank check, in field order. */
  errors: Array<'title' | 'question_text' | 'evaluation_criteria'>;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Trim a possibly-missing string value. */
function trimmed(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

// ─── Organization resolution ─────────────────────────────────────────────────

/**
 * Collect the distinct, non-empty `organization_id` values present in a list of
 * simulation groups. Output is sorted so the derived selection is stable across
 * reloads regardless of the order groups come back from the API.
 */
export function resolveOrganizationIds(
  groups: Array<{ organization_id?: string | null }>
): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    const id = trimmed(group?.organization_id);
    if (id !== '') ids.add(id);
  }
  return Array.from(ids).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ─── Tab partitioning ────────────────────────────────────────────────────────

/**
 * Split items into global and patient-specific buckets on the presence of the
 * `patient_specific` tag. The split is total and disjoint: every input item
 * lands in exactly one bucket, nothing is dropped and nothing is duplicated.
 */
export function partitionByPatientSpecific<T extends { tags?: string[] }>(
  items: T[]
): { global: T[]; patientSpecific: T[] } {
  const global: T[] = [];
  const patientSpecific: T[] = [];
  for (const item of items) {
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    if (tags.includes(PATIENT_SPECIFIC_TAG)) {
      patientSpecific.push(item);
    } else {
      global.push(item);
    }
  }
  return { global, patientSpecific };
}

// ─── Tag handling ────────────────────────────────────────────────────────────

/**
 * Parse a comma-separated tag input string: trim each entry, drop empties,
 * de-duplicate, and strip any user-entered `patient_specific` (that tag is
 * owned by the patient-specific toggle, not by free text).
 */
export function parseTagsInput(raw: string): string[] {
  if (typeof raw !== 'string') return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim();
    if (tag === '' || tag === PATIENT_SPECIFIC_TAG) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * Normalize the tag array written to the backend. When `patientSpecific` is
 * true, `patient_specific` is the first element exactly once; otherwise it is
 * absent entirely. Blank entries and duplicates are removed and the relative
 * order of the remaining user tags is preserved.
 *
 * Idempotent: `normalizeInstructorTags(normalizeInstructorTags(t, f), f)`
 * equals `normalizeInstructorTags(t, f)`.
 */
export function normalizeInstructorTags(
  userTags: string[],
  patientSpecific: boolean
): string[] {
  const source = Array.isArray(userTags) ? userTags : [];
  const seen = new Set<string>();
  const rest: string[] = [];
  for (const raw of source) {
    const tag = trimmed(raw);
    if (tag === '' || tag === PATIENT_SPECIFIC_TAG) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    rest.push(tag);
  }
  return patientSpecific ? [PATIENT_SPECIFIC_TAG, ...rest] : rest;
}

// ─── Content field validation ────────────────────────────────────────────────

/**
 * Validate instructor content fields before issuing a write.
 * `title` and `question_text` must be non-blank on both paths;
 * `evaluation_criteria` must additionally be non-blank on the create path.
 */
export function validateContentFields(
  fields: Pick<
    InstructorContentFields,
    'title' | 'question_text' | 'evaluation_criteria'
  >,
  mode: ContentFieldsMode
): ContentFieldsValidation {
  const errors: ContentFieldsValidation['errors'] = [];
  if (trimmed(fields?.title) === '') errors.push('title');
  if (trimmed(fields?.question_text) === '') errors.push('question_text');
  if (mode === 'create' && trimmed(fields?.evaluation_criteria) === '') {
    errors.push('evaluation_criteria');
  }
  return { valid: errors.length === 0, errors };
}

// ─── List updates ────────────────────────────────────────────────────────────

/**
 * Replace an item in a list by `id`, in place. Length and the position of every
 * other element are preserved; a non-matching `id` returns an equivalent list.
 */
export function replaceItem<T extends { id: string }>(
  items: T[],
  updated: T
): T[] {
  return items.map((item) => (item.id === updated.id ? updated : item));
}
