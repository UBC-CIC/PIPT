--
-- GenRx Baseline Schema
-- Generated from pg_dump of production database, cleaned for idempotent deployment.
-- Note: "public." prefix on all objects is pg_dump's default output style — functionally
-- identical to unqualified names since public is the default schema.
--

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ==========================================================================
-- TABLES
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    organization_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying,
    type character varying,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    ai_persona character varying DEFAULT 'Patient'::character varying,
    user_role character varying DEFAULT 'Student'::character varying,
    icon_color character varying DEFAULT '#03045E'::character varying,
    system_prompt text,
    key_question_threshold numeric(5,4),
    dtp_threshold numeric(5,4),
    recommendation_threshold numeric(5,4),
    CONSTRAINT chk_dtp_threshold CHECK (((dtp_threshold IS NULL) OR ((dtp_threshold >= 0.0) AND (dtp_threshold <= 1.0)))),
    CONSTRAINT chk_key_question_threshold CHECK (((key_question_threshold IS NULL) OR ((key_question_threshold >= 0.0) AND (key_question_threshold <= 1.0)))),
    CONSTRAINT chk_recommendation_threshold CHECK (((recommendation_threshold IS NULL) OR ((recommendation_threshold >= 0.0) AND (recommendation_threshold <= 1.0))))
);

CREATE TABLE IF NOT EXISTS public.users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_email character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    time_account_created timestamp with time zone DEFAULT now() NOT NULL,
    roles character varying[] DEFAULT ARRAY['student'::text] NOT NULL,
    last_sign_in timestamp with time zone,
    username character varying,
    cognito_sub character varying
);

CREATE TABLE IF NOT EXISTS public.simulation_groups (
    simulation_group_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    created_by uuid,
    group_name character varying NOT NULL,
    group_description character varying,
    group_access_code character varying,
    group_student_access boolean,
    system_prompt text,
    instructor_voice_enabled boolean DEFAULT true,
    debrief_prompt text,
    max_messages_per_chat integer
);

