/**
 * Migration 002: Database-level settings
 *
 * Sets connection safety timeouts to prevent runaway queries and
 * stale transactions.
 *
 * WHY THIS IS A SEPARATE MIGRATION:
 * ALTER DATABASE cannot run inside a PostgreSQL transaction block. If we
 * put these in 001_baseline alongside the schema creation, we'd have to
 * disable the transaction wrapper for the entire baseline — losing the
 * ability to cleanly roll back if any part of the schema creation fails.
 * By isolating ALTER DATABASE here, the baseline gets full transaction
 * safety, and this tiny migration runs non-transactionally on its own
 * (it's just two SET calls that are inherently idempotent).
 *
 * Idempotent: re-setting the same value is a no-op.
 */

exports.config = { transaction: false };

exports.up = (pgm) => {
  pgm.sql(`ALTER DATABASE genrx SET statement_timeout = '30s'`);
  pgm.sql(`ALTER DATABASE genrx SET idle_in_transaction_session_timeout = '60s'`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER DATABASE genrx RESET statement_timeout`);
  pgm.sql(`ALTER DATABASE genrx RESET idle_in_transaction_session_timeout`);
};
