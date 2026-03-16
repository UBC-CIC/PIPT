const { initializeConnection } = require("./lib.js");
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminAddUserToGroupCommand } = require("@aws-sdk/client-cognito-identity-provider");

const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  const { userName, userPoolId } = event;
  const client = new CognitoIdentityProviderClient();

  try {
    // Get user attributes from Cognito to retrieve the email
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(getUserCommand);

    const emailAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "email"
    );
    const firstNameAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "given_name"
    );
    const lastNameAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "family_name"
    );
    
    if (!emailAttr) {
      console.error("Email attribute missing from Cognito");
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Email attribute not found in Cognito user",
        }),
      };
    }
    
    const email = emailAttr.Value;
    const firstName = firstNameAttr?.Value || "";
    const lastName = lastNameAttr?.Value || "";
    const username = `${firstName}_${lastName}`.toLowerCase().replace(/\s+/g, '_');

    // Idempotent upsert: insert new user or update last_sign_in if already exists
    const dbUser = await sqlConnection`
      INSERT INTO "users" (
        user_email, 
        username, 
        first_name, 
        last_name, 
        time_account_created, 
        roles, 
        last_sign_in
      )
      VALUES (
        ${email}, 
        ${username}, 
        ${firstName}, 
        ${lastName}, 
        CURRENT_TIMESTAMP, 
        ARRAY['student'], 
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_email) DO UPDATE SET last_sign_in = CURRENT_TIMESTAMP
      RETURNING roles;
    `;

    const dbRoles = dbUser[0]?.roles || ['student'];

    // Determine the new Cognito group based on the roles
    const newGroupName = dbRoles.length > 0 ? dbRoles[0] : "student";

    // Add the user to the new group without removing existing groups
    const addUserToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userName,
      GroupName: newGroupName,
    });
    await client.send(addUserToGroupCommand);

    return event;
  } catch (err) {
    console.error("Error assigning user to group:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
