import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { authService } from '@/lib/auth';
import { useAuth } from '@/App';
import ChangelogButton from '@/components/ChangelogButton';

/**
 * LoginPage Component
 * 
 * Authentication page for PIPT - AI Supported Interview Evaluation 2.0
 * Connects to Cognito via AWS Amplify for real authentication
 */
function LoginPage() {
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigationAttempted = useRef(false);

  // Navigate once user is authenticated after sign-in
  useEffect(() => {
    if (!waitingForAuth) return;
    if (!user) return; // Keep waiting — don't clear waitingForAuth yet
    if (navigationAttempted.current) return;
    
    navigationAttempted.current = true;
    console.log('=== NAVIGATION TRIGGERED ===');
    console.log('User:', user);
    console.log('Groups:', user.groups);
    
    if (user.groups.includes('instructor')) {
      console.log('Navigating to /instructor');
      navigate('/instructor', { replace: true });
    } else if (user.groups.includes('admin')) {
      console.log('Navigating to /admin');
      navigate('/admin', { replace: true });
    } else {
      console.log('Navigating to /');
      navigate('/', { replace: true });
    }
    
    setWaitingForAuth(false);
    setLoading(false); // Clear loading here after nav
  }, [waitingForAuth, user, navigate]);

  /**
   * Validate email format
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Handle email input change with validation
   */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  /**
   * Handle sign in submission
   */
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate email before submission
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      // Force sign out first to clear any stale sessions
      try {
        await authService.signOut();
      } catch (e) {
        // Ignore sign out errors
        console.log('Sign out before sign in (expected):', e);
      }
      
      const result = await authService.signIn(email, password);
      
      if (result.needsConfirmation) {
        // User needs to verify their email first
        navigate('/signup', { state: { email, needsConfirmation: true } });
        return;
      }

      if (result.needsNewPassword) {
        setNeedsNewPassword(true);
        setLoading(false);
        return;
      }

      const currentUser = await refreshUser(); // Gets the user directly

      if (currentUser?.groups.includes('instructor')) {
        navigate('/instructor', { replace: true });
      } else if (currentUser?.groups.includes('admin')) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message.includes('UserNotConfirmedException')) {
        navigate('/signup', { state: { email, needsConfirmation: true } });
        return;
      }
      if (message.includes('NotAuthorizedException')) {
        setError('Incorrect email or password.');
      } else if (message.includes('UserNotFoundException')) {
        setError('No account found with this email.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle create account link click
   */
  const handleCreateAccount = () => {
    navigate('/signup');
  };

  /**
   * Handle forgot password request — sends code to email
   */
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const targetEmail = resetEmail || email;
    if (!validateEmail(targetEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(targetEmail);
      setResetEmail(targetEmail);
      setResetCodeSent(true);
      setSuccessMessage('A verification code has been sent to your email.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code';
      if (message.includes('UserNotFoundException')) {
        setError('No account found with this email.');
      } else if (message.includes('LimitExceededException')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle password reset confirmation with code and new password
   */
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (resetNewPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await authService.confirmForgotPassword(resetEmail, resetCode, resetNewPassword);
      // Reset all forgot password state and show success
      setForgotPasswordMode(false);
      setResetCodeSent(false);
      setResetCode('');
      setResetEmail('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setSuccessMessage('Password reset successfully. Please sign in with your new password.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      if (message.includes('CodeMismatchException')) {
        setError('Invalid verification code. Please try again.');
      } else if (message.includes('ExpiredCodeException')) {
        setError('Verification code has expired. Please request a new one.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle new password submission for admin-created users
   */
  const handleNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      await authService.completeNewPassword(newPassword);
      const currentUser = await refreshUser();

      if (currentUser?.groups.includes('instructor')) {
        navigate('/instructor', { replace: true });
      } else if (currentUser?.groups.includes('admin')) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set new password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Show new password form for admin-created users
  if (needsNewPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
            Set New Password
          </h2>
          <p className="mb-8 text-sm" style={{ color: UI_COLORS.text.body }}>
            Your account requires a new password. Please set a permanent password to continue.
          </p>

          {error && (
            <div
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleNewPassword} className="space-y-6">
            <div>
              <Input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              style={{
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text,
              }}
              loading={loading}
            >
              Set Password & Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Show forgot password form
  if (forgotPasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
            {resetCodeSent ? 'Reset Password' : 'Forgot Password'}
          </h2>
          <p className="mb-8 text-sm" style={{ color: UI_COLORS.text.body }}>
            {resetCodeSent
              ? 'Enter the verification code sent to your email and your new password.'
              : 'Enter your email address and we\'ll send you a code to reset your password.'}
          </p>

          {error && (
            <div
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#DCFCE7', color: '#166534', borderWidth: '1px', borderStyle: 'solid', borderColor: '#BBF7D0' }}
            >
              {successMessage}
            </div>
          )}

          {!resetCodeSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={resetEmail || email}
                  onChange={(e) => setResetEmail(e.target.value)}
                  maxLength={254}
                  className="w-full h-12 px-4 rounded-lg"
                  style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-full text-base font-medium"
                style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                loading={loading}
              >
                Send Reset Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <Input
                  type="text"
                  placeholder="Verification Code"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg"
                  style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="New Password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg"
                  style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm New Password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-lg"
                  style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                  required
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 rounded-full text-base font-medium"
                style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
                loading={loading}
              >
                Reset Password
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setForgotPasswordMode(false);
                setResetCodeSent(false);
                setResetCode('');
                setResetNewPassword('');
                setResetConfirmPassword('');
                setError('');
                setSuccessMessage('');
              }}
              className="underline font-medium hover:opacity-80"
              style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Welcome Section */}
      <div 
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12"
        style={{ 
          background: `linear-gradient(135deg, ${SIMULATION_GROUP_COLOR_PALETTE[2]} 0%, ${UI_COLORS.gradient.loginEnd} 100%)`,
          borderTopRightRadius: '3rem',
          borderBottomRightRadius: '3rem',
          color: UI_COLORS.button.text
        }}
      >
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold leading-tight">
            Welcome to<br />
            PIPT - AI Supported<br />
            Interview Evaluation 2.0
          </h1>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-8" style={{ color: UI_COLORS.text.heading }}>Sign In</h2>
          
          {error && (
            <div 
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}

          {successMessage && (
            <div
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#DCFCE7', color: '#166534', borderWidth: '1px', borderStyle: 'solid', borderColor: '#BBF7D0' }}
            >
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={handleEmailChange}
                maxLength={254}
                className="w-full h-12 px-4 rounded-lg"
                style={{ 
                  backgroundColor: UI_COLORS.background.input, 
                  borderWidth: '1px', 
                  borderStyle: 'solid', 
                  borderColor: emailError ? '#ef4444' : UI_COLORS.border.light 
                }}
                required
                disabled={loading}
              />
              {emailError && (
                <p className="mt-1 text-sm" style={{ color: '#ef4444' }}>
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordMode(true);
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-sm underline hover:opacity-80"
                style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}
              >
                Forgot Password?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ 
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text,
              }}
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="mb-2" style={{ color: UI_COLORS.text.muted }}>New here?</p>
            <button
              onClick={handleCreateAccount}
              className="underline font-medium hover:opacity-80"
              style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}
            >
              Create an account
            </button>
          </div>
        </div>
      </div>

      {/* Changelog floating button */}
      <ChangelogButton />
    </div>
  );
}

export default LoginPage;