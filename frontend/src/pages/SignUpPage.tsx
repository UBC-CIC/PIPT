import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';

/**
 * SignUpPage Component
 * 
 * Account creation page for GENRx - AI Supported Interview Evaluation 2.0
 * Provides registration form with first name, last name, email, and password fields
 */
function SignUpPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');

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
   * Phase 1: Navigates to student dashboard
   * Future: Will call registration API
   */
  const handleSignUp = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate email before submission
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        console.error('Passwords do not match');
        return;
      }
      console.log('Sign up attempt:', { firstName, lastName, email });
      // Future: Call registration API
      navigate('/');
    } catch (error) {
      console.error('Error during sign up:', error);
    }
  };

  /**
   * Handle log in link click
   * Navigates to login page
   */
  const handleLogIn = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-8" style={{ color: UI_COLORS.text.heading }}>
            Create your account
          </h2>
          
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
              />
              <Input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="flex-1 h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
              />
            </div>

            <div>
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={handleEmailChange}
                className="w-full h-12 px-4 rounded-lg"
                style={{ 
                  backgroundColor: UI_COLORS.background.input, 
                  borderWidth: '1px', 
                  borderStyle: 'solid', 
                  borderColor: emailError ? '#ef4444' : UI_COLORS.border.light 
                }}
                required
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
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ 
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text
              }}
            >
              Sign Up
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
