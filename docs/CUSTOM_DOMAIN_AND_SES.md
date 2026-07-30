# Custom Domain & SES Email Setup

## Overview

Patient Interaction Practice Tool uses Amazon SES for Cognito email delivery (verification codes, password resets). SES replaces Cognito's default email sender which is limited to 50 emails/day.

## Current state

If the project has been deployed as per the instructions laid out in the deployment guide, custom domain will NOT be setup by default, and email verification will be taking place via Cognito, which has an upper limit of 50 emails per day(therefore, 50 fresh sign ups in a day). Porting over to using SES will allow that limit to be raised to 50,000 emails per day. 

## Domain setup

Before the setup of SES, a domain is needed. This section will outline how exactly to go about configuring your own custom domain name. This domain will be the email address from which verification emails get sent from and also the final link through which users can access the web application. 

### Register a Domain (if you don't have one)

If your organization doesn't already own a domain, you need to register one first. You can do this directly through Route 53:

1. Go to **Route 53** → **Registered domains** → **Register domains**
![alt text](route53_registered_domains.png)
2. Search for a domain name (e.g., `pipt-clinic.com`, `mypharmacylab.ca`)
3. Choose a TLD — `.com`, `.ca`, `.io`, etc. (pricing ranges $3–$15/year)
4. Fill in registrant contact info and complete the purchase
5. AWS automatically creates a hosted zone and configures nameservers for you

