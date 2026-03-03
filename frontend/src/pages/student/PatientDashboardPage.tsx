import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * PatientDashboardPage Component
 * 
 * Displays detailed patient information including chat history and performance metrics.
 */
function PatientDashboardPage() {
  const navigate = useNavigate();
  const { groupId, patientId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Mock patient data - will be replaced with actual data fetching
  const patient = {
    id: patientId,
    name: 'Pamela',
    pronouns: 'she/her',
    age: 56,
    sex: 'Female',
    primaryComplaint: 'Chest Pain',
    avatarUrl: undefined, // Will be replaced with S3 URL when image is uploaded
  };

  // Mock chat history data
  const chatHistory = [
    {
      id: '1',
      name: 'Attempt 4 - Feb 19, 2026',
      completionStatus: 'In Progress',
      score: null,
    },
    {
      id: '2',
      name: 'Attempt 3 - Feb 18, 2026',
      completionStatus: 'Complete',
      score: '67%',
    },
    {
      id: '3',
      name: 'Attempt 2 - Feb 14, 2026',
      completionStatus: 'Complete',
      score: '88%',
    },
    {
      id: '4',
      name: 'Attempt 1 - Jan 27, 2026',
      completionStatus: 'In Progress',
      score: null,
    },
  ];

  // Mock key questions coverage data per attempt
  const keyQuestionsCoverageData = [
    { attempt: 'Attempt 1', coverage: 45 },
    { attempt: 'Attempt 2', coverage: 72 },
    { attempt: 'Attempt 3', coverage: 58 },
    { attempt: 'Attempt 4', coverage: 0 }, // In progress, no data yet
  ];

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to patients navigation
   */
  const handleBackToPatients = () => {
    navigate(`/patients/${groupId}`);
  };

  /**
   * Handle start new chat
   */
  const handleStartNewChat = () => {
    navigate(`/patients/${groupId}/${patientId}/chat`);
  };

  /**
   * Handle chat click
   */
  const handleChatClick = (chatId: string, completionStatus: string) => {
    if (completionStatus === 'Complete') {
      // Navigate to read-only chat history page
      navigate(`/patients/${groupId}/${patientId}/chat/${chatId}/history`);
    } else {
      // Navigate to active chat page to continue
      navigate(`/patients/${groupId}/${patientId}/chat`);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: UI_COLORS.background.white }}>
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
              Patient Dashboard
            </h1>
            <button
              onClick={handleBackToPatients}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Patients
            </button>
          </div>
        </div>

        <div className="flex items-center">
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

      {/* Main Content */}
      <main className="px-8 py-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Patient Overview */}
          <div className="pr-6" style={{ borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default }}>
            <h2 className="text-xl font-semibold mb-6" style={{ color: UI_COLORS.text.heading }}>Patient Overview</h2>
            
            {/* Patient Info Card */}
            <div className="flex items-start gap-4 mb-8">
              <UserAvatar
                name={patient.name}
                imageUrl={patient.avatarUrl}
                size="large"
              />
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                  {patient.name}
                </h3>
                <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                  Pronouns: {patient.pronouns}
                </p>
                <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                  Age: {patient.age}
                </p>
                <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                  Sex: {patient.sex}
                </p>
                <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                  Primary Complaint: {patient.primaryComplaint}
                </p>
              </div>
            </div>

            {/* Overall Key Questions Coverage */}
            <div>
              <h3 className="text-xl font-semibold mb-4" style={{ color: UI_COLORS.text.heading }}>
                Overall Key Questions Coverage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={keyQuestionsCoverageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                  <XAxis 
                    dataKey="attempt" 
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    stroke={UI_COLORS.border.default}
                  />
                  <YAxis 
                    label={{ value: 'Coverage (%)', angle: -90, position: 'insideLeft', fill: UI_COLORS.text.body }}
                    tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                    domain={[0, 100]}
                    stroke={UI_COLORS.border.default}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: UI_COLORS.background.white, 
                      border: `1px solid ${UI_COLORS.border.default}`,
                      borderRadius: '6px',
                      color: UI_COLORS.text.body
                    }}
                    labelStyle={{ color: UI_COLORS.text.heading }}
                  />
                  <Legend wrapperStyle={{ color: UI_COLORS.text.body }} />
                  <Line 
                    type="monotone"
                    dataKey="coverage" 
                    stroke={SIMULATION_GROUP_COLOR_PALETTE[2]} 
                    strokeWidth={2}
                    name="Coverage (%)"
                    dot={{ fill: SIMULATION_GROUP_COLOR_PALETTE[2], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column - Chat History */}
          <div className="pl-6">
            <h2 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>Chat History</h2>
            <p className="text-sm mb-4" style={{ color: UI_COLORS.text.body }}>
              Click on an in-progress chat to continue your diagnosis.<br />
              Click on a completed chat to view the AI debrief.
            </p>

            {/* Chat History Table */}
            <div className="rounded-lg overflow-hidden mb-4" style={{ backgroundColor: UI_COLORS.background.white, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default }}>
              <table className="w-full">
                <thead style={{ backgroundColor: UI_COLORS.background.tableHeader, borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-sm" style={{ color: UI_COLORS.text.heading }}>Name</th>
                    <th className="px-6 py-3 text-center font-semibold text-sm" style={{ color: UI_COLORS.text.heading }}>Chat Completion Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chatHistory.map((chat) => (
                    <tr
                      key={chat.id}
                      onClick={() => handleChatClick(chat.id, chat.completionStatus)}
                      className="last:border-b-0 cursor-pointer transition-colors"
                      style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.light }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.background.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="px-6 py-4" style={{ color: UI_COLORS.text.heading }}>{chat.name}</td>
                      <td className="px-6 py-4 text-center" style={{ color: UI_COLORS.text.body }}>{chat.completionStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Start New Chat Button */}
            <Button
              onClick={handleStartNewChat}
              variant="default"
              className="px-6 transition-colors"
              style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
            >
              + Start New Chat
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PatientDashboardPage;
