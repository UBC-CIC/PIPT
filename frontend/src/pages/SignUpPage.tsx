import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';
import { authService } from '@/lib/auth';
import { useAuth } from '@/App';

/**
 * SignUpPage Component
 * 
 * Account creation page for GENRx - AI Supported Interview Evaluation 2.0
 * Handles registration and email confirmation via Cognito
 */
function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  
  // Check if we were redirected here for email confirmation
  const locationState = location.state as { email?: string; needsConfirmation?: boolean } | null;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(locationState?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(locationState?.needsConfirmation || false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

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
   * Handle sign up submission
   */
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate email before submission
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.signUp({
        email,
        password,
        firstName,
        lastName,
      });

      if (result.needsConfirmation) {
        setShowConfirmation(true);
      } else {
        // Auto-confirmed — sign in and redirect
        await authService.signIn(email, password);
        await refreshUser();
        navigate('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      
      if (message.includes('UsernameExistsException')) {
        setError('An account with this email already exists.');
      } else if (message.includes('InvalidPasswordException')) {
        setError('Password does not meet requirements (min 8 chars, uppercase, lowercase, number).');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle confirmation code submission
   */
  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.confirmSignUp(email, confirmationCode);
      // Sign in after confirmation
      await authService.signIn(email, password);
      await refreshUser();
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      
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
   * Handle log in link click
   */
  const handleLogIn = () => {
    navigate('/login');
  };

  // Show confirmation code form
  if (showConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
            Verify your email
          </h2>
          <p className="mb-8 text-sm" style={{ color: UI_COLORS.text.body }}>
            We sent a verification code to <strong>{email}</strong>. Enter it below to complete your registration.
          </p>

          {error && (
            <div 
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-6">
            <div>
              <Input
                type="text"
                placeholder="Verification Code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                maxLength={10}
                className="w-full h-12 px-4 rounded-lg text-center text-lg tracking-widest"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ 
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text,
                opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleLogIn}
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

  // Show sign up form
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-8" style={{ color: UI_COLORS.text.heading }}>
            Create your account
          </h2>

          {error && (
            <div 
              className="mb-6 p-4 rounded-lg text-sm"
              style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }}
            >
              {error}
            </div>
          )}
          
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={50}
                className="flex-1 h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
              />
              <Input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={50}
                className="flex-1 h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
                disabled={loading}
              />
            </div>

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

            <div>
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                opacity: loading ? 0.7 : 1,
              }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="mb-2" style={{ color: UI_COLORS.text.muted }}>
              Already have an account?
            </p>
            <button
              onClick={handleLogIn}
              className="underline font-medium hover:opacity-80"
              style={{ color: SIMULATION_GROUP_COLOR_PALETTE[2] }}
            >
              Log in here
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Welcome Section */}
      <div 
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12"
        style={{ 
          background: `linear-gradient(135deg, ${SIMULATION_GROUP_COLOR_PALETTE[1]} 0%, ${UI_COLORS.gradient.signupEnd} 100%)`,
          borderTopLeftRadius: '3rem',
          borderBottomLeftRadius: '3rem',
          color: UI_COLORS.button.text
        }}
      >
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold leading-tight">
            Welcome to<br />
            GENRx - AI Supported<br />
            Interview Evaluation 2.0
          </h1>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;