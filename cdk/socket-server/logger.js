"use strict";

/**
 * Structured logging utility for the socket server (ECS Fargate / Node.js).
 *
 * Emits single-line JSON to stdout/stderr so it lands in CloudWatch Logs and is
 * queryable with CloudWatch Logs Insights (e.g. `fields @timestamp, level, message`).
 * This mirrors the Lambda logger (cdk/lambda/lib/logger.js) but is process-oriented
 * rather than request-oriented.
 *
 * WARN/ERROR are written via console.error so CloudWatch tags severity correctly;
 * INFO/DEBUG go to console.log.
 *
 * Usage:
 *   const logger = require("./logger");
 *   logger.info("DB connection initialized", { component: "session-auth" });
 *   logger.error("Query failed", { error: err.message, stack: err.stack });
 */

const SERVICE = "socket-server";

function _log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    message,
    ...data,
  };
  let line;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Fall back to a safe representation if data contains circular refs.
    line = JSON.stringify({ timestamp: entry.timestamp, level, service: SERVICE, message });
  }
  if (level === "ERROR" || level === "WARN") {
    console.error(line);
  } else {
    console.log(line);
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

module.exports = { info, warn, error };
