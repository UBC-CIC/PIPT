# Modification Guide

Instructions for customizing GenRx — colors, local development, email templates, API extension, frontend assets, and LLM configuration.

---

## Modifying Colors and Styles

GenRx uses CSS custom properties (variables) defined in `frontend/src/index.css`. The design system is built on shadcn/ui with Tailwind CSS 4.

### Color Variables

All colors are defined as `rgb()` values in the `:root` selector. The `.dark` class provides dark mode overrides (currently identical to light mode — customize as needed).

```css
/* frontend/src/index.css */

:root {
  /* Core surfaces */
  --background: rgb(255, 255, 255);        /* Page background */
  --foreground: rgb(0, 0, 0);              /* Default text color */
  --card: rgb(245, 245, 245);              /* Card backgrounds */
  --card-foreground: rgb(38, 38, 38);      /* Card text */
  --popover: rgb(255, 255, 255);           /* Popover/dropdown backgrounds */
  --popover-foreground: rgb(10, 10, 10);   /* Popover text */

  /* Brand colors */
  --primary: rgb(23, 68, 103);             /* Primary buttons, links, focus rings */
  --primary-foreground: rgb(245, 245, 245);/* Text on primary backgrounds */
  --secondary: rgb(229, 221, 200);         /* Secondary buttons, badges */
  --secondary-foreground: rgb(38, 38, 38); /* Text on secondary backgrounds */
  --accent: rgb(23, 68, 103);              /* Accent highlights (same as primary) */
  --accent-foreground: rgb(245, 245, 245); /* Text on accent backgrounds */

  /* Semantic colors */
  --destructive: rgb(158, 64, 66);         /* Delete buttons, error states */
  --destructive-foreground: rgb(250, 250, 250);
  --muted: rgb(245, 245, 245);             /* Muted backgrounds */
  --muted-foreground: rgb(115, 115, 115);  /* Muted/secondary text */

  /* Form elements */
  --border: rgb(212, 212, 212);            /* Borders */
  --input: rgb(245, 245, 245);             /* Input backgrounds */
  --ring: rgb(23, 68, 103);                /* Focus ring color */

  /* Charts (Recharts) */
  --chart-1: rgb(145, 197, 255);
  --chart-2: rgb(58, 129, 246);
  --chart-3: rgb(37, 99, 239);
  --chart-4: rgb(26, 78, 218);
  --chart-5: rgb(31, 63, 173);

  /* Sidebar */
  --sidebar: rgb(23, 68, 103);             /* Sidebar background */
  --sidebar-foreground: rgb(245, 245, 245);/* Sidebar text */
  --sidebar-primary: rgb(229, 221, 200);   /* Active sidebar item */
  --sidebar-primary-foreground: rgb(38, 38, 38);
  --sidebar-accent: rgb(4, 126, 131);      /* Sidebar accent (teal) */
  --sidebar-accent-foreground: rgb(245, 245, 245);
  --sidebar-border: rgb(10, 10, 10);
  --sidebar-ring: rgb(229, 221, 200);

  /* Layout */
  --radius: 0.625rem;                      /* Border radius for components */
}
```

### How to Customize

1. Open `frontend/src/index.css`
2. Modify the `rgb()` values in `:root` for light mode
3. Modify the `.dark` selector for dark mode (if implementing dark mode)
4. All shadcn/ui components automatically pick up the new values

### Key Color Relationships

- `--primary` and `--accent` are the same by default — change both for a consistent brand
- `--sidebar` uses the primary color for a branded navigation experience
- `--sidebar-accent` (teal) provides contrast for active states in the sidebar
- `--chart-*` variables control the Recharts color palette on analytics dashboards

---

## Setting Up Local Development

### Prerequisites

- Node.js 22+
- npm
- A deployed GenRx backend (you need the API endpoint, Cognito, and Socket URLs)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment Variables

Create or edit `frontend/.env` with your deployed backend values:

