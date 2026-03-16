// App configuration — initializes AWS Amplify and exports config
import { Amplify } from 'aws-amplify';

export const appConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'ca-central-1',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID || '',
  },
  api: {
    endpoint: import.meta.env.VITE_API_ENDPOINT || '',
  },
  socket: {
    url: import.meta.env.VITE_SOCKET_URL || '',
  },
  appSync: {
    graphqlUrl: import.meta.env.VITE_APPSYNC_GRAPHQL_URL || '',
  },
};

// Configure Amplify for Cognito auth
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: appConfig.cognito.userPoolId,
      userPoolClientId: appConfig.cognito.userPoolClientId,
      identityPoolId: appConfig.cognito.identityPoolId,
      loginWith: {
        email: true,
      },
    },
  },
});

// Validate required configuration
export const validateConfig = () => {
  const required = [
    'VITE_AWS_REGION',
    'VITE_COGNITO_USER_POOL_ID',
    'VITE_COGNITO_USER_POOL_CLIENT_ID',
    'VITE_API_ENDPOINT',
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing);
  }

  return missing.length === 0;
};

// Re-export as awsConfig for backward compat
export const awsConfig = appConfig;
