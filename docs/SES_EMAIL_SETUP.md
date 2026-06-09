# SES Email Setup

## Overview

GenRx uses Amazon SES for Cognito email delivery (verification codes, password resets). SES replaces Cognito's default email sender which is limited to 50 emails/day.

## Architecture

```
CDK Context Variables
├── SesVerifiedDomain = "genrx2.cloud-inov.com"
└── SesIdentityVerified = "true"
         │
         ▼
Route 53 Hosted Zone Lookup
         │
         ▼
SES EmailIdentity (auto-creates DKIM + MAIL FROM DNS records)
         │
         ▼
Cognito UserPool (sends from noreply@genrx2.cloud-inov.com)
```

## Context Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SesVerifiedDomain` | Domain with a Route 53 hosted zone (e.g., `genrx2.cloud-inov.com`) | Yes (for SES) |
| `SesIdentityVerified` | Set to `"true"` after the SES identity is verified | Yes (for Cognito to use SES) |

Both are set in `cdk.json` as defaults. Override with `-c` flags if needed.

## First-Time Setup (New Environment)

SES requires a two-step deployment because Cognito validates the SES identity is verified before accepting it.

### Step 1: Create the SES identity

Deploy **without** `SesIdentityVerified`:

```bash
cdk deploy --all -c SesIdentityVerified="" --profile <PROFILE>
```

This creates the SES domain identity and DKIM DNS records in Route 53 but keeps Cognito on default email.

### Step 2: Wait for verification

Go to **SES Console** → **Verified identities** → your domain. Wait until:
- Identity status: **Verified**
- DKIM: **Successful**

Usually takes 5-15 minutes.

### Step 3: Wire Cognito to SES

Deploy again (uses defaults from `cdk.json`):

```bash
cdk deploy --all --profile <PROFILE>
```

This updates Cognito to send emails through SES.

### Step 4: Request SES production access (one-time)

New AWS accounts start in the SES sandbox. Go to **SES Console** → **Account dashboard** → **Request production access**:
- Mail type: Transactional
- Website URL: your app URL
- Use case: "Verification codes and password resets for clinical education platform."

Approval is usually within 24 hours.

## Day-to-Day Deployment

After initial setup, just deploy normally:

```bash
cdk deploy --all --profile <PROFILE>
```

All context variables are in `cdk.json`. No extra flags needed.

## What Gets Created

| Resource | Purpose |
|----------|---------|
| `ses.EmailIdentity` | Domain identity with DKIM (auto-verified via Route 53) |
| Route 53 DKIM records | 3 CNAME records for email authentication |
| Route 53 MAIL FROM record | MX + TXT records for bounce handling |
| Cognito `email` property | `UserPoolEmail.withSES()` with `noreply@<domain>` |

## How It Works

- Cognito sends all emails (verification codes, password resets) through SES
- Emails come from `noreply@genrx2.cloud-inov.com`
- DKIM ensures emails aren't flagged as spam
- No Lambda functions call SES directly — all email is Cognito-managed

## CORS

The custom domain (`genrx2.cloud-inov.com` and `www.genrx2.cloud-inov.com`) is automatically added to the API Gateway and Lambda CORS allowed origins when `SesVerifiedDomain` is set.

## Troubleshooting

### "Email address is not verified" during deploy

The SES identity isn't verified yet. Either:
- Wait longer (DKIM propagation can take up to 72 hours in rare cases)
- Deploy without `SesIdentityVerified` flag: `-c SesIdentityVerified=""`

### No identities in SES console

The deploy rolled back before creating the identity. Deploy without `SesIdentityVerified` first.

### Emails not arriving (sandbox mode)

You're still in SES sandbox — emails only go to verified addresses. Request production access from SES console.

## Amplify Custom Domain

The `SesVerifiedDomain` context variable also configures a custom domain for the Amplify frontend. When set, users can access the app at `https://genrx2.cloud-inov.com` instead of the default `*.amplifyapp.com` URL.

### Prerequisites

- A **public Route 53 hosted zone** for the domain (same one used by SES)
- The domain must be registered and its nameservers must point to Route 53

### What CDK Creates

- An `amplify.CfnDomain` resource mapping the root domain and `www` to the `main` branch
- Amplify auto-provisions an SSL certificate (ACM)
- Amplify creates the required CNAME/ALIAS DNS records in Route 53

### After Deployment

1. Go to **Amplify Console** → your app → **Domain management**
2. You'll see the domain progressing through: **Creating** → **Requesting certificate** → **Available**
3. SSL provisioning takes 10-30 minutes
4. Once status is **Available**, `https://genrx2.cloud-inov.com` serves your app

### Subdomain Mapping

| Domain | Branch | Description |
|--------|--------|-------------|
| `genrx2.cloud-inov.com` | main | Root domain → main branch |
| `www.genrx2.cloud-inov.com` | main | www redirect → root |

### Changing the Domain

To use a different domain:
1. Update `SesVerifiedDomain` in `cdk.json`
2. Ensure a Route 53 hosted zone exists for the new domain
3. Deploy — CDK will create a new SES identity + Amplify custom domain

### Custom Domain Does NOT Affect SES

These features share the same context variable for convenience but are independent:
- **SES** sends email from `noreply@<domain>`
- **Amplify** serves the frontend at `https://<domain>`

Changing or removing the custom domain does not break email delivery, and vice versa.

---

## Files

| File | SES-related content |
|------|-------------------|
| `cdk/cdk.json` | Default context values (`SesVerifiedDomain`, `SesIdentityVerified`) |
| `cdk/bin/cdk.ts` | Reads `SesVerifiedDomain` context, passes to Api stack |
| `cdk/lib/api-service-stack.ts` | Creates SES identity, configures Cognito email |
| `cdk/lib/amplify-stack.ts` | Uses `SesVerifiedDomain` for Amplify custom domain |
