import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft } from 'lucide-react';

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

/*
  const patient = {
    id: patientId,
    name: 'Pamela',
    avatarUrl: undefined,
  };
*/

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
  const handleChatClick = (chatId: string) => {
    console.log(`Chat clicked: ${chatId}`);
    // Future: Navigate to chat details or continue chat
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex bg-gray-200 border-b border-border items-center justify-between py-6 px-8">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight text-gray-900 leading-tight text-2xl">
              Patient Dashboard
            </h1>
            <button
              onClick={handleBackToPatients}
              className="text-gray-600 hover:text-gray-900 font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
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
            className="bg-gray-800 text-white hover:bg-gray-900 px-6"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Patient Overview */}
          <div className="border-r border-gray-300 pr-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Overview</h2>
            {/* Patient overview content will be added later */}
          </div>

          {/* Right Column - Chat History */}
          <div className="pl-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Chat History</h2>
            <p className="text-sm text-gray-600 mb-4">
              Click on an in-progress chat to continue your diagnosis.<br />
              Click on a completed chat to view the AI debrief.
            </p>

            {/* Chat History Table */}
            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 text-sm">Name</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900 text-sm">Completion Status</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900 text-sm">Scores (if applicable)</th>
                  </tr>
                </thead>
                <tbody>
                  {chatHistory.map((chat) => (
                    <tr
                      key={chat.id}
                      onClick={() => handleChatClick(chat.id)}
                      className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 text-gray-900">{chat.name}</td>
                      <td className="px-6 py-4 text-gray-600 text-center">{chat.completionStatus}</td>
                      <td className="px-6 py-4 text-gray-600 text-center">{chat.score || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Start New Chat Button */}
            <Button
              onClick={handleStartNewChat}
              variant="default"
              className="bg-gray-800 text-white hover:bg-gray-900 px-6"
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