CREATE TABLE IF NOT EXISTS public.group_instructors (
    group_instructor_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid,
    user_id uuid,
    added_by uuid,
    added_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.personas (
    persona_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid NOT NULL,
    persona_name character varying NOT NULL,
    persona_age integer,
    persona_gender character varying,
    persona_number integer,
    persona_prompt text,
    average_wpm integer,
    voice_id character varying DEFAULT 'tiffany'::character varying,
    interaction_mode character varying,
    llm_completion boolean DEFAULT false,
    voice_enabled boolean DEFAULT true,
    voice_persona_prompt text
);

CREATE TABLE IF NOT EXISTS public.persona_media (
    media_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    persona_id uuid,
    media_type character varying,
    url character varying,
    title character varying,
    description text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.persona_data (
    file_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    persona_id uuid,
    filetype character varying,
    s3_bucket_reference character varying,
    filepath character varying,
    filename character varying,
    time_uploaded timestamp without time zone,
    metadata text,
    file_number integer,
    ingestion_status character varying(20) DEFAULT 'not processing'::character varying,
    display_name character varying
);

CREATE TABLE IF NOT EXISTS public.rubrics (
    rubric_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid,
    persona_id uuid,
    name character varying,
    description text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.key_questions (
    question_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rubric_id uuid,
    question_text text,
    category character varying,
    "order" integer,
    weight double precision,
    max_score integer
);

CREATE TABLE IF NOT EXISTS public.enrollments (
    enrollment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    simulation_group_id uuid,
    enrollment_type character varying NOT NULL,
    group_completion_percentage integer,
    time_enrolled timestamp without time zone,
    CONSTRAINT chk_enrollment_type CHECK (((enrollment_type)::text = ANY ((ARRAY['student'::character varying, 'instructor'::character varying, 'preview'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.student_interactions (
    student_interaction_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    persona_id uuid,
    enrollment_id uuid,
    persona_score integer,
    last_accessed timestamp without time zone,
    persona_context_embedding double precision[],
    is_completed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.chats (
    chat_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_interaction_id uuid NOT NULL,
    chat_name character varying,
    chat_context_embeddings double precision[],
    last_accessed timestamp without time zone,
    notes text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    status character varying DEFAULT 'active'::character varying,
    recommendation text,
    dtp_submission jsonb,
    recommendation_submission jsonb,
    CONSTRAINT chats_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'concluded'::character varying, 'expired'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.messages (
    message_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid NOT NULL,
    message_content text,
    sent_at timestamp with time zone,
    sender_type character varying NOT NULL,
    user_id uuid,
    matched_question_ids jsonb,
    CONSTRAINT chk_sender_type CHECK (((sender_type)::text = ANY ((ARRAY['student'::character varying, 'ai'::character varying, 'system'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.debriefs (
    debrief_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid,
    generated_text text,
    missing_key_questions jsonb,
    reasoning_gaps text,
    rubric_scores jsonb,
    created_at timestamp without time zone DEFAULT now(),
    student_id uuid,
    persona_id uuid,
    simulation_group_id uuid,
    total_questions_assigned integer,
    total_questions_asked integer,
    total_questions_missed integer,
    overall_score double precision
);

CREATE TABLE IF NOT EXISTS public.feedback (
    feedback_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid,
    score integer,
    analysis text,
    areas_for_improvement character varying[],
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.debrief_feedback (
    feedback_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid,
    persona_id uuid,
    chat_id uuid,
    user_id uuid,
    is_helpful boolean NOT NULL,
    comment text,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.debrief_prompt_history (
    history_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    modified_by uuid,
    simulation_group_id uuid,
    prompt_content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.issue_reports (
    report_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid,
    persona_id uuid,
    chat_id uuid,
    user_id uuid,
    issue_categories character varying[] NOT NULL,
    details text,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_engagement_log (
    log_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    simulation_group_id uuid,
    persona_id uuid,
    enrollment_id uuid,
    "timestamp" timestamp without time zone,
    engagement_type character varying,
    engagement_details text
);

CREATE TABLE IF NOT EXISTS public.system_prompt_history (
    history_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    modified_by uuid,
    organization_id uuid,
    prompt_content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.question_bank (
    question_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    question_text text NOT NULL,
    evaluation_criteria text NOT NULL,
    category character varying(100),
    difficulty_level character varying(50),
    is_mandatory boolean DEFAULT false,
    weight double precision DEFAULT 1.0,
    max_score integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tags character varying[] DEFAULT '{}'::character varying[],
    CONSTRAINT chk_qb_evaluation_criteria_not_empty CHECK ((length(TRIM(BOTH FROM evaluation_criteria)) > 0)),
    CONSTRAINT chk_qb_max_score_positive CHECK ((max_score > 0)),
    CONSTRAINT chk_qb_question_text_not_empty CHECK ((length(TRIM(BOTH FROM question_text)) > 0)),
    CONSTRAINT chk_qb_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0)),
    CONSTRAINT chk_qb_weight_positive CHECK ((weight > (0)::double precision))
);

CREATE TABLE IF NOT EXISTS public.question_interactions (
    interaction_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid,
    question_id uuid NOT NULL,
    student_id uuid NOT NULL,
    persona_id uuid,
    simulation_group_id uuid,
    was_asked boolean DEFAULT false,
    is_correct boolean,
    message_id uuid,
    quality_score integer,
    quality_feedback text,
    semantic_similarity_score double precision,
    asked_at timestamp without time zone,
    time_to_ask_seconds integer,
    attempt_number integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.simulation_group_questions (
    group_question_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid NOT NULL,
    persona_id uuid,
    question_id uuid NOT NULL,
    weight_override double precision,
    max_score_override integer,
    "order" integer DEFAULT 0 NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_sgq_max_score_override_positive CHECK (((max_score_override IS NULL) OR (max_score_override > 0))),
    CONSTRAINT chk_sgq_order_non_negative CHECK (("order" >= 0)),
    CONSTRAINT chk_sgq_weight_override_positive CHECK (((weight_override IS NULL) OR (weight_override > (0)::double precision)))
);

CREATE TABLE IF NOT EXISTS public.dtp_bank (
    dtp_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    expected_dtp_text text NOT NULL,
    clinical_intent text,
    evaluation_criteria text,
    tags text[] DEFAULT '{}'::text[],
    is_required boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_dtp_text_not_empty CHECK ((length(TRIM(BOTH FROM expected_dtp_text)) > 0)),
    CONSTRAINT chk_dtp_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0))
);

CREATE TABLE IF NOT EXISTS public.simulation_group_dtps (
    group_dtp_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid NOT NULL,
    persona_id uuid,
    dtp_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommendations_bank (
    recommendation_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    recommendation_text text NOT NULL,
    evaluation_criteria text,
    rationale text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT chk_rec_text_not_empty CHECK ((length(TRIM(BOTH FROM recommendation_text)) > 0)),
    CONSTRAINT chk_rec_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0))
);

CREATE TABLE IF NOT EXISTS public.simulation_group_recommendations (
    group_recommendation_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    simulation_group_id uuid NOT NULL,
    persona_id uuid,
    recommendation_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp without time zone DEFAULT now()
);

-- ==========================================================================
-- PRIMARY KEYS
-- ==========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_pkey') THEN
    ALTER TABLE ONLY public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (organization_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_groups_pkey') THEN
    ALTER TABLE ONLY public.simulation_groups ADD CONSTRAINT simulation_groups_pkey PRIMARY KEY (simulation_group_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_instructors_pkey') THEN
    ALTER TABLE ONLY public.group_instructors ADD CONSTRAINT group_instructors_pkey PRIMARY KEY (group_instructor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personas_pkey') THEN
    ALTER TABLE ONLY public.personas ADD CONSTRAINT personas_pkey PRIMARY KEY (persona_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_media_pkey') THEN
    ALTER TABLE ONLY public.persona_media ADD CONSTRAINT persona_media_pkey PRIMARY KEY (media_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_data_pkey') THEN
    ALTER TABLE ONLY public.persona_data ADD CONSTRAINT persona_data_pkey PRIMARY KEY (file_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rubrics_pkey') THEN
    ALTER TABLE ONLY public.rubrics ADD CONSTRAINT rubrics_pkey PRIMARY KEY (rubric_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'key_questions_pkey') THEN
    ALTER TABLE ONLY public.key_questions ADD CONSTRAINT key_questions_pkey PRIMARY KEY (question_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_pkey') THEN
    ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_pkey PRIMARY KEY (enrollment_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_interactions_pkey') THEN
    ALTER TABLE ONLY public.student_interactions ADD CONSTRAINT student_interactions_pkey PRIMARY KEY (student_interaction_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_pkey') THEN
    ALTER TABLE ONLY public.chats ADD CONSTRAINT chats_pkey PRIMARY KEY (chat_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_pkey') THEN
    ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (message_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debriefs_pkey') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT debriefs_pkey PRIMARY KEY (debrief_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_pkey') THEN
    ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_pkey PRIMARY KEY (feedback_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_feedback_pkey') THEN
    ALTER TABLE ONLY public.debrief_feedback ADD CONSTRAINT debrief_feedback_pkey PRIMARY KEY (feedback_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_prompt_history_pkey') THEN
    ALTER TABLE ONLY public.debrief_prompt_history ADD CONSTRAINT debrief_prompt_history_pkey PRIMARY KEY (history_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_reports_pkey') THEN
    ALTER TABLE ONLY public.issue_reports ADD CONSTRAINT issue_reports_pkey PRIMARY KEY (report_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_engagement_log_pkey') THEN
    ALTER TABLE ONLY public.user_engagement_log ADD CONSTRAINT user_engagement_log_pkey PRIMARY KEY (log_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_prompt_history_pkey') THEN
    ALTER TABLE ONLY public.system_prompt_history ADD CONSTRAINT system_prompt_history_pkey PRIMARY KEY (history_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_bank_pkey') THEN
    ALTER TABLE ONLY public.question_bank ADD CONSTRAINT question_bank_pkey PRIMARY KEY (question_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_pkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_pkey PRIMARY KEY (interaction_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_questions_pkey') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT simulation_group_questions_pkey PRIMARY KEY (group_question_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtp_bank_pkey') THEN
    ALTER TABLE ONLY public.dtp_bank ADD CONSTRAINT dtp_bank_pkey PRIMARY KEY (dtp_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_dtps_pkey') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT simulation_group_dtps_pkey PRIMARY KEY (group_dtp_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_bank_pkey') THEN
    ALTER TABLE ONLY public.recommendations_bank ADD CONSTRAINT recommendations_bank_pkey PRIMARY KEY (recommendation_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_recommendations_pkey') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT simulation_group_recommendations_pkey PRIMARY KEY (group_recommendation_id);
  END IF;
END $$;

-- ==========================================================================
-- UNIQUE CONSTRAINTS
-- ==========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_user_email_key') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_user_email_key UNIQUE (user_email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_cognito_sub_key') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_cognito_sub_key UNIQUE (cognito_sub);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_simulation_group_id_user_id_key') THEN
    ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_simulation_group_id_user_id_key UNIQUE (simulation_group_id, user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_instructors_simulation_group_id_user_id_key') THEN
    ALTER TABLE ONLY public.group_instructors ADD CONSTRAINT group_instructors_simulation_group_id_user_id_key UNIQUE (simulation_group_id, user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_chat_debrief') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT unique_chat_debrief UNIQUE (chat_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_group_persona_dtp') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT unique_group_persona_dtp UNIQUE (simulation_group_id, persona_id, dtp_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_group_persona_question') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT unique_group_persona_question UNIQUE (simulation_group_id, persona_id, question_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_group_persona_recommendation') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT unique_group_persona_recommendation UNIQUE (simulation_group_id, persona_id, recommendation_id);
  END IF;
END $$;

-- ==========================================================================
-- FOREIGN KEYS
-- ==========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_organization_id_fkey') THEN
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_groups_organization_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_groups ADD CONSTRAINT simulation_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_groups_created_by_fkey') THEN
    ALTER TABLE ONLY public.simulation_groups ADD CONSTRAINT simulation_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_instructors_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.group_instructors ADD CONSTRAINT group_instructors_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_instructors_user_id_fkey') THEN
    ALTER TABLE ONLY public.group_instructors ADD CONSTRAINT group_instructors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_instructors_added_by_fkey') THEN
    ALTER TABLE ONLY public.group_instructors ADD CONSTRAINT group_instructors_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personas_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.personas ADD CONSTRAINT personas_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_media_persona_id_fkey') THEN
    ALTER TABLE ONLY public.persona_media ADD CONSTRAINT persona_media_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_data_persona_id_fkey') THEN
    ALTER TABLE ONLY public.persona_data ADD CONSTRAINT persona_data_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rubrics_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.rubrics ADD CONSTRAINT rubrics_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rubrics_persona_id_fkey') THEN
    ALTER TABLE ONLY public.rubrics ADD CONSTRAINT rubrics_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'key_questions_rubric_id_fkey') THEN
    ALTER TABLE ONLY public.key_questions ADD CONSTRAINT key_questions_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(rubric_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_user_id_fkey') THEN
    ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.enrollments ADD CONSTRAINT enrollments_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_interactions_persona_id_fkey') THEN
    ALTER TABLE ONLY public.student_interactions ADD CONSTRAINT student_interactions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_interactions_enrollment_id_fkey') THEN
    ALTER TABLE ONLY public.student_interactions ADD CONSTRAINT student_interactions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_student_interaction_id_fkey') THEN
    ALTER TABLE ONLY public.chats ADD CONSTRAINT chats_student_interaction_id_fkey FOREIGN KEY (student_interaction_id) REFERENCES public.student_interactions(student_interaction_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_chat_id_fkey') THEN
    ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debriefs_chat_id_fkey') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT debriefs_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debriefs_student_id_fkey') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT debriefs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debriefs_persona_id_fkey') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT debriefs_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debriefs_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.debriefs ADD CONSTRAINT debriefs_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_chat_id_fkey') THEN
    ALTER TABLE ONLY public.feedback ADD CONSTRAINT feedback_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_feedback_chat_id_fkey') THEN
    ALTER TABLE ONLY public.debrief_feedback ADD CONSTRAINT debrief_feedback_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_feedback_persona_id_fkey') THEN
    ALTER TABLE ONLY public.debrief_feedback ADD CONSTRAINT debrief_feedback_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_feedback_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.debrief_feedback ADD CONSTRAINT debrief_feedback_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_feedback_user_id_fkey') THEN
    ALTER TABLE ONLY public.debrief_feedback ADD CONSTRAINT debrief_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_prompt_history_modified_by_fkey') THEN
    ALTER TABLE ONLY public.debrief_prompt_history ADD CONSTRAINT debrief_prompt_history_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debrief_prompt_history_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.debrief_prompt_history ADD CONSTRAINT debrief_prompt_history_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_reports_chat_id_fkey') THEN
    ALTER TABLE ONLY public.issue_reports ADD CONSTRAINT issue_reports_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_reports_persona_id_fkey') THEN
    ALTER TABLE ONLY public.issue_reports ADD CONSTRAINT issue_reports_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_reports_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.issue_reports ADD CONSTRAINT issue_reports_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_reports_user_id_fkey') THEN
    ALTER TABLE ONLY public.issue_reports ADD CONSTRAINT issue_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_engagement_log_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_engagement_log ADD CONSTRAINT user_engagement_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_engagement_log_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.user_engagement_log ADD CONSTRAINT user_engagement_log_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_engagement_log_persona_id_fkey') THEN
    ALTER TABLE ONLY public.user_engagement_log ADD CONSTRAINT user_engagement_log_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_engagement_log_enrollment_id_fkey') THEN
    ALTER TABLE ONLY public.user_engagement_log ADD CONSTRAINT user_engagement_log_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_prompt_history_modified_by_fkey') THEN
    ALTER TABLE ONLY public.system_prompt_history ADD CONSTRAINT system_prompt_history_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_prompt_history_organization_id_fkey') THEN
    ALTER TABLE ONLY public.system_prompt_history ADD CONSTRAINT system_prompt_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_bank_organization_id_fkey') THEN
    ALTER TABLE ONLY public.question_bank ADD CONSTRAINT question_bank_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_bank_created_by_fkey') THEN
    ALTER TABLE ONLY public.question_bank ADD CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_chat_id_fkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(chat_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_question_id_fkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(question_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_student_id_fkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_persona_id_fkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_interactions_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.question_interactions ADD CONSTRAINT question_interactions_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_questions_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT simulation_group_questions_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_questions_persona_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT simulation_group_questions_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_questions_question_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT simulation_group_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank(question_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_questions_added_by_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_questions ADD CONSTRAINT simulation_group_questions_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtp_bank_organization_id_fkey') THEN
    ALTER TABLE ONLY public.dtp_bank ADD CONSTRAINT dtp_bank_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtp_bank_created_by_fkey') THEN
    ALTER TABLE ONLY public.dtp_bank ADD CONSTRAINT dtp_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_dtps_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT simulation_group_dtps_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_dtps_persona_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT simulation_group_dtps_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_dtps_dtp_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT simulation_group_dtps_dtp_id_fkey FOREIGN KEY (dtp_id) REFERENCES public.dtp_bank(dtp_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_dtps_added_by_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_dtps ADD CONSTRAINT simulation_group_dtps_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_bank_organization_id_fkey') THEN
    ALTER TABLE ONLY public.recommendations_bank ADD CONSTRAINT recommendations_bank_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recommendations_bank_created_by_fkey') THEN
    ALTER TABLE ONLY public.recommendations_bank ADD CONSTRAINT recommendations_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_recommendations_simulation_group_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT simulation_group_recommendations_simulation_group_id_fkey FOREIGN KEY (simulation_group_id) REFERENCES public.simulation_groups(simulation_group_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_recommendations_persona_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT simulation_group_recommendations_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.personas(persona_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_recommendations_recommendation_id_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT simulation_group_recommendations_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.recommendations_bank(recommendation_id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'simulation_group_recommendations_added_by_fkey') THEN
    ALTER TABLE ONLY public.simulation_group_recommendations ADD CONSTRAINT simulation_group_recommendations_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================================================================
-- INDEXES
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_chats_interaction ON public.chats USING btree (student_interaction_id);
CREATE INDEX IF NOT EXISTS idx_debrief_feedback_chat ON public.debrief_feedback USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_debrief_feedback_user ON public.debrief_feedback USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_debrief_prompt_history_created ON public.debrief_prompt_history USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_debrief_prompt_history_group ON public.debrief_prompt_history USING btree (simulation_group_id);

CREATE INDEX IF NOT EXISTS idx_debriefs_chat ON public.debriefs USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_debriefs_created_at ON public.debriefs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_debriefs_group ON public.debriefs USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_debriefs_missing_questions ON public.debriefs USING gin (missing_key_questions);
CREATE INDEX IF NOT EXISTS idx_debriefs_persona ON public.debriefs USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_debriefs_rubric_scores ON public.debriefs USING gin (rubric_scores);
CREATE INDEX IF NOT EXISTS idx_debriefs_student ON public.debriefs USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_debriefs_student_created ON public.debriefs USING btree (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dtp_bank_active ON public.dtp_bank USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_dtp_bank_created_by ON public.dtp_bank USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_dtp_bank_org ON public.dtp_bank USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_dtp_bank_org_active ON public.dtp_bank USING btree (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_engagement_log_group ON public.user_engagement_log USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_engagement_log_timestamp ON public.user_engagement_log USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS idx_engagement_log_user ON public.user_engagement_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.enrollments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_chat ON public.feedback USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_group_instructors_user ON public.group_instructors USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_chat ON public.issue_reports USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_user ON public.issue_reports USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_key_questions_rubric ON public.key_questions USING btree (rubric_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON public.messages USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_sender_type ON public.messages USING btree (chat_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_chat_sent_at ON public.messages USING btree (chat_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_matched_questions ON public.messages USING gin (matched_question_ids);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON public.messages USING btree (sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_persona_data_persona ON public.persona_data USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_media_persona ON public.persona_media USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_personas_group ON public.personas USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_created ON public.system_prompt_history USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_history_org ON public.system_prompt_history USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_qi_asked_at ON public.question_interactions USING btree (asked_at);
CREATE INDEX IF NOT EXISTS idx_qi_chat ON public.question_interactions USING btree (chat_id);
CREATE INDEX IF NOT EXISTS idx_qi_correct ON public.question_interactions USING btree (is_correct);
CREATE INDEX IF NOT EXISTS idx_qi_group ON public.question_interactions USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_qi_group_question ON public.question_interactions USING btree (simulation_group_id, question_id);
CREATE INDEX IF NOT EXISTS idx_qi_question ON public.question_interactions USING btree (question_id);
CREATE INDEX IF NOT EXISTS idx_qi_student ON public.question_interactions USING btree (student_id);
CREATE INDEX IF NOT EXISTS idx_qi_student_question ON public.question_interactions USING btree (student_id, question_id);

CREATE INDEX IF NOT EXISTS idx_question_bank_active ON public.question_bank USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_question_bank_category ON public.question_bank USING btree (category);
CREATE INDEX IF NOT EXISTS idx_question_bank_created_by ON public.question_bank USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON public.question_bank USING btree (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_question_bank_org ON public.question_bank USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_org_active ON public.question_bank USING btree (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_question_bank_tags ON public.question_bank USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_rec_bank_active ON public.recommendations_bank USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_rec_bank_created_by ON public.recommendations_bank USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_rec_bank_org ON public.recommendations_bank USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_rec_bank_org_active ON public.recommendations_bank USING btree (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rubrics_group ON public.rubrics USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_persona ON public.rubrics USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_sgd_dtp ON public.simulation_group_dtps USING btree (dtp_id);
CREATE INDEX IF NOT EXISTS idx_sgd_group ON public.simulation_group_dtps USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_sgd_group_persona ON public.simulation_group_dtps USING btree (simulation_group_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_sgd_group_persona_order ON public.simulation_group_dtps USING btree (simulation_group_id, persona_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sgd_persona ON public.simulation_group_dtps USING btree (persona_id);

CREATE INDEX IF NOT EXISTS idx_sgq_added_by ON public.simulation_group_questions USING btree (added_by);
CREATE INDEX IF NOT EXISTS idx_sgq_group ON public.simulation_group_questions USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_sgq_group_persona ON public.simulation_group_questions USING btree (simulation_group_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_sgq_order ON public.simulation_group_questions USING btree ("order");
CREATE INDEX IF NOT EXISTS idx_sgq_persona ON public.simulation_group_questions USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_sgq_question ON public.simulation_group_questions USING btree (question_id);
CREATE INDEX IF NOT EXISTS idx_sgr_group ON public.simulation_group_recommendations USING btree (simulation_group_id);
CREATE INDEX IF NOT EXISTS idx_sgr_group_persona ON public.simulation_group_recommendations USING btree (simulation_group_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_sgr_group_persona_order ON public.simulation_group_recommendations USING btree (simulation_group_id, persona_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sgr_persona ON public.simulation_group_recommendations USING btree (persona_id);
CREATE INDEX IF NOT EXISTS idx_sgr_recommendation ON public.simulation_group_recommendations USING btree (recommendation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_groups_org ON public.simulation_groups USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_student_interactions_enrollment ON public.student_interactions USING btree (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_interactions_persona ON public.student_interactions USING btree (persona_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_interactions_persona_enrollment ON public.student_interactions USING btree (persona_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON public.users USING btree (cognito_sub);


