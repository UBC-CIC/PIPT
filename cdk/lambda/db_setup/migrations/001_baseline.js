/**
 * Migration 001: Baseline Schema
 * ================================
 * Consolidated baseline representing the full database schema produced by
 * the original 22 migrations (001_init through 022_matching_thresholds).
 *
 * WHAT IT DOES:
 *   Reads baseline_schema.sql and executes it. Every statement in that file
 *   uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, or
 *   DO $$ IF NOT EXISTS guards on constraints/foreign keys.
 *
 * FRESH DEPLOY (new account, empty database):
 *   Creates the entire schema from scratch in one shot.
 *
 * EXISTING DEPLOY (populated database, 22 migrations already ran):
 *   Every statement no-ops because everything already exists. The migration
 *   just gets recorded in pgmigrations and moves on.
 *
 * COEXISTENCE WITH OLD MIGRATIONS:
 *   The old 001_init through 022_matching_thresholds files are still in this
 *   folder. On existing deploys they're already in pgmigrations
 *   so they get skipped. On fresh deploys they run after this baseline but
 *   no-op because the schema already exists. They are safe to delete later
 *   once all environments have deployed this baseline at least once.
 *
 * WHY 002_database_settings IS SEPARATE:
 *   PostgreSQL cannot run ALTER DATABASE inside a transaction. node-pg-migrate
 *   wraps each migration in a transaction by default, giving us automatic
 *   rollback if anything fails halfway. If ALTER DATABASE were in this file,
 *   we'd have to disable the transaction wrapper — meaning a failure partway
 *   through schema creation leaves the DB in a broken half-applied state with
 *   no rollback. Keeping ALTER DATABASE in 002 lets this baseline stay fully
 *   transactional: it either succeeds completely or rolls back cleanly.
 */

const fs = require("fs");
const path = require("path");



exports.up = (pgm) => {
  const sql = fs.readFileSync(
    path.join(__dirname, "baseline_schema.sql"),
    "utf8",
  );
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  pgm.sql("GRANT ALL ON SCHEMA public TO public;");
};
