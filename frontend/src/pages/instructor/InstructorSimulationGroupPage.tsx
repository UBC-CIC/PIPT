import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, BarChart3, Users, UserCog, FileText, Eye, Key, Copy } from 'lucide-react';
import { UI_COLORS } from '@/lib/colors';
import { useState } from 'react';

/**
 * InstructorSimulationGroupPage Component
 * 
 * Displays the simulation group management view for instructors.
 * Includes sidebar navigation and content area for analytics, patient management, etc.
 */
function InstructorSimulationGroupPage() {
  const navigate = useNavigate();
  useParams();
  const [activeSection, setActiveSection] = useState<'analytics' | 'patients' | 'students' | 'rubric' | 'prompt'>('analytics');
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Mock access code
  const accessCode = 'NB3W-PI3I-Q2EH-WPA3';

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to all groups navigation
   */
  const handleBackToAllGroups = () => {
    navigate('/');
  };

  /**
   * Handle student view navigation
   */
  const handleStudentView = () => {
    navigate('/student');
  };

  /**
   * Handle generate new access code
   */
  const handleGenerateAccessCode = () => {
    // TODO: Implement access code generation
    console.log('Generate new access code');
  };

  /**
   * Handle copy access code
   */
  const handleCopyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: UI_COLORS.background.white }}>
      {/* Header */}
      <header className="flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
              Simulation Group View
            </h1>
            <button
              onClick={handleBackToAllGroups}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Groups
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleStudentView}
            className="px-6 transition-colors"
            style={{ 
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading
            }}
          >
            Student View
          </Button>
          
          <Button
            variant="default"
            onClick={handleSignOut}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r flex flex-col" style={{ backgroundColor: UI_COLORS.background.white, borderColor: UI_COLORS.border.default }}>
          {/* Navigation Buttons */}
          <nav className="flex-1 p-4 space-y-2">
          <Button
            onClick={() => setActiveSection('analytics')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'analytics' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </Button>

          <Button
            onClick={() => setActiveSection('patients')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'patients' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <Users className="w-5 h-5" />
            Manage Patients
          </Button>

          <Button
            onClick={() => setActiveSection('students')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'students' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <UserCog className="w-5 h-5" />
            Manage Students
          </Button>

          <Button
            onClick={() => setActiveSection('rubric')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'rubric' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <FileText className="w-5 h-5" />
            Global Rubric
          </Button>

          <Button
            onClick={() => setActiveSection('prompt')}
            variant="ghost"
            className="w-full justify-start gap-3 px-4 py-2.5 h-auto font-medium"
            style={{
              backgroundColor: activeSection === 'prompt' ? UI_COLORS.background.tableHeader : 'transparent',
              color: UI_COLORS.text.heading
            }}
          >
            <Eye className="w-5 h-5" />
            View Evaluation Prompt
          </Button>
        </nav>

        {/* Access Code Section */}
        <div className="border-t p-4 space-y-3" style={{ borderColor: UI_COLORS.border.default }}>
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: UI_COLORS.text.body }}>
              Access Code
            </p>
            <div className="flex items-center gap-2 p-3 rounded-md border" style={{ 
              backgroundColor: UI_COLORS.background.tableHeader,
              borderColor: UI_COLORS.border.default
            }}>
              <Key className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
              <span className="font-mono text-sm flex-1" style={{ color: UI_COLORS.text.heading }}>
                {accessCode}
              </span>
              <button
                onClick={handleCopyAccessCode}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                style={{ border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                title="Copy access code"
              >
                <Copy className="w-4 h-4" style={{ color: UI_COLORS.text.body }} />
              </button>
            </div>
          </div>
          
          <Button
            onClick={handleGenerateAccessCode}
            variant="outline"
            className="w-full justify-center gap-2 py-2.5 h-auto font-medium"
            style={{
              borderColor: UI_COLORS.border.default,
              color: UI_COLORS.text.heading
            }}
          >
            Generate new access code
          </Button>
        </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-8">
          {activeSection === 'analytics' && (
            <div>
              {/* Analytics content will go here */}
            </div>
          )}
          
          {activeSection === 'patients' && (
            <div>
              {/* Manage Patients content will go here */}
            </div>
          )}
          
          {activeSection === 'students' && (
            <div>
              {/* Manage Students content will go here */}
            </div>
          )}
          
          {activeSection === 'rubric' && (
            <div>
              {/* Global Rubric content will go here */}
            </div>
          )}
          
          {activeSection === 'prompt' && (
            <div>
              {/* View Evaluation Prompt content will go here */}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default InstructorSimulationGroupPage;
