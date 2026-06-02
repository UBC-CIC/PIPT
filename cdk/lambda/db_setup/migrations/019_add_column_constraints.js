/**
 * Migration 019: Add NOT NULL and CHECK constraints to critical columns
 *
 * Adds NOT NULL constraints to columns that should never be NULL (foreign keys,
 * identity columns, type discriminators) and CHECK constraints to enum-like
 * columns that store a fixed set of values.
 *
 * Pre-validated: All columns confirmed to have zero NULL values and only
 * expected enum values in production.
 *
 * Idempotent: SET NOT NULL is a no-op if the constraint already exists.
 */

exports.up = (pgm) => {
  // ============================================================
  // NOT NULL constraints
  // ============================================================

  // Foreign keys — prevent orphaned records
  pgm.sql(`ALTER TABLE messages ALTER COLUMN chat_id SET NOT NULL`);
  pgm.sql(`ALTER TABLE chats ALTER COLUMN student_interaction_id SET NOT NULL`);
  pgm.sql(`ALTER TABLE personas ALTER COLUMN simulation_group_id SET NOT NULL`);

  // Type discriminators and identity columns
  pgm.sql(`ALTER TABLE messages ALTER COLUMN sender_type SET NOT NULL`);
  pgm.sql(`ALTER TABLE enrollments ALTER COLUMN enrollment_type SET NOT NULL`);
  pgm.sql(`ALTER TABLE personas ALTER COLUMN persona_name SET NOT NULL`);
  pgm.sql(`ALTER TABLE simulation_groups ALTER COLUMN group_name SET NOT NULL`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN user_email SET NOT NULL`);

  // Roles — set default and NOT NULL (migration 013 already backfilled all existing rows)
  pgm.sql(`ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['student']`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN roles SET NOT NULL`);

  // ============================================================
  // Connection safety — prevent runaway queries and stale transactions
  // ============================================================

  pgm.sql(`ALTER DATABASE genrx SET statement_timeout = '30s'`);
  pgm.sql(`ALTER DATABASE genrx SET idle_in_transaction_session_timeout = '60s'`);

  // ============================================================
  // CHECK constraints — validate enum-like columns
  // ============================================================

  pgm.sql(`
    ALTER TABLE enrollments
    ADD CONSTRAINT chk_enrollment_type
    CHECK (enrollment_type IN ('student', 'instructor', 'preview'))
  `);

  pgm.sql(`
    ALTER TABLE messages
    ADD CONSTRAINT chk_sender_type
    CHECK (sender_type IN ('student', 'ai', 'system'))
  `);
};

exports.down = (pgm) => {
  // Drop CHECK constraints
  pgm.sql(`ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS chk_enrollment_type`);
  pgm.sql(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_sender_type`);

  // Reset connection timeouts to defaults (no limit)
  pgm.sql(`ALTER DATABASE genrx RESET statement_timeout`);
  pgm.sql(`ALTER DATABASE genrx RESET idle_in_transaction_session_timeout`);

  // Drop NOT NULL constraints
  pgm.sql(`ALTER TABLE messages ALTER COLUMN chat_id DROP NOT NULL`);
  pgm.sql(`ALTER TABLE chats ALTER COLUMN student_interaction_id DROP NOT NULL`);
  pgm.sql(`ALTER TABLE personas ALTER COLUMN simulation_group_id DROP NOT NULL`);
  pgm.sql(`ALTER TABLE messages ALTER COLUMN sender_type DROP NOT NULL`);
  pgm.sql(`ALTER TABLE enrollments ALTER COLUMN enrollment_type DROP NOT NULL`);
  pgm.sql(`ALTER TABLE personas ALTER COLUMN persona_name DROP NOT NULL`);
  pgm.sql(`ALTER TABLE simulation_groups ALTER COLUMN group_name DROP NOT NULL`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN user_email DROP NOT NULL`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN roles DROP NOT NULL`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN roles DROP DEFAULT`);
};
