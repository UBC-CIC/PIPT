# GenRx CDK Infrastructure — Technical Review

**Date:** April 27, 2026
**Reviewer Role:** AWS Solutions Architect
**Scope:** All files under `cdk/` — infrastructure stacks, Lambda functions, container workloads, CI/CD pipeline
**Assessment Criteria:** Functionality, Efficiency, Maintainability, and Overall Usefulness

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Stack-by-Stack Review](#3-stack-by-stack-review)
4. [Lambda Functions Review](#4-lambda-functions-review)
5. [Container Workloads Review](#5-container-workloads-review)
6. [Database Schema & Migrations](#6-database-schema--migrations)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Efficiency Analysis](#8-efficiency-analysis)
9. [Recommendations Summary](#9-recommendations-summary)

---

## 1. Executive Summary

The GenRx CDK project is a well-structured, multi-stack serverless application that delivers a pharmacy education simulation platform. The architecture makes good use of AWS services — API Gateway, Lambda, RDS with Proxy, S3, Cognito, Bedrock, AppSync, ECS Fargate, and CloudFront — and the CDK code is organized into logical stacks with clear separation of concerns.

**What works well:**
- Clean stack decomposition (VPC, Database, API, ECS, CI/CD, Amplify, DBFlow)
- Proper use of RDS Proxy for Lambda connection pooling
- Automated database migrations via CDK TriggerFunction
- CI/CD pipeline with ECR vulnerability scanning and path-based build filtering
- Parameterized SQL queries throughout (no SQL injection vectors)
- Comprehensive CloudWatch logging with infinite retention
- WAF v2 with AWS Managed Rules and IP-based rate limiting

**Key areas for improvement:**
- A single IAM role is shared across all Lambda functions (violates least privilege)
- TLS is disabled on the database layer (RDS + RDS Proxy)
- Several IAM policies use wildcard (`*`) resource scopes
- The monolithic Lambda handler pattern (giant switch statements) will become a maintenance burden
- No auto-scaling on ECS services
- The `cdk.out/` directory is committed to the repository (100+ synthesized assets)

**Overall assessment:** The infrastructure is functional and well-suited for a development/staging environment. It needs targeted hardening before production use, primarily around IAM scoping, transport encryption, and operational resilience.

---

## 2. Architecture Overview

### Stack Dependency Graph

```
CICDStack (ECR repos, CodeBuild, CodePipeline)
    │
VpcStack (VPC, subnets, NAT, endpoints, flow logs)
    │
    ├── DatabaseStack (RDS Postgres, RDS Proxy, Secrets Manager)
    │       │
    │       ├── ApiServiceStack (API Gateway, Cognito, Lambda functions,
    │       │                    S3 buckets, AppSync, WAF, Bedrock)
    │       │       │
    │       │       ├── EcsSocketStack (ECS Fargate, NLB, CloudFront, WebSocket)
    │       │       │
    │       │       ├── DBFlowStack (Migration runner TriggerFunction)
    │       │       │
    │       │       └── AmplifyStack (Frontend deployment)
    │       │
    │       └── TurnServerStack (STUN/TURN config — placeholder)
    │
    └── VoiceAgentStack (ECS Fargate, Cloud Map — not wired in main app)
```

### Technology Choices

| Component | Choice | Assessment |
|-----------|--------|------------|
| IaC | CDK (TypeScript) | Good — type safety, IDE support, mature ecosystem |
| Database | RDS PostgreSQL 16.10 | Good — Multi-AZ, encryption at rest, RDS Proxy |
| Compute | Lambda (Node.js 22, Python 3.12) + ECS Fargate | Good — serverless for API, containers for WebSocket |
| Auth | Cognito + custom JWT authorizer | Good — provider-agnostic JWT verification via jose |
| AI/LLM | Bedrock (Llama 3, Titan Embeddings, Nova Pro) | Good — managed, no infrastructure to maintain |
| API | API Gateway (REST, OpenAPI-defined) | Good — schema-first approach with request validation |
| Real-time | AppSync (GraphQL subscriptions) + ECS Socket.io | Functional — dual approach adds complexity |
| CI/CD | CodePipeline + CodeBuild + ECR | Good — automated Docker builds with vulnerability scanning |
| Frontend | Amplify (React/Vite) | Good — managed hosting with auto-deploy |

---

## 3. Stack-by-Stack Review

### 3.1 VpcStack (`vpc-stack.ts`)

**Functionality: ✅ Good**

The VPC stack supports two deployment modes: creating a new VPC or importing an existing one (for AWS Control Tower environments). This is a practical design that accommodates both greenfield and brownfield deployments.

**Strengths:**
- Three-tier subnet architecture (public, private, isolated) in the new-VPC path
- VPC Flow Logs enabled in both paths
- Interface endpoints for SSM, Secrets Manager, RDS, Glue, and API Gateway (reduces NAT Gateway costs and improves latency)
- NAT Gateway for outbound internet access from private subnets

**Issues:**
- The existing-VPC path hardcodes the Control Tower stack set name and CIDR (`172.31.128.0/20`). These should be CDK context parameters.
- The `existingVpcId` is an empty string that must be manually edited in the source code. This should be a context variable: `this.node.tryGetContext('existingVpcId')`.
- The new-VPC path creates only 1 NAT Gateway (`natGateways: 1`). For production, use at least 2 for AZ redundancy.
- The new-VPC path does not add SSM or API Gateway endpoints (only Secrets Manager and RDS), unlike the existing-VPC path. This inconsistency means Lambda functions in the new-VPC path may have higher latency for SSM calls.

**Efficiency:**
- Interface endpoints are a good cost/latency tradeoff for high-frequency services (Secrets Manager, SSM).
- Single NAT Gateway saves cost but is a single point of failure.

---

### 3.2 DatabaseStack (`database-stack.ts`)

**Functionality: ✅ Good with critical issues**

**Strengths:**
- PostgreSQL 16.10 on Graviton (cost-efficient ARM instances)
- Multi-AZ deployment with deletion protection
- Encryption at rest enabled
- 7-day automated backup retention
- Enhanced monitoring at 60-second intervals
- Three separate RDS Proxy instances for different access levels (user, table creator, admin) — good separation of privilege at the database layer
- Secrets Manager integration for credential management

**Critical Issues:**
- `rds.force_ssl: '0'` — TLS is disabled. All database traffic is plaintext. (Comment added to code)
- `requireTLS: false` on all three RDS Proxy instances. (Comment added to code)
- The RDS Proxy IAM role has `rds-db:connect` on `*`. (Comment added to code)
- `SecretValue.unsafePlainText("applicationUsername")` is used for initial secret values. While the comment says "will be changed at runtime" (and the DBFlow stack does rotate them), the initial plaintext values appear in the CloudFormation template.

**Efficiency:**
- `db.t4g.medium` (Graviton) is a good choice for development/staging. For production with sustained load, consider `db.r6g` or `db.r7g` for better memory-to-CPU ratio.
- `allocatedStorage: 100` with `maxAllocatedStorage: 115` — the 15 GB autoscaling headroom is very tight. Consider 200+ GB max for production.

---

### 3.3 ApiServiceStack (`api-service-stack.ts`)

**Functionality: ✅ Good — this is the core of the application**

This is the largest stack (~1,900 lines) and contains the API Gateway, Cognito, all Lambda functions, S3 buckets, AppSync, WAF, and Bedrock configuration.

**Strengths:**
- OpenAPI-first API definition loaded from a YAML file — good for documentation and contract-first development
- Three separate JWT authorizer deployments with different allowed roles (student, instructor, admin) — clean role separation
- WAF v2 with AWS Managed Rules (Common Rule Set) and IP-based rate limiting (1000 req/5min)
- AppSync GraphQL API for real-time text streaming with Cognito User Pool auth
- ECR Image Waiter custom resource — clever solution to the first-deploy chicken-and-egg problem where Lambda functions reference ECR images that haven't been built yet
- API Gateway throttling configured (100 req/s, 200 burst)
- CloudWatch logging with infinite retention on all Lambda functions

**Issues:**
- **Single shared `lambdaRole`** across student, instructor, admin, and file-operation functions. Every function can access every secret, connect to every RDS user, and invoke every other function. (Comment added to code)
- **Secrets Manager `*` wildcard** on both `lambdaRole` and `coglambdaRole`. (Comment added to code)
- **`allowUnauthenticatedIdentities: true`** on the Cognito Identity Pool. (Comment added to code)
- **Bedrock permissions on `*`** for the authenticated role — any authenticated user with Identity Pool credentials can invoke any Bedrock model in the account.
- **Stack size:** At ~1,900 lines, this stack is doing too much. Consider splitting into:
  - `AuthStack` (Cognito, Identity Pool, JWT authorizers)
  - `ApiStack` (API Gateway, Lambda functions, OpenAPI)
  - `AiStack` (Bedrock, AppSync, text generation, data ingestion)
  - `StorageStack` (S3 buckets, pre-signed URL functions)

**Efficiency:**
- All Lambda functions are configured with `memorySize: 512` and `timeout: 300s`. This is generous for simple CRUD operations. The student/instructor/admin functions that just run SQL queries would perform fine at 256 MB with 30s timeout, saving ~50% on Lambda costs.
- The `generatePreSignedURL` function is correctly set to 128 MB — it only generates a URL and returns.
- The text generation Docker Lambda at 512 MB may be tight for LLM inference. Monitor memory usage and consider 1024 MB if you see OOM errors.

---

### 3.4 EcsSocketStack (`ecs-socket-stack.ts`)

**Functionality: ✅ Good**

Deploys a Socket.io WebSocket server on ECS Fargate behind an NLB and CloudFront.

**Strengths:**
- CloudFront in front of NLB provides HTTPS termination and DDoS protection
- Proper health check configuration on the target group
- Security group allows NLB and WebRTC UDP traffic
- Scoped Secrets Manager permissions (specific secret ARNs, not `*`)

**Issues:**
- **Task role is reused as execution role.** The execution role only needs ECR pull and CloudWatch Logs permissions. Sharing it with the task role means the ECS agent has access to Bedrock, DynamoDB, Secrets Manager, etc. (Comment added to code)
- **ECS tasks in PUBLIC subnets with `assignPublicIp: true`.** Each container gets a public IP. While the security group restricts access, this is a larger attack surface than necessary. (Comment added to code)
- **NLB listener on port 80 (HTTP).** The CloudFront-to-origin connection is unencrypted. (Comment added to code)
- **Fixed `desiredCount: 2` with no auto-scaling.** Under load, the service cannot scale up. Under no load, you're paying for 2 idle tasks. Add Application Auto Scaling with target tracking on CPU or request count.
- **Bedrock permissions on `*`** — scope to specific model ARNs.

**Efficiency:**
- `cpu: 1024, memoryLimitMiB: 2048` is reasonable for a Node.js + Python Socket.io server. Monitor actual usage and right-size.
- CloudFront caching is correctly disabled (`CACHING_DISABLED`) for WebSocket traffic.

---

### 3.5 CICDStack (`cicd-stack.ts`)

**Functionality: ✅ Good — well-designed CI/CD pipeline**

**Strengths:**
- Single pipeline with parallel build actions for all container workloads
- Path-based build filtering — only rebuilds images when the relevant source directory changes
- ECR image scanning on push with a post-build check that blocks deployment on CRITICAL vulnerabilities
- Idempotent Lambda update — checks if the function exists before calling `update-function-code`
- Image tag includes module name, environment, and commit hash for traceability

**Issues:**
- **`AmazonEC2ContainerRegistryPowerUser` managed policy** on the CodeBuild role grants push/pull to ALL ECR repos in the account. The per-repo `grantPullPush()` calls make this redundant. (Comment added to code)
- **GitHub PAT via `unsafeUnwrap()`** — the PAT appears in the CloudFormation template. The CodeStar Connections approach (commented out) is the correct solution.
- **`sleep 30` for vulnerability scan** — the scan may not complete in 30 seconds for large images. Use `aws ecr wait image-scan-complete` instead.
- **Build failure on no changes** — the path filter script exits with code 1 to skip builds, but CodePipeline treats this as a build failure. Consider using CodePipeline's built-in file path filters instead.

**Efficiency:**
- Parallel build actions are efficient — all 4 images build simultaneously.
- The path filter avoids unnecessary rebuilds, saving build minutes.

---

### 3.6 DBFlowStack (`dbFlow-stack.ts`)

**Functionality: ✅ Good — automated migration runner**

Uses CDK's `TriggerFunction` to run database migrations on every deployment. The migration runner creates application-level database users with rotated passwords and stores them in Secrets Manager.

**Strengths:**
- Migrations run automatically on every `cdk deploy` — no manual steps
- Password rotation on every deployment (via `crypto.randomBytes`)
- Proper role separation: `readwrite` role for application queries, `tablecreator` role for schema changes
- Uses `node-pg-migrate` for versioned, idempotent migrations

**Issues:**
- **`AmazonS3FullAccess` managed policy** on the migration Lambda. The migration runner never touches S3. (Comment added to code)
- **`AmazonSSMReadOnlyAccess` managed policy** — overly broad. The migration Lambda doesn't need SSM access at all.
- **Timestamp in description** forces CloudFormation to update the resource on every synth, even if no code changed. This is intentional (to re-run migrations) but should be documented.
- **300-second timeout** may be tight for complex migrations. Consider 600s.

---

### 3.7 AmplifyStack (`amplify-stack.ts`)

**Functionality: ✅ Good**

**Strengths:**
- Environment variables injected from other stacks (API endpoint, Cognito IDs, AppSync URL)
- SPA routing rule for client-side routing (404 → 200 rewrite)
- Multiple branch deployments (main, chat-playground)

**Issues:**
- **`githubToken.unsafeUnwrap()`** — the GitHub PAT is resolved at synthesis time and appears in the CloudFormation template. Switch to CodeStar Connections.
- **`enableAutoBuild: true`** on both branches — any push triggers a deployment. Ensure GitHub branch protection rules are configured.
- No custom domain or SSL certificate configured — the app runs on the default Amplify domain.

---

### 3.8 TurnServerStack (`turn-server-stack.ts`)

**Functionality: ✅ Placeholder — correctly documented**

The coturn EC2 instance was removed due to AWS Control Tower guardrail CT.EC2.PR.8 (no public-IP EC2 instances). The stack now provides only a STUN URL (Google's public STUN server) and a placeholder TURN secret. This is well-documented in the code comments.

**Note:** STUN-only works for most NAT traversal scenarios but will fail for symmetric NATs (common in corporate networks). If students are behind corporate firewalls, you'll need a TURN relay. Consider AWS KVS TURN or a managed TURN service.

---

## 4. Lambda Functions Review

### 4.1 Handler Pattern

All three main handlers (`studentFunction.js`, `instructorFunction.js`, `adminFunction.js`) use the same pattern: a single `exports.handler` with a giant `switch` statement on `event.httpMethod + " " + event.resource`.

**Assessment:** This works but doesn't scale well. The instructor function is 2,756 lines. Consider:
- Extracting each route into its own module (e.g., `routes/getGroups.js`, `routes/createPatient.js`)
- Using a lightweight router library (e.g., `lambda-api` or a simple map-based dispatcher)
- Or splitting into separate Lambda functions per route (increases cold starts but improves isolation)

### 4.2 Database Connection Management (`lib.js`, `libadmin.js`)

**Strengths:**
- Connection is cached on `global` for reuse across warm Lambda invocations
- Uses the `postgres` library (porsager/postgres) which manages its own connection pool
- Credentials fetched from Secrets Manager at initialization

**Issues:**
- `ssl: false` — connections are unencrypted. (Comment added to code)
- No health check or reconnection logic — if the RDS Proxy rotates the connection, the cached handle may become stale. (Comment added to code)
- The Python Lambda functions (`deleteFile.py`, `data_ingestion/main.py`) build connection strings via string concatenation instead of keyword arguments. If a password contains `=` or spaces, the connection will fail. (Comment added to code)

### 4.3 JWT Authorizer (`jwtAuthorizer.js`)

**Strengths:**
- Provider-agnostic JWT verification using the `jose` library (not Cognito-specific)
- JWKS endpoint, issuer, and audience are configurable via environment variables
- Lazy-loaded ESM module (jose v5+ is ESM-only) with caching
- Proper error handling that returns the exact "Unauthorized" string API Gateway expects

**Issues:**
- Allows requests through when the roles claim is absent from the token (transition-period bypass). This should be removed once the transition is complete.

### 4.4 Pre-Signup Validation (`preSignup.js`)

**Strengths:**
- Email domain validation against an SSM parameter (configurable without redeployment)
- Structured JSON logging

**Issues:**
- Domain comparison is case-sensitive (`includes()` on the raw domain string). `@University.edu` would not match `university.edu` in the allowed list.
- No caching of the SSM parameter — fetched on every invocation. Use a TTL cache or Lambda extension.

### 4.5 ECR Image Waiter (`ecrImageWaiter/index.js`)

**Assessment: ✅ Excellent**

This is a well-implemented custom resource that solves a real problem: Lambda functions that reference ECR images fail to create if the image doesn't exist yet (first deployment). The waiter polls ECR with configurable retries and can optionally trigger a CodeBuild build if the image is missing.

### 4.6 Data Ingestion (`data_ingestion/src/main.py`)

**Strengths:**
- S3 event-driven architecture — automatically processes uploaded files
- Proper file path parsing with validation
- Embedding count tracking (before/after) for observability
- Ingestion status tracking in the database

**Issues:**
- Only processes the first S3 record in the event, then returns. Subsequent records are silently dropped. (Comment added to code)
- Connection string concatenation vulnerability. (Comment added to code)

### 4.7 Text Generation (`text_generation/src/helpers/chat.py`)

**Strengths:**
- RAG pipeline with LangChain: retrieval-augmented generation using document embeddings
- Streaming support via AppSync subscriptions
- Fallback from streaming to synchronous invoke on failure
- Async question matching using background threads
- Comprehensive debrief generation with structured JSON output
- Role guardrails appended to system prompts

**Issues:**
- At 2,758 lines, this file is doing too much. It handles chat, streaming, message persistence, question matching, debrief generation, answer key retrieval, and AppSync publishing. Split into focused modules.
- `save_message_to_db()` creates a new database connection on every call (fetches secret, connects, executes, closes). This is extremely inefficient for streaming where it's called for every message. Use a connection pool or cached connection.
- `get_system_prompt()` also creates a new connection on every call. Same issue.
- The `TODO(refactor)` comments throughout the file indicate the team is aware of the duplication.
- System prompt is logged at INFO level (`logger.info(f"System prompt...")`), which could expose sensitive prompt content in CloudWatch.

---

## 5. Container Workloads Review

### 5.1 Socket Server (`socket-server/`)

A Node.js Socket.io server that handles real-time WebSocket connections for chat and voice features. It authenticates via Cognito JWT, manages chat sessions, and bridges WebRTC media.

**Assessment:** The ECS deployment is well-configured. The main concern is the lack of auto-scaling and the public subnet placement.

### 5.2 Voice Agent (`voice-agent/`)

A Python agent using Bedrock AgentCore for voice interactions via Nova Sonic. Deployed on ECS Fargate with Cloud Map service discovery.

**Assessment:** The VoiceAgentStack is well-structured with proper internal-only access (no public exposure). However, it's not wired into the main `bin/cdk.ts` — it appears to be deployed separately or is still in development.

### 5.3 Docker Build Configuration

All container workloads use multi-stage Docker builds and are built via CodeBuild with ECR vulnerability scanning. The CICD stack correctly handles the ARM64 build image for the voice agent (Graviton).

---

## 6. Database Schema & Migrations

### 6.1 Schema Design

The initial migration (`001_init.js`) creates a well-normalized schema with:
- Proper foreign key relationships with CASCADE deletes
- UUID primary keys (via `uuid-ossp` extension)
- `pgvector` extension for embedding storage
- Indexes on all foreign key columns and frequently queried fields
- Engagement logging table for analytics

**Strengths:**
- Clean entity relationships: Organizations → Users → Enrollments → Student Interactions → Chats → Messages
- Separate `persona_data` table for uploaded knowledge base files with ingestion status tracking
- `system_prompt_history` table for prompt versioning

**Issues:**
- No composite indexes for common query patterns (e.g., `(simulation_group_id, user_id)` on enrollments is covered by the UNIQUE constraint, but `(chat_id, sender_type)` on messages is not indexed despite being used in message count queries)
- The `messages` table uses `varchar` for `message_content` — consider `text` for unbounded content
- No `created_at` / `updated_at` timestamps on several tables (personas, enrollments, student_interactions)

### 6.2 Migration Runner

The migration runner (`db_setup/index.js`) is well-implemented:
- Uses `node-pg-migrate` for versioned, idempotent migrations
- Creates application-level database users with proper role separation
- Rotates passwords on every deployment
- Updates Secrets Manager with new credentials

**Issue:** The SQL for creating users uses string interpolation for usernames and passwords inside a `DO` block. While the values come from `crypto.randomBytes` (not user input), this pattern is fragile. Consider using parameterized queries or `pg`'s built-in escaping.

---

## 7. Cross-Cutting Concerns

### 7.1 Logging

**Assessment: ✅ Good**

- All Lambda functions use `logRetention: logs.RetentionDays.INFINITE`
- Structured JSON logging in auth-related functions (JWT authorizer, pre-signup)
- AWS Lambda Powertools used in Python functions
- Custom logger module in Node.js functions with request ID tracking

**Gap:** No centralized log aggregation or alerting. Consider CloudWatch Insights queries or a log aggregation service.

### 7.2 Error Handling

**Assessment: ⚠️ Inconsistent**

- Lambda functions consistently return structured error responses with appropriate HTTP status codes
- Database errors are caught and logged, but some handlers don't close cursors in error paths (Python functions)
- The text generation streaming has a good fallback pattern (stream → invoke → word-by-word simulation)
- Some error responses leak internal details (e.g., `f"Error deleting file {file_name}.{file_type} from the database"`)

### 7.3 Configuration Management

**Assessment: ✅ Good**

- Secrets in Secrets Manager (database credentials, GitHub PAT, Cognito secrets)
- Configuration in SSM Parameter Store (Bedrock model IDs, embedding model IDs, DynamoDB table names, allowed email domains)
- CDK context for deployment-time configuration (StackPrefix, githubRepo, voiceAgentArn)

**Gap:** No environment-specific configuration. The same CDK code deploys to dev, staging, and production with the same settings. Consider using CDK context or environment variables to differentiate.

### 7.4 Tagging

**Assessment: ⚠️ Minimal**

Only one tag is applied globally: `cdk.Tags.of(app).add("app", "GenRx")`. For cost allocation and operational visibility, add:
- `environment` (dev/staging/prod)
- `team` or `owner`
- `cost-center`

### 7.5 Monitoring & Alerting

**Assessment: ⚠️ Limited**

- CloudWatch alarms exist for data ingestion Lambda timeouts
- API Gateway metrics are enabled
- Enhanced RDS monitoring at 60-second intervals

**Gaps:**
- No alarms on Lambda errors, throttles, or duration
- No alarms on RDS CPU, connections, or storage
- No alarms on ECS task health or CPU/memory
- No dashboard for operational visibility

---

## 8. Efficiency Analysis

### 8.1 Cost Optimization Opportunities

| Resource | Current | Recommendation | Estimated Savings |
|----------|---------|----------------|-------------------|
| Lambda memory (CRUD functions) | 512 MB | 256 MB | ~50% on Lambda costs |
| Lambda timeout (CRUD functions) | 300s | 30s | Prevents runaway costs |
| ECS Socket (fixed count: 2) | Always-on | Auto-scaling (min: 1, max: 4) | ~50% during low traffic |
| NAT Gateway | 1 (new VPC) | 1 is fine for dev; 2 for prod | N/A |
| VPC Endpoints | 5 interface endpoints | Correct — saves NAT costs | Already optimized |
| RDS instance | db.t4g.medium | Correct for dev/staging | N/A |
| CloudWatch Logs | INFINITE retention | 90 days for dev, INFINITE for prod | ~70% on log storage |

### 8.2 Performance Optimization Opportunities

| Area | Issue | Recommendation |
|------|-------|----------------|
| Text generation DB connections | New connection per `save_message_to_db()` call | Use a cached connection or connection pool |
| Pre-signup SSM parameter | Fetched on every invocation | Cache with 5-minute TTL |
| Lambda cold starts | All functions in VPC | Use provisioned concurrency for auth-critical paths |
| Data ingestion | Single-record processing | Process all records in the S3 event batch |
| Instructor analytics | 4 separate SQL queries joined in JS | Combine into a single query with CTEs |

### 8.3 Operational Efficiency

| Area | Assessment |
|------|------------|
| Deployment | Good — `cdk deploy` handles everything including migrations |
| Rollback | Limited — no canary/linear deployment for Lambda; ECS uses rolling update |
| Observability | Basic — logs exist but no dashboards or comprehensive alerting |
| Disaster recovery | Good — Multi-AZ RDS, 7-day backups, S3 with RETAIN policy |
| Secret rotation | Good — passwords rotated on every deployment via DBFlow |

---

## 9. Recommendations Summary

### Priority 1 — Must Fix (Before Production)

1. **Enable TLS on RDS and RDS Proxy** — Change `rds.force_ssl` to `'1'`, set `requireTLS: true` on all proxies, update `lib.js` to `ssl: 'require'`, and update Python functions to use `sslmode='require'`.

2. **Scope IAM permissions** — Replace `*` resource wildcards with specific ARNs on Secrets Manager, RDS Proxy, and Bedrock policies. Create separate Lambda execution roles per function group.

3. **Switch from GitHub PAT to CodeStar Connections** — The PAT appears in CloudFormation templates via `unsafeUnwrap()`. The CodeStar approach is already coded (commented out) — just needs the connection authorized in the AWS Console.

4. **Set `allowUnauthenticatedIdentities: false`** on the Cognito Identity Pool.

### Priority 2 — Should Fix (Short-term)

5. **Split `api-service-stack.ts`** into 3-4 smaller stacks. At 1,900 lines, it's approaching the CloudFormation resource limit and is difficult to maintain.

6. **Add ECS auto-scaling** to the Socket server and Voice Agent services.

7. **Fix Python connection string construction** — Use `psycopg2.connect(**connection_params)` instead of string concatenation.

8. **Add CloudWatch alarms** for Lambda errors, RDS CPU/connections, and ECS task health.

9. **Remove `AmazonS3FullAccess`** from the DBFlow migration Lambda role.

10. **Remove `AmazonEC2ContainerRegistryPowerUser`** from the CodeBuild role (per-repo grants are sufficient).

### Priority 3 — Nice to Have (Medium-term)

11. **Refactor monolithic Lambda handlers** — Extract routes into separate modules or functions.

12. **Add connection pooling** to the text generation Lambda — the current pattern of creating a new DB connection per function call is inefficient.

13. **Add environment-specific configuration** — Use CDK context or environment variables to differentiate dev/staging/prod settings (log retention, instance sizes, scaling policies).

14. **Add a CloudWatch dashboard** for operational visibility.

15. **Right-size Lambda memory** — Use AWS Lambda Power Tuning to find optimal memory settings for each function.

16. **Add `cdk.out/` to `.gitignore`** — The synthesized output (100+ asset directories) should not be committed to the repository. It's regenerated on every `cdk synth`.

17. **Separate ECS task role from execution role** in both the Socket and Voice Agent stacks.

18. **Add composite database indexes** for common query patterns (e.g., `(chat_id, sender_type)` on messages).

---

*Inline `REVIEW:` comments have been added directly to the following files where explanations were missing:*
- `cdk/lib/database-stack.ts` — TLS disabled, RDS Proxy TLS, IAM wildcard
- `cdk/lib/api-service-stack.ts` — Shared Lambda role, Secrets Manager wildcard, unauthenticated identities
- `cdk/lib/cicd-stack.ts` — ECR PowerUser managed policy
- `cdk/lib/dbFlow-stack.ts` — S3FullAccess on migration Lambda, TriggerFunction behavior
- `cdk/lib/ecs-socket-stack.ts` — Shared task/execution role, public subnet placement, HTTP listener
- `cdk/lambda/lib/lib.js` — SSL disabled, connection caching behavior
- `cdk/data_ingestion/src/main.py` — Connection string concatenation, single-record processing
