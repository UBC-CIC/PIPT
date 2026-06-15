/**
 * Migration: Matching Threshold Columns
 *
 * Adds per-organization configurable similarity thresholds for key question
 * matching, DTP matching, and recommendation matching.
 *
 * Each column is nullable — NULL means "use system default (0.55)".
 * CHECK constraints ensure non-NULL values are in [0.0, 1.0].
 *
 * Dependencies: organizations table from 001_init.js
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS key_question_threshold NUMERIC(5,4)`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dtp_threshold NUMERIC(5,4)`);
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS recommendation_threshold NUMERIC(5,4)`);
  pgm.sql(`DO $$ BEGIN ALTER TABLE organizations ADD CONSTRAINT chk_key_question_threshold CHECK (key_question_threshold IS NULL OR (key_question_threshold >= 0.0 AND key_question_threshold <= 1.0)); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  pgm.sql(`DO $$ BEGIN ALTER TABLE organizations ADD CONSTRAINT chk_dtp_threshold CHECK (dtp_threshold IS NULL OR (dtp_threshold >= 0.0 AND dtp_threshold <= 1.0)); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  pgm.sql(`DO $$ BEGIN ALTER TABLE organizations ADD CONSTRAINT chk_recommendation_threshold CHECK (recommendation_threshold IS NULL OR (recommendation_threshold >= 0.0 AND recommendation_threshold <= 1.0)); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_recommendation_threshold`);
  pgm.sql(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_dtp_threshold`);
  pgm.sql(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_key_question_threshold`);
  pgm.sql(`ALTER TABLE organizations DROP COLUMN IF EXISTS recommendation_threshold`);
  pgm.sql(`ALTER TABLE organizations DROP COLUMN IF EXISTS dtp_threshold`);
  pgm.sql(`ALTER TABLE organizations DROP COLUMN IF EXISTS key_question_threshold`);
};
