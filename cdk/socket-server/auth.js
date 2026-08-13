const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const AWS = require('aws-sdk');
const logger = require('./logger');

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error("Failed to get signing key", { component: "auth", operation: "getKey", kid: header.kid, error: err.message });
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: process.env.COGNITO_CLIENT_ID,
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        logger.error("Token verification failed", { component: "auth", operation: "verifyToken", error: err.message });
        reject(err);
      } else {
        logger.info("Token verified successfully", { component: "auth", operation: "verifyToken", userId: decoded.sub });
        resolve(decoded);
      }
    });
  });
}

async function getStsCredentials(idToken) {
  logger.info("Requesting STS credentials", { component: "auth", operation: "getStsCredentials" });
  const cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });
  const loginProvider = `cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
  try {
    const identityId = await cognitoIdentity.getId({
      IdentityPoolId: process.env.IDENTITY_POOL_ID,
      Logins: { [loginProvider]: idToken },
    }).promise();

    const credentials = await cognitoIdentity.getCredentialsForIdentity({
      IdentityId: identityId.IdentityId,
      Logins: { [loginProvider]: idToken },
    }).promise();

    logger.info("STS credentials issued", {
      component: "auth",
      operation: "getStsCredentials",
      expiration: credentials.Credentials?.Expiration,
    });
    return credentials.Credentials;
  } catch (err) {
    logger.error("Failed to obtain STS credentials", {
      component: "auth",
      operation: "getStsCredentials",
      error: err.message,
    });
    throw err;
  }
}

module.exports = { verifyToken, getStsCredentials };