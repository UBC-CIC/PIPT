# Deployment Guide

> **Type:** Procedural Guide
> **Last updated:** 2026-05-30

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Instructions](#step-by-step-instructions)
  - [Step 1: Create a GitHub Personal Access Token](#step-1-create-a-github-personal-access-token)
  - [Step 2: Verify Bedrock Model Availability](#step-2-verify-bedrock-model-availability)
  - [Step 3: Fork and Clone the Repository](#step-3-fork-and-clone-the-repository)
  - [Step 4: Upload Secrets and Parameters](#step-4-upload-secrets-and-parameters)
  - [Step 5: Bootstrap CDK](#step-5-bootstrap-cdk)
  - [Step 6: Deploy Stacks](#step-6-deploy-stacks)
- [Verification](#verification)
- [Post-Deployment](#post-deployment)
  - [Push Initial Docker Images](#push-initial-docker-images)
  - [Enable DynamoDB TTL](#enable-dynamodb-ttl)
  - [Request SES Production Access (Optional)](#request-ses-production-access-optional)
  - [Build the Amplify App](#build-the-amplify-app)
  - [Deploy the Voice Agent (Optional)](#deploy-the-voice-agent-optional)
  - [Visit the Web App](#visit-the-web-app)
- [Cleanup](#cleanup)
- [Troubleshooting](#troubleshooting)
- [Cross-References](#cross-references)

---

## Overview

This guide walks you through deploying GenRx from scratch. You will set up AWS prerequisites, configure secrets, deploy CDK stacks, and verify the deployment. The process covers the full lifecycle from initial setup through post-deployment configuration and teardown.

---

## Prerequisites

### Required

- **AWS Account** with administrative access
- **AWS CLI v2** installed and configured (`aws configure`) with a named profile
- **Node.js 22+** and npm
- **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
- **Git** installed
- **GitHub account** with a fork of the GenRx repository

> **Note:** Docker is **not** required locally. All Docker images are built in the cloud by CodePipeline/CodeBuild. Python is also not required locally — the Python Lambda functions and voice agent run in containers built remotely.

### Optional

- **Docker** — Only needed if you want to manually build and push container images locally (not required for normal deployment).
- **Custom domain** — If you want to use a custom domain for the Amplify-hosted frontend, configure it in the AWS Amplify console after deployment.
- **Amazon SES** — For production email sending (verification emails). By default, Cognito uses its built-in email service (limited to 50 emails/day).

---

## Step-by-Step Instructions

### Step 1: Create a GitHub Personal Access Token

The CI/CD pipeline and Amplify app use a GitHub PAT to pull source code.

1. Go to [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Select scopes: `repo` (full control of private repositories) and `admin:repo_hook` (for webhooks).
4. Copy the generated token — you will need it in Step 4.

### Step 2: Verify Bedrock Model Availability

GenRx uses several Amazon Bedrock models. These models are available by default — no manual access request is needed. However, verify they are accessible in the regions used by the application.

The application deploys to **`ca-central-1`** but makes cross-region calls to `us-east-1` for certain models that are only available there:

| Model | Region | Purpose |
|-------|--------|---------|
| **Anthropic Claude Sonnet 4.6** (`us.anthropic.claude-sonnet-4-6`) | `us-east-1` | Primary LLM for text generation |
| **Cohere Embed v4** (`cohere.embed-v4:0`) | `us-east-1` | Document and query embeddings |
| **Amazon Nova Sonic 2.0** (`amazon.nova-2-sonic-v1:0`) | `us-east-1` | Voice interactions |
| **Amazon Nova Lite** (`amazon.nova-lite-v1:0`) | `us-east-1` | Lightweight inference (diagnosis evaluation) |

To verify access, open the [Bedrock console in us-east-1](https://us-east-1.console.aws.amazon.com/bedrock/) and confirm these models appear under **Model access** as available. If any model shows as unavailable, enable it there.

> **Note:** The CDK stacks deploy to `ca-central-1`, but the application routes LLM, embedding, and voice calls to `us-east-1` where these models are hosted. This cross-region routing is handled automatically by the application code.

### Step 3: Fork and Clone the Repository

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/genrx.git
cd genrx/cdk
npm install
```

### Step 4: Upload Secrets and Parameters

Before deploying, create the following secrets and parameters in AWS. These are referenced by the CDK stacks at synthesis time.

#### Secret 1: GENRXSecrets

This secret contains the admin username for the RDS PostgreSQL instance. You choose this value — it will be the master username for your database. The database stack reads `DB_Username` from this secret at deploy time.

<details>
<summary>macOS / Linux</summary>

```bash
aws secretsmanager create-secret \
  --name GENRXSecrets \
  --secret-string '{"DB_Username": "<YOUR-DB-ADMIN-USERNAME>"}' \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws secretsmanager create-secret `
  --name GENRXSecrets `
  --secret-string '{\"DB_Username\": \"<YOUR-DB-ADMIN-USERNAME>\"}' `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws secretsmanager create-secret ^
  --name GENRXSecrets ^
  --secret-string "{\"DB_Username\": \"<YOUR-DB-ADMIN-USERNAME>\"}" ^
  --region <YOUR-REGION>
```

</details>

> **Important:** The RDS username must start with a letter, contain only alphanumeric characters, and be 1–63 characters long. Avoid reserved words like `admin`, `rds`, or `postgres`.

#### Secret 2: github-personal-access-token

This secret is used by the CI/CD pipeline and Amplify to access your GitHub repository.

<details>
<summary>macOS / Linux</summary>

```bash
aws secretsmanager create-secret \
  --name github-personal-access-token \
  --secret-string '{"my-github-token": "<YOUR-GITHUB-PAT>"}' \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws secretsmanager create-secret `
  --name github-personal-access-token `
  --secret-string '{\"my-github-token\": \"<YOUR-GITHUB-PAT>\"}' `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws secretsmanager create-secret ^
  --name github-personal-access-token ^
  --secret-string "{\"my-github-token\": \"<YOUR-GITHUB-PAT>\"}" ^
  --region <YOUR-REGION>
```

</details>

#### Parameter 1: genrx-owner-name

Create an SSM parameter containing your GitHub username (the owner of the forked repository).

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "genrx-owner-name" \
  --value "<YOUR-GITHUB-USERNAME>" \
  --type String \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws ssm put-parameter `
  --name "genrx-owner-name" `
  --value "<YOUR-GITHUB-USERNAME>" `
  --type String `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws ssm put-parameter ^
  --name "genrx-owner-name" ^
  --value "<YOUR-GITHUB-USERNAME>" ^
  --type String ^
  --region <YOUR-REGION>
```

</details>

#### Parameter 2: /GenRx/AllowedEmailDomains

Create a comma-separated list of email domains allowed to sign up (e.g., `gmail.com,ubc.ca`). The Cognito pre-signup Lambda reads this parameter to block registrations from unauthorized domains. Store it as a `SecureString` since it controls access.

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "/GenRx/AllowedEmailDomains" \
  --value "<COMMA-SEPARATED-DOMAINS>" \
  --type SecureString \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws ssm put-parameter `
  --name "/GenRx/AllowedEmailDomains" `
  --value "<COMMA-SEPARATED-DOMAINS>" `
  --type SecureString `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws ssm put-parameter ^
  --name "/GenRx/AllowedEmailDomains" ^
  --value "<COMMA-SEPARATED-DOMAINS>" ^
  --type SecureString ^
  --region <YOUR-REGION>
```

</details>

> **Example:** `--value "gmail.com,ubc.ca"` — only users with emails from these domains will be able to register. Add additional domains as needed, separated by commas.

#### Parameter 3 (Post-Deployment): /{StackPrefix}/voiceAgentArn

> **Skip this for now.** This parameter is created after the initial deployment as part of the voice agent setup (see [Deploy the Voice Agent](#deploy-the-voice-agent-optional)). It is listed here for reference only.

The EcsSocket stack reads this parameter to connect to the Bedrock AgentCore voice agent. You will create it after deploying the voice agent.

#### Summary of Required Secrets and Parameters

| Name | Type | Key/Value | Used By |
|------|------|-----------|---------|
| `GENRXSecrets` | Secrets Manager | `{"DB_Username": "..."}` | Database stack (RDS admin credentials) |
| `github-personal-access-token` | Secrets Manager | `{"my-github-token": "..."}` | CI/CD stack, Amplify stack |
| `genrx-owner-name` | SSM Parameter (String) | GitHub username | CI/CD stack, Amplify stack |
| `/GenRx/AllowedEmailDomains` | SSM Parameter (SecureString) | Comma-separated email domains | Cognito pre-signup Lambda |
| `/{StackPrefix}/voiceAgentArn` | SSM Parameter (String) | Voice agent ARN (created post-deployment) | EcsSocket stack |

### Step 5: Bootstrap CDK

If this is your first CDK deployment in the target account/region, bootstrap the environment:

```bash
cdk bootstrap aws://<YOUR-ACCOUNT-ID>/<YOUR-REGION> --profile <YOUR-AWS-PROFILE>
```

### Step 6: Deploy Stacks

The CDK app requires two context variables at deploy time:

| Context Variable | Description | Required |
|-----------------|-------------|----------|
| `StackPrefix` | Prefix for all stack and resource names (e.g., `GenRx`) | Yes |
| `githubRepo` | Name of your GitHub repository (not the full URL) | Yes |
| `githubBranch` | Branch to track for CI/CD (default: `main`) | No |
| `voiceAgentArn` | ARN of a deployed Bedrock AgentCore voice agent (not needed for first deploy) | No |

Choose one of the following deployment options:

#### Option A: Deploy All Stacks (Recommended for First Deployment)

```bash
cdk deploy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>
```

#### Option B: Deploy Individual Stacks (Incremental Updates)

Stacks deploy in dependency order. If you only need to update a specific stack:

```bash
cdk deploy GenRx-Api \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>
```

#### Option C: Redeploy with Voice Agent

After completing the voice agent setup, you can pass the ARN explicitly on subsequent deploys. However, the recommended approach is to store it in SSM so you do not need this flag.

```bash
cdk deploy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  -c voiceAgentArn="arn:aws:bedrock:us-east-1:123456789012:agent-runtime/XXXXXXXXXX" \
  --profile <YOUR-AWS-PROFILE>
```

#### Stack Deployment Order

The CDK app creates the following stacks in dependency order:

1. **`{StackPrefix}-CICD`** — ECR repositories, CodeBuild projects, CodePipeline
2. **`{StackPrefix}-VpcStack`** — VPC, subnets, NAT gateway, VPC endpoints
3. **`{StackPrefix}-Database`** — RDS PostgreSQL instance, RDS Proxy, secrets
4. **`{StackPrefix}-Api`** — API Gateway, Lambda functions, Cognito, AppSync, S3
5. **`{StackPrefix}-TurnServer`** — TURN server for WebRTC
6. **`{StackPrefix}-EcsSocket`** — ECS Fargate service for Socket.IO
7. **`{StackPrefix}-DBFlow`** — Database migration runner (triggers on deploy)
8. **`{StackPrefix}-Amplify`** — Amplify hosting for the React frontend

> **Note:** `--all` handles the dependency order automatically. Deployment takes approximately 30–45 minutes on first run.

---

## Verification

After deployment completes, verify the following:

1. **Check stack status.** Open the [CloudFormation console](https://console.aws.amazon.com/cloudformation/) and confirm all stacks show `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

2. **Verify Bedrock access.** Open the [Lambda console](https://console.aws.amazon.com/lambda/), find the function named `{StackPrefix}-Api-TextGenLambdaDockerFunction`, create a test event, and invoke it. Check CloudWatch Logs for successful initialization.

3. **Confirm API Gateway.** Navigate to the [API Gateway console](https://console.aws.amazon.com/apigateway/) and verify the `{StackPrefix}` REST API exists with deployed stages.

4. **Check ECS service.** Open the [ECS console](https://console.aws.amazon.com/ecs/) and confirm the socket server service has running tasks.

5. **Verify database connectivity.** Check CloudWatch Logs for the DBFlow Lambda to confirm migrations ran successfully.

---

## Post-Deployment

### Push Initial Docker Images

The CI/CD pipeline builds and pushes all Docker images (text generation, data ingestion, socket server, voice agent). For the first deployment, the ECR repositories are empty. Trigger the pipeline by either:

- **Pushing a commit** to your tracked branch, or
- **Clicking "Release change"** in the [CodePipeline console](https://console.aws.amazon.com/codepipeline/) for the `{StackPrefix}-CICD-DockerImagePipeline` pipeline

Wait for the pipeline to complete successfully. Once done, the Lambda functions and ECS services will have images to run.

### Enable DynamoDB TTL

The `DynamoDB-Conversation-Table` is created automatically on the first Lambda invocation. Enable TTL once per AWS account before users start using the app, otherwise early items will accumulate indefinitely.

> **Skip this step** if TTL is already enabled on the table (check in the DynamoDB console under the table's **Additional settings** tab).

<details>
<summary>macOS / Linux</summary>

```bash
aws dynamodb update-time-to-live \
  --table-name DynamoDB-Conversation-Table \
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws dynamodb update-time-to-live `
  --table-name DynamoDB-Conversation-Table `
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws dynamodb update-time-to-live ^
  --table-name DynamoDB-Conversation-Table ^
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" ^
  --region <YOUR-REGION>
```

</details>

Once enabled, DynamoDB automatically deletes:
- Question, DTP, and recommendation cache items after **7 days**
- Chat history items after **90 days**

### Request SES Production Access (Optional)

If you need to send more than 50 verification emails per day:

1. Open the [SES console](https://console.aws.amazon.com/ses/).
2. Navigate to **Account dashboard**.
3. Click **Request production access**.
4. Fill out the form describing your use case.

### Build the Amplify App

After the first deployment, Amplify needs to run its initial build:

1. Open the [Amplify console](https://console.aws.amazon.com/amplify/).
2. Find your app (named `{StackPrefix}-Amplify-amplify`).
3. If the build has not triggered automatically, click **Run build** on the `main` branch.
4. Wait for the build to complete (typically 3–5 minutes).

### Deploy the Voice Agent (Optional)

The voice agent runs on **Amazon Bedrock AgentCore** and requires the CDK stacks to be deployed first (since the CI/CD pipeline builds and pushes the voice-agent Docker image to ECR). Follow this order of operations:

#### Step A: Complete the Initial CDK Deployment

Deploy all stacks without a voice agent ARN (Steps 5–6 above). This creates the ECR repository for the voice agent image.

#### Step B: Push the Voice Agent Image

The CI/CD pipeline builds and pushes all Docker images, including the voice agent. Trigger it by either:

- **Pushing a commit** to your tracked branch, or
- **Clicking "Release change"** in the [CodePipeline console](https://console.aws.amazon.com/codepipeline/) for the `{StackPrefix}-CICD-DockerImagePipeline` pipeline

Wait for the pipeline to complete successfully before proceeding.

#### Step C: Set Up AgentCore and Deploy the Voice Agent

Follow the detailed instructions in [AgentCore Voice Agent Setup](./AGENTCORE_VOICE_AGENT_SETUP.md) to configure Bedrock AgentCore and deploy the voice agent through the AWS console.

Once complete, you will have a voice agent runtime ARN.

#### Step D: Store the ARN and Redeploy

Store the ARN in SSM so the EcsSocket stack can connect to it:

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" \
  --value "<YOUR-VOICE-AGENT-ARN>" \
  --type String \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws ssm put-parameter `
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" `
  --value "<YOUR-VOICE-AGENT-ARN>" `
  --type String `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws ssm put-parameter ^
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" ^
  --value "<YOUR-VOICE-AGENT-ARN>" ^
  --type String ^
  --region <YOUR-REGION>
```

</details>

Then redeploy the EcsSocket stack to pick up the new value:

```bash
cdk deploy GenRx-EcsSocket \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>
```

> **Note:** Voice features will not work until all four steps are complete. The ECS socket server uses the stored ARN to establish a SigV4-signed WebSocket connection to the AgentCore runtime.

### Visit the Web App

Once the Amplify build completes, your app is live at the default Amplify domain:

```text
https://main.<AMPLIFY-APP-ID>.amplifyapp.com
```

Find the exact URL in the Amplify console or in the CDK stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name GenRx-Amplify \
  --query "Stacks[0].Outputs[?OutputKey=='AmplifyDefaultDomain'].OutputValue" \
  --output text \
  --region <YOUR-REGION>
```

---

## Cleanup

To tear down all deployed resources, run:

```bash
cdk destroy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>
```

> **Warning:** The RDS instance has `deletionProtection: true`. You must disable deletion protection in the RDS console before the database stack can be deleted. The S3 bucket also has `removalPolicy: RETAIN` — empty and delete it manually after stack deletion.

To delete individual stacks, destroy them in reverse dependency order:

```bash
cdk destroy GenRx-Amplify -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-EcsSocket -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-TurnServer -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-Api -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-Database -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-VpcStack -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-CICD -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
```

---

## Troubleshooting

### Stack deletion fails for Database stack

**Cause:** Deletion protection is enabled on the RDS instance.

**Fix:**

1. Open the [RDS console](https://console.aws.amazon.com/rds/).
2. Select the database instance.
3. Click **Modify**.
4. Uncheck **Enable deletion protection**.
5. Apply immediately.
6. Retry `cdk destroy`.

### RDS username constraint error

**Cause:** The `DB_Username` value in `GENRXSecrets` uses a reserved word or invalid characters.

**Fix:** Update the secret with a valid username (starts with a letter, alphanumeric only, 1–63 chars):

```bash
aws secretsmanager update-secret \
  --secret-id GENRXSecrets \
  --secret-string '{"DB_Username": "genrxadmin"}' \
  --region <YOUR-REGION>
```

### Amplify build fails

**Cause:** Environment variables are not available during build, or the GitHub token is invalid.

**Fix:**

1. Verify the `github-personal-access-token` secret exists and contains a valid token.
2. Check that the token has `repo` scope.
3. Verify the repository name matches the `githubRepo` context variable.

### CodePipeline source action fails

**Cause:** The GitHub PAT has expired or lacks required permissions.

**Fix:**

1. Generate a new GitHub PAT with `repo` and `admin:repo_hook` scopes.
2. Update the secret:

```bash
aws secretsmanager update-secret \
  --secret-id github-personal-access-token \
  --secret-string '{"my-github-token": "<NEW-TOKEN>"}' \
  --region <YOUR-REGION>
```

### Lambda functions return errors after first deploy

**Cause:** ECR repositories are empty — the Docker Lambda functions have no image to run.

**Fix:** Push initial images by triggering the CI/CD pipeline (see [Push Initial Docker Images](#push-initial-docker-images)) or push a commit to the tracked branch.

### Voice features not working

**Cause:** Nova Sonic models are only available in `us-east-1`. If your deployment region is different, the voice service makes cross-region calls. Additionally, the voice agent must be deployed to Bedrock AgentCore and its ARN configured.

**Fix:**

1. Ensure Bedrock model access is enabled in `us-east-1` for Nova Sonic models.
2. Verify the ECS task role has `bedrock:InvokeModelWithBidirectionalStream` permission in `us-east-1`.
3. Confirm the voice agent is deployed to Bedrock AgentCore (see [Deploy the Voice Agent](#deploy-the-voice-agent-optional)).
4. Verify the `voiceAgentArn` is set — either via the `-c` context flag or the `/{StackPrefix}/voiceAgentArn` SSM parameter.

### Text generation or embeddings not working

**Cause:** Claude Sonnet 4.6 and Cohere Embed v4 are called in `us-east-1` via cross-region inference, but the models may not be accessible there.

**Fix:**

1. Open the [Bedrock console in us-east-1](https://us-east-1.console.aws.amazon.com/bedrock/).
2. Navigate to **Model access** and verify the models are available.
3. Check CloudWatch Logs for the `TextGenLambdaDockerFunction` for specific error messages.
4. Ensure the Lambda execution role has `bedrock:InvokeModel` permissions for the model ARNs in `us-east-1`.

---

## Cross-References

- [Security Overview](./SECURITY_OVERVIEW.md) — OWASP assessment and security remediation roadmap
- [AgentCore Voice Agent Setup](./AGENTCORE_VOICE_AGENT_SETUP.md) — Console-side voice agent configuration
- [Database Migrations](./DATABASE_MIGRATIONS.md) — Creating and running schema changes
- [Modification Guide](./MODIFICATION_GUIDE.md) — Customizing colors, API, LLM, and frontend
