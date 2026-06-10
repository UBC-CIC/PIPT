# Case Interaction Evaluation Tool

This prototype is a simulation platform for pharmacy education built on AWS. Students interact with AI-powered patient personas through text and voice chat, practicing clinical assessment and communication skills in a safe, repeatable environment. Instructors create simulation groups with configurable patient scenarios, and the system generates AI-powered debriefs evaluating student performance against key clinical questions.

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | End-to-end deployment instructions, prerequisites, and troubleshooting |
| [Architecture Deep Dive](docs/ARCHITECTURE_DEEP_DIVE.md) | System architecture, component breakdown, data flows, and database schema |
| [User Guide](docs/USER_GUIDE.md) | How to use the platform as a student, instructor, or admin |
| [Modification Guide](docs/MODIFICATION_GUIDE.md) | Customizing colors, extending the API, configuring LLMs, and local dev setup |
| [Database Migrations](docs/DATABASE_MIGRATIONS.md) | Migration system usage, patterns, and safety guidelines |
| [Dependency Management](docs/DEPENDENCY_MANAGEMENT.md) | Dependency locking and update procedures for Python and Node.js |
| [API Documentation](docs/api-documentation.md) | REST API endpoints, request/response formats |
| [Data Ingestion](docs/DATA_INGESTION.md) | Document processing pipeline for patient case materials |
| [Bedrock Guardrails](docs/BEDROCK_GUARDRAILS.md) | AI safety guardrails configuration |
| [Voice Agent Setup](docs/AGENTCORE_VOICE_AGENT_SETUP.md) | Bedrock AgentCore voice agent deployment |
| [Voice Agent Deep Dive](docs/VOICE_AGENT_DEEP_DIVE.md) | Voice architecture and Nova Sonic integration |
| [Custom Domain & SES](docs/CUSTOM_DOMAIN_AND_SES.md) | Custom domain setup, SES email delivery, and Amplify hosting |
| [Contributing to Docs](docs/CONTRIBUTING_DOCS.md) | Guidelines for writing and maintaining documentation |
| [Changelog](docs/CHANGELOG.md) | Version history and release notes |

## High-Level Architecture

![Architecture Diagram](docs/architecture-diagram-no-numberings-with-ses.drawio.png)

For a detailed breakdown of each component, data flows, and the full database schema, see the [Architecture Deep Dive](docs/ARCHITECTURE_DEEP_DIVE.md).

## Directories

```
.
├── cdk/                  # AWS CDK infrastructure + backend services
│   ├── bin/              # CDK app entry point
│   ├── lib/              # CDK stack definitions
│   ├── lambda/           # Lambda function source code (JS + Python)
│   ├── text_generation/  # AI text generation service (Docker Lambda)
│   ├── data_ingestion/   # Document processing pipeline (Docker Lambda)
│   ├── socket-server/    # Real-time server (ECS Fargate)
│   ├── voice-agent/      # Bedrock AgentCore voice agent
│   └── layers/           # Lambda layers (shared dependencies)
├── frontend/             # React SPA (Vite + Tailwind + shadcn/ui)
│   └── src/
│       ├── pages/        # Route-level page components
│       ├── components/   # Reusable UI components
│       ├── services/     # API service layers
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Shared utilities
├── docs/                 # Project documentation
└── scripts/              # Utility scripts
```

| Directory | Description |
|-----------|-------------|
| `/cdk` | AWS CDK infrastructure code (TypeScript) |
| `/cdk/bin` | CDK app entry point and stack orchestration |
| `/cdk/lib` | CDK stack definitions for all infrastructure (VPC, database, API, auth, hosting, WAF) |
| `/cdk/lambda` | Lambda function source code (Node.js 22.x and Python 3.12) |
| `/cdk/layers` | Lambda layers for shared dependencies (postgres, psycopg2, aws-jwt-verify, jose) |
| `/cdk/text_generation` | AI text generation service — LangChain + Bedrock for chat, debriefs, question matching (Docker Lambda) |
| `/cdk/data_ingestion` | Document processing pipeline — PDF ingestion into pgvector store (Docker Lambda) |
| `/cdk/socket-server` | Real-time server — Socket.IO voice on ECS Fargate |
| `/cdk/voice-agent` | Bedrock AgentCore voice agent with Nova Sonic |
| `/frontend` | React 19 frontend application (TypeScript, Vite, Tailwind CSS, shadcn/ui) |
| `/frontend/src/pages` | Page-level components organized by user role (student, instructor, admin) |
| `/frontend/src/components` | Reusable UI components and shadcn/ui primitives |
| `/frontend/src/services` | API service layer for backend communication |
| `/frontend/src/hooks` | Custom React hooks including WebSocket and panel management |
| `/frontend/src/lib` | Shared utilities (auth, API client, browser detection, debrief parsing) |
| `/docs` | Project documentation including deployment, architecture, and user guides |
