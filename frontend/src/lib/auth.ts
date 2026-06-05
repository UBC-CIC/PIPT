// Authentication service using AWS Amplify (Cognito)
// Provider-agnostic interface — swap provider by changing this file
// Roles are fetched from the database via GET /student/me, not from JWT claims
// See: cdk/lambda/jwtAuthorizer/jwtAuthorizer.js for backend auth implementation

import { signIn, signUp, signOut, fetchAuthSession, confirmSignUp, confirmSignIn } from 'aws-amplify/auth';
import { appConfig } from '@/config/aws-config';

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
  needsNewPassword?: boolean;
}

/** Response shape from GET /student/me */
interface UserProfileResponse {
  user_email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  organization_id: string | null;
}

class AuthService {
  // Session-level cache for user profile from /student/me
  private cachedUser: AuthUser | null = null;

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    // Clear cached profile on new sign-in
    this.cachedUser = null;

    const result = await signIn({ username: email, password });

    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
      return {
        user: { username: email, email, groups: [] },
        tokens: { idToken: '', accessToken: '' },
        needsConfirmation: true,
      };
    }

    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return {
        user: { username: email, email, groups: [] },
        tokens: { idToken: '', accessToken: '' },
        needsNewPassword: true,
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

  // Complete new password challenge (for admin-created users with temporary passwords)
  async completeNewPassword(newPassword: string): Promise<AuthResult> {
    await confirmSignIn({ challengeResponse: newPassword });
    return this.buildAuthResult();
  }

  // Sign out and clear cached profile.
  // Uses global sign-out to revoke all refresh tokens server-side,
  // preventing stolen tokens from being used after the user logs out.
  async signOut(): Promise<void> {
    this.cachedUser = null;
    await signOut({ global: true });
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

  // Fetch user profile from GET /student/me using the ID token
  private async fetchUserProfile(idToken: string): Promise<AuthUser | null> {
    const endpoint = appConfig.api.endpoint.replace(/\/+$/, '');
    const url = `${endpoint}/student/me`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': idToken,
      },
    });

    if (response.status === 404) {
      // No user record in database — treat as unauthenticated
      return null;
    }

    if (!response.ok) {
      throw new Error(`/student/me returned ${response.status}`);
    }

    const profile: UserProfileResponse = await response.json();

    return {
      username: profile.user_email,
      email: profile.user_email,
      groups: profile.roles || [],
    };
  }

  // Get current authenticated user with roles from the database
  async getCurrentUser(): Promise<AuthUser | null> {
    // Return cached user if available
    if (this.cachedUser) {
      return this.cachedUser;
    }

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      if (!idToken) {
        console.log('No idToken found');
        return null;
      }

      const tokenString = idToken.toString();

      try {
        const user = await this.fetchUserProfile(tokenString);
        if (user) {
          this.cachedUser = user;
        }
        return user;
      } catch (error) {
        // Network error — return cached user if available, otherwise null
        console.error('Error fetching user profile from /student/me:', error);
        if (this.cachedUser) {
          return this.cachedUser;
        }
        return null;
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Clear the cached user profile (useful when roles may have changed)
  clearUserCache(): void {
    this.cachedUser = null;
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

  // Check if user has a specific role using cached user profile
  async hasRole(role: 'student' | 'instructor' | 'admin'): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.groups.includes(role) || false;
  }

  // Build auth result from current session
  private async buildAuthResult(): Promise<AuthResult> {
    const session = await fetchAuthSession();

    if (!session.tokens) {
      throw new Error('Failed to get user session after sign in');
    }

    const idToken = session.tokens.idToken;
    const payload = idToken?.payload;

    // Try to get full user profile from /student/me
    let user = await this.getCurrentUser();

    // Fallback: if /student/me fails, build a minimal user from the JWT payload
    // so sign-in still succeeds. Roles will be fetched on the next getCurrentUser() call.
    if (!user && payload) {
      user = {
        username: (payload.email as string) || (payload.sub as string) || '',
        email: (payload.email as string) || '',
        groups: [], // roles will be populated when /student/me becomes available
      };
      console.warn('Using fallback user from JWT — /student/me was unavailable');
    }

    if (!user) {
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
