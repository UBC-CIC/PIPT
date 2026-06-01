# Database Migrations

This guide covers the GenRx database migration system — how it works, how to create new migrations, common patterns, and safety guidelines.

---

## Overview

GenRx uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) to manage PostgreSQL schema changes. Migrations are JavaScript files that export `up` and `down` functions. They run automatically on every CDK deployment via a Lambda trigger function.

---

## Quick Start

1. Create a new file in `cdk/lambda/db_setup/migrations/` following the naming convention:

   ```
   014_your_migration_name.js
   ```

2. Write your migration:

   ```javascript
   exports.up = (pgm) => {
     pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar`);
   };

   exports.down = (pgm) => {
     pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
   };
   ```

3. Deploy:

   ```bash
   npx cdk deploy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=genrx
   ```

---

## Migration System Architecture

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Migration runner | `cdk/lambda/db_setup/index.js` | Lambda handler that executes migrations |
| Migration files | `cdk/lambda/db_setup/migrations/` | Individual schema change scripts |
| node-pg-migrate layer | `cdk/layers/node-pg-migrate.zip` | Lambda layer with migration library |
| DBFlow stack | `cdk/lib/dbFlow-stack.ts` | CDK stack that deploys the trigger Lambda |

### Key Infrastructure

- **Runtime:** Node.js 22.x Lambda
- **Trigger:** `TriggerFunction` — runs on every CDK deployment (forced by timestamp in description)
- **Timeout:** 300 seconds
- **Memory:** 512 MB
- **Network:** Deployed in VPC private subnets with access to RDS
- **Credentials:** Reads admin credentials from Secrets Manager (`DB_SECRET_NAME`)
- **Tracking table:** `pgmigrations` (created automatically by node-pg-migrate)

---

## Migration Files Structure

### Naming Convention

```
{NNN}_{descriptive_name}.js
```

- `NNN` — Three-digit sequential number (e.g., `001`, `014`)
- `descriptive_name` — Snake-case description of what the migration does

Migrations run in alphabetical order. The numeric prefix ensures correct sequencing.

### File Format

Every migration file must export `up` and `down` functions:

```javascript
/**
 * Migration NNN: Brief Title
 *
 * Description of what this migration does.
 *
 * Columns added/modified:
 *   - table.column (type): description
 *
 * Dependencies: list tables this depends on
 * Idempotent: Safe to run multiple times.
 */

exports.up = (pgm) => {
  pgm.sql(`
    -- Your SQL here
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Reverse the changes
  `);
};
```

### Common Operations via `pgm.sql()`

The `pgm` object provides a `sql()` method for executing raw SQL. While node-pg-migrate supports a programmatic API, this project uses raw SQL exclusively for clarity and control.

---

## How Migrations Work

### Execution Flow

```mermaid
sequenceDiagram
    participant CDK as CDK Deploy
    participant CF as CloudFormation
    participant Lambda as DBFlow Lambda
    participant SM as Secrets Manager
    participant RDS as PostgreSQL

    CDK->>CF: Deploy DBFlow stack
    CF->>Lambda: Invoke TriggerFunction
    Lambda->>SM: Get admin credentials
    SM-->>Lambda: {username, password, host, dbname}
    Lambda->>RDS: Connect as admin
    Lambda->>RDS: Run pending migrations (node-pg-migrate)
    RDS-->>Lambda: Migrations complete
    Lambda->>RDS: Create/update app_rw and app_tc users
    Lambda->>SM: Update user/proxy secrets with new passwords
    Lambda-->>CF: Return success
