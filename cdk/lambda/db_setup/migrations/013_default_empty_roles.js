/**
 * Migration 013: Default empty roles to ['student']
 *
 * Ensures every user has at least one role assigned. Users with NULL
 * or empty roles arrays are updated to ARRAY['student'] as part of
 * the Cognito auth decoupling — the database is now the single
 * source of truth for roles.
 *
 * Idempotent: only touches rows where roles are NULL or empty.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      updated_count integer;
    BEGIN
      UPDATE users
      SET roles = ARRAY['student']
      WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'Migration 013: defaulted roles to [student] for % user(s)', updated_count;
    END $$;
  `);
};

exports.down = (pgm) => {
  // No-op: we cannot reliably determine which users had NULL roles
  // before this migration ran, so reverting would risk data loss.
  // If a rollback is needed, restore from a database backup.
};
