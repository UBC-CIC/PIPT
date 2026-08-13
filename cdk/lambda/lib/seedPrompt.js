/**
 * Returns the defaultPrompt if value is null, undefined, empty string,
 * or whitespace-only; otherwise returns value unchanged.
 *
 * @param {string|null|undefined} value - The value to check
 * @param {string} defaultPrompt - The fallback prompt to use
 * @returns {string} The original value or the default prompt
 */
function seedPrompt(value, defaultPrompt) {
  if (value === null || value === undefined || value.trim() === "") {
    return defaultPrompt;
  }
  return value;
}

module.exports = { seedPrompt };
