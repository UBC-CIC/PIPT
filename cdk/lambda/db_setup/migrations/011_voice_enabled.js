exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT true`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE personas DROP COLUMN IF EXISTS voice_enabled`);
};
