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

See the [Deployment Guide](docs/deploymentGuide.md) for full setup instructions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/deploymentGuide.md) | End-to-end deployment instructions, prerequisites, and troubleshooting |
| [Architecture Deep Dive](docs/architectureDeepDive.md) | System architecture overview and complete database schema |
| [Database Migrations](docs/databaseMigrations.md) | Migration system usage, patterns, and safety guidelines |
| [Dependency Management](docs/dependencyManagement.md) | Dependency locking and update procedures for Python and Node.js |
| [Modification Guide](docs/modificationGuide.md) | How to customize colors, extend the API, configure LLMs, and set up local dev |
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
- **AI**: Amazon Bedrock (Llama 3 70B, Titan Embeddings, Nova Sonic)
- **Database**: PostgreSQL 16 on RDS with pgvector
- **Real-time**: Socket.IO on ECS Fargate, AppSync subscriptions, WebRTC
- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Auth**: Amazon Cognito
- **CI/CD**: AWS CodePipeline + CodeBuild + Amplify
