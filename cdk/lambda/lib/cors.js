/**
 * CORS origin helper.
 *
 * Reads ALLOWED_ORIGINS from environment (comma-separated list, supports
 * wildcard subdomains like "https://*.amplifyapp.com").
 *
 * Returns the matching origin to echo back in the Access-Control-Allow-Origin
 * header, or falls back to the first allowed origin if none match.
 * If ALLOWED_ORIGINS is not set or equals "*", returns "*" (backwards-compatible).
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim()).filter(Boolean);

/**
 * @param {object} event — API Gateway Lambda proxy event
 * @returns {string} The origin to set in Access-Control-Allow-Origin
 */
function getCorsOrigin(event) {
  // Backwards-compatible: if not configured, allow all
  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes("*")) {
    return "*";
  }

  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";

  if (!origin) {
    // No Origin header (e.g., same-origin request, server-to-server) — return primary domain
    return ALLOWED_ORIGINS[0];
  }

  const isAllowed = ALLOWED_ORIGINS.some((pattern) => {
    if (pattern.includes("*")) {
      // Escape regex special chars except *, then replace * with [^.]+ for subdomain matching
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+");
      return new RegExp("^" + escaped + "$").test(origin);
    }
    return pattern === origin;
  });

  return isAllowed ? origin : ALLOWED_ORIGINS[0];
}

/**
 * Build standard CORS headers for a response.
 * @param {object} event — API Gateway Lambda proxy event
 * @returns {object} Headers object with CORS fields
 */
function getCorsHeaders(event) {
  return {
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": getCorsOrigin(event),
    "Access-Control-Allow-Methods": "*",
  };
}

module.exports = { getCorsOrigin, getCorsHeaders };
