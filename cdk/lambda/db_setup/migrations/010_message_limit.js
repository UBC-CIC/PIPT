/**
 * Migration 009: Add max_messages_per_chat to simulation_groups
 *
 * Allows admins to configure a per-chat message limit for students
 * in a simulation group. NULL means unlimited.
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'simulation_groups' AND column_name = 'max_messages_per_chat') THEN
        ALTER TABLE simulation_groups ADD COLUMN max_messages_per_chat integer DEFAULT NULL;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE simulation_groups DROP COLUMN IF EXISTS max_messages_per_chat;
  `);
};
