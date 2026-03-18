/**
 * Migration: Question Bank, Assignments & Analytics
 *
 * This migration creates/alters the tables needed for the question bank feature:
 *   1. question_bank - Organization-scoped question repository
 *   2. simulation_group_questions - Question assignments to groups/personas
 *   3. question_interactions - Per-question analytics and tracking
 *   4. ALTER debriefs - Add denormalized columns and aggregate metrics
 *
 * Dependencies (from 001_init.js):
 *   organizations, users, simulation_groups, personas, chats, debriefs
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  // Ensure uuid-ossp is available
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // ==========================================================================
  // TABLE 1: question_bank
  // ==========================================================================
  // Organization-scoped question repository.
  // Admins: full CRUD. Instructors: create only.
  // Soft-delete via is_active flag.
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS question_bank (
      question_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
      created_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,

      -- Question Content
      title varchar(255) NOT NULL,
      question_text text NOT NULL,
      evaluation_criteria text NOT NULL,

      -- Categorization
      category varchar(100),
      difficulty_level varchar(50),

      -- Assessment Configuration
      is_mandatory boolean DEFAULT false,
      weight float DEFAULT 1.0,
      max_score integer DEFAULT 100,

      -- Metadata
      is_active boolean DEFAULT true,
      created_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT chk_qb_weight_positive CHECK (weight > 0),
      CONSTRAINT chk_qb_max_score_positive CHECK (max_score > 0),
      CONSTRAINT chk_qb_title_not_empty CHECK (length(trim(title)) > 0),
      CONSTRAINT chk_qb_question_text_not_empty CHECK (length(trim(question_text)) > 0),
      CONSTRAINT chk_qb_evaluation_criteria_not_empty CHECK (length(trim(evaluation_criteria)) > 0)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_org ON question_bank(organization_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_created_by ON question_bank(created_by)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_active ON question_bank(is_active)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_category ON question_bank(category)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty_level)"
  );
  // Composite: common filter pattern
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_question_bank_org_active ON question_bank(organization_id, is_active)"
  );

  // ==========================================================================
  // TABLE 2: simulation_group_questions
  // ==========================================================================
  // Links questions to groups, with optional persona-level specificity.
  //   persona_id IS NULL  → group-level (applies to all personas)
  //   persona_id = <uuid> → persona-level (applies to one persona)
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS simulation_group_questions (
      group_question_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid NOT NULL REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      question_id uuid NOT NULL REFERENCES question_bank(question_id) ON DELETE CASCADE ON UPDATE CASCADE,

      -- Per-Assignment Customization
      weight_override float,
      max_score_override integer,
      "order" integer NOT NULL DEFAULT 0,

      -- Audit Trail
      added_by uuid NOT NULL REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      added_at timestamp DEFAULT now(),

      -- Constraints
      CONSTRAINT unique_group_persona_question UNIQUE (simulation_group_id, persona_id, question_id),
      CONSTRAINT chk_sgq_weight_override_positive CHECK (weight_override IS NULL OR weight_override > 0),
      CONSTRAINT chk_sgq_max_score_override_positive CHECK (max_score_override IS NULL OR max_score_override > 0),
      CONSTRAINT chk_sgq_order_non_negative CHECK ("order" >= 0)
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgq_group ON simulation_group_questions(simulation_group_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgq_persona ON simulation_group_questions(persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgq_question ON simulation_group_questions(question_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_sgq_added_by ON simulation_group_questions(added_by)"
  );
  // Composite: group + persona lookup
  pgm.sql(
    'CREATE INDEX IF NOT EXISTS idx_sgq_group_persona ON simulation_group_questions(simulation_group_id, persona_id)'
  );
  // Ordering
  pgm.sql(
    'CREATE INDEX IF NOT EXISTS idx_sgq_order ON simulation_group_questions("order")'
  );

  // ==========================================================================
  // TABLE 3: question_interactions
  // ==========================================================================
  // Real-time, per-question tracking of student interactions during chat.
  // Never deleted — serves as an audit/analytics trail.
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS question_interactions (
      interaction_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

      -- Core relationships
      chat_id uuid REFERENCES chats(chat_id) ON DELETE SET NULL ON UPDATE CASCADE,
      question_id uuid NOT NULL REFERENCES question_bank(question_id) ON DELETE CASCADE ON UPDATE CASCADE,
      student_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE SET NULL ON UPDATE CASCADE,
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE SET NULL ON UPDATE CASCADE,

      -- Question status
      was_asked boolean DEFAULT false,
      is_correct boolean,
      message_id uuid,

      -- Quality metrics
      quality_score integer,
      quality_feedback text,
      semantic_similarity_score float,

      -- Temporal data
      asked_at timestamp,
      time_to_ask_seconds integer,

      -- Context
      attempt_number integer DEFAULT 1,

      -- Metadata
      created_at timestamp DEFAULT now(),
      updated_at timestamp
    )
  `);

  // Indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_student ON question_interactions(student_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_question ON question_interactions(question_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_group ON question_interactions(simulation_group_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_asked_at ON question_interactions(asked_at)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_chat ON question_interactions(chat_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_correct ON question_interactions(is_correct)"
  );
  // Composite: group-level question analytics
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_group_question ON question_interactions(simulation_group_id, question_id)"
  );
  // Composite: individual student analytics
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_qi_student_question ON question_interactions(student_id, question_id)"
  );

  // ==========================================================================
  // ALTER TABLE: debriefs
  // ==========================================================================
  // Add denormalized columns and aggregate metrics to existing debriefs table.
  // The base table (debrief_id, chat_id, generated_text, missing_key_questions,
  // reasoning_gaps, rubric_scores, created_at) already exists from 001_init.js.
  // ==========================================================================

  pgm.sql(`
    DO $$
    BEGIN
      -- Denormalized FKs for fast queries
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'student_id') THEN
        ALTER TABLE debriefs ADD COLUMN student_id uuid REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'persona_id') THEN
        ALTER TABLE debriefs ADD COLUMN persona_id uuid REFERENCES personas(persona_id) ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'simulation_group_id') THEN
        ALTER TABLE debriefs ADD COLUMN simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      -- Aggregate metrics for quick visualization
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'total_questions_assigned') THEN
        ALTER TABLE debriefs ADD COLUMN total_questions_assigned integer;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'total_questions_asked') THEN
        ALTER TABLE debriefs ADD COLUMN total_questions_asked integer;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'total_questions_missed') THEN
        ALTER TABLE debriefs ADD COLUMN total_questions_missed integer;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'debriefs' AND column_name = 'overall_score') THEN
        ALTER TABLE debriefs ADD COLUMN overall_score float;
      END IF;
    END $$;
  `);

  // Debriefs indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_student ON debriefs(student_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_persona ON debriefs(persona_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_group ON debriefs(simulation_group_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_created_at ON debriefs(created_at)"
  );
  // Composite: student debrief history
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_student_created ON debriefs(student_id, created_at)"
  );
  // GIN indexes for JSONB fields
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_missing_questions ON debriefs USING GIN (missing_key_questions)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debriefs_rubric_scores ON debriefs USING GIN (rubric_scores)"
  );

  // Add unique constraint on chat_id if missing
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'unique_chat_debrief') THEN
        ALTER TABLE debriefs ADD CONSTRAINT unique_chat_debrief UNIQUE (chat_id);
      END IF;
    END $$;
  `);
};

/**
 * Rollback
 *
 * WARNING: This will permanently delete all question bank and interaction data!
 */
exports.down = (pgm) => {
  // Drop new tables (reverse dependency order)
  pgm.sql("DROP TABLE IF EXISTS question_interactions CASCADE");
  pgm.sql("DROP TABLE IF EXISTS simulation_group_questions CASCADE");
  pgm.sql("DROP TABLE IF EXISTS question_bank CASCADE");

  // Remove added columns from debriefs (keep the table itself — owned by 001_init)
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS student_id");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS persona_id");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS simulation_group_id");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS total_questions_assigned");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS total_questions_asked");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS total_questions_missed");
  pgm.sql("ALTER TABLE debriefs DROP COLUMN IF EXISTS overall_score");
  pgm.sql("ALTER TABLE debriefs DROP CONSTRAINT IF EXISTS unique_chat_debrief");
};