```

### Tracking

node-pg-migrate maintains a `pgmigrations` table in the database:

| Column | Description |
|--------|-------------|
| id | Auto-increment ID |
| name | Migration filename (without extension) |
| run_on | Timestamp when the migration was applied |

Only migrations not yet recorded in `pgmigrations` will run. This makes the system idempotent at the file level.

### Deployment Process

1. CDK deploys the `DBFlow` stack
2. The `TriggerFunction` is invoked automatically (its description contains a timestamp, forcing CloudFormation to update it every deploy)
3. The Lambda fetches admin DB credentials from Secrets Manager
4. It connects to RDS and runs `node-pg-migrate` in the `up` direction with `count: Infinity` (all pending migrations)
5. After migrations, it creates/rotates the `app_rw` and `app_tc` database users
6. Updated credentials are written back to Secrets Manager

---

## Creating New Migrations

### Step-by-Step

1. **Determine the next number.** Check the highest-numbered file in `cdk/lambda/db_setup/migrations/` and increment by 1.

2. **Create the file:**

   ```
   cdk/lambda/db_setup/migrations/014_add_avatar_url.js
   ```

3. **Write idempotent SQL.** Use `IF NOT EXISTS` / `IF EXISTS` guards:

   ```javascript
   exports.up = (pgm) => {
     pgm.sql(`
       DO $$
       BEGIN
         IF NOT EXISTS (SELECT FROM information_schema.columns
                        WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
           ALTER TABLE users ADD COLUMN avatar_url varchar;
         END IF;
       END $$;
     `);
   };

   exports.down = (pgm) => {
     pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
   };
   ```

4. **Test locally** (optional — connect to a dev database):

   ```bash
   DATABASE_URL="postgresql://user:pass@localhost:5432/genrx" \
     npx node-pg-migrate up --migrations-dir cdk/lambda/db_setup/migrations
   ```

5. **Deploy:**

   ```bash
   npx cdk deploy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=genrx
   ```

---

## Common Migration Patterns

### Adding a New Table

```javascript
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
      title varchar NOT NULL,
      body text,
      is_read boolean DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)"
  );
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)"
  );
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS notifications CASCADE");
};
```

### Adding Columns to an Existing Table

```javascript
exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_url varchar`);
  pgm.sql(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS bio text`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE personas DROP COLUMN IF EXISTS avatar_url`);
  pgm.sql(`ALTER TABLE personas DROP COLUMN IF EXISTS bio`);
};
```

### Adding Columns with Defaults and Constraints

```javascript
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'simulation_groups' AND column_name = 'max_retries') THEN
        ALTER TABLE simulation_groups ADD COLUMN max_retries integer DEFAULT 3
          CHECK (max_retries >= 0 AND max_retries <= 10);
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE simulation_groups DROP COLUMN IF EXISTS max_retries`);
};
```

### Adding Indexes

```javascript
exports.up = (pgm) => {
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING GIN (to_tsvector('english', message_content))"
  );
};

exports.down = (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS idx_messages_content_search");
};
```

### Adding an Enum-like Check Constraint

```javascript
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM information_schema.columns
                     WHERE table_name = 'chats' AND column_name = 'mode') THEN
        ALTER TABLE chats ADD COLUMN mode varchar DEFAULT 'text'
          CHECK (mode IN ('text', 'voice', 'hybrid'));
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE chats DROP COLUMN IF EXISTS mode`);
};
```

### Enabling a PostgreSQL Extension

```javascript
exports.up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
};

exports.down = (pgm) => {
  pgm.sql('DROP EXTENSION IF EXISTS "pg_trgm"');
};
```

### Data Migration (Backfill)

```javascript
exports.up = (pgm) => {
  // Add column first
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar`);

  // Backfill from existing data
  pgm.sql(`
    UPDATE users
    SET display_name = COALESCE(first_name || ' ' || last_name, user_email)
    WHERE display_name IS NULL
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS display_name`);
};
```

### Renaming a Column

```javascript
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'personas' AND column_name = 'persona_name') THEN
        ALTER TABLE personas RENAME COLUMN persona_name TO name;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.columns
                 WHERE table_name = 'personas' AND column_name = 'name') THEN
        ALTER TABLE personas RENAME COLUMN name TO persona_name;
      END IF;
    END $$;
  `);
};
```

