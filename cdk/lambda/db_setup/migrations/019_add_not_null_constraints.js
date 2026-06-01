/**
 * Migration 019: Add NOT NULL constraints to critical columns
 *
 * Adds NOT NULL constraints to columns that should never be NULL based on
 * application logic. These are foreign keys, identity columns, and type
 * discriminators that the application always populates.
 *
 * Pre-validated: All columns confirmed to have zero NULL values in production.
 *
 * Idempotent: SET NOT NULL is a no-op if the constraint already exists.
 */

exports.up = (pgm) => {
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
};

exports.down = (pgm) => {
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
