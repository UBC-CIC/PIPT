const postgres = require("postgres");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

async function initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT) {
  try {
    console.log(JSON.stringify({ level: "INFO", message: "Initializing database connection" }));
    // Retrieve the secret from AWS Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({ SecretId: SM_DB_CREDENTIALS });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    const credentials = JSON.parse(secretResponse.SecretString);

    // REVIEW: ssl: false means the Node.js Lambda functions connect to RDS without TLS.
    // When rds.force_ssl is changed to '1', update this to ssl: { rejectUnauthorized: true }
    // or ssl: 'require' to match the server-side enforcement.
    const connectionConfig = {
      host: RDS_PROXY_ENDPOINT,
      port: credentials.port,
      username: credentials.username,
      password: credentials.password,
      database: credentials.dbname,
      ssl: false,
    };

    // REVIEW: The connection is stored on the global object and reused across Lambda invocations.
    // The postgres library (porsager/postgres) manages its own connection pool internally,
    // so this is efficient for warm starts. However, there is no health-check or reconnection
    // logic — if the RDS Proxy rotates the connection, the cached handle may become stale.
    // Consider adding a lightweight query (e.g., SELECT 1) to verify the connection on each invocation.
    global.sqlConnection = postgres(connectionConfig);
    
    console.log(JSON.stringify({ level: "INFO", message: "Database connection initialized successfully" }));
  } catch (error) {
    console.error(JSON.stringify({ level: "ERROR", message: "Error initializing database connection", error: error.message, stack: error.stack }));
    throw new Error("Failed to initialize database connection");
  }
}

module.exports = { initializeConnection };
