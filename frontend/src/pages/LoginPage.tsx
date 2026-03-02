import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';

/**
 * LoginPage Component
 * 
 * Authentication page for GENRx - AI Supported Interview Evaluation 2.0
 * Provides username/password login and account creation link
 */
function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  /**
   * Handle sign in submission
   * Phase 1: Navigates to student dashboard
   * Future: Will call authentication API
   */
  const handleSignIn = (e: React.ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      console.log('Sign in attempt:', { username });
      // Future: Call authentication API
      navigate('/');
    } catch (error) {
      console.error('Error during sign in:', error);
    }
  };

  /**
   * Handle create account link click
   * Navigates to sign up page
   */
  const handleCreateAccount = () => {
    navigate('/signup');
  };

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
            GENRx - AI Supported<br />
            Interview Evaluation 2.0
          </h1>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: UI_COLORS.background.white }}>
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold mb-8" style={{ color: UI_COLORS.text.heading }}>Sign In</h2>
          
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 px-4 rounded-lg"
                style={{ backgroundColor: UI_COLORS.background.input, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.light }}
                required
              />
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

            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium"
              style={{ 
                backgroundColor: UI_COLORS.button.primary,
                color: UI_COLORS.button.text
              }}
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
    </div>
  );
}

export default LoginPage;
