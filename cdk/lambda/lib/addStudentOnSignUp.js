const { initializeConnection } = require("./lib.js");
const logger = require("./logger");

const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

exports.handler = async (event, context) => {
  logger.init(event, context);
  logger.info("addStudentOnSignUp invoked", { userName: event.userName });

  if (!sqlConnection) {
    logger.info("Initializing database connection");
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  try {
    // Read user attributes directly from the Cognito POST_CONFIRMATION event
    const userAttributes = event.request.userAttributes;

    const email = userAttributes.email;
    const firstName = userAttributes.given_name || "";
    const lastName = userAttributes.family_name || "";

    // event.userName is the immutable Cognito sub (e.g. "abc123-def456-...")
    const cognitoSub = event.userName || userAttributes.sub || null;

    if (!email) {
      logger.error("Email attribute missing from event userAttributes", { userName: event.userName });
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Email attribute not found in event userAttributes",
        }),
      };
    }

    const username = `${firstName}_${lastName}`.toLowerCase().replace(/\s+/g, '_');

    // Idempotent upsert: insert new user or update last_sign_in if already exists.
    // Also sets cognito_sub on insert and backfills it on subsequent sign-ins
    // (COALESCE keeps any existing value, so we never overwrite with NULL).
    await sqlConnection`
      INSERT INTO "users" (
        user_email, 
        username, 
        first_name, 
        last_name, 
        cognito_sub,
        time_account_created, 
        roles, 
        last_sign_in
      )
      VALUES (
        ${email}, 
        ${username}, 
        ${firstName}, 
        ${lastName}, 
        ${cognitoSub},
        CURRENT_TIMESTAMP, 
        ARRAY['student'], 
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_email) DO UPDATE SET 
        last_sign_in = CURRENT_TIMESTAMP,
        cognito_sub = COALESCE("users".cognito_sub, EXCLUDED.cognito_sub)
    `;

    logger.info("User upserted successfully", { email, cognitoSub });

    return event;
  } catch (err) {
    logger.error("Error creating/updating user record", { error: err.message, stack: err.stack, userName: event.userName });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
