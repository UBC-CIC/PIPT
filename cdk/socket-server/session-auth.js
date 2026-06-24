"use strict";

/**
 * Session Authorization Module for Socket Server
 *
 * Provides session ownership verification to prevent IDOR attacks.
 * Uses the same ownership chain as the Lambda authz module:
 * chats → student_interactions → enrollments → users.
 *
 * Follows a fail-closed pattern: any error returns { authorized: false }.
 */

const postgres = require("postgres");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || "ca-central-1",
});

let sqlConnection = null;

/**
 * Lazily initialize the database connection using SM_DB_CREDENTIALS and RDS_PROXY_ENDPOINT.
 * Reuses the connection once established.
 * @returns {Promise<object>} postgres tagged template connection
 */
async function getDbConnection() {
  if (sqlConnection) return sqlConnection;

  const secretName = process.env.SM_DB_CREDENTIALS;
  const rdsProxyEndpoint = process.env.RDS_PROXY_ENDPOINT;

  if (!secretName || !rdsProxyEndpoint) {
    throw new Error("SM_DB_CREDENTIALS or RDS_PROXY_ENDPOINT not configured");
  }

  const { SecretString } = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const credentials = JSON.parse(SecretString);

  sqlConnection = postgres({
    host: rdsProxyEndpoint,
    port: credentials.port,
    username: credentials.username,
    password: credentials.password,
    database: credentials.dbname,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idle_timeout: 60,
  });

  console.log("✅ Socket server DB connection initialized");
  return sqlConnection;
}

/**
 * Verify that the authenticated user owns the given chat session.
 * Joins chats → student_interactions → enrollments → users to confirm ownership.
 *
 * @param {string} sessionId - The chat_id to verify ownership of
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<{authorized: boolean, userId?: string}>}
 */
async function verifySessionOwnership(sessionId, userEmail) {
  try {
    const sql = await getDbConnection();
    const result = await sql`
      SELECT u.user_id
      FROM chats c
      JOIN student_interactions si ON si.student_interaction_id = c.student_interaction_id
      JOIN enrollments e ON e.enrollment_id = si.enrollment_id
      JOIN users u ON u.user_id = e.user_id
      WHERE c.chat_id = ${sessionId}
        AND u.user_email = ${userEmail};
    `;

    if (result.length > 0) {
      return { authorized: true, userId: result[0].user_id };
    }
    return { authorized: false };
  } catch (error) {
    console.error("❌ Session ownership verification error:", error.message);
    return { authorized: false };
  }
}

module.exports = { verifySessionOwnership, getDbConnection };
