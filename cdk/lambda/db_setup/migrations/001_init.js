exports.up = (pgm) => {
  // ==========================================================================
  // Extensions
  // ==========================================================================
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "vector"');

  // ==========================================================================
  // USERS & ORGANIZATIONS
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS organizations (
      organization_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar,
      type varchar,
      created_at timestamp DEFAULT now()
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      user_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid REFERENCES organizations(organization_id) ON DELETE SET NULL ON UPDATE CASCADE,
      user_email varchar UNIQUE,
      first_name varchar,
      last_name varchar,
      time_account_created timestamptz NOT NULL DEFAULT now(),
      roles varchar[],
      last_sign_in timestamptz
    )
  `);

  // ==========================================================================
  // SIMULATION GROUPS & PERSONAS
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS simulation_groups (
      simulation_group_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid REFERENCES organizations(organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
      created_by uuid REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      group_name varchar,
      group_description varchar,
      group_access_code varchar,
      group_student_access boolean,
      system_prompt text
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_simulation_groups_org ON simulation_groups(organization_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS group_instructors (
      group_instructor_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      added_by uuid REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      added_at timestamp DEFAULT now(),
      UNIQUE(simulation_group_id, user_id)
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_group_instructors_user ON group_instructors(user_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS personas (
      persona_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_name varchar,
      persona_age integer,
      persona_gender varchar,
      persona_number integer,
      persona_prompt text,
      average_wpm integer,
      voice_id varchar DEFAULT 'tiffany',
      interaction_mode varchar
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_personas_group ON personas(simulation_group_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS persona_media (
      media_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      media_type varchar,
      url varchar,
      title varchar,
      description text,
      created_at timestamp DEFAULT now()
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_persona_media_persona ON persona_media(persona_id)",
  );

  // ==========================================================================
  // RUBRICS & ASSESSMENT
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS rubrics (
      rubric_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      name varchar,
      description text,
      created_at timestamp DEFAULT now()
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rubrics_group ON rubrics(simulation_group_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_rubrics_persona ON rubrics(persona_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS key_questions (
      question_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      rubric_id uuid REFERENCES rubrics(rubric_id) ON DELETE CASCADE ON UPDATE CASCADE,
      question_text text,
      category varchar,
      "order" integer,
      weight float,
      max_score integer
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_key_questions_rubric ON key_questions(rubric_id)",
  );

  // ==========================================================================
  // ENROLLMENTS & STUDENT PROGRESS
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS enrollments (
      enrollment_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE ON UPDATE CASCADE,
      enrollment_type varchar,
      group_completion_percentage integer,
      time_enrolled timestamp,
      UNIQUE(simulation_group_id, user_id)
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS student_interactions (
      student_interaction_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      enrollment_id uuid REFERENCES enrollments(enrollment_id) ON DELETE CASCADE ON UPDATE CASCADE,
      persona_score integer,
      last_accessed timestamp,
      persona_context_embedding float[],
      is_completed boolean DEFAULT false
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_student_interactions_enrollment ON student_interactions(enrollment_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_student_interactions_persona ON student_interactions(persona_id)",
  );

  // ==========================================================================
  // CHATS & MESSAGES
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS chats (
      chat_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_interaction_id uuid REFERENCES student_interactions(student_interaction_id) ON DELETE CASCADE ON UPDATE CASCADE,
      chat_name varchar,
      chat_context_embeddings float[],
      last_accessed timestamp,
      notes text
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_chats_interaction ON chats(student_interaction_id)",
  );

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      chat_id uuid REFERENCES chats(chat_id) ON DELETE CASCADE ON UPDATE CASCADE,
      student_sent boolean,
      message_content varchar,
      time_sent timestamp,
      quality_score integer,
      quality_feedback text,
      suggested_rewrite text
    )
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)");

  // ==========================================================================
  // DEBRIEFS
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS debriefs (
      debrief_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      chat_id uuid REFERENCES chats(chat_id) ON DELETE CASCADE ON UPDATE CASCADE,
      generated_text text,
      missing_key_questions jsonb,
      reasoning_gaps text,
      rubric_scores jsonb,
      created_at timestamp DEFAULT now()
    )
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_debriefs_chat ON debriefs(chat_id)");

  // ==========================================================================
  // ANALYTICS & LOGGING
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_engagement_log (
      log_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE SET NULL ON UPDATE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE SET NULL ON UPDATE CASCADE,
      enrollment_id uuid REFERENCES enrollments(enrollment_id) ON DELETE SET NULL ON UPDATE CASCADE,
      timestamp timestamp,
      engagement_type varchar,
      engagement_details text
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_engagement_log_user ON user_engagement_log(user_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_engagement_log_timestamp ON user_engagement_log(timestamp)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_engagement_log_group ON user_engagement_log(simulation_group_id)",
  );

  // ==========================================================================
  // FEEDBACK
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS feedback (
      feedback_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      chat_id uuid REFERENCES chats(chat_id) ON DELETE CASCADE ON UPDATE CASCADE,
      score integer,
      analysis text,
      areas_for_improvement varchar[],
      submitted_at timestamp DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_feedback_chat ON feedback(chat_id)");

  // ==========================================================================
  // SYSTEM CONFIGURATION
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS system_prompt_history (
      history_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      modified_by uuid REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
      organization_id uuid REFERENCES organizations(organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
      prompt_content text NOT NULL,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_prompt_history_org ON system_prompt_history(organization_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_prompt_history_created ON system_prompt_history(created_at)",
  );

  // ==========================================================================
  // PERSONA DATA — Uploaded knowledge base files
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS persona_data (
      file_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE ON UPDATE CASCADE,
      filetype varchar,
      s3_bucket_reference varchar,
      filepath varchar,
      filename varchar,
      time_uploaded timestamp,
      metadata text,
      file_number integer,
      ingestion_status varchar(20) DEFAULT 'not processing'
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_persona_data_persona ON persona_data(persona_id)",
  );
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS persona_data CASCADE");
  pgm.sql("DROP TABLE IF EXISTS system_prompt_history CASCADE");
  pgm.sql("DROP TABLE IF EXISTS feedback CASCADE");
  pgm.sql("DROP TABLE IF EXISTS user_engagement_log CASCADE");
  pgm.sql("DROP TABLE IF EXISTS debriefs CASCADE");
  pgm.sql("DROP TABLE IF EXISTS messages CASCADE");
  pgm.sql("DROP TABLE IF EXISTS chats CASCADE");
  pgm.sql("DROP TABLE IF EXISTS student_interactions CASCADE");
  pgm.sql("DROP TABLE IF EXISTS enrollments CASCADE");
  pgm.sql("DROP TABLE IF EXISTS key_questions CASCADE");
  pgm.sql("DROP TABLE IF EXISTS rubrics CASCADE");
  pgm.sql("DROP TABLE IF EXISTS persona_media CASCADE");
  pgm.sql("DROP TABLE IF EXISTS persona_data CASCADE");
  pgm.sql("DROP TABLE IF EXISTS personas CASCADE");
  pgm.sql("DROP TABLE IF EXISTS group_instructors CASCADE");
  pgm.sql("DROP TABLE IF EXISTS simulation_groups CASCADE");
  pgm.sql("DROP TABLE IF EXISTS users CASCADE");
  pgm.sql("DROP TABLE IF EXISTS organizations CASCADE");
  pgm.sql('DROP EXTENSION IF EXISTS "vector"');
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"');
};
