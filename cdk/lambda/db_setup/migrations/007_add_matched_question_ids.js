/**
 * Migration 007: Add matched_question_ids to messages
 *
 * Adds a JSONB column to the messages table for storing per-message
 * semantic match results (question_id + similarity_score pairs).
 * Includes a GIN index for efficient queries filtering by matched question IDs.
 *
 * Columns added to messages:
 *   - matched_question_ids (JSONB): Array of {question_id, similarity_score} objects
 *
 * Indexes added:
 *   - idx_messages_matched_questions (GIN) on matched_question_ids
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'messages' AND column_name = 'matched_question_ids') THEN
        ALTER TABLE messages ADD COLUMN matched_question_ids JSONB DEFAULT NULL;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_messages_matched_questions
      ON messages USING GIN (matched_question_ids);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_messages_matched_questions;
    ALTER TABLE messages DROP COLUMN IF EXISTS matched_question_ids;
  `);
};
