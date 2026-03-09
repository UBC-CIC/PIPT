/**
 * TODO: Auth Decoupling — Replace this Cognito-specific authorizer with a generic JWT authorizer.
 *
 * PLAN: Single authorizer codebase (lambda/jwtAuthorizer/jwtAuthorizer.js) deployed 3 times via CDK
 * with different AUTH_ALLOWED_ROLES env vars. OpenAPI spec stays untouched.
 *
 * Deployments:
 *   studentLambdaAuthorizer    → AUTH_ALLOWED_ROLES=student,instructor,admin
 *   instructorLambdaAuthorizer → AUTH_ALLOWED_ROLES=instructor,admin
 *   adminLambdaAuthorizer      → AUTH_ALLOWED_ROLES=admin
 *
 * New env vars (provider-agnostic):
 *   AUTH_JWKS_URI      — OIDC provider's JWKS endpoint
 *   AUTH_ISSUER        — Token issuer URL
 *   AUTH_AUDIENCE      — Client ID
 *   AUTH_ROLES_CLAIM   — JWT claim containing roles (default: "cognito:groups")
 *   AUTH_ALLOWED_ROLES — Comma-separated roles allowed for this deployment
 *
 * Implementation (using `jose` library instead of `aws-jwt-verify`):
 *
 *   const { createRemoteJWKSet, jwtVerify } = require("jose");
 *
 *   let JWKS;
 *   exports.handler = async (event) => {
 *       if (!JWKS) JWKS = createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URI));
 *
 *       const token = event.authorizationToken.toString();
 *       const { payload } = await jwtVerify(token, JWKS, {
 *           issuer: process.env.AUTH_ISSUER,
 *           audience: process.env.AUTH_AUDIENCE,
 *       });
 *
 *       const userRoles = payload[process.env.AUTH_ROLES_CLAIM || "cognito:groups"] || [];
 *       const allowedRoles = (process.env.AUTH_ALLOWED_ROLES || "").split(",");
 *       if (!allowedRoles.some(role => userRoles.includes(role))) throw new Error("Unauthorized");
 *
 *       const email = payload.email || payload.sub;
 *       return {
 *           principalId: payload.sub,
 *           policyDocument: { Version: "2012-10-17", Statement: [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: "..." }] },
 *           context: { userId: payload.sub, email, roles: JSON.stringify(userRoles) },
 *       };
 *   };
 *
 * Benefits:
 *   - To swap auth providers, change 4 CDK env vars. Zero code changes.
 *   - Authorizer passes email + roles in context → downstream Lambdas stop calling Cognito API.
 *   - Works with Cognito, Auth0, Supabase, Keycloak, or any OIDC provider.
 */
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

let { SM_COGNITO_CREDENTIALS } = process.env;

// Return response
const responseStruct = {
  principalId: "yyyyyyyy", // The principal user identification associated with the token sent by the client.
  policyDocument: {
    Version: "2012-10-17",
    Statement: [],
  },
  context: {},
};

// Create the verifier outside the Lambda handler (= during cold start),
// so the cache can be reused for subsequent invocations. Then, only during the
// first invocation, will the verifier actually need to fetch the JWKS.
let jwtVerifier;

async function initializeConnection() {
  try {
    // Retrieve the secret from AWS Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: SM_COGNITO_CREDENTIALS,
    });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    const credentials = JSON.parse(secretResponse.SecretString);

    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: credentials.VITE_COGNITO_USER_POOL_ID,
      tokenUse: "id",
      groups: ["student", "instructor", "admin"],
      clientId: credentials.VITE_COGNITO_USER_POOL_CLIENT_ID,
    });
  } catch (error) {
    console.error("Error initializing JWT verifier:", error);
    throw new Error("Failed to initialize JWT verifier");
  }
}

exports.handler = async (event) => {
  if (!jwtVerifier) {
    await initializeConnection();
  }

  const accessToken = event.authorizationToken.toString();
  let payload;

  try {
    // If the token is not valid, an error is thrown:
    payload = await jwtVerifier.verify(accessToken);

    // Modify the response output
    const parts = event.methodArn.split("/");
    const resource = parts.slice(0, 2).join("/") + "*";
    responseStruct["principalId"] = payload.sub;
    responseStruct["policyDocument"]["Statement"].push({
      Action: "execute-api:Invoke",
      Effect: "Allow",
      Resource: resource,
    });
    responseStruct["context"] = {
      userId: payload.sub,
    };

    return responseStruct;
  } catch (error) {
    console.error("Authorization error:", error);
    // API Gateway wants this *exact* error message, otherwise it returns 500 instead of 401:
    throw new Error("Unauthorized");
  }
};
