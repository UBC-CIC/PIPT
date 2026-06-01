# GenRx

GenRx is a clinical simulation platform for pharmacy education. Students interact with AI-powered patient personas through text and voice chat, practicing clinical assessment skills in a safe environment.

---

## Quick Start

```bash
# Deploy infrastructure
cd cdk
npm install
npx cdk deploy --all -c StackPrefix=GenRx -c githubRepo=genrx

# Run frontend locally
cd frontend
npm install
npm run dev
```

See the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for full setup instructions.

---

## High-Level Architecture

The following architecture diagram illustrates the various AWS components utilized to deliver the solution. For an in-depth explanation of the frontend and backend stacks, see the [Architecture Deep Dive](docs/ARCHITECTURE_DEEP_DIVE.md).

![GenRx Architecture](docs/architecture-diagram.drawio.png)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | End-to-end deployment instructions, prerequisites, and troubleshooting |
| [Architecture Deep Dive](docs/ARCHITECTURE_DEEP_DIVE.md) | System architecture overview and complete database schema |
| [Database Migrations](docs/DATABASE_MIGRATIONS.md) | Migration system usage, patterns, and safety guidelines |
| [Dependency Management](docs/DEPENDENCY_MANAGEMENT.md) | Dependency locking and update procedures for Python and Node.js |
| [Modification Guide](docs/MODIFICATION_GUIDE.md) | How to customize colors, extend the API, configure LLMs, and set up local dev |
| [Security Overview](docs/SECURITY_OVERVIEW.md) | Network architecture and security controls |
| [Voice Agent Setup](docs/AGENTCORE_VOICE_AGENT_SETUP.md) | Bedrock AgentCore voice agent deployment |

---

## Project Structure

```
.
├── cdk/                # AWS CDK infrastructure + backend services
│   ├── bin/            # CDK app entry point
│   ├── lib/            # CDK stack definitions
│   ├── lambda/         # Lambda function source code
│   ├── text_generation/# AI text generation service (Docker Lambda)
│   ├── data_ingestion/ # Document processing pipeline (Docker Lambda)
│   ├── socket-server/  # Real-time server (ECS Fargate)
│   ├── voice-agent/    # Bedrock AgentCore voice agent
│   └── layers/         # Lambda layers (shared dependencies)
├── frontend/           # React SPA (Vite + Tailwind + shadcn/ui)
├── docs/               # Project documentation
└── scripts/            # Utility scripts
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui
- **Backend**: AWS Lambda (Node.js + Python), API Gateway, AppSync
- **AI**: Amazon Bedrock (Claude Sonnet 4.6 for text generation, Cohere Embed v4 for embeddings, Nova Sonic 2.0 for voice)
- **Database**: PostgreSQL 16 on RDS with pgvector
- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Auth**: Amazon Cognito
- **CI/CD**: AWS CodePipeline + CodeBuild + Amplify
