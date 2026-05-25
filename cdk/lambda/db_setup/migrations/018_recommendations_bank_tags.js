/**
 * Migration 018: Add tags column to recommendations_bank
 *
 * Adds a tags text[] column to recommendations_bank to match dtp_bank's schema.
 * Enables categorization via reserved tags (e.g., 'patient_specific') for
 * filtering items into general vs patient-specific pools in the UI.
 *
 * This is a metadata-only operation on PG 11+ (ADD COLUMN with DEFAULT does not
 * rewrite the table), so it's safe to run without downtime.
 */

exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE recommendations_bank
    ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE recommendations_bank
    DROP COLUMN IF EXISTS tags
  `);
};
