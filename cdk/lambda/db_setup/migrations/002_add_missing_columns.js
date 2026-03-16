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

  // Add instructor_voice_enabled column to simulation_groups table
  pgm.sql(`
    ALTER TABLE simulation_groups
    ADD COLUMN IF NOT EXISTS instructor_voice_enabled boolean DEFAULT true
  `);
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE users DROP COLUMN IF EXISTS username");
  pgm.sql("ALTER TABLE personas DROP COLUMN IF EXISTS llm_completion");
  pgm.sql("ALTER TABLE simulation_groups DROP COLUMN IF EXISTS instructor_voice_enabled");
};
