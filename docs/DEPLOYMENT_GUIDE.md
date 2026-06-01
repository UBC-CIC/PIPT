# Deployment Guide

This guide walks you through deploying GenRx from scratch, including prerequisites, secrets setup, CDK deployment, and post-deployment verification.

---

## 1. Requirements

### Base Requirements

- **AWS Account** with administrative access
- **AWS CLI v2** installed and configured (`aws configure`)
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

## 2. Pre-Deployment

### 2.1 Create a GitHub Personal Access Token (PAT)

The CI/CD pipeline and Amplify app use a GitHub PAT to pull source code.

1. Go to [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes: `repo` (full control of private repositories) and `admin:repo_hook` (for webhooks)
4. Copy the generated token — you will need it in the next section

### 2.2 Enable Bedrock Models

GenRx uses several Amazon Bedrock models. You must request access before deployment.

1. Open the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/)
2. Navigate to **Model access** in the left sidebar
3. Request access to the following models **in `us-east-1`**:
   - **Anthropic Claude Sonnet 4.6** (`us.anthropic.claude-sonnet-4-6`) — primary LLM for text generation (cross-region inference profile)
   - **Cohere Embed v4** (`cohere.embed-v4:0`) — document and query embeddings
   - **Amazon Nova Sonic 2.0** (`amazon.nova-2-sonic-v1:0`) — voice interactions
   - **Amazon Nova Lite** (`amazon.nova-lite-v1:0`) — lightweight inference tasks (diagnosis evaluation)

> **Important:** All models above are called in `us-east-1` regardless of your deployment region. The application hardcodes `us-east-1` for LLM calls (Claude Sonnet 4.6), embedding calls (Cohere Embed v4), and voice calls (Nova Sonic). You must enable model access in `us-east-1` even if you deploy the CDK stacks to a different region.

---

## 3. Deployment

### 3.1 Fork and Clone

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/genrx.git
cd genrx/cdk
npm install
```

### 3.2 Upload Secrets and Parameters

Before deploying, you must create the following secrets and parameters in AWS. These are referenced by the CDK stacks at synthesis time.

#### Secret 1: GENRXSecrets

Contains the admin username for the RDS PostgreSQL instance. You choose this value — it will be the master username for your database. The database stack reads `DB_Username` from this secret at deploy time.

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

Used by the CI/CD pipeline and Amplify to access your GitHub repository.

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

An SSM parameter containing your GitHub username (the owner of the forked repository).

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

A comma-separated list of email domains allowed to sign up (e.g., `gmail.com,ubc.ca`). The Cognito pre-signup Lambda reads this parameter to block registrations from unauthorized domains. Stored as a `SecureString` since it controls access.

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

> **Skip this for now.** This parameter is created after the initial deployment as part of the voice agent setup (section 4.5). It's listed here for reference only.

The EcsSocket stack reads this parameter to connect to the Bedrock AgentCore voice agent. You'll create it in section 4.5 after deploying the voice agent.

#### Summary of Required Secrets/Parameters

| Name | Type | Key/Value | Used By |
|------|------|-----------|---------|
| `GENRXSecrets` | Secrets Manager | `{"DB_Username": "..."}` | Database stack (RDS admin credentials) |
| `github-personal-access-token` | Secrets Manager | `{"my-github-token": "..."}` | CI/CD stack, Amplify stack |
| `genrx-owner-name` | SSM Parameter (String) | GitHub username | CI/CD stack, Amplify stack |
| `/GenRx/AllowedEmailDomains` | SSM Parameter (SecureString) | Comma-separated email domains | Cognito pre-signup Lambda |
| `/{StackPrefix}/voiceAgentArn` | SSM Parameter (String) | Voice agent ARN (created in section 4.5) | EcsSocket stack |

### 3.3 Bootstrap CDK

If this is your first CDK deployment in the target account/region, bootstrap the environment:

```bash
npx cdk bootstrap aws://<YOUR-ACCOUNT-ID>/<YOUR-REGION>
```

### 3.4 Deploy Stacks

The CDK app requires two context variables at deploy time:

| Context Variable | Description | Required |
|-----------------|-------------|----------|
| `StackPrefix` | Prefix for all stack and resource names (e.g., `GenRx`) | Yes |
| `githubRepo` | Name of your GitHub repository (not the full URL) | Yes |
| `githubBranch` | Branch to track for CI/CD (default: `main`) | No |
| `voiceAgentArn` | ARN of a deployed Bedrock AgentCore voice agent (not needed for first deploy — see section 4.5) | No |

Choose one of the following deployment options:

#### Option A: Deploy All Stacks (Recommended for First Deployment)

```bash
npx cdk deploy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx
```

#### Option B: Deploy All Stacks with a Custom Branch

```bash
npx cdk deploy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx \
  -c githubBranch=develop
