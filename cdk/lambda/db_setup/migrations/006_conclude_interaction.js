/**
 * Migration 006: Conclude Interaction
 *
 * Fixes the chats table to match the intended schema and adds the
 * recommendation column for the conclude interaction feature.
 *
 * Columns added to chats:
 *   - started_at (timestamptz): When the chat session was started
 *   - ended_at (timestamptz): When the session was concluded
 *   - status (varchar): Session status (e.g. 'active', 'concluded')
 *   - recommendation (text): Student's recommendation submitted on conclude
 *
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'started_at') THEN
        ALTER TABLE chats ADD COLUMN started_at timestamptz;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'ended_at') THEN
        ALTER TABLE chats ADD COLUMN ended_at timestamptz;
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'status') THEN
        ALTER TABLE chats ADD COLUMN status varchar DEFAULT 'active'
          CHECK (status IN ('active', 'concluded', 'expired'));
      END IF;

      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'recommendation') THEN
        ALTER TABLE chats ADD COLUMN recommendation text;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE chats DROP COLUMN IF EXISTS started_at;
    ALTER TABLE chats DROP COLUMN IF EXISTS ended_at;
    ALTER TABLE chats DROP COLUMN IF EXISTS status;
    ALTER TABLE chats DROP COLUMN IF EXISTS recommendation;
  `);
};
