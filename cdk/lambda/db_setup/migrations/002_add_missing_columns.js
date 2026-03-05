exports.up = (pgm) => {
  // Add username column to users table (used by POST /student/create_user)
  pgm.sql(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username varchar
  `);

  // Add llm_completion column to personas table (used by GET /instructor/analytics)
  pgm.sql(`
    ALTER TABLE personas
    ADD COLUMN IF NOT EXISTS llm_completion boolean DEFAULT false
  `);
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE users DROP COLUMN IF EXISTS username");
  pgm.sql("ALTER TABLE personas DROP COLUMN IF EXISTS llm_completion");
};