```

#### Option C: Deploy Individual Stacks (Incremental Updates)

Stacks are deployed in dependency order. If you only need to update a specific stack:

```bash
npx cdk deploy GenRx-Api \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx
```

#### Option D: Redeploy with Voice Agent

After completing the voice agent setup (section 4.5), you can pass the ARN explicitly on subsequent deploys. However, the recommended approach is to store it in SSM (done in section 4.5) so you don't need this flag.

```bash
npx cdk deploy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx \
  -c voiceAgentArn="arn:aws:bedrock:us-east-1:123456789012:agent-runtime/XXXXXXXXXX"
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

## 4. Post-Deployment

### 4.1 Verify Bedrock Access

After deployment, confirm that the text generation Lambda can reach Bedrock:

1. Open the [Lambda console](https://console.aws.amazon.com/lambda/)
2. Find the function named `{StackPrefix}-Api-TextGenLambdaDockerFunction`
3. Create a test event and invoke it, or check CloudWatch Logs for successful initialization

### 4.2 Push Initial Docker Images

The CI/CD pipeline builds and pushes all Docker images (text generation, data ingestion, socket server, voice agent). For the first deployment, the ECR repositories are empty. Trigger the pipeline by either:

- **Pushing a commit** to your tracked branch, or
- **Clicking "Release change"** in the [CodePipeline console](https://console.aws.amazon.com/codepipeline/) for the `{StackPrefix}-CICD-DockerImagePipeline` pipeline

Wait for the pipeline to complete successfully. Once done, the Lambda functions and ECS services will have images to run.

### 4.3 Enable DynamoDB TTL

The `DynamoDB-Conversation-Table` is created automatically on the first Lambda invocation (triggered by the pipeline completing above). TTL must be enabled once per AWS account before users start using the app, otherwise early items will accumulate indefinitely.

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

Once enabled, DynamoDB will automatically delete:
- Question, DTP, and recommendation cache items after **7 days**
- Chat history items after **90 days**

### 4.4 Request SES Production Access (Optional)

If you need to send more than 50 verification emails per day:

1. Open the [SES console](https://console.aws.amazon.com/ses/)
2. Navigate to **Account dashboard**
3. Click **Request production access**
4. Fill out the form describing your use case

### 4.5 Build the Amplify App

After the first deployment, Amplify needs to run its initial build:

1. Open the [Amplify console](https://console.aws.amazon.com/amplify/)
2. Find your app (named `{StackPrefix}-Amplify-amplify`)
3. If the build hasn't triggered automatically, click **Run build** on the `main` branch
4. Wait for the build to complete (typically 3–5 minutes)

### 4.6 Deploy the Voice Agent (Optional)

The voice agent runs on **Amazon Bedrock AgentCore** and requires the CDK stacks to be deployed first (since the CI/CD pipeline builds and pushes the voice-agent Docker image to ECR). Follow this order of operations:

#### Step 1: Complete the Initial CDK Deployment

Deploy all stacks without a voice agent ARN (sections 3.3–3.4). This creates the ECR repository for the voice agent image. This creates the ECR repository for the voice agent image.

#### Step 2: Push the Voice Agent Image

The CI/CD pipeline (CodePipeline) builds and pushes all Docker images, including the voice agent. Trigger it by either:

- **Pushing a commit** to your tracked branch, or
- **Clicking "Release change"** in the [CodePipeline console](https://console.aws.amazon.com/codepipeline/) for the `{StackPrefix}-CICD-DockerImagePipeline` pipeline

Wait for the pipeline to complete successfully before proceeding.

#### Step 3: Set Up AgentCore and Deploy the Voice Agent

Follow the detailed instructions in [AGENTCORE_VOICE_AGENT_SETUP.md](./AGENTCORE_VOICE_AGENT_SETUP.md) to configure Bedrock AgentCore and deploy the voice agent through the AWS console.

Once complete, you will have a voice agent runtime ARN.

#### Step 4: Store the ARN and Redeploy

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
npx cdk deploy GenRx-EcsSocket \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx
```

> **Note:** Voice features will not work until all four steps are complete. The ECS socket server uses the stored ARN to establish a SigV4-signed WebSocket connection to the AgentCore runtime.

### 4.7 Visit the Web App

Once the Amplify build completes, your app is live at the default Amplify domain:

```
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

## 5. Cleanup

To tear down all deployed resources:

```bash
npx cdk destroy --all \
  -c StackPrefix=GenRx \
  -c githubRepo=genrx
```

> **Warning:** The RDS instance has `deletionProtection: true`. You must disable deletion protection in the RDS console before the database stack can be deleted. The S3 bucket also has `removalPolicy: RETAIN` — empty and delete it manually after stack deletion.

To delete individual stacks, destroy them in reverse dependency order:

```bash
npx cdk destroy GenRx-Amplify -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-DBFlow -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-EcsSocket -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-TurnServer -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-Api -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-Database -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-VpcStack -c StackPrefix=GenRx -c githubRepo=genrx
npx cdk destroy GenRx-CICD -c StackPrefix=GenRx -c githubRepo=genrx
```

---

## 6. Troubleshooting

### Stack deletion fails for Database stack

**Cause:** Deletion protection is enabled on the RDS instance.

**Fix:**
1. Open the [RDS console](https://console.aws.amazon.com/rds/)
2. Select the database instance
3. Click **Modify**
4. Uncheck **Enable deletion protection**
5. Apply immediately
6. Retry `cdk destroy`

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
1. Verify the `github-personal-access-token` secret exists and contains a valid token
2. Check that the token has `repo` scope
3. Verify the repository name matches the `githubRepo` context variable

### CodePipeline source action fails

**Cause:** The GitHub PAT has expired or lacks required permissions.

**Fix:**
1. Generate a new GitHub PAT with `repo` and `admin:repo_hook` scopes
2. Update the secret:

```bash
aws secretsmanager update-secret \
  --secret-id github-personal-access-token \
  --secret-string '{"my-github-token": "<NEW-TOKEN>"}' \
  --region <YOUR-REGION>
```

### Lambda functions return errors after first deploy

**Cause:** ECR repositories are empty — the Docker Lambda functions have no image to run.

**Fix:** Push initial images manually (see section 4.2) or trigger the CI/CD pipeline by pushing a commit to the tracked branch.

### Voice features not working

**Cause:** Nova Sonic models are only available in `us-east-1`. If your deployment region is different, the voice service makes cross-region calls. Additionally, the voice agent must be deployed to Bedrock AgentCore and its ARN configured.

**Fix:**
1. Ensure Bedrock model access is enabled in `us-east-1` for Nova Sonic models
2. Verify the ECS task role has `bedrock:InvokeModelWithBidirectionalStream` permission in `us-east-1`
3. Confirm the voice agent is deployed to Bedrock AgentCore (see section 4.5)
4. Verify the `voiceAgentArn` is set — either via the `-c` context flag or the `/{StackPrefix}/voiceAgentArn` SSM parameter

### Text generation or embeddings not working

**Cause:** Claude Sonnet 4.6 and Cohere Embed v4 are called in `us-east-1` via cross-region inference, but model access was not enabled there.

**Fix:**
1. Open the [Bedrock console in us-east-1](https://us-east-1.console.aws.amazon.com/bedrock/)
2. Navigate to **Model access**
3. Ensure access is granted for `anthropic.claude-sonnet-4-6` and `cohere.embed-v4:0`
4. Check CloudWatch Logs for the `TextGenLambdaDockerFunction` for specific error messages
