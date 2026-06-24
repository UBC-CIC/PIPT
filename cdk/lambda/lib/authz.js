"use strict";

/**
 * Centralized Authorization Module
 *
 * Provides helper functions to verify resource ownership before allowing access.
 * All functions follow a fail-closed pattern: any database error returns { authorized: false }.
 */

/**
 * Verify that the authenticated user owns the given chat session.
 * Joins chats → student_interactions → enrollments → users to confirm ownership.
 *
 * @param {object} sqlConnection - postgres tagged template connection
 * @param {string} sessionId - The chat_id to verify ownership of
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<{authorized: boolean, userId?: string}>}
 */
async function verifySessionOwnership(sqlConnection, sessionId, userEmail) {
  try {
    const result = await sqlConnection`
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
    return { authorized: false };
  }
}

/**
 * Verify that the authenticated instructor owns or is assigned to the given simulation group.
 * Checks if the user either created the group (simulation_groups.created_by)
 * or is assigned via the group_instructors table.
 *
 * @param {object} sqlConnection - postgres tagged template connection
 * @param {string} simulationGroupId - The simulation_group_id to verify ownership of
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<{authorized: boolean}>}
 */
async function verifyGroupOwnership(sqlConnection, simulationGroupId, userEmail) {
  try {
    const result = await sqlConnection`
      SELECT 1
      FROM users u
      WHERE u.user_email = ${userEmail}
        AND (
          EXISTS (
            SELECT 1 FROM simulation_groups sg
            WHERE sg.simulation_group_id = ${simulationGroupId}
              AND sg.created_by = u.user_id
          )
          OR EXISTS (
            SELECT 1 FROM group_instructors gi
            WHERE gi.simulation_group_id = ${simulationGroupId}
              AND gi.user_id = u.user_id
          )
        );
    `;

    return { authorized: result.length > 0 };
  } catch (error) {
    return { authorized: false };
  }
}

/**
 * Verify that the authenticated user has an active enrollment in the given simulation group.
 *
 * @param {object} sqlConnection - postgres tagged template connection
 * @param {string} simulationGroupId - The simulation_group_id to check enrollment for
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<{authorized: boolean, enrollmentId?: string}>}
 */
async function verifyEnrollment(sqlConnection, simulationGroupId, userEmail) {
  try {
    const result = await sqlConnection`
      SELECT e.enrollment_id
      FROM enrollments e
      JOIN users u ON u.user_id = e.user_id
      WHERE e.simulation_group_id = ${simulationGroupId}
        AND u.user_email = ${userEmail};
    `;

    if (result.length > 0) {
      return { authorized: true, enrollmentId: result[0].enrollment_id };
    }
    return { authorized: false };
  } catch (error) {
    return { authorized: false };
  }
}

/**
 * Verify that the authenticated instructor owns or is assigned to the group
 * that the given persona belongs to.
 * Joins personas → simulation_groups and checks created_by or group_instructors.
 *
 * @param {object} sqlConnection - postgres tagged template connection
 * @param {string} personaId - The persona_id to verify ownership of
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<{authorized: boolean}>}
 */
async function verifyPersonaOwnership(sqlConnection, personaId, userEmail) {
  try {
    const result = await sqlConnection`
      SELECT 1
      FROM users u
      WHERE u.user_email = ${userEmail}
        AND (
          EXISTS (
            SELECT 1 FROM personas p
            JOIN simulation_groups sg ON sg.simulation_group_id = p.simulation_group_id
            WHERE p.persona_id = ${personaId}
              AND sg.created_by = u.user_id
          )
          OR EXISTS (
            SELECT 1 FROM personas p
            JOIN group_instructors gi ON gi.simulation_group_id = p.simulation_group_id
            WHERE p.persona_id = ${personaId}
              AND gi.user_id = u.user_id
          )
        );
    `;

    return { authorized: result.length > 0 };
  } catch (error) {
    return { authorized: false };
  }
}

/**
 * Check if the authenticated user has the 'admin' role.
 *
 * @param {object} sqlConnection - postgres tagged template connection
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<boolean>}
 */
async function isAdmin(sqlConnection, userEmail) {
  try {
    const result = await sqlConnection`
      SELECT roles
      FROM users
      WHERE user_email = ${userEmail};
    `;

    if (result.length > 0 && Array.isArray(result[0].roles)) {
      return result[0].roles.includes("admin");
    }
    return false;
  } catch (error) {
    return false;
  }
}

module.exports = {
  verifySessionOwnership,
  verifyGroupOwnership,
  verifyEnrollment,
  verifyPersonaOwnership,
  isAdmin,
};
