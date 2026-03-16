// Authentication service using AWS Amplify (Cognito)
// Provider-agnostic interface — swap provider by changing this file
// See: cdk/lambda/studentAuthorizerFunction/studentAuthorizerFunction.js for backend decoupling plan

import { signIn, signUp, signOut, fetchAuthSession, getCurrentUser, confirmSignUp } from 'aws-amplify/auth';

export interface AuthTokens {
  idToken: string;
  accessToken: string;
}

export interface AuthUser {
  username: string;
  email: string;
  groups: string[];
}

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
  needsConfirmation?: boolean;
}

class AuthService {
  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    const result = await signIn({ username: email, password });

    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
      return {
        user: { username: email, email, groups: [] },
        tokens: { idToken: '', accessToken: '' },
        needsConfirmation: true,
      };
    }

    return this.buildAuthResult();
  }

  // Sign up with email, password, and name
  async signUp(params: SignUpParams): Promise<{ needsConfirmation: boolean }> {
    const result = await signUp({
      username: params.email,
      password: params.password,
      options: {
        userAttributes: {
          email: params.email,
          given_name: params.firstName,
          family_name: params.lastName,
        },
      },
    });

    return {
      needsConfirmation: result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP',
    };
  }

  // Confirm sign up with verification code
  async confirmSignUp(email: string, code: string): Promise<void> {
    await confirmSignUp({ username: email, confirmationCode: code });
  }

  // Sign out
  async signOut(): Promise<void> {
    await signOut();
  }

  // Get current ID token for API requests
  async getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      if (!idToken) return null;

      const payload = idToken.payload;
      const user = await getCurrentUser();

      return {
        username: user.username,
        email: (payload.email as string) || user.username,
        groups: (payload['cognito:groups'] as string[]) || [],
      };
    } catch {
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      return !!session.tokens?.idToken;
    } catch {
      return false;
    }
  }

  // Check if user has a specific role
  async hasRole(role: 'student' | 'instructor' | 'admin'): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.groups.includes(role) || false;
  }

  // Build auth result from current session
  private async buildAuthResult(): Promise<AuthResult> {
    const session = await fetchAuthSession();
    const user = await this.getCurrentUser();

    if (!user || !session.tokens) {
      throw new Error('Failed to get user session after sign in');
    }

    return {
      user,
      tokens: {
        idToken: session.tokens.idToken?.toString() || '',
        accessToken: session.tokens.accessToken?.toString() || '',
      },
    };
  }
}

export const authService = new AuthService();
