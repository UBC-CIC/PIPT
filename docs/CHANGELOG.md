# Changelog

> **Type:** Changelog
> **Last updated:** 2026-05-30

All notable changes to the GenRx project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2026-05-30]

### Added

- `USER_GUIDE.md` — User-facing guide covering student, instructor, and admin workflows
- `CHANGELOG.md` — Project changelog following Keep a Changelog format
- `DATA_INGESTION.md` — Technical reference for the document ingestion pipeline and vector store
- `BEDROCK_GUARDRAILS.md` — Technical reference for AI content filtering and prompt injection defenses
- `README.md` — Central documentation index organized by document type
- `CONTRIBUTING_DOCS.md` — Documentation maintenance rules and contribution guidelines

### Changed

- Renamed files from camelCase to UPPER_SNAKE_CASE to follow naming conventions:
  - `architectureDeepDive.md` → `ARCHITECTURE_DEEP_DIVE.md`
  - `deploymentGuide.md` → `DEPLOYMENT_GUIDE.md`
  - `modificationGuide.md` → `MODIFICATION_GUIDE.md`
  - `databaseMigrations.md` → `DATABASE_MIGRATIONS.md`
  - `dependencyManagement.md` → `DEPENDENCY_MANAGEMENT.md`
- Restructured `ARCHITECTURE_DEEP_DIVE.md` to follow the Technical Reference pattern
- Restructured `DEPLOYMENT_GUIDE.md` to follow the Procedural Guide pattern
- Restructured `MODIFICATION_GUIDE.md` to follow the Procedural Guide pattern
- Restructured `DATABASE_MIGRATIONS.md` to follow the Procedural Guide pattern
- Restructured `DEPENDENCY_MANAGEMENT.md` to follow the Technical Reference pattern
- Added supplementary document headers to `CDK_TECHNICAL_REVIEW.md`, `SECURITY_OVERVIEW.md`, `VOICE_AGENT_DEEP_DIVE.md`, and `AGENTCORE_VOICE_AGENT_SETUP.md`
