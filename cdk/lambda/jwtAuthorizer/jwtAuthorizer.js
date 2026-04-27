// jose v5+ is ESM-only — use dynamic import() and cache the module at cold start.
let joseModule;
let JWKS;

async function initJose() {
  if (!joseModule) {
    joseModule = await import("jose");
    JWKS = joseModule.createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URI));
  }
}

/**
 * Checks whether the user has at least one role that matches the allowed roles.
 * Returns the matching result and normalised roles array.
 *
 * @param {string|string[]} rolesClaim - Role value(s) from the JWT payload
 * @param {string} allowedRolesEnv - Comma-separated allowed roles string
 * @returns {{ roles: string[], allowed: boolean }}
 */
function checkRoles(rolesClaim, allowedRolesEnv) {
  // Normalise: accept both a single string and an array
  const roles = Array.isArray(rolesClaim) ? rolesClaim : [rolesClaim];
  const allowedRoles = (allowedRolesEnv || "").split(",").filter(Boolean);

  const allowed = roles.some((role) => allowedRoles.includes(role));
  return { roles, allowed };
}

/**
 * Builds an API Gateway authorizer Allow policy with context.
 *
 * @param {string} principalId - The user's subject identifier
 * @param {string} resource - The API Gateway resource ARN (wildcarded)
 * @param {{ userId: string, email: string, roles: string }} context
 * @returns {object} API Gateway Authorizer Response
 */
function buildAllowPolicy(principalId, resource, context) {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: resource,
        },
      ],
    },
    context,
  };
}

exports.handler = async (event, context) => {
  const requestId = context?.awsRequestId || "unknown";

  try {
    // Lazy-init jose (ESM dynamic import, cached after first call)
    await initJose();

    const token = event.authorizationToken.toString();

    // Verify the JWT against the JWKS endpoint with issuer and audience checks
    const { payload } = await joseModule.jwtVerify(token, JWKS, {
      issuer: process.env.AUTH_ISSUER,
      audience: process.env.AUTH_AUDIENCE,
    });

    // Extract roles from the configurable claim (default: cognito:groups)
    const rolesClaim =
      payload[process.env.AUTH_ROLES_CLAIM || "cognito:groups"] || [];

    const { roles, allowed } = checkRoles(
      rolesClaim,
      process.env.AUTH_ALLOWED_ROLES
    );

    // If the JWT has no roles claim at all (e.g. Cognito groups were removed),
    // allow the request through — the user is authenticated and downstream
    // Lambdas will check roles from the database. This supports the transition
    // period where existing tokens don't carry group claims.
    const hasRolesClaim = payload[process.env.AUTH_ROLES_CLAIM || "cognito:groups"] !== undefined;

    if (hasRolesClaim && !allowed) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          requestId,
          message: "No matching role",
          userRoles: roles,
          allowedRoles: process.env.AUTH_ALLOWED_ROLES,
        })
      );
      throw new Error("Unauthorized");
    }

    // Build the wildcarded resource ARN for the policy
    const parts = event.methodArn.split("/");
    const resource = parts.slice(0, 2).join("/") + "/*";

    const email = payload.email || payload.sub;

    console.log(
      JSON.stringify({
        level: "INFO",
        requestId,
        message: "Authorization successful",
        userId: payload.sub,
      })
    );

    return buildAllowPolicy(payload.sub, resource, {
      userId: payload.sub,
      email,
      roles: roles.join(","),
    });
  } catch (error) {
    if (error.message !== "Unauthorized") {
      console.error(
        JSON.stringify({
          level: "ERROR",
          requestId,
          message: "Authorization failed",
          error: error.message,
        })
      );
    }
    // API Gateway wants this *exact* error message, otherwise it returns 500 instead of 401
    throw new Error("Unauthorized");
  }
};

// Exported for unit testing
exports._checkRoles = checkRoles;
exports._buildAllowPolicy = buildAllowPolicy;
