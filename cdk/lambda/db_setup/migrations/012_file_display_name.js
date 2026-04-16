exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE persona_data ADD COLUMN IF NOT EXISTS display_name varchar`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE persona_data DROP COLUMN IF EXISTS display_name`);
};
