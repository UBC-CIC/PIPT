/**
 * Migration: Update messages table schema
 *
 * Aligns the messages table with the new schema:
 *   - Replaces `student_sent` (boolean) with `sender_type` (varchar: 'student', 'ai', 'system')
 *   - Adds `user_id` column (uuid of the student or AI persona who sent the message)
 *   - Renames `time_sent` to `sent_at` and changes type to timestamptz
 *   - Changes `message_content` from varchar to text
 *   - Drops unused columns: quality_score, quality_feedback, suggested_rewrite
 *
 * Dependencies: messages table from 001_init.js
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  // Add sender_type column and backfill from student_sent
  pgm.sql(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type varchar
  `);
  pgm.sql(`
    UPDATE messages
    SET sender_type = CASE WHEN student_sent = true THEN 'student' ELSE 'ai' END
    WHERE sender_type IS NULL AND student_sent IS NOT NULL
  `);

  // Add user_id column (nullable — existing rows won't have it)
  pgm.sql(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id uuid
  `);

  // Rename time_sent -> sent_at and change to timestamptz
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'time_sent') THEN
        ALTER TABLE messages RENAME COLUMN time_sent TO sent_at;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'sent_at'
                   AND data_type <> 'timestamp with time zone') THEN
        ALTER TABLE messages ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC';
      END IF;
    END $$;
  `);

  // Change message_content from varchar to text
  pgm.sql(`
    ALTER TABLE messages ALTER COLUMN message_content TYPE text
  `);

  // Drop old columns
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS student_sent`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS quality_score`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS quality_feedback`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS suggested_rewrite`);

  // Add indexes
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_chat_sent_at ON messages(chat_id, sent_at)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_chat_sender_type ON messages(chat_id, sender_type)"
  );
};

exports.down = (pgm) => {
  // Re-add old columns
  pgm.sql(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS student_sent boolean`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS quality_score integer`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS quality_feedback text`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS suggested_rewrite text`);

  // Backfill student_sent from sender_type
  pgm.sql(`
    UPDATE messages
    SET student_sent = CASE WHEN sender_type = 'student' THEN true ELSE false END
    WHERE student_sent IS NULL AND sender_type IS NOT NULL
  `);

  // Rename sent_at back to time_sent
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'sent_at') THEN
        ALTER TABLE messages RENAME COLUMN sent_at TO time_sent;
      END IF;
    END $$;
  `);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'messages' AND column_name = 'time_sent'
                   AND data_type <> 'timestamp without time zone') THEN
        ALTER TABLE messages ALTER COLUMN time_sent TYPE timestamp USING time_sent::timestamp;
      END IF;
    END $$;
  `);

  // Drop new indexes and columns
  pgm.sql("DROP INDEX IF EXISTS idx_messages_chat");
  pgm.sql("DROP INDEX IF EXISTS idx_messages_user_id");
  pgm.sql("DROP INDEX IF EXISTS idx_messages_sent_at");
  pgm.sql("DROP INDEX IF EXISTS idx_messages_chat_sent_at");
  pgm.sql("DROP INDEX IF EXISTS idx_messages_chat_sender_type");
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS sender_type`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN IF EXISTS user_id`);
};
