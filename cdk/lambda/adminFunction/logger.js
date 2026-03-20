/**
 * Structured logging utility for Lambda functions.
 * Outputs JSON logs for easy CloudWatch Insights querying.
 *
 * Usage:
 *   const logger = require("./logger");
 *   // At handler entry:
 *   logger.init(event, context);
 *   logger.info("Processing request", { route: "GET /admin/instructors" });
 *   logger.error("Query failed", { error: err.message, stack: err.stack });
 */

let _requestId = null;
let _route = null;

function init(event, context) {
  _requestId = context?.awsRequestId || event?.requestContext?.requestId || "unknown";
  _route = event ? `${event.httpMethod} ${event.resource}` : "unknown";
}

function _log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: _requestId,
    route: _route,
    message,
    ...data,
  };
  if (level === "ERROR" || level === "WARN") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function info(message, data) {
  _log("INFO", message, data);
}

function warn(message, data) {
  _log("WARN", message, data);
}

function error(message, data) {
  _log("ERROR", message, data);
}

function logResponse(response) {
  _log("INFO", "Lambda response", {
    statusCode: response.statusCode,
    bodyLength: response.body ? response.body.length : 0,
  });
}

module.exports = { init, info, warn, error, logResponse };
