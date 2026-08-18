/**
 * Pure field-normalization helpers shared by the question bank routes.
 *
 * This module intentionally has no database or Lambda-event dependency so the
 * normalization rules can be exercised directly in unit and property tests.
 */

/**
 * Validates the `tags` field of an update request body.
 *
 * `undefined` signals "field omitted — leave the stored value unchanged", and is
 * reported as a success with an `undefined` value. Any array (including the
 * empty array) is accepted and returned unchanged so it can be written through.
 * Everything else is rejected with an error message naming the field.
 *
 * @param {unknown} tags - The submitted `tags` value.
 * @returns {{ ok: true, value: string[]|undefined }|{ ok: false, error: string }}
 */
function validateTagsField(tags) {
  if (tags === undefined) {
    return { ok: true, value: undefined };
  }
  if (Array.isArray(tags)) {
    return { ok: true, value: tags };
  }
  return { ok: false, error: "tags must be an array of strings" };
}

/**
 * Normalizes a create (POST) request body.
 *
 * `clinicalIntent` is the submitted string, or `''` when the field is absent,
 * null, or not a string — so the column stores an empty value rather than NULL.
 * `tags` is the submitted array, or `[]` when absent or not an array.
 *
 * @param {Record<string, unknown>|null|undefined} body - The parsed request body.
 * @returns {{ clinicalIntent: string, tags: string[] }}
 */
function normalizeCreateFields(body) {
  const source = body && typeof body === "object" ? body : {};
  const clinicalIntent =
    typeof source.clinical_intent === "string" ? source.clinical_intent : "";
  const tags = Array.isArray(source.tags) ? source.tags : [];
  return { clinicalIntent, tags };
}

module.exports = { validateTagsField, normalizeCreateFields };