Once registered, your domain is ready to use — skip directly to the [Create a Route 53 Hosted Zone](#create-a-route-53-hosted-zone) section below (the hosted zone already exists if you registered via Route 53).

> **Timeline:** Domain registration is usually instant but can take up to 3 days for some TLDs. `.com` and `.ca` are typically immediate.

### Use a subdomain of an existing domain

If your organization already owns a domain (e.g., `example-domain.com`) and you want to use a subdomain (e.g., `app.example-domain.com`), follow the steps below to create a hosted zone and delegate it.

### Create a Route 53 Hosted Zone

1. Open Route 53 on AWS Console
![Route 53 Console](./media/route53_aws_console.png)
2. Choose Hosted Zones in the left side panel.
![Route 53 Left Panel](./media/route53_left_panel.png)
3. Click on "Create Hosted Zone"
![Create Hosted Zone](./media/route53_create_zone.png)
4. Enter your FULL subdomain name.  For type, choose public hosted zone.
![Domain Name Entry](./media/route53_domain_name.png)
5. Once created, a list of 4 Name Server (NS) records will be generated under the (NS) type. Note these values and send them to the account administrator for approval.
![NS Records](./media/route53_ns_names.png)

> **What happens next:** The domain administrator adds an NS record delegation in their DNS provider pointing your subdomain to these 4 Route 53 nameservers. Once that propagates (5 min – 48 hours), Route 53 has authority over your subdomain and CDK can create SES/Amplify records automatically.
>
> **What to tell your admin:** "Please add an NS record for `<your-subdomain>` pointing to these 4 nameservers: [paste the 4 values]. This delegates DNS authority for the subdomain to our AWS account."
>
> **How to verify it worked:** Run `nslookup -type=NS <your-subdomain>` in a terminal. If it returns the 4 Route 53 nameservers, delegation is complete and you can proceed with the CDK deploy.

## First-Time Setup (New Environment)

SES requires a two-step deployment because Cognito validates the SES identity is verified before accepting it.

### Step 1: Create the SES identity

Deploy **without** `SesIdentityVerified`:

```bash
cdk deploy --all \
  -c StackPrefix=<PREFIX> \
  -c githubRepo=<REPO> \
  -c githubBranch=main \
  -c SesVerifiedDomain=<YOUR-DOMAIN> \
  -c SesIdentityVerified="" \
  --profile <PROFILE>
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
cdk deploy --all \
  -c StackPrefix=<PREFIX> \
  -c githubRepo=<REPO> \
  -c githubBranch=main \
  -c SesVerifiedDomain=<YOUR-DOMAIN> \
  -c SesIdentityVerified=true \
  --profile <PROFILE>
```

### Step 4: Request SES production access (one-time)

New AWS accounts start in the SES sandbox. Go to **SES Console** → **Account dashboard** → **Request production access**:
- Mail type: Transactional
- Website URL: your app URL
- Use case: "Verification codes and password resets for clinical education platform."

Approval is usually within 24 hours.

## Context Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SesVerifiedDomain` | Domain with a Route 53 hosted zone (e.g., `app.YOUR-DOMAIN.com`) | Yes (for SES) |
| `SesIdentityVerified` | Set to `"true"` after the SES identity is verified | Yes (for Cognito to use SES) |
| `SesSkipIdentityCreation` | Set to `"true"` **only** if the SES identity was created outside of this CDK stack (e.g., manually or by another stack). See warning below. | No |

All are passed as `-c` context flags at deploy time. They are not set in `cdk.json` to avoid conflicts with first-time deployments that don't have a verified domain yet.

> **⚠️ CRITICAL: Do NOT use `SesSkipIdentityCreation=true` if the SES identity was created by this CDK stack.**
>
> When you pass `SesSkipIdentityCreation=true`, CDK removes the `ses.EmailIdentity` resource from the CloudFormation template. CloudFormation interprets this as a resource deletion and **destroys the SES identity from your account**. This causes Cognito's SES email configuration to break, reverting sign-up emails back to the default Cognito sender (50/day limit).
>
> Only use this flag if the SES identity was created by a different stack or manually in the console — i.e., it was never part of this stack's CloudFormation template.

## Day-to-Day Deployment

After initial setup, include the SES flags on **every** deploy:

```bash
cdk deploy --all \
  -c StackPrefix=<PREFIX> \
  -c githubRepo=<REPO> \
  -c githubBranch=<BRANCH> \
  -c SesVerifiedDomain=<YOUR-DOMAIN> \
  -c SesIdentityVerified=true \
  --profile <PROFILE>
```

> **⚠️ You MUST pass `SesVerifiedDomain` and `SesIdentityVerified=true` on every deploy.** If you omit these flags, CDK will:
> 1. Remove the SES identity resource → CloudFormation deletes it from your account
> 2. Switch Cognito back to its built-in email sender (50 emails/day limit)
>
> There is no way to "lock in" SES — the flags must be present every time.

> **Do NOT pass `SesSkipIdentityCreation=true`** on day-to-day deploys. The SES identity resource must stay in the CloudFormation template so CloudFormation does not delete it.

## What Gets Created

| Resource | Purpose |
|----------|---------|
| `ses.EmailIdentity` | Domain identity with DKIM (auto-verified via Route 53) |
| Route 53 DKIM records | 3 CNAME records for email authentication |
| Route 53 MAIL FROM record | MX + TXT records for bounce handling |
| Cognito `email` property | `UserPoolEmail.withSES()` with `noreply@<domain>` |

## How It Works

- Cognito sends all emails (verification codes, password resets) through SES
- Emails come from `noreply@YOUR-DOMAIN.com`
- DKIM ensures emails aren't flagged as spam
- No Lambda functions call SES directly — all email is Cognito-managed

## CORS

The custom domain (`YOUR-DOMAIN.com` and `www.YOUR-DOMAIN.com`) is automatically added to the API Gateway and Lambda CORS allowed origins when `SesVerifiedDomain` is set.

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

The `SesVerifiedDomain` context variable also configures a custom domain for the Amplify frontend. When set, users can access the app at `https://YOUR-DOMAIN.com` instead of the default `*.amplifyapp.com` URL.

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
4. Once status is **Available**, `https://YOUR-DOMAIN.com` serves your app

### Subdomain Mapping

| Domain | Branch | Description |
|--------|--------|-------------|
| `YOUR-DOMAIN.com` | main | Root domain → main branch |
| `www.YOUR-DOMAIN.com` | main | www redirect → root |

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

## Alternative: Third-Party DNS with Imported SSL Certificate

If your organization manages DNS outside of Route 53 (e.g., university DNS) or requires using an organization-issued SSL certificate, use this path instead of the Route 53 approach above. This is common in enterprise/academic environments where you receive a subdomain (e.g., `pipt.yourorg.edu`) but don't have full DNS delegation authority.

> **⚠️ CDK Conflict Warning:** If you use this manual approach, do **NOT** pass `SesVerifiedDomain` on your CDK deploys. The CDK's `CfnDomain` block will attempt to create an Amplify custom domain resource that conflicts with your manually configured domain. If you've already deployed with `SesVerifiedDomain` set, you'll need to either:
> - Remove the manual console domain and let CDK manage it (Route 53 path), OR
> - Run one deploy with `SesVerifiedDomain` omitted to remove the CDK-managed domain resource, then configure manually in the console
>
> Pick one path and stick with it. Mixing CDK-managed and console-managed domains on the same Amplify app will cause deploy failures.

### Phase 1: Import your organization's SSL certificate into ACM

Your organization's CA will provide: the certificate body (PEM), the private key, and the certificate chain (intermediate/CA bundle).

**Requirements:**
- RSA (1024/2048/3072/4096-bit) or ECDSA (256-bit, prime256v1)
- Must cover your subdomain — a wildcard like `*.yourorg.edu` works
- Certificate must not be expired

**Steps:**

1. Open the **ACM console** in **us-east-1 (N. Virginia)** — this region is mandatory for Amplify custom domains regardless of where your app is deployed.
2. Click **Import a certificate**.
3. Paste the **certificate body** (PEM format, begins with `-----BEGIN CERTIFICATE-----`).
4. Paste the **private key** (begins with `-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`).
5. Paste the **certificate chain** (intermediate and root CA certificates, concatenated).
6. Click **Import**.
7. Confirm the status shows **Issued**. Copy the **certificate ARN** — you'll need it in Phase 2.

> **Renewal responsibility:** Imported certificates do NOT auto-renew. Set a calendar reminder to re-import the renewed certificate before expiry. When you re-import into the same ACM certificate ARN, Amplify picks up the new cert automatically — no app changes needed.

Reference: [Importing certificates into ACM](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html)

### Phase 2: Add the custom domain in Amplify Console

1. Open the **Amplify Console** → select the PIPT app.
2. Go to **Hosting** → **Custom domains** → **Add domain**.
3. Enter your subdomain (e.g., `pipt.yourorg.edu`). Use a subdomain, not an apex domain, so you only need a CNAME record.
4. Amplify will detect it's not a Route 53 domain → choose **Manual configuration**.
5. Map the subdomain to the **main** branch. Remove the extra `www` entry unless you want it.
6. For **SSL certificate**, choose **Custom SSL certificate** → select the ACM certificate you imported in Phase 1.
7. Click **Add domain**.

Reference: [Adding a custom domain managed by a third-party DNS provider](https://docs.aws.amazon.com/amplify/latest/userguide/to-add-a-custom-domain-managed-by-a-third-party-dns-provider.html)

### Phase 3: Add DNS records at your organization's DNS provider

After adding the domain, Amplify will show you the DNS records you need to create.

1. In Amplify, go to **Actions** → **View DNS records**. You'll see two CNAME records.
2. Send these to your organization's DNS administrator:

| Record Type | Host | Value | Purpose |
|-------------|------|-------|---------|
| CNAME | `_abc123.pipt` (validation) | `_abc123...acm-validations.aws` | Proves domain ownership to ACM |
| CNAME | `pipt` (routing) | `<branch>.<app-id>.amplifyapp.com` | Routes traffic to Amplify |

> **Timing matters:** Add these records promptly. ACM validation retries with exponential backoff — delays can leave the domain stuck in **Pending Verification** for hours. If this happens, delete the domain in Amplify and re-add it to restart the validation process.

### Phase 4: Verify

1. Wait for the Amplify domain status to reach **Available**. DNS propagation + ACM validation typically takes 15–60 minutes, but can take up to 24 hours in some environments.
2. Browse to `https://pipt.yourorg.edu` and confirm:
   - The site loads correctly
   - The padlock shows your organization's certificate (not an AWS-issued one)

### Ongoing maintenance

| Task | Frequency | What to do |
|------|-----------|------------|
| Certificate renewal | Before expiry (annually for most org CAs) | Re-import the renewed cert into the same ACM certificate in us-east-1. Amplify refreshes automatically. |
| CDK deploys | Every deploy | Do NOT pass `SesVerifiedDomain` — this prevents CDK from creating a competing `CfnDomain` resource. SES email can still be configured separately if needed. |
| Branch changes | As needed | Update the subdomain mapping in Amplify Console if you change the production branch. |

### Deploy commands for this path

When using the third-party DNS / manual SSL approach, your CDK deploy commands **must omit** the `SesVerifiedDomain` and `SesIdentityVerified` flags entirely. This prevents CDK from creating SES identities or Amplify domains that would conflict with your manual console configuration.

**Standard deploy (no SES, no CDK-managed domain):**

```bash
cdk deploy --all -c StackPrefix=<PREFIX> -c githubRepo=<REPO> -c githubBranch=main --profile <PROFILE>
```

**If you also want SES email but set it up manually in the SES console:**

Deploy the same way (no SES flags), then configure SES separately:
1. Go to **SES Console** → **Verified identities** → **Create identity**
2. Choose **Domain** and enter your domain
3. SES will give you DKIM CNAME records — send these to your org DNS admin
4. Once verified, configure Cognito to use SES via the Cognito console:
   - **User Pool** → **Messaging** → **Email** → select SES and enter the verified domain
5. This keeps SES completely outside of CloudFormation, so deploys never touch it

**If you previously deployed WITH `SesVerifiedDomain` and need to switch to manual:**

You need one transitional deploy to remove the CDK-managed SES identity and Amplify domain from CloudFormation's state:

```bash
# This removes the SES identity and CfnDomain from the stack (CloudFormation will delete them)
cdk deploy --all -c StackPrefix=<PREFIX> -c githubRepo=<REPO> -c githubBranch=main --profile <PROFILE>
```

After this deploy completes:
- The SES identity created by CDK will be deleted — recreate it manually in the SES console if needed
- The Amplify custom domain will be removed — add it back manually via Phase 2 above
- All future deploys use the simple command (no SES flags)

> **⚠️ This means a brief interruption:** Cognito will fall back to its default email sender (50/day limit) until you manually configure SES. Plan accordingly — do this during a low-usage window.

### Separating SES email from the manual domain

If you want SES email (for Cognito verification emails) but are managing the Amplify domain manually:
- You can still set up SES manually in the SES console for your domain
- Create the DKIM records at your org DNS provider (same process as the routing CNAME above)
- Configure Cognito to use SES via the API or console, independent of CDK
- Alternatively, use a different domain/subdomain for email (e.g., `mail.yourorg.edu`) that IS in Route 53, while keeping the app domain manual

Reference: [Using SSL/TLS certificates with Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/using-certificates.html)

---

## Files

| File | SES-related content |
|------|-------------------|
| `cdk/bin/cdk.ts` | Reads `SesVerifiedDomain` context, passes to Api stack |
| `cdk/lib/api-service-stack.ts` | Creates SES identity, configures Cognito email |
| `cdk/lib/amplify-stack.ts` | Uses `SesVerifiedDomain` for Amplify custom domain |

---

## Glossary

- **Domain**: A human-readable address like `pipt-clinic.com` or `app.example-domain.com`. You either buy one or use a subdomain of one your organization already owns.
- **Hosted Zone**: A Route 53 container that holds DNS records for your domain. Think of it as the phone book entry that tells the internet where your domain's services live.
- **NS (Name Server) Records**: These tell the internet which DNS servers are authoritative for your domain. When you create a hosted zone, Route 53 gives you 4 NS records.
- **Delegation**: If using a subdomain of an existing domain, the parent domain's DNS must add NS records pointing the subdomain to Route 53. This is how Route 53 gets "permission" to manage the subdomain.
- **DKIM**: DomainKeys Identified Mail — a cryptographic signature added to emails so recipients can verify the email actually came from your domain and wasn't spoofed.
- **SES (Simple Email Service)**: AWS's email sending service. Cognito uses it to send verification codes and password reset emails from your domain instead of a generic AWS address.
- **SES Sandbox**: The default state for new SES accounts — you can only send emails to verified addresses. Production access removes this restriction.

---

## References

- [Cognito User Pool Email Settings (AWS Docs)](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)
