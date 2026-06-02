const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const postgres = require("postgres");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

async function initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT) {
    try {
        console.log(JSON.stringify({ level: "INFO", message: "Initializing admin database connection" }));
        // Retrieve the secret from AWS Secrets Manager
        const getSecretValueCommand = new GetSecretValueCommand({ SecretId: SM_DB_CREDENTIALS });
        const secretResponse = await secretsManager.send(getSecretValueCommand);

        const credentials = JSON.parse(secretResponse.SecretString);

        const connectionConfig = {
            host: RDS_PROXY_ENDPOINT,
            // host: credentials.host,
            port: credentials.port,
            username: credentials.username,
            password: credentials.password,
            database: credentials.dbname,
            ssl: { rejectUnauthorized: true },
        };

        // Create the PostgreSQL connection
        // Global variable to hold the database connection
        global.sqlConnectionTableCreator = postgres(connectionConfig);

        console.log(JSON.stringify({ level: "INFO", message: "Admin database connection initialized successfully" }));
    } catch (error) {
        console.error(JSON.stringify({ level: "ERROR", message: "Error initializing admin database connection", error: error.message, stack: error.stack }));
        throw new Error("Failed to initialize database connection");
    }
}

module.exports = { initializeConnection };
