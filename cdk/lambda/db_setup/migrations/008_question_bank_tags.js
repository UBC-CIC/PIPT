/**
 * Migration 008: Add tags to question_bank
 *
 * Adds a varchar[] tags column to the question_bank table for flexible
 * categorization and filtering of questions.
 *
 * Convention:
 *   - tags includes 'patient_specific' → patient-specific question
 *   - tags without 'patient_specific' (or NULL) → global question
 *   - Additional tags for domain filtering: 'Health', 'Physio', etc.
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'question_bank' AND column_name = 'tags') THEN
        ALTER TABLE question_bank ADD COLUMN tags varchar[] DEFAULT '{}';
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_question_bank_tags
      ON question_bank USING GIN (tags);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_question_bank_tags;
    ALTER TABLE question_bank DROP COLUMN IF EXISTS tags;
  `);
};
