/**
 * Migration: DTP Bank, Recommendations Bank & Assignments
 *
 * This migration creates the tables needed for the DTP and Recommendations Bank features:
 *   1. dtp_bank - Organization-scoped Drug Therapy Problem repository
 *   2. recommendations_bank - Organization-scoped Recommendation repository
 *   3. simulation_group_dtps - DTP assignments to groups/personas with ordering
 *   4. simulation_group_recommendations - Recommendation assignments to groups/personas with ordering
 *
 * Dependencies (from 001_init.js):
 *   organizations, users, simulation_groups, personas
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  // Ensure uuid-ossp is available
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ==========================================================================
  // TABLE 1: dtp_bank
  // ==========================================================================
  // Organization-scoped Drug Therapy Problem repository.
  // Admins: full CRUD.
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS dtp_bank (
      dtp_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
      created_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,

      -- DTP Content
      title varchar(255) NOT NULL,
      expected_dtp_text text NOT NULL,
      clinical_intent text,
      evaluation_criteria text,
      tags text[] DEFAULT '{}',

      -- Assessment Configuration
      is_required boolean DEFAULT false,

      -- Metadata
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT chk_dtp_title_not_empty CHECK (length(trim(title)) > 0),
      CONSTRAINT chk_dtp_text_not_empty CHECK (length(trim(expected_dtp_text)) > 0)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_dtp_bank_org ON dtp_bank(organization_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_dtp_bank_created_by ON dtp_bank(created_by)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_dtp_bank_active ON dtp_bank(is_active)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_dtp_bank_org_active ON dtp_bank(organization_id, is_active)"
  );

  // ==========================================================================
  // TABLE 2: recommendations_bank
  // ==========================================================================
  // Organization-scoped Recommendation repository.
  // Admins: full CRUD.
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS recommendations_bank (
      recommendation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
      created_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,

      -- Recommendation Content
      title varchar(255) NOT NULL,
      recommendation_text text NOT NULL,
      evaluation_criteria text,
      rationale text,

      -- Metadata
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT chk_rec_title_not_empty CHECK (length(trim(title)) > 0),
      CONSTRAINT chk_rec_text_not_empty CHECK (length(trim(recommendation_text)) > 0)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rec_bank_org ON recommendations_bank(organization_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rec_bank_created_by ON recommendations_bank(created_by)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rec_bank_active ON recommendations_bank(is_active)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rec_bank_org_active ON recommendations_bank(organization_id, is_active)"
  );

  // ==========================================================================
  // TABLE 3: simulation_group_dtps
  // ==========================================================================
  // Links DTP items to groups, with optional persona-level specificity and ordering.
  //   persona_id IS NULL  → group-level (applies to all personas)
  //   persona_id = <uuid> → persona-level (applies to one persona)
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS simulation_group_dtps (
      group_dtp_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid NOT NULL REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      dtp_id uuid NOT NULL REFERENCES dtp_bank(dtp_id) ON DELETE CASCADE ON UPDATE CASCADE,

      -- Ordering
      sort_order integer NOT NULL DEFAULT 0,

      -- Audit Trail
      added_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      added_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT unique_group_persona_dtp UNIQUE (simulation_group_id, persona_id, dtp_id)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgd_group ON simulation_group_dtps(simulation_group_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgd_persona ON simulation_group_dtps(persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgd_dtp ON simulation_group_dtps(dtp_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgd_group_persona ON simulation_group_dtps(simulation_group_id, persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgd_group_persona_order ON simulation_group_dtps(simulation_group_id, persona_id, sort_order)"
  );

  // ==========================================================================
  // TABLE 4: simulation_group_recommendations
  // ==========================================================================
  // Links Recommendation items to groups, with optional persona-level specificity and ordering.
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS simulation_group_recommendations (
      group_recommendation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid NOT NULL REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      recommendation_id uuid NOT NULL REFERENCES recommendations_bank(recommendation_id) ON DELETE CASCADE ON UPDATE CASCADE,

      -- Ordering
      sort_order integer NOT NULL DEFAULT 0,

      -- Audit Trail
      added_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      added_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT unique_group_persona_recommendation UNIQUE (simulation_group_id, persona_id, recommendation_id)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgr_group ON simulation_group_recommendations(simulation_group_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgr_persona ON simulation_group_recommendations(persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgr_recommendation ON simulation_group_recommendations(recommendation_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgr_group_persona ON simulation_group_recommendations(simulation_group_id, persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgr_group_persona_order ON simulation_group_recommendations(simulation_group_id, persona_id, sort_order)"
  );
};

/**
 * Rollback
 *
 * WARNING: This will permanently delete all DTP bank, recommendations bank, and assignment data!
 */
exports.down = (pgm) => {
  // Drop tables in reverse dependency order
  pgm.sql("DROP TABLE IF EXISTS simulation_group_recommendations CASCADE");
  pgm.sql("DROP TABLE IF EXISTS simulation_group_dtps CASCADE");
  pgm.sql("DROP TABLE IF EXISTS recommendations_bank CASCADE");
  pgm.sql("DROP TABLE IF EXISTS dtp_bank CASCADE");
};
