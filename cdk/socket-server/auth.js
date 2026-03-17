const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const AWS = require('aws-sdk');

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error(JSON.stringify({ level: "ERROR", message: "Failed to get signing key", error: err.message, kid: header.kid }));
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
        console.error(JSON.stringify({ level: "ERROR", message: "Token verification failed", error: err.message }));
        reject(err);
      } else {
        console.log(JSON.stringify({ level: "INFO", message: "Token verified successfully", userId: decoded.sub }));
        resolve(decoded);
      }
    });
  });
}

async function getStsCredentials(idToken) {
  console.log(JSON.stringify({ level: "INFO", message: "Requesting STS credentials" }));
  const cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });
  const identityId = await cognitoIdentity.getId({
    IdentityPoolId: process.env.IDENTITY_POOL_ID,
    Logins: {
      [`cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`]: idToken
    }
  }).promise();

  const credentials = await cognitoIdentity.getCredentialsForIdentity({
    IdentityId: identityId.IdentityId,
    Logins: {
      [`cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`]: idToken
    }
  }).promise();

  return credentials.Credentials;
}

module.exports = { verifyToken, getStsCredentials };