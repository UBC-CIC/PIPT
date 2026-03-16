import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageContainer from '@/components/PageContainer';
import UserAvatar from '@/components/UserAvatar';
import { ArrowLeft } from 'lucide-react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import { useAuth } from '@/App';

/**
 * PatientDashboardPage Component
 * 
 * Displays detailed patient information including chat history and performance metrics.
 */
function PatientDashboardPage() {
  const navigate = useNavigate();
  const { groupId, patientId } = useParams();
  
  const { user: authUser, signOut } = useAuth();
  const user = { name: authUser?.email || 'Student', avatarUrl: undefined };
  
  // State for showing all attempts
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  
  // Load patient data from mock data service
  const patient = mockDataService.getPatientDetail(patientId);

  // Load chat history from mock data service
  const chatHistory = mockDataService.getChatHistory();

  // Load key questions coverage data from mock data service
  const allKeyQuestionsCoverageData = mockDataService.getKeyQuestionsCoverageData();

  // Check if there are any chats
  const hasChats = chatHistory.length > 0;
  
  // Check if there's any coverage data
  const hasCoverageData = allKeyQuestionsCoverageData.some(d => d.coverage > 0);

  // Show only last 5 attempts by default
  const displayedCoverageData = showAllAttempts 
    ? allKeyQuestionsCoverageData 
    : allKeyQuestionsCoverageData.slice(-5);

  /**
   * Handle sign out event
   */
  const handleSignOut = async () => {
    await signOut();
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
    <PageContainer>
      {/* Header */}
      <header className="flex-shrink-0 flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
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
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className={hasChats ? "grid grid-cols-2 gap-6" : "max-w-4xl"}>
          {/* Left Column - Patient Overview */}
          <div className={hasChats ? "pr-6" : ""} style={hasChats ? { borderRightWidth: '1px', borderRightStyle: 'solid', borderRightColor: UI_COLORS.border.default } : {}}>
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
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold" style={{ color: UI_COLORS.text.heading }}>
                  Overall Key Questions Coverage
                </h3>
                {hasCoverageData && allKeyQuestionsCoverageData.length > 5 && (
                  <button
                    onClick={() => setShowAllAttempts(!showAllAttempts)}
                    className="text-sm px-3 py-1 rounded transition-colors"
                    style={{ 
                      backgroundColor: UI_COLORS.button.secondary, 
                      color: UI_COLORS.button.text,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                  >
                    {showAllAttempts ? 'Show Recent' : 'View All Attempts'}
                  </button>
                )}
              </div>
              
              {hasCoverageData ? (
                <>
                  {!showAllAttempts && allKeyQuestionsCoverageData.length > 5 && (
                    <p className="text-xs mb-2" style={{ color: UI_COLORS.text.muted }}>
                      Showing last 5 attempts
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={displayedCoverageData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={UI_COLORS.border.light} />
                      <XAxis 
                        dataKey="attemptNumber" 
                        tick={{ fill: UI_COLORS.text.body, fontSize: 12 }}
                        stroke={UI_COLORS.border.default}
                        label={{ value: 'Attempt Number', position: 'insideBottom', offset: -10, fill: UI_COLORS.text.body }}
                        tickFormatter={(value) => `#${value}`}
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
                </>
              ) : (
                <div 
                  className="flex items-center justify-center rounded-lg"
                  style={{ 
                    backgroundColor: UI_COLORS.background.input,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.light,
                    height: '300px'
                  }}
                >
                  <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                    Start an interaction to view key question coverage
                  </p>
                </div>
              )}
            </div>

            {/* Chat History - Show in left column when no chats */}
            {!hasChats && (
              <div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: UI_COLORS.text.heading }}>Chat History</h2>
                <p className="text-sm mb-4" style={{ color: UI_COLORS.text.body }}>
                  Click on an in-progress chat to continue your diagnosis.<br />
                  Click on a completed chat to view the AI debrief.
                </p>

                {/* Empty State */}
                <div 
                  className="rounded-lg mb-4 flex items-center justify-center"
                  style={{ 
                    backgroundColor: UI_COLORS.background.input,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: UI_COLORS.border.light,
                    padding: '3rem'
                  }}
                >
                  <p className="text-base" style={{ color: UI_COLORS.text.muted }}>
                    No chat history yet
                  </p>
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
            )}
          </div>

          {/* Right Column - Chat History (only when there are chats) */}
          {hasChats && (
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
          )}
        </div>
      </main>
    </PageContainer>
  );
}

export default PatientDashboardPage;