---

## Running Migrations

### Automatic (CDK Deploy)

Migrations run automatically on every `cdk deploy` that includes the DBFlow stack:

```bash
npx cdk deploy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=genrx
```

Or as part of a full deployment:

```bash
npx cdk deploy --all -c StackPrefix=GenRx -c githubRepo=genrx
```

### Manual (CLI)

If you have direct database access, you can run migrations manually:

```bash
DATABASE_URL="postgresql://admin:password@rds-proxy-endpoint:5432/genrx" \
  npx node-pg-migrate up \
    --migrations-dir cdk/lambda/db_setup/migrations \
    --migrations-table pgmigrations
```

To roll back the last migration:

```bash
DATABASE_URL="postgresql://admin:password@rds-proxy-endpoint:5432/genrx" \
  npx node-pg-migrate down \
    --migrations-dir cdk/lambda/db_setup/migrations \
    --migrations-table pgmigrations \
    --count 1
```

---

## Safety Guidelines

### ✅ Safe Patterns

| Pattern | Why |
|---------|-----|
| `ADD COLUMN IF NOT EXISTS` | Idempotent — safe to re-run |
| `CREATE TABLE IF NOT EXISTS` | Idempotent — won't fail if table exists |
| `CREATE INDEX IF NOT EXISTS` | Idempotent — won't duplicate indexes |
| `DROP COLUMN IF EXISTS` | Safe in down migrations |
| `DO $$ BEGIN ... END $$` blocks | Conditional logic prevents errors on re-run |
| Adding nullable columns | No table rewrite, no lock contention |
| Adding columns with defaults (Postgres 11+) | No table rewrite for non-volatile defaults |

### ❌ Dangerous Patterns

| Pattern | Risk | Alternative |
|---------|------|-------------|
| `DROP TABLE` without `IF EXISTS` | Fails if table doesn't exist | Always use `IF EXISTS` |
| `ALTER TABLE ... ALTER COLUMN ... TYPE` on large tables | Full table rewrite, long lock | Add new column, backfill, drop old |
| `NOT NULL` constraint on existing column without default | Fails if NULLs exist | Backfill first, then add constraint |
| Renaming tables referenced by application code | Breaks running application | Use views as aliases during transition |
| Dropping columns still read by application code | Runtime errors | Deploy code change first, then drop column |
| Long-running data migrations in a single transaction | Holds locks, may timeout | Batch updates or run outside migration |

---

## Migration Patterns and Best Practices

1. **Always make migrations idempotent.** Use `IF NOT EXISTS` / `IF EXISTS` guards so migrations can safely re-run without errors.

2. **Keep migrations small and focused.** One logical change per migration file. Don't combine unrelated schema changes.

3. **Write both `up` and `down`.** Even if `down` is a no-op, document why (e.g., data loss concerns).

4. **Test migrations against a copy of production data** before deploying to production. Schema changes that work on empty tables may fail on tables with millions of rows.

5. **Never modify a migration that has already been applied.** The tracking table records which migrations have run. If you need to fix something, create a new migration.

6. **Use `DO $$ ... END $$` blocks** for conditional logic that checks column/table existence before making changes.

7. **Add indexes concurrently for large tables** (note: this cannot be done inside a transaction, so use `pgm.sql` with `CREATE INDEX CONCURRENTLY IF NOT EXISTS`).

8. **Document your migration** with a JSDoc comment at the top explaining what it does, what columns/tables it affects, and any dependencies.

9. **Consider the deployment order.** If your migration adds a column that new application code reads, deploy the migration first, then deploy the application code. If your migration removes a column, deploy the application code first (to stop reading it), then deploy the migration.

10. **Respect the 300-second Lambda timeout.** If a migration involves large data backfills, consider splitting it into multiple migrations or running the backfill separately.
