# GenRx — Application Security Overview

> **Document Type:** Supplementary Technical Reference
> **Relationship:** This document supplements the core documentation set. See [Documentation Index](./README.md) for the full document listing.
> **Last updated:** 2026-05-30

**Date:** April 26, 2026
**Classification:** Internal — Confidential
**Prepared by:** Security Analysis Team
**Methodology:** OWASP Top 10 (2021), OWASP Application Security Verification Standard (ASVS)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Application Architecture](#2-application-architecture)
3. [OWASP Top 10 Assessment](#3-owasp-top-10-assessment)
4. [Detailed Findings](#4-detailed-findings)
5. [Risk Register](#5-risk-register)
6. [Remediation Roadmap](#6-remediation-roadmap)
7. [Compliance Considerations](#7-compliance-considerations)

---

## 1. Executive Summary

GenRx is a pharmacy education simulation platform that allows students to practice patient interactions through AI-powered conversations. The application is built on AWS serverless infrastructure (Lambda, API Gateway, RDS, S3, Cognito, Bedrock) with a React frontend deployed via Amplify.

This review identified **20 findings** across the OWASP Top 10 categories:

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 6     |
| Medium   | 7     |
| Low      | 4     |

The most urgent issues are **disabled TLS enforcement on the database layer**, **wildcard CORS across all API endpoints**, and **LLM prompt injection exposure**. The application demonstrates solid foundational security in several areas — parameterized SQL queries, VPC isolation, WAF protection, and encryption at rest — but has gaps in transport security, access control granularity, and input validation that require prompt attention.

---

## 2. Application Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  React SPA  │────▶│ API Gateway  │────▶│  Lambda (Node/   │
│  (Amplify)  │     │  + WAF       │     │  Python)         │
└─────────────┘     │  + JWT Auth  │     └────────┬─────────┘
                    └──────────────┘              │
                           │                      ▼
                    ┌──────────────┐     ┌──────────────────┐
                    │  AppSync     │     │  RDS Postgres    │
                    │  (Streaming) │     │  (via RDS Proxy) │
                    └──────────────┘     └──────────────────┘
                           │                      │
                    ┌──────────────┐     ┌──────────────────┐
                    │  Bedrock LLM │     │  S3 (Documents,  │
                    │  (Claude/    │     │  Embeddings,     │
                    │   Nova/Llama)│     │  Profile Pics)   │
                    └──────────────┘     └──────────────────┘
```

**Key components:**
- **Frontend:** React + Vite, deployed via AWS Amplify from GitHub
- **Auth:** Cognito User Pool with JWT Lambda authorizers (jose library), role-based access (student/instructor/admin)
- **API:** API Gateway (REST, OpenAPI-defined) with WAF v2
- **Compute:** Lambda functions (Node.js 22, Python 3.12) in VPC
- **Database:** PostgreSQL 16.10 on RDS (Multi-AZ), accessed via RDS Proxy
- **AI/LLM:** AWS Bedrock (Llama 3, Titan Embeddings, Nova Pro) with RAG pipeline
- **Real-time:** AppSync GraphQL for streaming, ECS-based Socket.io
- **Storage:** S3 with pre-signed URLs for document upload/download

---

## 3. OWASP Top 10 Assessment

### A01:2021 — Broken Access Control 🔴 HIGH

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A01-1 | JWT authorizer allows requests through when the roles claim is absent from the token | High | `cdk/lambda/jwtAuthorizer/jwtAuthorizer.js:80-86` |
| A01-2 | Cognito Identity Pool allows unauthenticated identities | Medium | `cdk/lib/api-service-stack.ts` — `allowUnauthenticatedIdentities: true` |
| A01-3 | No object-level authorization on file operations — any authenticated instructor can delete any simulation group's files | Medium | `cdk/lambda/deleteFile/deleteFile.py` |
| A01-4 | Shared Lambda execution role across all functions (student, instructor, admin) | Medium | `cdk/lib/api-service-stack.ts` — single `lambdaRole` |

**A01-1 Detail:** The JWT authorizer explicitly allows requests when the `cognito:groups` claim is missing from the token. The code comment states this supports a "transition period," but it means any valid JWT without group claims bypasses role checks entirely. Downstream Lambda functions are expected to check roles from the database, but this is not consistently enforced.

```javascript
// jwtAuthorizer.js lines 80-86
const hasRolesClaim = payload[process.env.AUTH_ROLES_CLAIM || "cognito:groups"] !== undefined;
if (hasRolesClaim && !allowed) {
  throw new Error("Unauthorized");
}
// If hasRolesClaim is false → request is ALLOWED regardless of role
```

**A01-2 Detail:** The Identity Pool is configured with `allowUnauthenticatedIdentities: true`. While the unauthenticated role has no attached policies, this still creates an attack surface where unauthenticated users can obtain temporary AWS credentials. If any policy is accidentally attached to this role in the future, it becomes exploitable immediately.

---

### A02:2021 — Cryptographic Failures 🔴 CRITICAL

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A02-1 | SSL/TLS disabled on RDS PostgreSQL (`rds.force_ssl: '0'`) | Critical | `cdk/lib/database-stack.ts:73` |
| A02-2 | TLS not required on any of the three RDS Proxy instances | Critical | `cdk/lib/database-stack.ts:155,161,169` |
| A02-3 | Database connection strings built via string concatenation (not using keyword arguments) | Low | `cdk/lambda/deleteFile/deleteFile.py:37-39` |

**A02-1 / A02-2 Detail:** This is the most critical finding. The RDS parameter group explicitly disables SSL enforcement:

```typescript
// database-stack.ts line 73
parameters: {
    'rds.force_ssl': '0'   // ← SSL DISABLED
}
```

All three RDS Proxy instances are configured with `requireTLS: false`. This means all database traffic — including credentials, patient simulation data, student records, and system prompts — travels in plaintext between Lambda functions and the database. While the traffic stays within the VPC, any network-level compromise (misconfigured security group, compromised Lambda, VPC flow log exposure) would reveal all data in transit.

**A02-3 Detail:** The `deleteFile.py` Lambda constructs the psycopg2 connection string via string concatenation rather than keyword arguments. If a secret value contained a space or special character, it could corrupt the connection string or cause unexpected behavior:

```python
connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
connection = psycopg2.connect(connection_string)
```

The safer pattern is `psycopg2.connect(**connection_params)`.

---

### A03:2021 — Injection 🟠 HIGH

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A03-1 | LLM prompt injection via user-controlled system prompts and patient prompts | High | `cdk/text_generation/src/helpers/chat.py:260-295` |
| A03-2 | File name parameters not validated for path traversal characters | Medium | `cdk/lambda/generatePreSignedURL/generatePreSignedURL.py`, `cdk/lambda/deleteFile/deleteFile.py` |

**A03-1 Detail:** The `get_response()` function interpolates `system_prompt` and `patient_prompt` (which are instructor-configurable and stored in the database) directly into the LLM system prompt template. While role guardrails are appended, they are not structurally separated from user-controlled content:

```python
system_prompt = (
    f"""
    <|begin_of_text|>
    <|start_header_id|>patient<|end_header_id|>
    Please pay close attention to this: {system_prompt}
    Here are some additional details: {patient_prompt}
    ...
    """
)
```

A malicious instructor (or compromised instructor account) could craft a `patient_prompt` that overrides the role guardrails, instructs the LLM to ignore previous instructions, or exfiltrates the system prompt. Role guardrails are appended unconditionally in `get_response()` via a dedicated `<|start_header_id|>guardrails<|end_header_id|>` section.

Additionally, student messages flow through `get_student_query()` with zero sanitization before being passed to the LLM as the `{input}` variable.

**A03-2 Detail:** File names from query parameters are used directly in S3 key construction without validation for path traversal sequences (`../`, `..\\`), null bytes, or excessive length:

```python
# generatePreSignedURL.py
key = f"{simulation_group_id}/{persona_id}/documents/{file_name}.{file_type}"
```

While S3 treats `/` as a literal character in keys (not a directory separator), a crafted `file_name` like `../../other-group/other-persona/documents/secret` could create confusing key structures or overwrite unintended objects.

**Positive note:** SQL queries throughout the application use parameterized statements consistently. The Node.js functions use the `postgres` library's tagged template literals, and the Python functions use `psycopg2`'s `%s` placeholders. No SQL injection vectors were identified.

---

### A04:2021 — Insecure Design 🟡 MEDIUM

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A04-1 | No per-user rate limiting — WAF rate limit is 1000 req/5min per IP only | Medium | `cdk/lib/api-service-stack.ts:1830-1845` |
| A04-2 | Bedrock guardrails are optional and depend on an environment variable being set | Medium | `cdk/text_generation/src/helpers/chat.py` — `BEDROCK_GUARDRAIL_ID` defaults to empty |

**A04-1 Detail:** The WAF is configured with AWS Managed Rules (Common Rule Set) and an IP-based rate limit of 1000 requests per 5 minutes. However, there is no per-user or per-session rate limiting. A single authenticated user could make up to 1000 LLM requests per 5 minutes, which could result in significant Bedrock costs. API Gateway throttling is set to 100 req/s with 200 burst, but this is global, not per-user.

**A04-2 Detail:** The `BEDROCK_GUARDRAIL_ID` environment variable is set to an empty string by default. If not explicitly configured during deployment, no Bedrock guardrails are applied to LLM responses, leaving the application reliant solely on prompt-level guardrails.

---

### A05:2021 — Security Misconfiguration 🔴 CRITICAL

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A05-1 | Wildcard CORS (`Access-Control-Allow-Origin: *`) on all API endpoints and S3 buckets | Critical | `cdk/OpenAPI_Swagger_Definition.yaml`, all Lambda response headers, S3 bucket CORS |
| A05-2 | Overly broad IAM permissions — Secrets Manager access on `*` for all Lambda roles | High | `cdk/lib/api-service-stack.ts` — multiple `secretsmanager:GetSecretValue` on `*` |
| A05-3 | RDS Proxy IAM role has `rds-db:connect` on `*` (all resources) | High | `cdk/lib/database-stack.ts:143-148` |
| A05-4 | Database security group allows ingress from entire VPC CIDR | Medium | `cdk/lib/database-stack.ts:118-123` |

**A05-1 Detail:** Every API response — including error responses, CORS preflight responses, and the API Gateway `UNAUTHORIZED` gateway response — returns `Access-Control-Allow-Origin: *`. This is configured at three levels:

1. **OpenAPI definition** (gateway responses and OPTIONS handlers)
2. **Lambda function responses** (hardcoded in every handler)
3. **S3 bucket CORS** (both data ingestion and embedding storage buckets)

This allows any website on the internet to make authenticated cross-origin requests to the API if it can obtain a valid JWT. Combined with the Cognito self-signup flow, this significantly increases the attack surface for CSRF-style attacks.

**A05-2 Detail:** Both `lambdaRole` and `coglambdaRole` grant `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:${region}:${account}:secret:*`. This means every Lambda function can read every secret in the account, including the GitHub PAT, admin database credentials, and any other secrets. The principle of least privilege requires restricting each function to only the specific secret ARNs it needs.

**A05-3 Detail:** The RDS Proxy IAM role grants `rds-db:connect` on `*`:

```typescript
rdsProxyRole.addToPolicy(new iam.PolicyStatement({
    resources: ['*'],
    actions: ['rds-db:connect'],
}));
```

This should be scoped to the specific RDS instance and database user.

---

### A06:2021 — Vulnerable and Outdated Components 🟢 LOW

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A06-1 | Lambda Powertools layer pinned to a specific version (v78) rather than using latest | Low | `cdk/lib/api-service-stack.ts:133` |

The application uses current runtimes (Node.js 22, Python 3.12, PostgreSQL 16.10) and recent library versions. No known vulnerable components were identified in the reviewed code. However, a full dependency audit (npm audit, pip-audit) was not performed as part of this review and is recommended.

---

### A07:2021 — Identification and Authentication Failures 🟡 MEDIUM

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A07-1 | Password policy does not require symbols | Low | `cdk/lib/api-service-stack.ts` — `requireSymbols: false` |
| A07-2 | GitHub PAT exposed via `unsafeUnwrap()` in Amplify stack | High | `cdk/lib/amplify-stack.ts:56-57` |

**A07-1 Detail:** The Cognito password policy requires 8+ characters with uppercase, lowercase, and digits, but not symbols. While this meets minimum standards, NIST 800-63B recommends allowing (not requiring) symbols and focusing on minimum length of 8+ characters, which this configuration satisfies.

**A07-2 Detail:** The GitHub Personal Access Token is retrieved from Secrets Manager but then passed to the Amplify CDK construct via `unsafeUnwrap()`:

```typescript
const githubToken = cdk.SecretValue.secretsManager("github-personal-access-token", {
    jsonField: "my-github-token"
});
amplifyApp accessToken: githubToken.unsafeUnwrap(), // TEMPORARY
```

`unsafeUnwrap()` resolves the secret at synthesis time, meaning the PAT value appears in the CloudFormation template stored in S3. Anyone with access to the CloudFormation template or the CDK output can read the GitHub PAT. The code comments indicate this is temporary, but it has been deployed to production.

---

### A08:2021 — Software and Data Integrity Failures 🟡 MEDIUM

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A08-1 | Amplify auto-build enabled on multiple branches without branch protection verification | Medium | `cdk/lib/amplify-stack.ts:100-110` |

Amplify is configured with `enableAutoBuild: true` on both the `main` and `chat-playground` branches. Any push to these branches triggers an automatic build and deployment. If GitHub branch protection rules are not properly configured, a compromised contributor could push malicious code that deploys automatically.

---

### A09:2021 — Security Logging and Monitoring 🟢 POSITIVE

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A09-1 | Comprehensive logging infrastructure in place | Positive | Throughout |

**Strengths identified:**
- All Lambda functions have `logRetention: logs.RetentionDays.INFINITE`
- API Gateway has metrics enabled and ERROR-level logging
- VPC Flow Logs enabled
- CloudWatch alarms for Lambda timeouts
- Structured JSON logging in JWT authorizer and pre-signup functions
- AWS Lambda Powertools used for structured logging in Python functions

**Gap:** No centralized alerting on authentication failures or suspicious access patterns was identified. Consider adding CloudWatch alarms for repeated 401/403 responses.

---

### A10:2021 — Server-Side Request Forgery (SSRF) 🟢 LOW

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| A10-1 | No user-controlled URLs are fetched server-side | Low | N/A |

The application does not appear to fetch user-supplied URLs on the server side. The LLM integration uses AWS Bedrock (SDK-based, not URL-based), and file operations use pre-signed S3 URLs generated server-side. SSRF risk is minimal.

---

## 4. Detailed Findings

### 4.1 Frontend Security

**Committed `.env` file:** The `frontend/.env` file contains production API endpoints, Cognito User Pool IDs, and Identity Pool IDs. While these values are inherently public (they're embedded in the built JavaScript), committing them to the repository makes environment management harder and increases the risk of accidentally committing actual secrets in the same file. The Amplify stack already passes these values as environment variables during build — the `.env` file should be in `.gitignore`.

**Token handling:** Authentication is managed by the Cognito SDK, which handles token storage, refresh, and transmission. No custom token storage or handling was identified in the frontend code.

### 4.2 Database Connection Security

Multiple Python Lambda functions construct psycopg2 connection strings via string concatenation instead of keyword arguments:

```python
# Vulnerable pattern (deleteFile.py, others)
connection_string = " ".join([f"{key}={value}" for key, value in connection_params.items()])
connection = psycopg2.connect(connection_string)

# Recommended pattern
connection = psycopg2.connect(
    dbname=secret["dbname"],
    user=secret["username"],
    password=secret["password"],
    host=RDS_PROXY_ENDPOINT,
    port=secret["port"]
)
```

### 4.3 Cognito Pre-Signup Validation

The pre-signup Lambda validates email domains against an SSM Parameter Store value. The validation is case-sensitive (`includes()` on the domain string), meaning `@University.edu` would not match `university.edu` in the allowed list. The domain should be lowercased before comparison.

### 4.4 Identity Pool Configuration

The Cognito Identity Pool is configured with `allowUnauthenticatedIdentities: true`. The unauthenticated role has no policies attached, but the authenticated role carries broad permissions including:
- DynamoDB read/write on the conversation table
- Bedrock `InvokeModel` and `InvokeModelWithBidirectionalStream` on `*` (all models)
- Secrets Manager `GetSecretValue` on the database user secret

The Bedrock permission on `*` is particularly concerning — any authenticated user with Identity Pool credentials could invoke any Bedrock model in the account, not just the ones used by the application.

---

## 5. Risk Register

| ID | OWASP | Finding | Severity | Likelihood | Impact | Risk |
|----|-------|---------|----------|------------|--------|------|
| A02-1 | A02 | SSL disabled on RDS | Critical | High | High | **Critical** |
| A02-2 | A02 | TLS not required on RDS Proxy | Critical | High | High | **Critical** |
| A05-1 | A05 | Wildcard CORS on all endpoints | Critical | High | High | **Critical** |
| A03-1 | A03 | LLM prompt injection | High | Medium | High | **High** |
| A05-2 | A05 | Secrets Manager `*` permissions | High | Medium | High | **High** |
| A05-3 | A05 | RDS Proxy IAM `*` permissions | High | Medium | High | **High** |
| A07-2 | A07 | GitHub PAT via `unsafeUnwrap()` | High | Medium | High | **High** |
| A01-1 | A01 | JWT role bypass when claim absent | High | Medium | Medium | **High** |
| A01-4 | A01 | Shared Lambda execution role | Medium | Medium | Medium | **Medium** |
| A01-2 | A01 | Unauthenticated identities enabled | Medium | Low | High | **Medium** |
| A01-3 | A01 | No object-level authorization | Medium | Medium | Medium | **Medium** |
| A03-2 | A03 | File name path traversal | Medium | Medium | Low | **Medium** |
| A04-1 | A04 | No per-user rate limiting | Medium | Medium | Medium | **Medium** |
| A04-2 | A04 | Optional Bedrock guardrails | Medium | Low | Medium | **Medium** |
| A05-4 | A05 | DB security group too broad | Medium | Low | High | **Medium** |
| A08-1 | A08 | Auto-build without branch protection | Medium | Low | High | **Medium** |
| A07-1 | A07 | No symbol requirement in passwords | Low | Low | Low | **Low** |
| A02-3 | A02 | Connection string concatenation | Low | Low | Low | **Low** |
| A06-1 | A06 | Pinned Powertools layer version | Low | Low | Low | **Low** |
| A10-1 | A10 | SSRF (minimal risk) | Low | Low | Low | **Low** |

---

## 6. Remediation Roadmap

### Phase 1 — Immediate (Week 1) 🔴

**1. Enable TLS on RDS and RDS Proxy**
```typescript
// database-stack.ts — Change parameter group
parameters: {
    'rds.force_ssl': '1'   // ← ENABLE SSL
}

// All three RDS Proxy instances
requireTLS: true,
```
Ensure all Lambda connection code includes `sslmode=require` in connection parameters.

**2. Restrict CORS to application domain**
Replace all instances of `Access-Control-Allow-Origin: '*'` with the actual Amplify domain:
- Update `OpenAPI_Swagger_Definition.yaml` (gateway responses and OPTIONS handlers)
- Update all Lambda function response headers
- Update S3 bucket CORS configuration

**3. Fix JWT authorizer role bypass**
```javascript
// Remove the transition-period bypass
if (!allowed) {
  throw new Error("Unauthorized");
}
```

### Phase 2 — Short-term (Weeks 2–3) 🟠

**4. Scope IAM permissions to specific resources**
- Replace `secretsmanager:GetSecretValue` on `*` with specific secret ARNs
- Scope `rds-db:connect` on the RDS Proxy role to the specific DB instance
- Scope Bedrock permissions on the authenticated role to specific model ARNs
- Create separate Lambda execution roles per function group (student, instructor, admin, file operations)

**5. Validate file name inputs**
Add validation to `generatePreSignedURL.py` and `deleteFile.py`:
```python
import re
SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\-. ]{1,255}$')
if not SAFE_FILENAME.match(file_name):
    return {'statusCode': 400, 'body': json.dumps('Invalid file name')}
```

**6. Migrate GitHub PAT to CodeStar Connections**
The code already has the CodeStar approach commented out. Complete the migration to eliminate the `unsafeUnwrap()` exposure.

**7. Disable unauthenticated identities**
```typescript
allowUnauthenticatedIdentities: false,
```

### Phase 3 — Medium-term (Month 1) 🟡

**8. Implement LLM prompt injection defenses**
- Sanitize instructor-provided prompts before interpolation
- Use structural separation (e.g., XML tags or delimiters) between system instructions and user content
- Enable Bedrock guardrails by default (set a guardrail ID)
- Implement output validation to detect prompt leakage

**9. Add object-level authorization**
Verify that the requesting user has permission to access the specific simulation group and persona before performing file operations.

**10. Implement per-user rate limiting**
Add a WAF rule that rate-limits based on the JWT subject claim or add application-level rate limiting in the Lambda authorizer.

**11. Restrict database security group**
Replace the VPC-wide CIDR rule with references to the specific Lambda security groups.

**12. Fix pre-signup domain validation**
```javascript
const emailDomain = email.split("@")[1].toLowerCase();
```

**13. Use keyword arguments for psycopg2 connections**
Replace string concatenation with `psycopg2.connect(**connection_params)` in all Python Lambda functions.

---

## 7. Compliance Considerations

### FERPA (Student Educational Records)
As an educational platform handling student performance data (simulation scores, chat transcripts, debrief reports), GenRx likely falls under FERPA. Key gaps:
- Database traffic encryption (A02-1, A02-2) must be resolved
- Access controls need tightening (A01-1, A01-3)
- Data retention and deletion policies should be documented

### HIPAA (if simulated patient data resembles PHI)
If simulation scenarios use realistic patient data, HIPAA considerations may apply:
- Encryption in transit is currently not enforced (A02-1, A02-2)
- Audit logging is present but needs centralized monitoring
- BAA with AWS is required

### SOC 2
- **Security:** Multiple findings need remediation (CORS, TLS, IAM)
- **Availability:** Multi-AZ RDS and deletion protection are positive
- **Confidentiality:** Secrets management is mostly sound but needs scoping
- **Processing Integrity:** Input validation gaps need addressing
- **Privacy:** Data retention policies not documented

---

*This document should be treated as a point-in-time assessment. A full penetration test and dependency audit are recommended to complement these findings.*
