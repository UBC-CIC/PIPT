/**
 * Migration: Add system_prompt column to organizations
 *
 * This column was originally part of 004_organization_details but was added
 * after that migration had already been applied on the main deployment.
 * This migration ensures the column exists on all environments.
 *
 * Idempotent: Uses IF NOT EXISTS, safe to run on environments where it already exists.
 */

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS system_prompt text`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE organizations DROP COLUMN IF EXISTS system_prompt`);
};
