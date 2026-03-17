const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

exports.handler = async (event, context) => {
  const requestId = context?.awsRequestId || "unknown";
  const ssmClient = new SSMClient();
  const parameterName = process.env.ALLOWED_EMAIL_DOMAINS;

  try {
    const getParameterCommand = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    });
    const data = await ssmClient.send(getParameterCommand);
    const allowedDomains = data.Parameter.Value.split(",");
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