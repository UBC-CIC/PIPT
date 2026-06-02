exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS voice_persona_prompt TEXT NULL`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE personas DROP COLUMN IF EXISTS voice_persona_prompt`);
};
