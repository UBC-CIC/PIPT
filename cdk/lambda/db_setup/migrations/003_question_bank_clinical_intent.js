/**
 * Migration 003: Add clinical_intent to question_bank
 *
 * The question_bank table stored only question_text and evaluation_criteria,
 * but the UI collects a separate "Clinical Intent" field for each key question
 * (mirroring the dtp_bank.clinical_intent column). Without a dedicated column
 * the value was silently dropped on write and always rendered blank on read.
 *
 * Adds a nullable clinical_intent text column, matching the dtp_bank pattern.
 *
 * Idempotent: uses ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS.
 */

exports.up = (pgm) => {
  pgm.sql(
    `ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS clinical_intent text`,
  );
};

exports.down = (pgm) => {
  pgm.sql(
    `ALTER TABLE public.question_bank DROP COLUMN IF EXISTS clinical_intent`,
  );
};