```dotenv
VITE_AWS_REGION=ca-central-1
VITE_COGNITO_USER_POOL_ID=ca-central-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_IDENTITY_POOL_ID=ca-central-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ca-central-1.amazonaws.com/prod/
VITE_SOCKET_URL=wss://xxxxxxxxxxxxxx.cloudfront.net
VITE_APPSYNC_GRAPHQL_URL=https://xxxxxxxxxxxxxxxxxxxxxx.appsync-api.ca-central-1.amazonaws.com/graphql
```

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `VITE_AWS_REGION` | AWS region of deployment | Your CDK deploy region |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | CDK output or Cognito console |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | Cognito App Client ID | CDK output or Cognito console |
| `VITE_IDENTITY_POOL_ID` | Cognito Identity Pool ID | CDK output or Cognito console |
| `VITE_API_ENDPOINT` | API Gateway base URL (with trailing `/`) | CDK output or API Gateway console |
| `VITE_SOCKET_URL` | WebSocket URL for real-time features | CDK output (EcsSocket stack) |
| `VITE_APPSYNC_GRAPHQL_URL` | AppSync GraphQL endpoint | CDK output or AppSync console |

You can find all these values in the Secrets Manager secret named `{StackPrefix}-Api-GenRx_Cognito_Secrets` or from the CDK stack outputs.

### Step 3: Start the Dev Server

```bash
npm run dev
```

The Vite dev server starts at `http://localhost:5173` with hot module replacement.

### How the Configuration Works

The `frontend/src/config/aws-config.ts` file reads all `VITE_` environment variables at build time and configures AWS Amplify:

```typescript
export const appConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'ca-central-1',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || '',
  },
  api: {
    endpoint: import.meta.env.VITE_API_ENDPOINT || '',
  },
  socket: {
    url: import.meta.env.VITE_SOCKET_URL || '',
  },
  appSync: {
    graphqlUrl: import.meta.env.VITE_APPSYNC_GRAPHQL_URL || '',
  },
};
```

### Troubleshooting Local Dev

- **CORS errors**: The API Gateway is configured to allow all origins. If you see CORS issues, verify the `VITE_API_ENDPOINT` ends with `/prod/` (trailing slash).
- **Auth failures**: Ensure the Cognito User Pool ID and Client ID match the deployed environment.
- **Socket connection fails**: The socket URL must use `wss://` protocol and point to the CloudFront distribution in front of the ECS service.
- **Environment variables not loading**: Vite requires a server restart after `.env` changes. Stop and re-run `npm run dev`.

---

## Customizing the Verification Email

The Cognito verification email template is defined inline in the CDK stack at `cdk/lib/api-service-stack.ts` within the `userVerification` property of the User Pool.

### Location

```
cdk/lib/api-service-stack.ts → UserPool → userVerification → emailBody
```

### Template Structure

The email is a full HTML document with:
- Responsive design (mobile-friendly)
- Dark mode support via `@media (prefers-color-scheme: dark)`
- GenRx branding (green gradient header)
- Verification code display using `{####}` placeholder

### How to Modify

1. Edit the `emailBody` string in `cdk/lib/api-service-stack.ts`
2. Keep the `{####}` placeholder — Cognito replaces it with the actual verification code
3. Deploy the API stack:

   ```bash
   npx cdk deploy GenRx-Api -c StackPrefix=GenRx -c githubRepo=genrx
   ```

> **Note:** Changes only affect new verification emails. Users who already received a code won't see the updated template.

---

## Extending the API

To add a new REST endpoint:

### Step 1: Add the Route Handler

Edit the appropriate Lambda handler file based on which role should access the endpoint:

- Student: `cdk/lambda/lib/studentFunction.js`
- Instructor: `cdk/lambda/lib/instructorFunction.js`
- Admin: `cdk/lambda/adminFunction/adminFunction.js`

Add a new case to the switch statement:

```javascript
// In the handler function
case "POST /student/my_new_endpoint":
  // Extract parameters
  const { param1, param2 } = JSON.parse(event.body);
  const userId = event.requestContext.authorizer.userId;

  // Database query
  const result = await sql`
    SELECT * FROM my_table WHERE user_id = ${userId}
  `;

  // Return response
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ data: result }),
  };
```

### Step 2: Add the API Gateway Resource

Edit `cdk/OpenAPI_Swagger_Definition.yaml` to add the new path:

```yaml
  /student/my_new_endpoint:
    options:
      summary: CORS support
      # ... standard CORS options config
    post:
      summary: Description of your endpoint
      # ... request/response schemas
      x-amazon-apigateway-integration:
        uri:
          Fn::Sub: "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${StudentFunction.Arn}/invocations"
        httpMethod: "POST"
        type: "aws_proxy"
```

### Step 3: Deploy

```bash
npx cdk deploy GenRx-Api -c StackPrefix=GenRx -c githubRepo=genrx
```

### Step 4: Add Frontend Service Method

Add the corresponding API call in the appropriate service file:

