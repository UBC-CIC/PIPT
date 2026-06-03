const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient();
let cachedAllowedDomains = null;

async function getAllowedDomains() {
  if (!cachedAllowedDomains) {
    const parameterName = process.env.ALLOWED_EMAIL_DOMAINS;
    const data = await ssmClient.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true })
    );
    cachedAllowedDomains = data.Parameter.Value.split(",");
  }
  return cachedAllowedDomains;
}

exports.handler = async (event, context) => {
  const requestId = context?.awsRequestId || "unknown";

  try {
    const allowedDomains = await getAllowedDomains();
    const email = event.request.userAttributes.email;
    const emailDomain = email.split("@")[1];

    if (!allowedDomains.includes(emailDomain)) {
      console.error(JSON.stringify({ level: "WARN", requestId, message: "Signup blocked for disallowed domain", emailDomain }));
      throw new Error(`Signup not allowed for email domain: ${emailDomain}`);
    }

    console.log(JSON.stringify({ level: "INFO", requestId, message: "Pre-signup validation passed", emailDomain }));
    return event;
  } catch (error) {
    console.error(JSON.stringify({ level: "ERROR", requestId, message: "Pre-signup validation failed", error: error.message }));
    throw new Error("Error validating email domain during pre-signup.");
  }
};