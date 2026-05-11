/**
 * Migration 014: Deduplicate student_interactions
 *
 * Removes duplicate student_interactions rows where the same
 * (persona_id, enrollment_id) pair has multiple entries. This was
 * caused by enrollment flows creating student_interaction rows
 * without checking for existing records.
 *
 * Keeps the row that has chats (actual student activity) attached.
 * If multiple rows have chats, keeps the one with the most chats.
 * If none have chats, keeps the most recently accessed one.
 * Deletes the rest.
 *
 * Also adds a unique index to prevent future duplicates.
 *
 * Idempotent: only deletes rows that are true duplicates.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $
    DECLARE
      deleted_count integer;
    BEGIN
      -- Delete duplicate student_interactions, prioritizing the row that has
      -- actual chat activity. Among ties, prefer most recent last_accessed.
      DELETE FROM "student_interactions"
      WHERE student_interaction_id NOT IN (
        SELECT DISTINCT ON (si.persona_id, si.enrollment_id) si.student_interaction_id
        FROM "student_interactions" si
        LEFT JOIN (
          SELECT student_interaction_id, COUNT(*) AS chat_count
          FROM "chats"
          GROUP BY student_interaction_id
        ) c ON c.student_interaction_id = si.student_interaction_id
        ORDER BY
          si.persona_id,
          si.enrollment_id,
          COALESCE(c.chat_count, 0) DESC,
          si.last_accessed DESC NULLS LAST,
          si.student_interaction_id DESC
      );

      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      RAISE NOTICE 'Migration 014: removed % duplicate student_interaction(s)', deleted_count;
    END $;
  `);

  // Add a unique constraint to prevent future duplicates
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_student_interactions_persona_enrollment
    ON "student_interactions" (persona_id, enrollment_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_student_interactions_persona_enrollment;
  `);
  // Cannot restore deleted duplicates — restore from backup if needed.
};
