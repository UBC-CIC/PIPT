/**
 * Per-bank field descriptors and the pure field rules shared by the DTP and
 * recommendation bank routes.
 *
 * Like `questionBankFields.js`, this module intentionally has no database or
 * Lambda-event dependency, so every rule can be exercised directly in unit and
 * property tests.
 */

// Re-exported so DTP/recommendation callers need not reach into a
// question-named module. One implementation, no second copy.
const { validateTagsField } = require("./questionBankFields.js");

/**
 * Per-bank field descriptors — plain data, no behaviour.
 *
 * `requiredTextKeys` are the columns the database constrains to be non-blank,
 * `optionalTextKeys` the nullable text columns that are normalized to `''`
 * rather than NULL, and `booleanDefaults` the boolean columns of that bank
 * together with the value to store when the request omits them.
 *
 * @type {Record<string, { requiredTextKeys: string[], optionalTextKeys: string[], booleanDefaults: Record<string, boolean> }>}
 */
const BANK_DESCRIPTORS = {
  dtp: {
    requiredTextKeys: ["title", "expected_dtp_text"],
    optionalTextKeys: ["clinical_intent", "evaluation_criteria"],
    booleanDefaults: { is_required: false },
  },
  recommendation: {
    requiredTextKeys: ["title", "recommendation_text"],
    optionalTextKeys: ["evaluation_criteria", "rationale"],
    booleanDefaults: {},
  },
};

/**
 * Reports whether a submitted value counts as blank for a required text field.
 *
 * Blank means absent (`undefined`/`null`), not a string, or whitespace-only —
 * the last case matters because a `"   "` value passes a plain falsy check but
 * is rejected by the table CHECK constraint, turning a client mistake into a
 * 500 instead of a 400.
 *
 * @param {unknown} value - The submitted value.
 * @returns {boolean}
 */
function isBlankText(value) {
  return typeof value !== "string" || value.trim() === "";
}

/**
 * Validates the required text fields of a create request body.
 *
 * @param {Record<string, unknown>|null|undefined} body - The parsed request body.
 * @param {string[]} requiredTextKeys - The bank's required text keys, in order.
 * @returns {{ ok: true }|{ ok: false, missing: string[], error: string }}
 *   On failure, `missing` lists the blank keys in `requiredTextKeys` order and
 *   `error` names them, satisfying "400 naming the missing field".
 */
function validateRequiredTextFields(body, requiredTextKeys) {
  const source = body && typeof body === "object" ? body : {};
  const keys = Array.isArray(requiredTextKeys) ? requiredTextKeys : [];
  const missing = keys.filter((key) => isBlankText(source[key]));

  if (missing.length === 0) {
    return { ok: true };
  }

  const error = `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`;
  return { ok: false, missing, error };
}

/**
 * Normalizes a create (POST) request body against a bank descriptor.
 *
 * Required text is trimmed, so the value bound to the insert is exactly what a
 * later read returns. Each optional text key becomes the submitted string, or
 * `''` when the key is absent, null, or not a string — never NULL, so the
 * write-then-read round trip holds. `tags` becomes the submitted array or `[]`.
 * Each boolean named by the descriptor becomes the submitted value or the
 * descriptor default; a bank with no booleans yields an empty `booleans` object.
 *
 * @param {Record<string, unknown>|null|undefined} body - The parsed request body.
 * @param {{ requiredTextKeys: string[], optionalTextKeys: string[], booleanDefaults: Record<string, boolean> }} descriptor
 * @returns {{ text: Record<string, string>, tags: unknown[], booleans: Record<string, unknown> }}
 */
function normalizeBankCreateFields(body, descriptor) {
  const source = body && typeof body === "object" ? body : {};
  const spec = descriptor && typeof descriptor === "object" ? descriptor : {};
  const requiredTextKeys = Array.isArray(spec.requiredTextKeys) ? spec.requiredTextKeys : [];
  const optionalTextKeys = Array.isArray(spec.optionalTextKeys) ? spec.optionalTextKeys : [];
  const booleanDefaults =
    spec.booleanDefaults && typeof spec.booleanDefaults === "object" ? spec.booleanDefaults : {};

  const text = {};
  for (const key of requiredTextKeys) {
    text[key] = typeof source[key] === "string" ? source[key].trim() : "";
  }
  for (const key of optionalTextKeys) {
    text[key] = typeof source[key] === "string" ? source[key] : "";
  }

  const tags = Array.isArray(source.tags) ? source.tags : [];

  const booleans = {};
  for (const key of Object.keys(booleanDefaults)) {
    booleans[key] = source[key] !== undefined ? source[key] : booleanDefaults[key];
  }

  return { text, tags, booleans };
}

module.exports = {
  BANK_DESCRIPTORS,
  validateRequiredTextFields,
  normalizeBankCreateFields,
  validateTagsField,
};
