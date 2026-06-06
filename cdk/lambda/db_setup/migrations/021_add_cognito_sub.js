exports.up = (pgm) => {
  // Add cognito_sub column to store the immutable Cognito user identifier.
  // Nullable so existing rows are unaffected until the user signs in again.
  // UNIQUE ensures no two rows can share the same Cognito identity.
  pgm.sql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS cognito_sub varchar UNIQUE
  `);

  // Index for fast lookups by cognito_sub (the unique constraint already creates
  // an index, but being explicit makes intent clear for future readers).
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub)
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_users_cognito_sub`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS cognito_sub`);
};
