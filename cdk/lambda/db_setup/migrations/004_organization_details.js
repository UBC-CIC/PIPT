/**
 * Migration: Organization Detail Columns
 *
 * Adds columns to the organizations table to support admin-configurable
 * display labels (AI persona name, user role name) and visual styling.
 *
 * Dependencies: organizations table from 001_init.js
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description text`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_persona varchar DEFAULT 'Patient'`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS user_role varchar DEFAULT 'Student'`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS icon_color varchar DEFAULT '#03045E'`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS system_prompt text`);
};

exports.down = (pgm) => {
  pgm.sql("ALTER TABLE organizations DROP COLUMN IF EXISTS description");
  pgm.sql("ALTER TABLE organizations DROP COLUMN IF EXISTS ai_persona");
  pgm.sql("ALTER TABLE organizations DROP COLUMN IF EXISTS user_role");
  pgm.sql("ALTER TABLE organizations DROP COLUMN IF EXISTS icon_color");
  pgm.sql("ALTER TABLE organizations DROP COLUMN IF EXISTS system_prompt");
};
