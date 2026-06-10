# Deployment Guide

> **Type:** Procedural Guide
> **Last updated:** 2026-06-08

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
  - [Monitoring the Deployment](#monitoring-the-deployment)
- [Verification](#verification)
- [Post-Deployment](#post-deployment)
  - [Push Initial Docker Images](#push-initial-docker-images)
  - [DynamoDB Conversation Table & TTL](#dynamodb-conversation-table--ttl)
  - [Request SES Production Access (Optional)](#request-ses-production-access-optional)
  - [Build the Amplify App](#build-the-amplify-app)
  - [Deploy the Voice Agent](#deploy-the-voice-agent)
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
- **OpenSSL** for generating the RSA key pair used in CloudFront signed URLs (pre-installed on macOS/Linux; on Windows, available via [Git Bash](https://gitforwindows.org/) or [Win32 OpenSSL](https://slproweb.com/products/Win32OpenSSL.html))

> **Note:** Docker is **not** required locally. All Docker images are built in the cloud by CodePipeline/CodeBuild. Python is also not required locally since the Python Lambda functions and voice agent run in containers built remotely.

### Optional

- **Docker**: only needed if you want to manually build and push container images locally (not required for normal deployment).
- **Custom domain**: configured automatically via the `SesVerifiedDomain` CDK context variable. See [Custom Domain & SES](./CUSTOM_DOMAIN_AND_SES.md#amplify-custom-domain) for details.
- **Amazon SES**: for production email sending (verification emails). By default, Cognito uses its built-in email service (limited to 50 emails/day).

---

## Step-by-Step Instructions

### Step 1: Create a GitHub Personal Access Token

The CI/CD pipeline and Amplify app use a GitHub PAT to pull source code.

1. Go to [GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Select scopes: `repo` (full control of private repositories) and `admin:repo_hook` (for webhooks).
4. Copy the generated token. You will need it in Step 4.

### Step 2: Verify Bedrock Model Availability

GenRx uses several Amazon Bedrock models. These models are available by default (no manual access request is needed). However, verify they are accessible in the regions used by the application.

The application deploys to **`ca-central-1`** but makes cross-region calls to `us-east-1` for certain models that are only available there:

| Model | Region | Purpose |
|-------|--------|---------|
| **Anthropic Claude Sonnet 4.6** (`us.anthropic.claude-sonnet-4-6`) | `us-east-1` | Primary LLM for text generation |
| **Cohere Embed v4** (`cohere.embed-v4:0`) | `us-east-1` | Document and query embeddings |
| **Amazon Nova Sonic 2.0** (`amazon.nova-2-sonic-v1:0`) | `us-east-1` | Voice interactions (via AgentCore) |

To verify access, open the [Bedrock console in us-east-1](https://us-east-1.console.aws.amazon.com/bedrock/) and confirm these models appear under **Model access** as available. If any model shows as unavailable, enable it there.

> **Note:** The CDK stacks deploy to `ca-central-1`, but the application routes LLM, embedding, and voice calls to `us-east-1` where these models are hosted. This cross-region routing is handled automatically by the application code.

> **You are not limited to these regions.** The application can be deployed to any AWS region — `ca-central-1` is simply the default used by the team. To deploy elsewhere, change the region in `cdk/bin/cdk.ts`. The cross-region Bedrock calls to `us-east-1` will still work from any deployment region since the application explicitly targets `us-east-1` for model invocations regardless of where the stacks live.

### Step 3: Fork and Clone the Repository

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/genrx.git
cd genrx/cdk
npm install
```

### Step 4: Upload Secrets and Parameters

Before deploying, create the following secrets and parameters in AWS. These are referenced by the CDK stacks at synthesis time.

#### Secret 1: GENRXSecrets

This secret contains the admin username for the RDS PostgreSQL instance. You choose this value; it becomes the master username for your database. The database stack reads `DB_Username` from this secret at deploy time.

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

> **Important:** The value must be comma-separated with no spaces between domains. Use `gmail.com,ubc.ca`, not `gmail.com, ubc.ca`. A space before a domain will cause sign-up validation to fail silently for that domain.

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

> **Example:** `--value "gmail.com,ubc.ca"` allows only users with emails from these domains to register. Add additional domains as needed, separated by commas.

#### Parameter 3: /{StackPrefix}/voiceAgentArn (Placeholder Required)

The EcsSocket stack **unconditionally** reads this SSM parameter at deploy time to configure the voice agent WebSocket connection. Even though you won't have a real voice agent ARN until post-deployment, a placeholder value **must** exist before the first `cdk deploy` or CloudFormation will fail during the EcsSocket stack creation.

Create the placeholder now. You will update it with the real ARN after deploying the voice agent (see [Deploy the Voice Agent](#deploy-the-voice-agent-optional)).

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" \
  --value "placeholder" \
  --type String \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws ssm put-parameter `
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" `
  --value "placeholder" `
  --type String `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws ssm put-parameter ^
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" ^
  --value "placeholder" ^
  --type String ^
  --region <YOUR-REGION>
```

</details>

> **Example:** If your `StackPrefix` is `GenRx`, the parameter name is `/GenRx/voiceAgentArn`. Voice features will not function with the placeholder value (they require the real ARN set up in post-deployment), but the placeholder prevents the deployment from failing.

#### Secret 3: GenRx/CloudFrontSigningKey

The API service stack uses CloudFront signed URLs to deliver patient documents securely. This requires an RSA key pair: the private key signs download URLs, and the public key lets CloudFront verify them. Without these, the `{StackPrefix}-Api` stack will fail to deploy because it reads `/GenRx/CloudFrontPublicKey` from SSM and references `GenRx/CloudFrontSigningKey` from Secrets Manager at synthesis time.

**Why this is required:** In `cdk/lib/api-service-stack.ts`, the stack calls `ssm.StringParameter.valueForStringParameter(this, "/GenRx/CloudFrontPublicKey")` to create a CloudFront `PublicKey` resource, and Lambda functions reference the `GenRx/CloudFrontSigningKey` secret at runtime to generate signed URLs. If either is missing, deployment fails.

**Step 1: Generate an RSA 2048-bit key pair.**

<details>
<summary>macOS / Linux</summary>

```bash
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

> **Note:** If `openssl` is not available, install it via [Git for Windows](https://gitforwindows.org/) (included in Git Bash) or [Win32/Win64 OpenSSL](https://slproweb.com/products/Win32OpenSSL.html).

</details>

**Step 2: Store the private key in Secrets Manager.**

This is the signing key that Lambda functions use at runtime to generate time-limited signed URLs for document downloads.

<details>
<summary>macOS / Linux</summary>

```bash
aws secretsmanager create-secret \
  --name "GenRx/CloudFrontSigningKey" \
  --secret-string file://private_key.pem \
  --description "RSA private key for signing CloudFront document delivery URLs" \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
$privateKey = Get-Content -Raw private_key.pem
aws secretsmanager create-secret `
  --name "GenRx/CloudFrontSigningKey" `
  --secret-string $privateKey `
  --description "RSA private key for signing CloudFront document delivery URLs" `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws secretsmanager create-secret ^
  --name "GenRx/CloudFrontSigningKey" ^
  --secret-string file://private_key.pem ^
  --description "RSA private key for signing CloudFront document delivery URLs" ^
  --region <YOUR-REGION>
```

</details>

**Step 3: Store the public key in SSM.**

CDK reads this at synthesis time to create the CloudFront `PublicKey` resource that verifies signed URLs.

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "/GenRx/CloudFrontPublicKey" \
  --value file://public_key.pem \
  --type String \
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
$publicKey = Get-Content -Raw public_key.pem
aws ssm put-parameter `
  --name "/GenRx/CloudFrontPublicKey" `
  --value $publicKey `
  --type String `
  --region <YOUR-REGION>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws ssm put-parameter ^
  --name "/GenRx/CloudFrontPublicKey" ^
  --value file://public_key.pem ^
  --type String ^
  --region <YOUR-REGION>
```

</details>

> **Security note:** After uploading, delete the local key files (`rm private_key.pem public_key.pem`). The private key is sensitive: anyone with access to it can generate signed URLs that bypass CloudFront access controls.

#### Summary of Required Secrets and Parameters

| Name | Type | Key/Value | Used By |
|------|------|-----------|---------|
| `GENRXSecrets` | Secrets Manager | `{"DB_Username": "..."}` | Database stack (RDS admin credentials) |
| `github-personal-access-token` | Secrets Manager | `{"my-github-token": "..."}` | CI/CD stack, Amplify stack |
| `GenRx/CloudFrontSigningKey` | Secrets Manager | RSA private key (PEM) | Api stack (Lambda signed URL generation) |
| `genrx-owner-name` | SSM Parameter (String) | GitHub username | CI/CD stack, Amplify stack |
| `/GenRx/AllowedEmailDomains` | SSM Parameter (SecureString) | Comma-separated email domains | Cognito pre-signup Lambda |
| `/GenRx/CloudFrontPublicKey` | SSM Parameter (String) | RSA public key (PEM) | Api stack (CloudFront PublicKey resource) |
| `/{StackPrefix}/voiceAgentArn` | SSM Parameter (String) | `placeholder` (updated post-deployment) | EcsSocket stack |

### Step 5: Bootstrap CDK

CDK must be bootstrapped in **two regions**: your deployment region and `us-east-1`.

**Why both regions?** The `CloudFrontWafStack` is deployed to `us-east-1` because AWS requires CloudFront-scoped WAF Web ACLs to reside in `us-east-1` regardless of where your application runs. The CDK app uses `crossRegionReferences: true` to pass the WAF ARN from the `us-east-1` stack to the Api and EcsSocket stacks in your deployment region. This cross-region reference mechanism relies on CDK's bootstrap resources (S3 bucket, SSM parameters, IAM roles) existing in both regions. If `us-east-1` is not bootstrapped, the `{StackPrefix}-CloudFrontWaf` stack deployment will fail with a "bootstrap stack not found" error.

```bash
# Bootstrap your primary deployment region
cdk bootstrap aws://<YOUR-ACCOUNT-ID>/<YOUR-REGION> \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>

# Bootstrap us-east-1 (required for the CloudFront WAF stack)
cdk bootstrap aws://<YOUR-ACCOUNT-ID>/us-east-1 \
  -c StackPrefix=GenRx \
  -c githubRepo=GenRx \
  -c githubBranch=main \
  --profile <YOUR-AWS-PROFILE>
```

> **Note:** If your deployment region IS `us-east-1`, you only need to run the command once. The second bootstrap is only needed when deploying to a different region (e.g., `ca-central-1`).

> **If bootstrapping fails**, ensure you are also passing the CDK context flags (`-c StackPrefix`, `-c githubRepo`, `-c githubBranch`) just like the deploy command. Without these, CDK may fail to synthesize the app before bootstrapping.

### Step 6: Deploy Stacks

> **Optional — Rename the DynamoDB conversation table:** The default table name is `DynamoDB-Conversation-Table` (a legacy name from the forked codebase). If you're deploying fresh and want something more specific, change this one line in `cdk/lib/api-service-stack.ts` **before** deploying:
>
> ```typescript
> this.dynamoTableName = "GenRx-Conversation-Table"; // or whatever you prefer
> ```
>
> Everything else is parameterized from there — the custom resource creates whatever name you set, it gets written to the SSM parameter `/{id}/GenRx/TableName`, and the Python Lambdas read it from SSM at runtime. No other code changes needed.

The CDK app requires two context variables at deploy time:

| Context Variable | Description | Required |
|-----------------|-------------|----------|
| `StackPrefix` | Prefix for all stack and resource names (e.g., `GenRx`) | Yes |
| `githubRepo` | Name of your GitHub repository (not the full URL) | Yes |
| `githubBranch` | Branch to track for CI/CD (default: `main`) | No |
| `voiceAgentArn` | ARN of a deployed Bedrock AgentCore voice agent (not needed for first deploy) | No |
| `SesVerifiedDomain` | Domain with a Route 53 hosted zone for SES email + Amplify custom domain | No |
| `SesIdentityVerified` | Set to `"true"` after SES domain is verified (see [Custom Domain & SES](./CUSTOM_DOMAIN_AND_SES.md)) | No |
| `SesSkipIdentityCreation` | Set to `"true"` to skip SES identity creation (when it already exists) | No |

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

1. **`{StackPrefix}-CICD`** : ECR repositories, CodeBuild projects, CodePipeline
2. **`{StackPrefix}-VpcStack`** : VPC, subnets, NAT gateway, VPC endpoints
3. **`{StackPrefix}-Database`** : RDS PostgreSQL instance, RDS Proxy, secrets
4. **`{StackPrefix}-CloudFrontWaf`** : WAF Web ACL for CloudFront (deployed to `us-east-1`)
5. **`{StackPrefix}-Api`** : API Gateway, Lambda functions, Cognito, AppSync, S3, CloudFront
6. **`{StackPrefix}-TurnServer`** : TURN server for WebRTC
7. **`{StackPrefix}-EcsSocket`** : ECS Fargate service for Socket.IO
8. **`{StackPrefix}-DBFlow`** : Database migration runner (triggers on deploy)
9. **`{StackPrefix}-Amplify`** : Amplify hosting for the React frontend

> **Note:** `--all` handles the dependency order automatically. Deployment takes approximately 30–45 minutes on first run.

### Monitoring the Deployment

While the stacks deploy, you can monitor progress in real time through the AWS Console:

1. Open the [CloudFormation console](https://console.aws.amazon.com/cloudformation/) in your deployment region.
2. You will see each stack appear as it begins creating (e.g., `GenRx-VpcStack`, `GenRx-Database`, etc.).
3. Click into any stack and go to the **Events** tab to see individual resource creation progress.
4. A stack showing `CREATE_IN_PROGRESS` is still deploying. Wait for `CREATE_COMPLETE`.
5. If a stack shows `ROLLBACK_IN_PROGRESS` or `CREATE_FAILED`, check the Events tab for the specific resource and error message that caused the failure. Do not attempt to delete or redeploy the stack until it reaches `ROLLBACK_COMPLETE`. CloudFormation must finish rolling back all provisioned resources before it can accept new operations on that stack.

> **Tip:** Also check the [CloudFormation console in us-east-1](https://us-east-1.console.aws.amazon.com/cloudformation/) for the `{StackPrefix}-CloudFrontWaf` stack, since it deploys to that region separately.

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

> **Expected behavior:** Until the pipeline finishes pushing the `socketServer` image, the ECS socket service will show `STOPPED` tasks with `CannotPullContainerError`. This is normal on first deployment. The service retries automatically and will stabilize once the image is available in ECR (typically 10–15 minutes after the pipeline starts). Do not manually intervene or delete the service.

### DynamoDB Conversation Table & TTL

#### First-time deploy — no manual steps required

On a fresh deploy in a new account/region, everything is handled automatically:

- A custom resource (`EnsureConversationTable`) creates the table during CloudFormation deployment.
- TTL is enabled on the `expireAt` attribute as part of the same operation.
- All downstream Lambdas have the table ready before they ever run.
- Other DynamoDB tables in the account are **completely unaffected** — both the table creation and TTL enablement target this single table by name. The custom resource's IAM policy is scoped to `arn:aws:dynamodb:<region>:<account>:table/DynamoDB-Conversation-Table` only. TTL is a per-table setting in DynamoDB, not an account-wide setting — enabling it here does not touch any other table in your account.

#### How it works

The `DynamoDB-Conversation-Table` is **not owned by CDK**. This project was forked from an earlier codebase where the table was created manually in the AWS console and never linked to CloudFormation. Importing it into CDK (`cdk import`) was attempted but failed repeatedly, so CDK only **references** the table (via `Table.fromTableName(...)`) for IAM policies, Lambda environment variables, and CloudWatch alarms — it does not manage its lifecycle.

To handle the case where the table doesn't exist yet (fresh deploy), the stack includes a custom resource that runs on every deploy:

1. Calls `CreateTable` for the configured table name (passed via environment variable, not hardcoded) with PAY_PER_REQUEST billing and key = `SessionId`.
2. If the table **already exists**, catches `ResourceInUseException` and does nothing — completely idempotent.
3. If the table **does not exist**, creates it, waits for `ACTIVE` status, then enables TTL on `expireAt`.

Because CDK doesn't own the table, `cdk destroy` will **not** delete it or its data.

#### Legacy environments — manually enabling TTL

This only applies if the table was created **before** the custom resource existed (i.e., it was manually created in the console without TTL). In that scenario the custom resource sees the table already exists, catches the exception, and skips everything — including TTL setup.

**Check if TTL is already enabled:** DynamoDB console → select `DynamoDB-Conversation-Table` > **Additional settings** tab > look for "Time to live attribute: `expireAt` (Enabled)". If it shows enabled, you're done.

If TTL is **not** enabled on a pre-existing table, run the following **once**:

<details>
<summary>macOS / Linux</summary>

```bash
aws dynamodb update-time-to-live \
  --table-name DynamoDB-Conversation-Table \
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" \
  --region <YOUR-REGION> \
  --profile <YOUR-AWS-PROFILE>
```

</details>

<details>
<summary>Windows (PowerShell)</summary>

```powershell
aws dynamodb update-time-to-live `
  --table-name DynamoDB-Conversation-Table `
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" `
  --region <YOUR-REGION> `
  --profile <YOUR-AWS-PROFILE>
```

</details>

<details>
<summary>Windows (CMD)</summary>

```cmd
aws dynamodb update-time-to-live ^
  --table-name DynamoDB-Conversation-Table ^
  --time-to-live-specification "Enabled=true, AttributeName=expireAt" ^
  --region <YOUR-REGION> ^
  --profile <YOUR-AWS-PROFILE>
```

</details>

#### What TTL does once enabled

DynamoDB automatically deletes expired items in the background:
- Question, DTP, and recommendation cache items after **7 days**
- Chat history items after **90 days**

#### Safety notes

| Concern | Answer |
|---------|--------|
| Will this affect other DynamoDB tables in my account? | **No.** The Lambda's IAM policy only grants access to the configured table (default: `DynamoDB-Conversation-Table`). The table name is parameterized via an environment variable, not hardcoded. Every API call targets that single table by name. Other tables are untouched. |
| Will `cdk destroy` delete the table? | **No.** CDK references it via `fromTableName`, it doesn't own the resource. The table and all its data survive stack deletion. |

### Request SES Production Access (Optional)

If you need to send more than 50 verification emails per day, SES is configured via CDK context variables. See [Custom Domain & SES](./CUSTOM_DOMAIN_AND_SES.md) for the full two-step deployment process, custom domain setup, and troubleshooting.

### Build the Amplify App

After the first deployment, Amplify needs to run its initial build:

1. Open the [Amplify console](https://console.aws.amazon.com/amplify/).
2. Find your app (named `{StackPrefix}-Amplify-amplify`).
3. If the build has not triggered automatically, click **Run build** on the `main` branch.
4. Wait for the build to complete (typically 3–5 minutes).

### Deploy the Voice Agent

The voice agent runs on **Amazon Bedrock AgentCore** and is required for the voice mode functionality. It requires the CDK stacks to be deployed first (since the CI/CD pipeline builds and pushes the voice-agent Docker image to ECR). Follow this order of operations:

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

Store the ARN in SSM so the EcsSocket stack can connect to it (this overwrites the placeholder created in Step 4):

<details>
<summary>macOS / Linux</summary>

```bash
aws ssm put-parameter \
  --name "/<YOUR-STACK-PREFIX>/voiceAgentArn" \
  --value "<YOUR-VOICE-AGENT-ARN>" \
  --type String \
  --overwrite \
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
  --overwrite `
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
  --overwrite ^
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

> **Warning:** The RDS instance has `deletionProtection: true`. You must disable deletion protection in the RDS console before the database stack can be deleted. The S3 bucket also has `removalPolicy: RETAIN`, so you need to empty and delete it manually after stack deletion.

To delete individual stacks, destroy them in reverse dependency order:

```bash
cdk destroy GenRx-Amplify -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-EcsSocket -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-TurnServer -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-Api -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
cdk destroy GenRx-CloudFrontWaf -c StackPrefix=GenRx -c githubRepo=GenRx -c githubBranch=main --profile <YOUR-AWS-PROFILE>
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

### GitHub token secret not stored as valid JSON

**Cause:** On some systems (particularly Windows), escape characters can cause the secret value to be stored as malformed JSON rather than a proper `{"my-github-token": "..."}` object. This happens due to differences in how shells handle quotes and escape characters across Windows CMD, PowerShell, macOS, and Linux.

**Symptoms:** CodePipeline or Amplify fails with authentication errors even though the token is correct. Retrieving the secret value shows it is not valid JSON (e.g., extra backslashes, missing quotes, or the string stored as plain text instead of a JSON object).

**Fix:** Delete the secret and recreate it:

```bash
# Delete the malformed secret (force immediate deletion)
aws secretsmanager delete-secret \
  --secret-id github-personal-access-token \
  --force-delete-without-recovery \
  --region <YOUR-REGION> \
  --profile <YOUR-AWS-PROFILE>

# Wait a few seconds, then recreate it
aws secretsmanager create-secret \
  --name github-personal-access-token \
  --secret-string '{"my-github-token": "<YOUR-GITHUB-PAT>"}' \
  --region <YOUR-REGION> \
  --profile <YOUR-AWS-PROFILE>
```

> **Tip:** After creating the secret, verify the stored value is valid JSON by retrieving it:
>
> ```bash
> aws secretsmanager get-secret-value --secret-id github-personal-access-token --region <YOUR-REGION> --profile <YOUR-AWS-PROFILE> --query SecretString --output text
> ```
>
> The output should be exactly: `{"my-github-token": "ghp_xxxxx..."}`

### Lambda functions return errors after first deploy

**Cause:** ECR repositories are empty. The Docker Lambda functions have no image to run.

**Fix:** Push initial images by triggering the CI/CD pipeline (see [Push Initial Docker Images](#push-initial-docker-images)) or push a commit to the tracked branch.

### ECS socket service shows STOPPED tasks after first deploy

**Cause:** The ECS service starts immediately after the stack deploys, but the ECR repository for `socketServer` is empty until the CI/CD pipeline finishes building and pushing the image. The service cannot pull a container image that doesn't exist yet, so tasks fail with `CannotPullContainerError` and restart repeatedly.

**Fix:** This resolves itself. Once the CI/CD pipeline pushes the `socketServer` image to ECR, the ECS service will pull it on the next retry and stabilize. No manual action is needed. If tasks are still failing 20+ minutes after the pipeline completes successfully, check that the image tag in ECR matches what the task definition expects (`latest`).

### Voice features not working

**Cause:** Nova Sonic models are only available in `us-east-1`. If your deployment region is different, the voice service makes cross-region calls. The voice agent must also be deployed to Bedrock AgentCore and its ARN configured.

**Fix:**

1. Ensure Bedrock model access is enabled in `us-east-1` for Nova Sonic models.
2. Verify the ECS task role has `bedrock:InvokeModelWithBidirectionalStream` permission in `us-east-1`.
3. Confirm the voice agent is deployed to Bedrock AgentCore (see [Deploy the Voice Agent](#deploy-the-voice-agent-optional)).
4. Verify the `voiceAgentArn` is set, either via the `-c` context flag or the `/{StackPrefix}/voiceAgentArn` SSM parameter.

### Text generation or embeddings not working

**Cause:** Claude Sonnet 4.6 and Cohere Embed v4 are called in `us-east-1` via cross-region inference, but the models may not be accessible there.

**Fix:**

1. Open the [Bedrock console in us-east-1](https://us-east-1.console.aws.amazon.com/bedrock/).
2. Navigate to **Model access** and verify the models are available.
3. Check CloudWatch Logs for the `TextGenLambdaDockerFunction` for specific error messages.
4. Ensure the Lambda execution role has `bedrock:InvokeModel` permissions for the model ARNs in `us-east-1`.

---

## Cross-References

- [AgentCore Voice Agent Setup](./AGENTCORE_VOICE_AGENT_SETUP.md) : Console-side voice agent configuration
- [Database Migrations](./DATABASE_MIGRATIONS.md) : Creating and running schema changes
- [Modification Guide](./MODIFICATION_GUIDE.md) : Customizing colors, API, LLM, and frontend

### Optional Setup

- [Custom Domain & SES](./CUSTOM_DOMAIN_AND_SES.md) : SES email delivery, custom domain, and Amplify custom domain
