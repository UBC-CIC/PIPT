# Contributing to Documentation

> **Type:** Procedural / Meta
> **Last updated:** 2026-05-30

## Table of Contents

- [Overview](#overview)
- [When to Update Documentation](#when-to-update-documentation)
- [Document Patterns](#document-patterns)
- [Naming Convention](#naming-convention)
- [Writing Conventions](#writing-conventions)
- [Quality Checklist](#quality-checklist)
- [Changelog Requirements](#changelog-requirements)
- [Cross-References](#cross-references)

## Overview

This document defines the rules and processes for maintaining the GenRx documentation set. Follow these guidelines when creating new documents, updating existing ones, or reviewing documentation pull requests.

## When to Update Documentation

You must update documentation when your code change affects any of the following areas:

- **Architecture** — Changes to system components, service boundaries, data flow, or infrastructure topology require updates to [Architecture Deep Dive](./ARCHITECTURE_DEEP_DIVE.md) and any related technical references.
- **Deployment** — Changes to deployment steps, environment variables, stack configuration, or prerequisites require updates to [Deployment Guide](./DEPLOYMENT_GUIDE.md).
- **Configuration** — Changes to CDK context values, environment variables, feature flags, or runtime configuration require updates to the relevant procedural or technical reference document.
- **Database schema** — New migrations or schema changes require updates to [Database Migrations](./DATABASE_MIGRATIONS.md) and potentially [Architecture Deep Dive](./ARCHITECTURE_DEEP_DIVE.md).
- **Dependencies** — Adding, removing, or upgrading dependencies requires updates to [Dependency Management](./DEPENDENCY_MANAGEMENT.md).
- **User-facing behavior** — Changes to workflows, UI, or API contracts visible to students, instructors, or admins require updates to [User Guide](./USER_GUIDE.md).
- **Security** — Changes to authentication, authorization, guardrails, or content filtering require updates to [Security Overview](./SECURITY_OVERVIEW.md) or [Bedrock Guardrails](./BEDROCK_GUARDRAILS.md).

### Rule of Thumb

If your pull request changes how someone deploys, operates, extends, or uses the system, it requires a documentation update. When in doubt, update the docs.

## Document Patterns

When creating a new document, choose the pattern that matches its purpose:

### Technical Reference

Use for documents that describe **what the system is** — architecture, schemas, data models, component internals.

**Structure:**

1. Title (H1)
2. Metadata header (Type, Last updated)
3. Table of Contents
4. Overview
5. Component/system sections
6. Data models or schemas
7. Diagrams (Mermaid)
8. Cross-References

**Voice:** Present tense. Describe system behavior as it exists now.

**Examples:** `ARCHITECTURE_DEEP_DIVE.md`, `DEPENDENCY_MANAGEMENT.md`, `DATA_INGESTION.md`, `BEDROCK_GUARDRAILS.md`

### Procedural Guide

Use for documents that describe **how to do something** — deployment, migrations, modifications, setup tasks.

**Structure:**

1. Title (H1)
2. Metadata header (Type, Last updated)
3. Table of Contents
4. Overview
5. Prerequisites
6. Step-by-Step Instructions
7. Verification
8. Troubleshooting
9. Cross-References

**Voice:** Second-person active voice. Address the reader directly with actionable instructions.

**Examples:** `DEPLOYMENT_GUIDE.md`, `MODIFICATION_GUIDE.md`, `DATABASE_MIGRATIONS.md`

### User-Facing Guide

Use for documents aimed at **end-users** of the platform (students, instructors, admins).

**Structure:**

1. Title (H1)
2. Metadata header (Type, Last updated)
3. Table of Contents
4. Getting Started
5. Feature walkthroughs (per role or per feature)
6. FAQ

**Voice:** Second-person active voice. Keep language accessible and avoid internal implementation details.

**Examples:** `USER_GUIDE.md`

### Changelog

Use exclusively for `CHANGELOG.md`. Follows the [Keep a Changelog](https://keepachangelog.com/) format.

**Structure:**

1. Title and format description
2. Version or date entries (newest first)
3. Categories: Added, Changed, Fixed, Removed

**Examples:** `CHANGELOG.md`

## Naming Convention

All documentation files in `docs/` follow **UPPER_SNAKE_CASE** naming:

### Rules

1. Use uppercase letters with underscores separating words: `UPPER_SNAKE_CASE.md`
2. The file extension is always lowercase `.md`
3. Names should be descriptive and concise (2–4 words typical)
4. Avoid abbreviations unless they are universally understood (e.g., `CDK`, `API`, `FAQ`)

### Examples

| Correct | Incorrect |
|---------|-----------|
| `ARCHITECTURE_DEEP_DIVE.md` | `architectureDeepDive.md` |
| `DEPLOYMENT_GUIDE.md` | `deployment-guide.md` |
| `DATABASE_MIGRATIONS.md` | `db_migrations.md` |
| `BEDROCK_GUARDRAILS.md` | `BedrockGuardrails.md` |

### Exception

`README.md` is the only file that does not follow UPPER_SNAKE_CASE. This is a universal convention recognized by Git hosting platforms and documentation tools.

## Writing Conventions

| Context | Convention |
|---------|-----------|
| Procedural instructions | Second-person active voice ("Deploy the stack by running...") |
| System behavior descriptions | Present tense ("The migration runner executes pending migrations.") |
| Code blocks | Always include a language identifier (e.g., ` ```typescript `, ` ```bash `, ` ```python `) |
| Heading hierarchy | H1 → H2 → H3 → H4 with no skipped levels |
| Code snippets >30 lines | Include a file path comment at the top (e.g., `// cdk/lib/api-service-stack.ts`) |
| Cross-references | Use relative paths: `[Document Name](./FILENAME.md)` |

## Quality Checklist

Before merging any documentation change, verify that your document satisfies all of the following criteria:

### Structure

- [ ] **Table of Contents** — Present if the document has more than 3 H2 sections. Uses anchor links.
- [ ] **Heading hierarchy** — Consistent progression: H1 → H2 → H3 → H4. No skipped levels (e.g., H2 directly to H4 is not allowed).
- [ ] **Metadata header** — Contains `Type` and `Last updated` fields in a blockquote at the top of the document.

### Code

- [ ] **Language identifiers** — Every fenced code block specifies a language (e.g., ` ```typescript `, ` ```bash `, ` ```sql `).
- [ ] **File path comments** — Code snippets exceeding 30 lines include a comment indicating the source file path.

### Links

- [ ] **Cross-references** — Related documents are linked using relative paths (`./FILENAME.md`).
- [ ] **No broken links** — All internal `./FILENAME.md` references resolve to existing files in `docs/`.

### Content

- [ ] **Last updated date** — The `Last updated` field reflects the date of the current change.
- [ ] **Correct voice** — Procedural docs use second-person active voice; technical references use present tense.
- [ ] **UPPER_SNAKE_CASE naming** — New files follow the naming convention (exception: `README.md`).

### Final Verification

- [ ] **CHANGELOG.md updated** — If the change is user-facing or affects infrastructure, an entry has been added to `CHANGELOG.md`.
- [ ] **README.md index updated** — If a new document was created, it has been added to the [Documentation Index](./README.md).

## Changelog Requirements

The `CHANGELOG.md` must be updated for every change that is:

- **User-facing** — Any change that affects how students, instructors, or admins interact with the platform.
- **Infrastructure** — Any change to CDK stacks, deployment procedures, environment configuration, or service architecture.

### How to Update the Changelog

1. Open `docs/CHANGELOG.md`
2. Add your entry under the current date section (create one if it does not exist)
3. Categorize your change:
   - **Added** — New features, new documents, new capabilities
   - **Changed** — Modifications to existing behavior or documentation
   - **Fixed** — Bug fixes, corrections
   - **Removed** — Deprecated features or removed functionality
4. Write a concise one-line description of the change

### Example Entry

```markdown
## [2026-05-30]

### Added
- Voice agent integration with Bedrock AgentCore Nova Sonic

### Changed
- Updated deployment prerequisites to require Node.js 20+
```

## Cross-References

- [Documentation Index](./README.md)
- [Changelog](./CHANGELOG.md)
- [Architecture Deep Dive](./ARCHITECTURE_DEEP_DIVE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
