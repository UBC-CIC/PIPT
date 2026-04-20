exports.up = (pgm) => {
  // ==========================================================================
  // DEBRIEF FEEDBACK
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS debrief_feedback (
      feedback_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE,
      chat_id uuid REFERENCES chats(chat_id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
      is_helpful boolean NOT NULL,
      comment text,
      submitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debrief_feedback_chat ON debrief_feedback(chat_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_debrief_feedback_user ON debrief_feedback(user_id)",
  );

  // ==========================================================================
  // ISSUE REPORTS
  // ==========================================================================

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS issue_reports (
      report_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      simulation_group_id uuid REFERENCES simulation_groups(simulation_group_id) ON DELETE CASCADE,
      persona_id uuid REFERENCES personas(persona_id) ON DELETE CASCADE,
      chat_id uuid REFERENCES chats(chat_id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
      issue_categories varchar[] NOT NULL,
      details text,
      submitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_issue_reports_chat ON issue_reports(chat_id)",
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_issue_reports_user ON issue_reports(user_id)",
  );
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS issue_reports CASCADE");
  pgm.sql("DROP TABLE IF EXISTS debrief_feedback CASCADE");
};