```typescript
// frontend/src/services/studentService.ts
export async function myNewEndpoint(param1: string, param2: number) {
  return apiClient.post('/student/my_new_endpoint', { param1, param2 });
}
```

---

## Modifying Frontend Text, Icons, and Logo

### Application Name and Branding Text

The application name "GENRx" appears in:

- `frontend/src/pages/LoginPage.tsx` — Login page heading
- `frontend/src/pages/SignUpPage.tsx` — Sign-up page heading

Search for "GENRx" across the frontend to find all instances.

### Logo and Icons

| Asset | Location | Usage |
|-------|----------|-------|
| App icon | `frontend/public/stethoscope_icon.png` | Browser tab favicon / app icon |
| Vite default | `frontend/public/vite.svg` | Can be removed or replaced |

To change the app icon:
1. Replace `frontend/public/stethoscope_icon.png` with your new icon
2. Update `frontend/index.html` if the filename changes

### Component-Level Customization

- **Sidebar navigation**: Components in `frontend/src/components/` that render the sidebar
- **Page layouts**: `frontend/src/pages/{role}/` directories contain role-specific page components
- **UI primitives**: `frontend/src/components/ui/` contains shadcn/ui components (Button, Dialog, Card, etc.)

---

## Modifying the LLM

### Changing the Active Model (Admin UI)

Administrators can change the active LLM model through the admin interface:

1. Log in as an admin
2. Navigate to **Settings → Prompt Management**
3. Select a different model from the available options

This updates the SSM parameter `/{StackPrefix}-Api/GenRx/BedrockLLMId` at runtime.

### Changing Available Models (Code)

The default model is set in the CDK stack. To change it:

1. Edit `cdk/lib/api-service-stack.ts`:

   ```typescript
   const bedrockLLMParameter = new ssm.StringParameter(
     this,
     "BedrockLLMParameter",
     {
       parameterName: `/${id}/GenRx/BedrockLLMId`,
       description: "Parameter containing the Bedrock LLM ID",
       stringValue: "anthropic.claude-3-5-sonnet-20241022-v2:0", // ← Change this
     }
   );
   ```

2. Ensure the model is enabled in your Bedrock console (Model access)

3. Deploy:

   ```bash
   npx cdk deploy GenRx-Api -c StackPrefix=GenRx -c githubRepo=genrx
   ```

### Changing the Embedding Model

The embedding model is used for document ingestion and semantic search:

```typescript
const embeddingModelParameter = new ssm.StringParameter(
  this,
  "EmbeddingModelParameter",
  {
    parameterName: `/${id}/GenRx/EmbeddingModelId`,
    description: "Parameter containing the Embedding Model ID",
    stringValue: "amazon.titan-embed-text-v2:0", // ← Change this
  }
);
```

> **Warning:** Changing the embedding model invalidates all existing vector embeddings. You must re-ingest all persona documents after changing this value.

### Current Model Configuration

| Parameter | Default Value | Purpose |
|-----------|---------------|---------|
| `/{id}/GenRx/BedrockLLMId` | `meta.llama3-70b-instruct-v1:0` | Primary chat and debrief LLM |
| `/{id}/GenRx/EmbeddingModelId` | `amazon.titan-embed-text-v2:0` | Document and query embeddings |
| `/{id}/GenRx/TableName` | `DynamoDB-Conversation-Table` | DynamoDB table for conversations |

### Prompt Management

System prompts are managed at multiple levels:

1. **Organization-level**: Set in the admin UI under Settings → Prompt Management. Stored in `organizations.system_prompt`.
2. **Simulation group-level**: Set by instructors when creating/editing a group. Stored in `simulation_groups.system_prompt`.
3. **Persona-level**: Set per patient character. Stored in `personas.persona_prompt`.
4. **Debrief prompt**: Configurable per simulation group. Stored in `simulation_groups.debrief_prompt`.

The text generation Lambda (`cdk/text_generation/src/helpers/chat.py`) combines these prompts in priority order: persona prompt > group system prompt > organization system prompt.

### Voice Model

The voice model (Nova Sonic) is hardcoded in the socket server and voice agent:

- `cdk/socket-server/nova_sonic.py` — `model_id='amazon.nova-sonic-v1:0'`
- `cdk/voice-agent/nova_sonic.py` — `MODEL_ID = "amazon.nova-2-sonic-v1:0"`
- `cdk/socket-server/voice_preview_tts.py` — `MODEL_ID = "amazon.nova-2-sonic-v1:0"`

To change the voice model, update these constants and redeploy the socket server / voice agent containers.
