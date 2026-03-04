// AWS Configuration for the application
export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
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
